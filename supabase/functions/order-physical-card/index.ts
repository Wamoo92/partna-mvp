import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ISSUING_FEE      = 20000
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
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