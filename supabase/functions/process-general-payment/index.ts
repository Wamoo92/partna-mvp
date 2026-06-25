import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
const json = (data: unknown, req: Request, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

function formatUGX(n: number): string {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

// Server-side general/retail savings payment. Replaces Pay.jsx handleGeneralPay.
// All amounts (remaining, discount, full-vs-partial) are recomputed server-side;
// the only client input trusted is the enrollmentId and the requested amount.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { enrollmentId, amount } = await req.json()
    if (!enrollmentId || amount == null) return json({ error: 'Missing required fields' }, req, 400)

    const payAmount = Math.floor(Number(amount))
    if (isNaN(payAmount) || payAmount < 1000) return json({ error: 'Invalid payment amount' }, req, 400)

    // ── Authenticate + ownership ──────────────────────────────────────────
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, business_id').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

    const { data: enrollment } = await supabase
      .from('customer_campaigns').select('id, customer_id, campaign_id, wallet_id, status')
      .eq('id', enrollmentId).maybeSingle()
    if (!enrollment || enrollment.customer_id !== customer.id) return json({ error: 'Forbidden' }, req, 403)
    if (enrollment.status !== 'active') return json({ error: 'Enrollment is not active' }, req, 400)

    const { data: campaign } = await supabase
      .from('campaigns').select('id, business_id, name, target_amount').eq('id', enrollment.campaign_id).maybeSingle()
    if (!campaign) return json({ error: 'Campaign not found' }, req, 404)

    const { data: wallet } = await supabase
      .from('wallets').select('id, balance').eq('id', enrollment.wallet_id).maybeSingle()
    if (!wallet) return json({ error: 'Wallet not found' }, req, 404)
    const balance = Number(wallet.balance)

    // ── Recompute remaining + discount server-side (do not trust client) ──
    const { data: paidRows } = await supabase
      .from('transactions').select('amount').eq('customer_id', customer.id).eq('campaign_id', campaign.id).eq('type', 'payment')
    const alreadyPaid = (paidRows || []).reduce((s: number, t: any) => s + Number(t.amount), 0)

    const { data: discount } = await supabase
      .from('customer_discounts').select('id, discount_percentage')
      .eq('customer_id', customer.id).eq('campaign_id', campaign.id).eq('is_used', false).maybeSingle()
    const discountPct    = discount ? Number(discount.discount_percentage) : 0
    const target         = Number(campaign.target_amount || 0)
    const rawRemaining   = Math.max(target - alreadyPaid, 0)
    const discountAmount = discountPct > 0 ? Math.round(rawRemaining * (discountPct / 100)) : 0
    const remaining      = Math.max(rawRemaining - discountAmount, 0)

    if (balance < payAmount) {
      return json({ error: `Insufficient balance. Your wallet has ${formatUGX(balance)}.`, blocked: true }, req, 400)
    }
    if (remaining > 0 && payAmount > remaining) {
      return json({ error: `Payment exceeds the remaining ${formatUGX(remaining)}.`, blocked: true }, req, 400)
    }

    const fullPayment = payAmount >= remaining
    const partnaFee   = Math.round(payAmount * 0.01)
    const reference   = generateReference()

    // ── Debit wallet with an optimistic lock (rejects on lost-update race) ─
    const { data: debited } = await supabase
      .from('wallets').update({ balance: balance - payAmount, updated_at: new Date().toISOString() })
      .eq('id', wallet.id).eq('balance', balance).select('id')
    if (!debited || debited.length === 0) {
      return json({ error: 'Your balance changed during processing. Please try again.' }, req, 409)
    }

    // ── Record the transaction ───────────────────────────────────────────
    const { data: txnRows } = await supabase.from('transactions').insert({
      customer_id: customer.id, wallet_id: wallet.id, campaign_id: campaign.id,
      type: 'payment', amount: payAmount, status: 'completed', reference,
      notes: discountPct > 0 ? `Discount prize applied: ${discountPct}% (${formatUGX(discountAmount)} saved)` : null,
    }).select('id')
    const txnId = txnRows?.[0]?.id || null

    if (txnId) {
      await supabase.from('transaction_fees').insert({
        transaction_id: txnId, customer_id: customer.id, fee_type: 'payment', charged_to: 'business',
        partna_fee: partnaFee, carrier_fee: 0, tax: 0, total_fees: partnaFee, net_amount: payAmount - partnaFee,
      })
    }

    // ── Full payment: credit escrow (campaign's business) + record sale ───
    if (fullPayment) {
      const { data: escrow } = await supabase
        .from('escrow_wallets').select('id, balance').eq('business_id', campaign.business_id).maybeSingle()
      if (escrow) {
        await supabase.from('escrow_wallets').update({ balance: Number(escrow.balance) + payAmount }).eq('id', escrow.id)
      } else {
        await supabase.from('escrow_wallets').insert({ business_id: campaign.business_id, balance: payAmount })
      }
      await supabase.from('sales').insert({
        business_id: campaign.business_id, customer_id: customer.id, campaign_id: campaign.id,
        transaction_id: txnId, amount: payAmount, type: 'retail', status: 'pending', is_prize: false,
        notes: discountPct > 0 ? `Discount prize applied: ${discountPct}% off` : null,
      })
    }

    if (discount) await supabase.from('customer_discounts').update({ is_used: true }).eq('id', discount.id)

    return json({
      success: true, reference, newBalance: balance - payAmount, isFullPayment: fullPayment,
    }, req)

  } catch (e) {
    console.error('process-general-payment error:', e)
    return json({ error: 'Payment processing failed. Please try again.' }, req, 500)
  }
})
