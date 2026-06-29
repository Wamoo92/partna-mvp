import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { CARRIER_FEE, EARLY_EXIT_FEE_PERCENT } from '../_shared/fees.ts'

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

// Server-side "leave campaign". Replaces Profile.jsx handleLeaveCampaign. Marks the
// caller's own enrollment left, zeroes the wallet, and records a pending refund
// (10% exit fee), all under an ownership check.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { enrollmentId } = await req.json()
    if (!enrollmentId) return json({ error: 'Missing enrollmentId' }, req, 400)

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, phone, payment_network, payment_number').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

    const { data: enrollment } = await supabase
      .from('customer_campaigns').select('id, customer_id, campaign_id, wallet_id, status')
      .eq('id', enrollmentId).maybeSingle()
    if (!enrollment || enrollment.customer_id !== customer.id) return json({ error: 'Forbidden' }, req, 403)
    if (enrollment.status !== 'active') return json({ error: 'Enrollment is not active' }, req, 400)

    const { data: wallet } = await supabase
      .from('wallets').select('id, balance').eq('id', enrollment.wallet_id).maybeSingle()
    const balance    = Number(wallet?.balance || 0)
    const fee        = Math.round(balance * EARLY_EXIT_FEE_PERCENT)  // early-exit fee (Partna)
    const carrierFee = balance > 0 ? CARRIER_FEE : 0          // mobile-money payout fee
    const refund     = Math.max(0, balance - fee - carrierFee)

    await supabase.from('customer_campaigns')
      .update({ status: 'left', left_at: new Date().toISOString() }).eq('id', enrollment.id)

    if (wallet) {
      await supabase.from('wallets').update({ balance: 0, updated_at: new Date().toISOString() }).eq('id', wallet.id)
    }

    if (balance > 0) {
      // The refund is paid out to the customer's saved mobile-money account, so stamp
      // the payout phone/network onto the transaction — otherwise the OpenFloat export
      // has a blank Account Number for refund rows.
      const payoutNetwork = customer.payment_network === 'mtn' ? 'MTN'
        : customer.payment_network === 'airtel' ? 'AirtelMoney'
        : (customer.payment_network || null)
      const payoutPhone = customer.payment_number || customer.phone || null

      const { data: refundTxn } = await supabase.from('transactions').insert({
        customer_id: customer.id, wallet_id: wallet?.id || null, campaign_id: enrollment.campaign_id,
        type: 'withdrawal', amount: balance, status: 'pending',
        network: payoutNetwork, withdrawal_network: payoutNetwork, withdrawal_phone: payoutPhone,
        notes: `Campaign left — refund pending. Exit fee: UGX ${fee.toLocaleString()}, mobile money fee: UGX ${carrierFee.toLocaleString()}. Net refund: UGX ${refund.toLocaleString()}`,
      }).select('id').single()

      // Link the fee row to the refund transaction so the net amount is recoverable
      // (the OpenFloat amount comes from transaction_fees.net_amount).
      await supabase.from('transaction_fees').insert({
        transaction_id: refundTxn?.id || null,
        customer_id: customer.id, fee_type: 'leave_campaign', charged_to: 'user',
        partna_fee: fee, carrier_fee: carrierFee, tax: 0, total_fees: fee + carrierFee, net_amount: refund,
      })
    }

    return json({ success: true, fee, carrierFee, refund }, req)

  } catch (e) {
    console.error('leave-campaign error:', e)
    return json({ error: 'Could not leave the campaign. Please try again.' }, req, 500)
  }
})
