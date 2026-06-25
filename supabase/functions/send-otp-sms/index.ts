import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AT_API_KEY   = Deno.env.get('AT_API_KEY')!
const AT_USERNAME  = Deno.env.get('AT_USERNAME')!
const AT_SENDER_ID = Deno.env.get('AT_SENDER_ID') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Africa's Talking requires international format: +256XXXXXXXXX
function formatPhone(phone: string): string {
  if (!phone) return ''
  const clean = phone.replace(/[\s\-\(\)]/g, '')
  if (clean.startsWith('+256')) return clean
  if (clean.startsWith('256'))  return '+' + clean
  if (clean.startsWith('0'))    return '+256' + clean.slice(1)
  if (clean.startsWith('7'))    return '+256' + clean
  return clean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Missing phone or otp' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const to = formatPhone(phone)
    if (!to || !to.startsWith('+')) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = `Your Partna verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`

    const endpoint = AT_USERNAME === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

    const body = new URLSearchParams({ username: AT_USERNAME, to, message })
    // A registered sender ID is required for delivery on live accounts — without
    // it Africa's Talking accepts the request (it shows in the dashboard) but the
    // SMS is never delivered. send-sms uses this; OTP must too.
    if (AT_SENDER_ID) body.append('from', AT_SENDER_ID)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey':       AT_API_KEY,
      },
      body: body.toString(),
    })

    const responseText = await res.text()
    let data: any
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    // Surface the real per-recipient outcome instead of blindly reporting success.
    const recipient = data?.SMSMessageData?.Recipients?.[0]
    const status    = recipient?.status

    if (status !== 'Success') {
      console.error('OTP SMS not accepted by AT:', { to, status, body: responseText })
      return new Response(JSON.stringify({
        success: false,
        error:   status || 'SMS could not be sent',
        data,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success:   true,
      messageId: recipient?.messageId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})