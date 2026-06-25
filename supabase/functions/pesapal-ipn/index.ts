import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'
const PESAPAL_BASE    = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

function formatUGX(n: number): string {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

async function sendSMS(customerId: string, phone: string, event: string, vars: Record<string, string>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error('SMS send error (non-critical):', e)
  }
}

serve(async (req) => {
  // Pesapal sends IPN as GET with query params.
  const url             = new URL(req.url)
  const orderTrackingId = url.searchParams.get('OrderTrackingId')
  const merchantRef     = url.searchParams.get('OrderMerchantReference')

  if (!orderTrackingId || !merchantRef) {
    return new Response('Missing params', { status: 400 })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const token  = await getPesapalToken()
    const status = await getTransactionStatus(token, orderTrackingId)

    // The verified merchant reference must match the IPN's reference.
    if (status.merchant_reference && status.merchant_reference !== merchantRef) {
      console.error('pesapal-ipn: merchant_reference mismatch', {
        orderTrackingId, merchantRef, verified: status.merchant_reference,
      })
      return new Response('ok', { status: 200 })
    }

    if (status.payment_status_description === 'Completed') {
      // Atomic + idempotent + amount-verified credit. If the callback already
      // credited this deposit, the RPC returns 'already_processed' and no second
      // credit happens.
      const verifiedAmount = Number(status.amount)
      const { data: result, error: rpcError } = await supabase.rpc('process_pesapal_credit', {
        p_reference:         merchantRef,
        p_order_tracking_id: orderTrackingId,
        p_verified_amount:   isNaN(verifiedAmount) ? null : verifiedAmount,
      })

      if (rpcError) {
        console.error('pesapal-ipn: process_pesapal_credit failed', rpcError)
        // Return 200 anyway so Pesapal stops retrying; the callback path can recover.
        return new Response('ok', { status: 200 })
      }

      // Only the path that actually applies the credit sends the SMS (fires once).
      if (result?.result === 'credited') {
        const { data: customer } = await supabase
          .from('customers').select('phone, first_name').eq('id', result.customer_id).maybeSingle()

        let campaignName = 'your campaign'
        if (result.campaign_id) {
          const { data: campaign } = await supabase
            .from('campaigns').select('name').eq('id', result.campaign_id).maybeSingle()
          if (campaign) campaignName = campaign.name
        }

        if (customer?.phone) {
          await sendSMS(result.customer_id, customer.phone, 'deposit_confirmed', {
            amount:    formatUGX(Number(result.amount)),
            balance:   formatUGX(Number(result.new_balance)),
            campaign:  campaignName,
            reference: merchantRef,
          })
        }
      }

    } else if (
      status.payment_status_description === 'Failed' ||
      status.payment_status_description === 'Invalid'
    ) {
      await supabase
        .from('transactions')
        .update({ status: 'failed', notes: `Pesapal IPN status: ${status.payment_status_description}` })
        .eq('reference', merchantRef)
        .eq('status', 'pending')
    }

    // Always return 200 to Pesapal so they stop retrying.
    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('pesapal-ipn error:', err)
    // Still return 200 — if we return an error Pesapal will retry indefinitely.
    return new Response('ok', { status: 200 })
  }
})
