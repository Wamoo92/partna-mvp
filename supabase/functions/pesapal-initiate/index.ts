import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'

const PESAPAL_BASE = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

// IPN and callback are our own Edge Function URLs
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const IPN_URL         = `${SUPABASE_URL}/functions/v1/pesapal-ipn`
const CALLBACK_URL    = `${SUPABASE_URL}/functions/v1/pesapal-callback`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPesapalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  })
  const data = await res.json()
  if (!data.token) throw new Error(`Pesapal auth failed: ${JSON.stringify(data)}`)
  return data.token
}

async function getOrRegisterIPN(token: string): Promise<string> {
  // Check if IPN already registered
  const listRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/GetIpnList`, {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
  })
  const listData = await listRes.json()

  if (Array.isArray(listData)) {
    const existing = listData.find((ipn: any) => ipn.url === IPN_URL)
    if (existing?.ipn_id) return existing.ipn_id
  }

  // Register IPN
  const regRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: IPN_URL, ipn_notification_type: 'GET' }),
  })
  const regData = await regRes.json()
  if (!regData.ipn_id) throw new Error(`IPN registration failed: ${JSON.stringify(regData)}`)
  return regData.ipn_id
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, currency = 'UGX', customer, walletId, campaignId, enrollmentId } = await req.json()

    if (!amount || !customer?.id || !walletId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate a unique merchant reference
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let reference = 'DEP-'
    for (let i = 0; i < 8; i++) reference += chars[Math.floor(Math.random() * chars.length)]

    const token     = await getPesapalToken()
    const ipn_id    = await getOrRegisterIPN(token)

    // Submit order to Pesapal
    const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id:               reference,
        currency,
        amount:           Number(amount),
        description:      `Partna deposit — ${campaignId || 'savings'}`,
        callback_url:     `${CALLBACK_URL}?walletId=${walletId}&amount=${amount}&reference=${reference}&customerId=${customer.id}&campaignId=${campaignId || ''}&enrollmentId=${enrollmentId || ''}`,
        notification_id:  ipn_id,
        billing_address: {
          email_address: customer.email || '',
          phone_number:  customer.phone || '',
          first_name:    customer.first_name || '',
          last_name:     customer.last_name  || '',
          country_code:  'UG',
        },
      }),
    })

    const orderData = await orderRes.json()

    if (!orderData.redirect_url) {
      throw new Error(`Pesapal order failed: ${JSON.stringify(orderData)}`)
    }

    // Store pending transaction in Supabase so we can reconcile later
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase.from('transactions').insert({
      customer_id:  customer.id,
      wallet_id:    walletId,
      campaign_id:  campaignId || null,
      type:         'deposit',
      amount:       Number(amount),
      status:       'pending',
      reference,
      notes:        `Pesapal order_tracking_id: ${orderData.order_tracking_id}`,
    })

    return new Response(JSON.stringify({
      redirect_url:       orderData.redirect_url,
      order_tracking_id:  orderData.order_tracking_id,
      reference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('pesapal-initiate error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})