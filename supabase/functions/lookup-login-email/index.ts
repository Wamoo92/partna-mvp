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

// Minimal pre-auth helper: resolve the auth email for a phone so the client can
// call signInWithPassword / resetPasswordForEmail. Returns ONLY email +
// registration_status for the single queried phone (no bulk read of customers).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { phone } = await req.json()
    const cleanPhone = String(phone || '').replace(/\s+/g, '')
    if (!cleanPhone) return json({ found: false }, req)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const { data: rows } = await supabase
      .from('customers')
      .select('email, registration_status')
      .eq('phone', cleanPhone)

    if (!rows || rows.length === 0) return json({ found: false }, req)

    // Prefer a fully-registered account if several rows share the phone.
    const row = rows.find((r: any) => r.registration_status === 'complete') || rows[0]
    if (!row.email) return json({ found: false }, req)

    return json({ found: true, email: row.email, registration_status: row.registration_status }, req)

  } catch (e) {
    console.error('lookup-login-email error:', e)
    return json({ found: false }, req, 500)
  }
})
