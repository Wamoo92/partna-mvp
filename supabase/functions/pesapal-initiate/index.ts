import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONSUMER_KEY    = Deno.env.get('PESAPAL_CONSUMER_KEY')!
const CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET')!
const IS_LIVE         = Deno.env.get('PESAPAL_ENV') === 'live'
const PESAPAL_BASE    = IS_LIVE
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IPN_URL       = `${SUPABASE_URL}/functions/v1/pesapal-ipn`
const CALLBACK_URL  = `${SUPABASE_URL}/functions/v1/pesapal-callback`

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

// ── Simple in-memory rate limiter ──
// Limits each IP to 10 payment initiations per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT   = 10
const WINDOW_MS    = 15 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
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
  const listRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/GetIpnList`, {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
  })
  const listData = await listRes.json()
  if (Array.isArray(listData)) {
    const existing = listData.find((ipn: any) => ipn.url === IPN_URL)
    if (existing?.ipn_id) return existing.ipn_id
  }
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
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { amount, currency = 'UGX', walletId, campaignId, enrollmentId } = body

    // Input validation
    if (!amount || typeof amount !== 'number' || amount < 1000 || amount > 50000000) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!walletId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── Authenticate the caller and derive the customer from the JWT ──────
    // (Don't trust a client-supplied customer object / walletId.)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: customer } = await supabase
      .from('customers').select('id, email, phone, first_name, last_name').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // The wallet must belong to this customer.
    const { data: ownedWallet } = await supabase
      .from('wallets').select('id').eq('id', walletId).eq('customer_id', customer.id).maybeSingle()
    if (!ownedWallet) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let reference = 'DEP-'
    for (let i = 0; i < 8; i++) reference += chars[Math.floor(Math.random() * chars.length)]

    const token  = await getPesapalToken()
    const ipn_id = await getOrRegisterIPN(token)

    const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id:              reference,
        currency,
        amount:          Number(amount),
        description:     `Partna deposit — ${campaignId || 'savings'}`,
        callback_url:    `${CALLBACK_URL}?walletId=${walletId}&amount=${amount}&reference=${reference}&customerId=${customer.id}&campaignId=${campaignId || ''}&enrollmentId=${enrollmentId || ''}`,
        notification_id: ipn_id,
        billing_address: {
          email_address: customer.email      || '',
          phone_number:  customer.phone      || '',
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

    await supabase.from('transactions').insert({
      customer_id: customer.id,
      wallet_id:   walletId,
      campaign_id: campaignId || null,
      type:        'deposit',
      amount:      Number(amount),
      status:      'pending',
      reference,
      notes:       `Pesapal order_tracking_id: ${orderData.order_tracking_id}`,
    })

    return new Response(JSON.stringify({
      redirect_url:      orderData.redirect_url,
      order_tracking_id: orderData.order_tracking_id,
      reference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('pesapal-initiate error:', err)
    return new Response(JSON.stringify({ error: 'Payment initiation failed. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
