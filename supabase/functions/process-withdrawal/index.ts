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
function toOpenFloatNetwork(network: string): string {
  if (network === 'mtn') return 'MTN'
  if (network === 'airtel') return 'AirtelMoney'
  return network
}

const CARRIER_FEE = 1800

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
    const { enrollmentId, amount, network, momoPhone } = await req.json()
    if (!enrollmentId || amount == null || !momoPhone) return json({ error: 'Missing required fields' }, req, 400)

    const amt = Math.floor(Number(amount))
    if (isNaN(amt) || amt < 5000) return json({ error: 'Minimum withdrawal is UGX 5,000.' }, req, 400)

    const cleanPhone = String(momoPhone).replace(/\s/g, '')
    if (cleanPhone.length < 10) return json({ error: 'Please enter a valid phone number.' }, req, 400)

    // ── Authenticate + ownership ──────────────────────────────────────────
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, phone').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

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

    const openFloatNetwork = toOpenFloatNetwork(String(network || ''))
    const networkLabel     = network === 'mtn' ? 'MTN MoMo' : network === 'airtel' ? 'Airtel Money' : openFloatNetwork
    const partnaFee  = Math.round(amt * 0.02)
    const totalFees  = partnaFee + CARRIER_FEE
    const netAmount  = Math.max(0, amt - totalFees)
    const reference  = generateReference()

    // ── Debit wallet with an optimistic lock ──────────────────────────────
    const { data: debited } = await supabase
      .from('wallets').update({ balance: balance - amt, updated_at: new Date().toISOString() })
      .eq('id', wallet.id).eq('balance', balance).select('id')
    if (!debited || debited.length === 0) {
      return json({ error: 'Your balance changed during processing. Please try again.' }, req, 409)
    }

    const { data: txnRows, error: txnErr } = await supabase.from('transactions').insert({
      customer_id: customer.id, wallet_id: wallet.id, campaign_id: enrollment.campaign_id,
      type: 'withdrawal', amount: amt, status: 'pending',
      network: openFloatNetwork, withdrawal_network: openFloatNetwork, withdrawal_phone: cleanPhone,
      reference, notes: `${networkLabel}: ${momoPhone}`,
    }).select('id')
    if (txnErr) {
      // Restore the balance — the withdrawal record could not be created.
      await supabase.from('wallets').update({ balance, updated_at: new Date().toISOString() }).eq('id', wallet.id)
      console.error('process-withdrawal: txn insert failed, balance restored', txnErr)
      return json({ error: 'Could not record withdrawal. Please try again.' }, req, 500)
    }
    const txnId = txnRows?.[0]?.id || null
    if (txnId) {
      await supabase.from('transaction_fees').insert({
        transaction_id: txnId, customer_id: customer.id, network: openFloatNetwork,
        fee_type: 'withdrawal', charged_to: 'user',
        partna_fee: partnaFee, carrier_fee: CARRIER_FEE, tax: 0, total_fees: totalFees, net_amount: netAmount,
      })
    }

    const smsPhone = customer.phone || cleanPhone
    await sendSMS(customer.id, smsPhone, 'withdrawal_requested', { amount: formatUGX(amt), reference })

    return json({ success: true, reference, newBalance: balance - amt }, req)

  } catch (e) {
    console.error('process-withdrawal error:', e)
    return json({ error: 'Withdrawal failed. Please try again.' }, req, 500)
  }
})
