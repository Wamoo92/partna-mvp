import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'
const PESAPAL_BASE    = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

// Where to send the customer after payment confirmed or failed
// This should be your live domain once hosted — for now points to localhost
const APP_BASE = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173'

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
  const url    = new URL(req.url)
  const params = url.searchParams

  // Pesapal appends these to our callback URL
  const orderTrackingId = params.get('OrderTrackingId')
  const merchantRef     = params.get('OrderMerchantReference')

  // Our own params we baked into the callback URL in pesapal-initiate
  const walletId      = params.get('walletId')
  const amount        = params.get('amount')
  const reference     = params.get('reference')
  const customerId    = params.get('customerId')
  const campaignId    = params.get('campaignId') || null
  const enrollmentId  = params.get('enrollmentId') || null

  if (!orderTrackingId || !walletId || !amount || !customerId) {
    return Response.redirect(`${APP_BASE}/portal/home?deposit=failed`, 302)
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token  = await getPesapalToken()
    const status = await getTransactionStatus(token, orderTrackingId)

    // payment_status_description: 'Completed' means money received
    if (status.payment_status_description === 'Completed') {

      // Credit the wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .maybeSingle()

      if (wallet) {
        const newBalance = Number(wallet.balance) + Number(amount)
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId)
      }

      // Mark the pending transaction as completed
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          notes:  `Pesapal confirmed. order_tracking_id: ${orderTrackingId}`,
        })
        .eq('reference', reference)

      // Redirect customer to success page
      return Response.redirect(
        `${APP_BASE}/portal/payment-success?reference=${reference}&amount=${amount}&enrollmentId=${enrollmentId || ''}`,
        302
      )

    } else {
      // Payment not completed — mark transaction as failed
      await supabase
        .from('transactions')
        .update({ status: 'failed', notes: `Pesapal status: ${status.payment_status_description}` })
        .eq('reference', reference)

      return Response.redirect(`${APP_BASE}/portal/home?deposit=failed`, 302)
    }

  } catch (err) {
    console.error('pesapal-callback error:', err)
    return Response.redirect(`${APP_BASE}/portal/home?deposit=error`, 302)
  }
})