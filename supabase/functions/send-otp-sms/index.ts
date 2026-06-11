import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const AT_API_KEY = Deno.env.get('AT_API_KEY')!
const AT_USERNAME = Deno.env.get('AT_USERNAME')!

serve(async (req) => {
  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Missing phone or otp' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const message = `Your Partna verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`

    const endpoint = AT_USERNAME === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

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

    const data = await res.json()
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})