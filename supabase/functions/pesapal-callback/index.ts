import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'
const PESAPAL_BASE    = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

const APP_BASE     = Deno.env.get('APP_BASE_URL') || 'https://www.partna.io'
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
  const url             = new URL(req.url)
  const params          = url.searchParams
  const orderTrackingId = params.get('OrderTrackingId')
  const reference       = params.get('reference')
  // enrollmentId is a UI hint for the success page only — never used for crediting.
  const enrollmentId    = params.get('enrollmentId') || ''

  // Redirect the customer BACK to the exact origin they started from (their
  // subdomain portal), so their session survives. Validate it is a partna.io
  // origin (prevents open redirect); fall back to APP_BASE if absent/invalid.
  function safePartnaOrigin(o: string): string {
    try {
      const u = new URL(o)
      if (u.protocol === 'https:' && (u.hostname === 'partna.io' || u.hostname === 'www.partna.io' || u.hostname.endsWith('.partna.io'))) {
        return u.origin
      }
    } catch (_) { /* ignore */ }
    return ''
  }
  const BASE = safePartnaOrigin(params.get('returnOrigin') || '') || APP_BASE

  // SECURITY: walletId / amount / customerId from the URL are intentionally IGNORED.
  // The amount credited is the server-stored transaction amount, verified against
  // Pesapal's GetTransactionStatus and applied atomically by process_pesapal_credit.
  if (!orderTrackingId || !reference) {
    return Response.redirect(`${BASE}/portal/home?deposit=failed`, 302)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const token  = await getPesapalToken()
    const status = await getTransactionStatus(token, orderTrackingId)

    // Guard against an OrderTrackingId being paired with a different order's
    // reference: the verified merchant reference must match the one we were given.
    if (status.merchant_reference && reference && status.merchant_reference !== reference) {
      console.error('pesapal-callback: merchant_reference mismatch', {
        orderTrackingId, reference, verified: status.merchant_reference,
      })
      return Response.redirect(`${BASE}/portal/home?deposit=failed`, 302)
    }

    if (status.payment_status_description !== 'Completed') {
      // Only fail a still-pending row (don't clobber an already-completed one).
      await supabase.from('transactions')
        .update({ status: 'failed', notes: `Pesapal status: ${status.payment_status_description}` })
        .eq('reference', reference)
        .eq('status', 'pending')
      return Response.redirect(`${BASE}/portal/home?deposit=failed`, 302)
    }

    // Atomic + idempotent + amount-verified credit (see migration RPC).
    const verifiedAmount = Number(status.amount)
    const { data: result, error: rpcError } = await supabase.rpc('process_pesapal_credit', {
      p_reference:         reference,
      p_order_tracking_id: orderTrackingId,
      p_verified_amount:   isNaN(verifiedAmount) ? null : verifiedAmount,
    })

    if (rpcError) {
      console.error('pesapal-callback: process_pesapal_credit failed', rpcError)
      return Response.redirect(`${BASE}/portal/home?deposit=error`, 302)
    }

    const outcome = result?.result

    if (outcome === 'credited') {
      // Send the deposit-confirmed SMS using the server-stored txn values.
      const creditedAmount = Number(result.amount)
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
          amount:    formatUGX(creditedAmount),
          balance:   formatUGX(Number(result.new_balance)),
          campaign:  campaignName,
          reference: reference || '',
        })
      }

      return Response.redirect(
        `${BASE}/portal/payment-success?reference=${reference}&amount=${creditedAmount}&enrollmentId=${enrollmentId}`,
        302
      )
    }

    if (outcome === 'already_processed') {
      // Idempotent success — the IPN (or an earlier callback) already credited it.
      return Response.redirect(
        `${BASE}/portal/payment-success?reference=${reference}&amount=${verifiedAmount}&enrollmentId=${enrollmentId}`,
        302
      )
    }

    // not_found / amount_mismatch
    console.error('pesapal-callback: credit not applied', { reference, outcome, result })
    return Response.redirect(`${BASE}/portal/home?deposit=failed`, 302)

  } catch (err) {
    console.error('pesapal-callback error:', err)
    return Response.redirect(`${BASE}/portal/home?deposit=error`, 302)
  }
})
