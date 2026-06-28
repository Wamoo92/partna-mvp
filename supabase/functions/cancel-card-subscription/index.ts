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

async function sendCardEmail(to: string, subject: string, html: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
      body:    JSON.stringify({ to, subject, html, from: 'support' }),
    })
  } catch (e) { console.error('cancel-card email error (non-critical):', e) }
}
function cardCancellationEmailHtml({ customerName, businessName, billingPeriodEnd }: Record<string, string>): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px;">Your card subscription has been cancelled</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your ${businessName} Partna card subscription has been cancelled. Your card will remain
        active until <strong>${billingPeriodEnd}</strong>, after which it will be deactivated and you will no longer
        be billed.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        You can reactivate a card at any time from your card page. Your savings are unaffected.
      </p>
      <p style="font-size: 13px; color: #959687; line-height: 1.6; margin: 0;">
        Questions? Contact <a href="mailto:support@partna.io" style="color:#111;font-weight:600;">support@partna.io</a>.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">Powered by Partna</p>
    </div>`
}

// Server-side card-subscription cancellation. card_subscriptions is service-role
// only, so the customer cannot update it from the browser — this function verifies
// the caller owns the subscription, cancels it, and emails the confirmation.
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
      .from('customers').select('id, email, first_name, last_name, businesses(name)').eq('auth_user_id', user.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, 403)

    // The customer's own active/grace subscription.
    const { data: subscription } = await supabase
      .from('card_subscriptions')
      .select('id, next_billing_date')
      .eq('customer_id', customer.id)
      .in('status', ['active', 'grace_period'])
      .maybeSingle()
    if (!subscription) return json({ error: 'No active card subscription to cancel.' }, 404)

    const { error: updErr } = await supabase
      .from('card_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'customer_request' })
      .eq('id', subscription.id)
    if (updErr) {
      console.error('cancel-card-subscription update failed:', updErr)
      return json({ error: 'Could not cancel the subscription. Please try again.' }, 500)
    }

    // Confirmation email (non-blocking).
    if (customer.email) {
      const businessName = (customer.businesses as any)?.name || 'Partna'
      const billingEnd = subscription.next_billing_date
        ? new Date(subscription.next_billing_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'the end of your current billing period'
      await sendCardEmail(
        customer.email,
        `Your ${businessName} card subscription has been cancelled`,
        cardCancellationEmailHtml({
          customerName:     `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'there',
          businessName,
          billingPeriodEnd: billingEnd,
        })
      )
    }

    return json({ success: true })

  } catch (e) {
    console.error('cancel-card-subscription error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
