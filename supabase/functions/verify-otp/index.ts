import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
const err  = (message: string, req: Request, status = 400) => json({ error: message }, req, status)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { otpId, code, customerId } = await req.json()
    if (!otpId || !code || !customerId) return err('Missing required fields', req)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications').select('id, otp_code, status, expires_at').eq('id', otpId).maybeSingle()
    if (fetchError || !otpRecord) return err('OTP not found. Please go back and try again.', req)

    if (new Date(otpRecord.expires_at) < new Date())
      return err('OTP has expired. Please go back and request a new one.', req)

    // Server-side comparison — the code is never exposed to the client.
    if (String(otpRecord.otp_code) !== String(code).trim())
      return err('Incorrect OTP. Please check and try again.', req)

    await supabase.from('otp_verifications').update({ status: 'verified' }).eq('id', otpId)
    await supabase.from('customers').update({ registration_status: 'pin_pending' }).eq('id', customerId)

    return json({ success: true }, req)

  } catch (e) {
    console.error('verify-otp error:', e)
    return err((e as Error).message || 'Unexpected error', req, 500)
  }
})
