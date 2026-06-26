import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VIRTUAL_FEE       = 5000
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
  return 'CRD-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

Deno.serve(async (req) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // Verify JWT and get customer
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: CORS })

    // ── Get customer record ───────────────────────────────────────────────
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, business_id, first_name, last_name, phone, businesses(subscription_package)')
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

    // ── Check no existing active subscription ─────────────────────────────
    const { data: existing } = await supabase
      .from('card_subscriptions')
      .select('id, status')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'grace_period'])
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Customer already has an active card subscription' }), { status: 409, headers: CORS })
    }

    // ── Get wallet (scoped to the customer's active enrollment) ───────────
    // A customer can now have multiple wallets (one per enrollment), so look the
    // wallet up via the active enrollment instead of .maybeSingle() on
    // customer_id (which errors when more than one wallet exists).
    const { data: enrollment } = await supabase
      .from('customer_campaigns')
      .select('wallet_id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!enrollment?.wallet_id) {
      return new Response(JSON.stringify({ error: 'No active savings wallet found. Please join a campaign first.' }), { status: 404, headers: CORS })
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('id', enrollment.wallet_id)
      .maybeSingle()

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), { status: 404, headers: CORS })
    }

    if (Number(wallet.balance) < VIRTUAL_FEE) {
      return new Response(JSON.stringify({
        error: `Insufficient balance. You need UGX ${VIRTUAL_FEE.toLocaleString()} to activate your card. Your current balance is UGX ${Number(wallet.balance).toLocaleString()}.`
      }), { status: 400, headers: CORS })
    }

    // ── Deduct from wallet ────────────────────────────────────────────────
    const newBalance = Number(wallet.balance) - VIRTUAL_FEE
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id)

    if (walletUpdateError) {
      return new Response(JSON.stringify({ error: 'Failed to deduct activation fee. Please try again.' }), { status: 500, headers: CORS })
    }

    // ── Calculate billing dates ───────────────────────────────────────────
    const now           = new Date()
    const nextBilling   = new Date(now)
    nextBilling.setMonth(nextBilling.getMonth() + 1)
    const nextBillingDate = nextBilling.toISOString().slice(0, 10)

    // ── Create card subscription ──────────────────────────────────────────
    const { data: subscription, error: subError } = await supabase
      .from('card_subscriptions')
      .insert({
        customer_id:          customer.id,
        wallet_id:            wallet.id,
        business_id:          customer.business_id,
        card_type:            'virtual',
        status:               'active',
        virtual_activated_at: now.toISOString(),
        monthly_fee:          VIRTUAL_FEE,
        next_billing_date:    nextBillingDate,
        last_billed_at:       now.toISOString(),
      })
      .select()
      .single()

    if (subError || !subscription) {
      // Rollback wallet deduction
      await supabase.from('wallets').update({ balance: Number(wallet.balance), updated_at: new Date().toISOString() }).eq('id', wallet.id)
      return new Response(JSON.stringify({ error: 'Failed to create card subscription. Fee has been refunded.' }), { status: 500, headers: CORS })
    }

    // ── Record transaction ────────────────────────────────────────────────
    const reference = generateReference()
    const { error: txnError } = await supabase
      .from('card_subscription_transactions')
      .insert({
        customer_id:     customer.id,
        wallet_id:       wallet.id,
        subscription_id: subscription.id,
        type:            'virtual_activation_fee',
        amount:          VIRTUAL_FEE,
        status:          'completed',
        reference,
        notes:           'Virtual card activation fee — first month subscription',
      })

    if (txnError) {
      // Non-fatal — subscription and deduction succeeded, just log
      console.error('Failed to record activation transaction:', txnError)
    }

    return new Response(JSON.stringify({
      success:      true,
      subscription: {
        id:               subscription.id,
        card_type:        subscription.card_type,
        status:           subscription.status,
        next_billing_date: subscription.next_billing_date,
        monthly_fee:      subscription.monthly_fee,
      },
      new_balance:  newBalance,
      reference,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('activate-card error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS })
  }
})