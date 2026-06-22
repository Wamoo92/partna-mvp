const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

// Allowed sender addresses — add new ones here as needed
const ALLOWED_SENDERS: Record<string, string> = {
  'receipts': 'Partna <receipts@partna.io>',
  'billing':  'Partna Billing <billing@partna.io>',
  'support':  'Partna <support@partna.io>',
}
const DEFAULT_SENDER = ALLOWED_SENDERS['receipts']

Deno.serve(async (req) => {
  try {
    const { to, subject, html, from } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})