const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

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
