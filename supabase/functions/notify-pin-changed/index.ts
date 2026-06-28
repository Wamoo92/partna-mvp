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

// Sends the "your PIN was changed" SMS server-side. The PIN change itself is done
// client-side (supabase.auth.updateUser); this only fires the notification to the
// caller's OWN phone (looked up server-side) using the service role — the customer
// can't call the locked-down send-sms relay directly.
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, phone').eq('auth_user_id', user.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, 403)

    if (customer.phone) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
          body:    JSON.stringify({ event: 'pin_changed', phone: customer.phone, customerId: customer.id, vars: {} }),
        })
      } catch (e) { console.error('notify-pin-changed SMS error (non-critical):', e) }
    }

    return json({ success: true })

  } catch (e) {
    console.error('notify-pin-changed error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
