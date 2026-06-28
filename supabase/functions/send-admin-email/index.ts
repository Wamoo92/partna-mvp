import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

// Authorized if the request carries the service-role key (internal Edge-Function
// calls) OR a JWT belonging to a Partna admin / business admin. This used to be an
// open relay that could send mail from partna.io domains to anyone.
function jwtRole(jwt: string): string | null {
  try {
    const json = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.role === 'string' ? json.role : null
  } catch { return null }
}

async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!bearer) return false
  // Internal Edge-Function calls carry the service-role JWT (gateway verifies the
  // signature since verify_jwt is enabled), so a service_role role claim is trusted.
  if (bearer === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || jwtRole(bearer) === 'service_role') return true
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await admin.auth.getUser(bearer)
  if (!user) return false
  if (user.email) {
    const { data: au } = await admin.from('admin_users').select('email').eq('email', user.email).maybeSingle()
    if (au) return true
  }
  const { data: ba } = await admin.from('business_admins').select('id').eq('auth_user_id', user.id).limit(1).maybeSingle()
  return !!ba
}

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

// Allowed sender addresses — add new ones here as needed
const ALLOWED_SENDERS: Record<string, string> = {
  'receipts': 'Partna <receipts@partna.io>',
  'billing':  'Partna Billing <billing@partna.io>',
  'support':  'Partna <support@partna.io>',
}
const DEFAULT_SENDER = ALLOWED_SENDERS['receipts']

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  // This function previously had NO CORS headers and did not handle the preflight,
  // so every browser call (admin/dashboard/portal) failed before sending. Handle
  // OPTIONS and attach CORS to every response.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!(await isAuthorizedCaller(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { to, subject, html, from } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Resolve sender — caller passes 'support', 'billing' or 'receipts', defaults to receipts
    const sender = (from && ALLOWED_SENDERS[from]) ? ALLOWED_SENDERS[from] : DEFAULT_SENDER

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    sender,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('send-admin-email error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
