import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BUSINESS_WITHDRAWAL_FEE_PERCENT, BUSINESS_CARRIER_FEE, MIN_BUSINESS_WITHDRAWAL, formatUGX } from '../_shared/fees.ts'

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

// Server-side business wallet withdrawal. The business admin can't write
// business_transactions / business_wallets directly (no RLS write policy), so this
// runs with the service role: it verifies the caller is an admin of the business,
// computes the 3% + UGX 6,000 fees, and moves the money atomically via RPC.
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { amount } = await req.json()

    const amt = Math.floor(Number(amount))
    if (isNaN(amt) || amt < MIN_BUSINESS_WITHDRAWAL) {
      return json({ error: `Minimum withdrawal is ${formatUGX(MIN_BUSINESS_WITHDRAWAL)}.` }, 400)
    }

    // ── Authenticate: caller must be an admin of a business ────────────────
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: ba } = await supabase
      .from('business_admins').select('business_id').eq('auth_user_id', user.id).limit(1).maybeSingle()
    if (!ba) return json({ error: 'Forbidden' }, 403)
    const businessId = ba.business_id

    // ── Bank account (authoritative — read server-side, not from client) ───
    const { data: bank } = await supabase
      .from('business_bank_accounts').select('*').eq('business_id', businessId).maybeSingle()
    if (!bank) return json({ error: 'Please link a bank account in Settings before withdrawing.' }, 400)

    const { data: wallet } = await supabase
      .from('business_wallets').select('id, balance').eq('business_id', businessId).maybeSingle()
    const balance = Number(wallet?.balance || 0)
    if (balance < amt) return json({ error: `Insufficient balance. Your wallet has ${formatUGX(balance)}.` }, 400)

    // ── Fees: 3% Partna + UGX 6,000 flat carrier; net = gross − both ───────
    const partnaFee  = Math.round(amt * BUSINESS_WITHDRAWAL_FEE_PERCENT)
    const carrierFee = BUSINESS_CARRIER_FEE
    const totalFees  = partnaFee + carrierFee
    const netAmount  = Math.max(0, amt - totalFees)

    const notes = `Bank: ${bank.bank_name} · ${bank.account_name} · ${bank.account_number}`
      + `${bank.notification_phone ? ` · Notify: ${bank.notification_phone}` : ''}`
      + ` | Gross ${formatUGX(amt)} − Partna ${formatUGX(partnaFee)} − carrier ${formatUGX(carrierFee)} = net ${formatUGX(netAmount)}`

    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_business_withdrawal_tx', {
      p_business_id:    businessId,
      p_amount:         amt,
      p_partna_fee:     partnaFee,
      p_carrier_fee:    carrierFee,
      p_total_fees:     totalFees,
      p_net_amount:     netAmount,
      p_notes:          notes,
      p_method:         bank.bank_name || null,
      p_account_name:   bank.account_name || null,
      p_account_number: bank.account_number || null,
      p_notify_phone:   bank.notification_phone || null,
    })
    if (rpcErr) {
      const msg = rpcErr.message || ''
      if (msg.includes('INSUFFICIENT_BALANCE')) return json({ error: `Insufficient balance. Your wallet has ${formatUGX(balance)}.` }, 400)
      if (msg.includes('WALLET_NOT_FOUND'))     return json({ error: 'Business wallet not found.' }, 404)
      console.error('process-business-withdrawal: RPC failed', rpcErr)
      return json({ error: 'Could not process withdrawal. Please try again.' }, 500)
    }

    return json({
      success:    true,
      gross:      amt,
      partnaFee,
      carrierFee,
      netAmount,
      newBalance: Number(rpcData?.new_balance ?? (balance - amt)),
    })
  } catch (e) {
    console.error('process-business-withdrawal error:', e)
    return json({ error: 'Withdrawal failed. Please try again.' }, 500)
  }
})
