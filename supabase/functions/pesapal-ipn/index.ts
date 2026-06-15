import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'
const PESAPAL_BASE    = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

async function getPesapalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  })
  const data = await res.json()
  if (!data.token) throw new Error(`Auth failed: ${JSON.stringify(data)}`)
  return data.token
}

async function getTransactionStatus(token: string, orderTrackingId: string) {
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } }
  )
  return await res.json()
}

serve(async (req) => {
  // Pesapal sends IPN as GET with query params
  const url             = new URL(req.url)
  const orderTrackingId = url.searchParams.get('OrderTrackingId')
  const merchantRef     = url.searchParams.get('OrderMerchantReference')

  if (!orderTrackingId || !merchantRef) {
    return new Response('Missing params', { status: 400 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Look up the pending transaction by reference
    const { data: txn } = await supabase
      .from('transactions')
      .select('*, wallets(balance)')
      .eq('reference', merchantRef)
      .eq('status', 'pending')
      .maybeSingle()

    if (!txn) {
      // Either already processed or doesn't exist — return 200 so Pesapal stops retrying
      return new Response('ok', { status: 200 })
    }

    const token  = await getPesapalToken()
    const status = await getTransactionStatus(token, orderTrackingId)

    if (status.payment_status_description === 'Completed') {
      // Credit wallet if not already credited by callback
      const wallet = txn.wallets
      if (wallet) {
        const newBalance = Number(wallet.balance) + Number(txn.amount)
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', txn.wallet_id)
      }

      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          notes:  `Pesapal IPN confirmed. order_tracking_id: ${orderTrackingId}`,
        })
        .eq('id', txn.id)

    } else if (
      status.payment_status_description === 'Failed' ||
      status.payment_status_description === 'Invalid'
    ) {
      await supabase
        .from('transactions')
        .update({ status: 'failed', notes: `Pesapal IPN status: ${status.payment_status_description}` })
        .eq('id', txn.id)
    }

    // Always return 200 to Pesapal so they stop retrying
    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('pesapal-ipn error:', err)
    // Still return 200 — if we return an error Pesapal will retry indefinitely
    return new Response('ok', { status: 200 })
  }
})