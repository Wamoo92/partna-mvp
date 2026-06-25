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

async function sendSMS(customerId: string, phone: string, event: string, vars: Record<string, string>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

// Server-side account closure. Replaces Profile.jsx handleDeleteAccount. Leaves all
// of the caller's active enrollments (zeroing wallets + recording 10%-fee refunds),
// marks the customer deleted, and notifies them. The client signs out afterwards.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, phone').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

    const { data: enrollments } = await supabase
      .from('customer_campaigns').select('id, campaign_id, wallet_id, wallets(id, balance)')
      .eq('customer_id', customer.id).eq('status', 'active')

    for (const enrollment of enrollments || []) {
      const wallet  = (enrollment as any).wallets
      const balance = Number(wallet?.balance || 0)
      const fee     = Math.round(balance * 0.10)
      const refund  = Math.max(0, balance - fee)

      await supabase.from('customer_campaigns')
        .update({ status: 'left', left_at: new Date().toISOString() }).eq('id', enrollment.id)
      if (wallet) {
        await supabase.from('wallets').update({ balance: 0, updated_at: new Date().toISOString() }).eq('id', wallet.id)
      }
      if (balance > 0) {
        await supabase.from('transactions').insert({
          customer_id: customer.id, wallet_id: wallet?.id || null, campaign_id: enrollment.campaign_id,
          type: 'withdrawal', amount: balance, status: 'pending',
          notes: `Account deleted — refund pending. Fee: UGX ${fee.toLocaleString()}. Net: UGX ${refund.toLocaleString()}`,
        })
        await supabase.from('transaction_fees').insert({
          customer_id: customer.id, fee_type: 'delete_account', charged_to: 'user',
          partna_fee: fee, carrier_fee: 0, tax: 0, total_fees: fee, net_amount: refund,
        })
      }
    }

    await supabase.from('customers').update({ registration_status: 'deleted' }).eq('id', customer.id)
    if (customer.phone) await sendSMS(customer.id, customer.phone, 'account_deleted', {})

    return json({ success: true }, req)

  } catch (e) {
    console.error('close-account error:', e)
    return json({ error: 'Could not close the account. Please try again.' }, req, 500)
  }
})
