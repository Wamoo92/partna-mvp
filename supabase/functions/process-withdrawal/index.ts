import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CARRIER_FEE, PARTNA_WITHDRAWAL_FEE_PERCENT, formatUGX } from '../_shared/fees.ts'

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

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}
function toOpenFloatNetwork(network: string): string {
  if (network === 'mtn') return 'MTN'
  if (network === 'airtel') return 'AirtelMoney'
  return network
}

async function sendSMS(customerId: string, phone: string, event: string, vars: Record<string, string>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

// Server-side withdrawal request. Replaces Withdraw.jsx handleWithdraw. Debits the
// wallet with an optimistic lock and records a pending withdrawal + its fees.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { enrollmentId, amount } = await req.json()
    if (!enrollmentId || amount == null) return json({ error: 'Missing required fields' }, req, 400)

    const amt = Math.floor(Number(amount))
    if (isNaN(amt) || amt < 5000) return json({ error: 'Minimum withdrawal is UGX 5,000.' }, req, 400)

    // ── Authenticate + ownership ──────────────────────────────────────────
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, phone, payment_network, payment_number').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

    // Withdrawals always go to the customer's SAVED payment source (set in Profile).
    if (!customer.payment_network || !customer.payment_number) {
      return json({ error: 'Please add a mobile money payment source in your profile before withdrawing.' }, req, 400)
    }

    const { data: enrollment } = await supabase
      .from('customer_campaigns').select('id, customer_id, campaign_id, wallet_id, status')
      .eq('id', enrollmentId).maybeSingle()
    if (!enrollment || enrollment.customer_id !== customer.id) return json({ error: 'Forbidden' }, req, 403)
    if (enrollment.status !== 'active') return json({ error: 'Enrollment is not active' }, req, 400)

    const { data: wallet } = await supabase
      .from('wallets').select('id, balance').eq('id', enrollment.wallet_id).maybeSingle()
    if (!wallet) return json({ error: 'Wallet not found' }, req, 404)
    const balance = Number(wallet.balance)
    if (balance < amt) return json({ error: `Insufficient balance. Your wallet has ${formatUGX(balance)}.` }, req, 400)

    const savedNetwork     = String(customer.payment_network)
    const openFloatNetwork = toOpenFloatNetwork(savedNetwork)
    const networkLabel     = savedNetwork === 'mtn' ? 'MTN MoMo' : savedNetwork === 'airtel' ? 'Airtel Money' : openFloatNetwork
    const payoutPhone      = String(customer.payment_number).replace(/\s/g, '')
    const partnaFee  = Math.round(amt * PARTNA_WITHDRAWAL_FEE_PERCENT)
    const totalFees  = partnaFee + CARRIER_FEE
    const netAmount  = Math.max(0, amt - totalFees)   // amount actually disbursed to mobile money
    const reference  = generateReference()

    // ── Atomic: debit wallet + record pending withdrawal + fees in ONE txn ──
    // amt = gross debited from the wallet; the NET (after fees) is paid out to the
    // customer's mobile money (transaction_fees.net_amount).
    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_withdrawal_tx', {
      p_wallet_id:        wallet.id,
      p_customer_id:      customer.id,
      p_campaign_id:      enrollment.campaign_id,
      p_amount:           amt,
      p_network:          openFloatNetwork,
      p_withdrawal_phone: payoutPhone,
      p_reference:        reference,
      p_notes:            `Payout UGX ${netAmount.toLocaleString()} to ${networkLabel} ${payoutPhone} (gross UGX ${amt.toLocaleString()} − fees UGX ${totalFees.toLocaleString()})`,
      p_partna_fee:       partnaFee,
      p_carrier_fee:      CARRIER_FEE,
      p_total_fees:       totalFees,
      p_net_amount:       netAmount,
    })
    if (rpcErr) {
      const msg = rpcErr.message || ''
      if (msg.includes('INSUFFICIENT_BALANCE')) return json({ error: `Insufficient balance. Your wallet has ${formatUGX(balance)}.` }, req, 400)
      if (msg.includes('WALLET_NOT_FOUND'))     return json({ error: 'Wallet not found' }, req, 404)
      console.error('process-withdrawal: RPC failed', rpcErr)
      return json({ error: 'Could not process withdrawal. Please try again.' }, req, 500)
    }
    const newBalance = Number(rpcData?.new_balance ?? (balance - amt))

    const smsPhone = customer.phone || payoutPhone
    await sendSMS(customer.id, smsPhone, 'withdrawal_requested', { amount: formatUGX(amt), reference })

    return json({ success: true, reference, newBalance, netAmount }, req)

  } catch (e) {
    console.error('process-withdrawal error:', e)
    return json({ error: 'Withdrawal failed. Please try again.' }, req, 500)
  }
})
