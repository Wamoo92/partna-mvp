import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AT_API_KEY = Deno.env.get('AT_API_KEY')!
const AT_USERNAME = Deno.env.get('AT_USERNAME')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()
    console.log('Received request — phone:', phone, 'otp:', otp)
    console.log('AT_USERNAME:', AT_USERNAME)
    console.log('AT_API_KEY present:', !!AT_API_KEY)

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Missing phone or otp' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = `Your Partna verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`

    const endpoint = AT_USERNAME === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

    console.log('Sending to endpoint:', endpoint)

    const body = new URLSearchParams({
      username: AT_USERNAME,
      to: phone.startsWith('+') ? phone : `+${phone}`,
      message,
    })

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': AT_API_KEY,
      },
      body: body.toString(),
    })

    const responseText = await res.text()
    console.log('AT response status:', res.status)
    console.log('AT response body:', responseText)

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { raw: responseText }
    }

    return new Response(JSON.stringify({ success: true, data }), {
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