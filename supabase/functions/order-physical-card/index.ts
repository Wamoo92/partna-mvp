import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ISSUING_FEE      = 20000
function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('origin') || ''
  const allowed = (
    origin === 'https://www.partna.io' ||
    origin === 'https://partna.io'     ||
    origin.endsWith('.partna.io')      ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:3000'
  )
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://www.partna.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function generateReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return 'ISS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateCollectionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  // Keep generating until we get one that doesn't exist (checked below)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function sendCardEmail(to: string, subject: string, html: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
      body:    JSON.stringify({ to, subject, html, from: 'support' }),
    })
  } catch (e) { console.error('order-physical-card email error (non-critical):', e) }
}
function cardOrderEmailHtml({ customerName, businessName, collectionCode }: Record<string, string>): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px;">Your physical card is on the way</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your ${businessName} physical Partna card has been ordered. It will be ready for
        collection at ${businessName} within 5–7 working days.
      </p>
      <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; padding: 16px; text-align: center; margin: 0 0 24px;">
        <p style="font-size: 12px; color: #959687; margin: 0 0 6px;">Your collection code</p>
        <p style="font-size: 26px; font-weight: 700; font-family: monospace; letter-spacing: 0.18em; margin: 0; color: #111;">${collectionCode}</p>
      </div>
      <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Bring your National ID and this collection code to ${businessName} to collect your card.
      </p>
      <p style="font-size: 13px; color: #959687; line-height: 1.6; margin: 0;">
        The UGX 20,000 issuing fee has been charged. Your monthly subscription will be UGX 10,000 from the date your
        card is delivered. Questions? Contact <a href="mailto:support@partna.io" style="color:#111;font-weight:600;">support@partna.io</a>.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">Powered by Partna</p>
    </div>`
}

Deno.serve(async (req) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

    // ── Get customer record ───────────────────────────────────────────────
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, business_id, first_name, last_name, phone, email, businesses(subscription_package, name)')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (custError || !customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404, headers: CORS })
    }

    // ── Check business plan allows card ───────────────────────────────────
    const plan = customer.businesses?.subscription_package || 'starter'
    if (plan === 'starter') {
      return new Response(JSON.stringify({ error: 'Card feature not available on Starter plan' }), { status: 403, headers: CORS })
    }

    // ── Get active card subscription ──────────────────────────────────────
    const { data: subscription, error: subError } = await supabase
      .from('card_subscriptions')
      .select('*')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'grace_period'])
      .maybeSingle()

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'No active card subscription found. Please activate your virtual card first.' }), { status: 404, headers: CORS })
    }

    // ── Check physical card not already ordered ───────────────────────────
    if (subscription.physical_status) {
      return new Response(JSON.stringify({
        error: `Physical card already ${subscription.physical_status}. You cannot place a new order.`
      }), { status: 409, headers: CORS })
    }

    // ── Get wallet ────────────────────────────────────────────────────────
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('id', subscription.wallet_id)
      .maybeSingle()

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), { status: 404, headers: CORS })
    }

    if (Number(wallet.balance) < ISSUING_FEE) {
      return new Response(JSON.stringify({
        error: `Insufficient balance. You need UGX ${ISSUING_FEE.toLocaleString()} for the card issuing fee. Your current balance is UGX ${Number(wallet.balance).toLocaleString()}.`
      }), { status: 400, headers: CORS })
    }

    // ── Generate unique collection code ───────────────────────────────────
    let collectionCode = ''
    let codeIsUnique   = false
    let attempts       = 0

    while (!codeIsUnique && attempts < 10) {
      const candidate = generateCollectionCode()
      const { data: existing } = await supabase
        .from('card_subscriptions')
        .select('id')
        .eq('collection_code', candidate)
        .maybeSingle()
      if (!existing) {
        collectionCode = candidate
        codeIsUnique   = true
      }
      attempts++
    }

    if (!collectionCode) {
      return new Response(JSON.stringify({ error: 'Could not generate a unique collection code. Please try again.' }), { status: 500, headers: CORS })
    }

    // ── Deduct issuing fee from wallet ────────────────────────────────────
    const newBalance = Number(wallet.balance) - ISSUING_FEE
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id)

    if (walletUpdateError) {
      return new Response(JSON.stringify({ error: 'Failed to deduct issuing fee. Please try again.' }), { status: 500, headers: CORS })
    }

    // ── Update subscription record ────────────────────────────────────────
    const now = new Date()
    const { data: updatedSub, error: updateError } = await supabase
      .from('card_subscriptions')
      .update({
        physical_status:    'ordered',
        physical_ordered_at: now.toISOString(),
        issuing_fee_paid:   true,
        issuing_fee_paid_at: now.toISOString(),
        collection_code:    collectionCode,
        updated_at:         now.toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (updateError || !updatedSub) {
      // Rollback wallet deduction
      await supabase.from('wallets').update({ balance: Number(wallet.balance), updated_at: new Date().toISOString() }).eq('id', wallet.id)
      return new Response(JSON.stringify({ error: 'Failed to update subscription. Issuing fee has been refunded.' }), { status: 500, headers: CORS })
    }

    // ── Record issuing fee transaction ────────────────────────────────────
    const reference = generateReference()
    const { error: txnError } = await supabase
      .from('card_subscription_transactions')
      .insert({
        customer_id:     customer.id,
        wallet_id:       wallet.id,
        subscription_id: subscription.id,
        type:            'physical_issuing_fee',
        amount:          ISSUING_FEE,
        status:          'completed',
        reference,
        notes:           'Physical card one-time issuing fee',
      })

    if (txnError) {
      console.error('Failed to record issuing fee transaction:', txnError)
    }

    // ── Send order confirmation email (server-side, non-blocking) ─────────
    if (customer.email) {
      const businessName = (customer.businesses as any)?.name || 'Partna'
      await sendCardEmail(
        customer.email,
        `Your ${businessName} physical card order — collection code inside`,
        cardOrderEmailHtml({
          customerName:   `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'there',
          businessName,
          collectionCode,
        })
      )
    }

    return new Response(JSON.stringify({
      success:         true,
      collection_code: collectionCode,
      physical_status: 'ordered',
      new_balance:     newBalance,
      reference,
      message:         'Your physical card order has been placed. You will receive an email with your collection code when your card is ready for collection.',
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('order-physical-card error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS })
  }
})