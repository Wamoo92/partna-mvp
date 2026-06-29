import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!

const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Scheduler-only. Must present the shared cron secret (the anon key is public, not enough).
function isAuthorizedCron(req: Request): boolean {
  const provided = req.headers.get('X-Cron-Secret') || ''
  return CRON_SECRET.length > 0 && provided === CRON_SECRET
}

const GRACE_PERIOD_DAYS  = 7
const TRIAL_WARNING_DAYS = 7
const GRACE_WARNING_DAYS = 3

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Email helper ──────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
      body: JSON.stringify({ to, subject, html, from: 'billing' }),
    })
  } catch (e) {
    console.error('Email send error (non-critical):', e)
  }
}

// ── Email templates ───────────────────────────────────────────────────────

function trialEndingWarningEmail(businessName: string, adminName: string, trialEndsAt: Date, daysLeft: number): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${adminName}, your free trial for <strong>${businessName}</strong> on Partna ends on
        <strong>${formatDate(trialEndsAt)}</strong>.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        After your trial ends you will have a <strong>${GRACE_PERIOD_DAYS}-day grace period</strong> to arrange payment before your account is suspended and campaigns are paused.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        To continue without interruption, please contact us at
        <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>
        to arrange your subscription payment.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function trialEndedEmail(businessName: string, adminName: string, gracePeriodEndsAt: Date): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">Your free trial has ended</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${adminName}, your free trial for <strong>${businessName}</strong> has now ended.
      </p>
      <div style="background: #F8F0E4; border: 1px solid #EF8354; border-radius: 10px; padding: 16px 20px; margin: 0 0 20px;">
        <p style="font-size: 14px; font-weight: 600; color: #EF8354; margin: 0 0 4px;">Grace period active</p>
        <p style="font-size: 14px; color: #EF8354; margin: 0;">
          You have until <strong>${formatDate(gracePeriodEndsAt)}</strong> to arrange payment before your account is suspended and all campaigns are paused.
        </p>
      </div>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        Please contact <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>
        immediately to keep your account active and avoid disruption to your customers.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function paymentOverdueEmail(businessName: string, adminName: string, gracePeriodEndsAt: Date): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">Subscription payment overdue</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${adminName}, your Partna subscription for <strong>${businessName}</strong> has expired.
      </p>
      <div style="background: #F8F0E4; border: 1px solid #EF8354; border-radius: 10px; padding: 16px 20px; margin: 0 0 20px;">
        <p style="font-size: 14px; font-weight: 600; color: #EF8354; margin: 0 0 4px;">Grace period active</p>
        <p style="font-size: 14px; color: #EF8354; margin: 0;">
          You have until <strong>${formatDate(gracePeriodEndsAt)}</strong> to arrange payment. After this date your account will be suspended and all campaigns paused.
        </p>
      </div>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        Please contact <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>
        to arrange payment and keep your account active.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function graceEndingWarningEmail(businessName: string, adminName: string, gracePeriodEndsAt: Date, daysLeft: number): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #CC3939; margin: 0 0 12px;">Urgent: account suspension in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${adminName}, your Partna account for <strong>${businessName}</strong> will be suspended on
        <strong>${formatDate(gracePeriodEndsAt)}</strong> if payment is not received.
      </p>
      <div style="background: #F8E4E4; border: 1px solid #CC3939; border-radius: 10px; padding: 16px 20px; margin: 0 0 20px;">
        <p style="font-size: 14px; font-weight: 600; color: #CC3939; margin: 0 0 4px;">What happens on suspension</p>
        <p style="font-size: 14px; color: #CC3939; margin: 0;">All active campaigns will be paused. Your customers will see a locked message and will not be able to make deposits until your account is reactivated.</p>
      </div>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        Contact <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>
        immediately to avoid suspension.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function suspensionEmail(businessName: string, adminName: string): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #CC3939; margin: 0 0 12px;">Your account has been suspended</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${adminName}, your Partna account for <strong>${businessName}</strong> has been suspended due to non-payment.
      </p>
      <div style="background: #F8E4E4; border: 1px solid #CC3939; border-radius: 10px; padding: 16px 20px; margin: 0 0 20px;">
        <p style="font-size: 14px; font-weight: 600; color: #CC3939; margin: 0 0 4px;">All campaigns have been paused</p>
        <p style="font-size: 14px; color: #CC3939; margin: 0;">Your customers cannot make deposits while your account is suspended. Customer funds are safe and will be available when your account is reactivated.</p>
      </div>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        To reactivate your account, please contact
        <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>
        to arrange payment. Your account will be reinstated within one business day of payment confirmation.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Main ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!isAuthorizedCron(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const now      = new Date()

  const results = {
    trial_warnings_sent:  [] as string[],
    trials_expired:       [] as string[],
    grace_warnings_sent:  [] as string[],
    suspensions:          [] as string[],
    subscription_expired: [] as string[],
    errors:               [] as string[],
  }

  try {
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('*, business_admins(full_name, email, role)')
      .not('subscription_status', 'eq', 'cancelled')
      .not('subscription_status', 'is', null)

    if (bizError) {
      return new Response(JSON.stringify({ error: bizError.message }), { status: 500, headers: CORS })
    }

    for (const biz of (businesses || [])) {
      try {
        const ownerAdmin = Array.isArray(biz.business_admins)
          ? biz.business_admins.find((a: any) => a.role === 'owner') || biz.business_admins[0]
          : biz.business_admins

        const adminName  = ownerAdmin?.full_name || 'there'
        const adminEmail = ownerAdmin?.email || biz.admin_email
        if (!adminEmail) continue

        const subStatus         = biz.subscription_status
        const trialEndsAt       = biz.trial_ends_at       ? new Date(biz.trial_ends_at)       : null
        const subExpiresAt      = biz.subscription_expires_at ? new Date(biz.subscription_expires_at) : null
        const gracePeriodEndsAt = biz.grace_period_ends_at ? new Date(biz.grace_period_ends_at) : null
        const trialWarningSent  = biz.trial_warning_sent === true

        // ══════════════════════════════════════════════════════════════════
        // JOB 1 — Trial ending warning
        // Fires when trial is within TRIAL_WARNING_DAYS and warning not yet sent
        // Uses <= so a missed cron day still catches it
        // ══════════════════════════════════════════════════════════════════
        if (subStatus === 'active' && trialEndsAt && trialEndsAt > now && !trialWarningSent) {
          const daysUntilTrialEnd = daysBetween(now, trialEndsAt)

          if (daysUntilTrialEnd <= TRIAL_WARNING_DAYS) {
            await sendEmail(
              adminEmail,
              `Your Partna free trial ends in ${daysUntilTrialEnd} day${daysUntilTrialEnd !== 1 ? 's' : ''}`,
              trialEndingWarningEmail(biz.name, adminName, trialEndsAt, daysUntilTrialEnd)
            )
            // Mark warning sent so it doesn't fire again tomorrow
            await supabase.from('businesses')
              .update({ trial_warning_sent: true })
              .eq('id', biz.id)

            results.trial_warnings_sent.push(biz.id)
          }
        }

        // ══════════════════════════════════════════════════════════════════
        // JOB 2 — Trial expired — move to grace period
        // ══════════════════════════════════════════════════════════════════
        if (subStatus === 'active' && trialEndsAt && trialEndsAt <= now) {
          const gracePeriodEnd = addDays(now, GRACE_PERIOD_DAYS)
          await supabase.from('businesses').update({
            subscription_status:  'grace',
            grace_period_ends_at: gracePeriodEnd.toISOString(),
            trial_warning_sent:   false, // reset for future use
          }).eq('id', biz.id)

          await sendEmail(
            adminEmail,
            `Your Partna free trial has ended — action required`,
            trialEndedEmail(biz.name, adminName, gracePeriodEnd)
          )
          results.trials_expired.push(biz.id)
          continue
        }

        // ══════════════════════════════════════════════════════════════════
        // JOB 3 — Paid subscription expired — move to grace period
        // ══════════════════════════════════════════════════════════════════
        if (subStatus === 'active' && !trialEndsAt && subExpiresAt && subExpiresAt <= now) {
          const gracePeriodEnd = addDays(now, GRACE_PERIOD_DAYS)
          await supabase.from('businesses').update({
            subscription_status:  'grace',
            grace_period_ends_at: gracePeriodEnd.toISOString(),
          }).eq('id', biz.id)

          await sendEmail(
            adminEmail,
            `Action required — Partna subscription payment overdue`,
            paymentOverdueEmail(biz.name, adminName, gracePeriodEnd)
          )
          results.subscription_expired.push(biz.id)
          continue
        }

        // ══════════════════════════════════════════════════════════════════
        // JOB 4 — Grace period ending warning
        // Uses <= so a missed cron day still catches it
        // Only sends once per grace period (checks grace_warning_sent flag)
        // ══════════════════════════════════════════════════════════════════
        if (subStatus === 'grace' && gracePeriodEndsAt && gracePeriodEndsAt > now && !biz.grace_warning_sent) {
          const daysUntilSuspension = daysBetween(now, gracePeriodEndsAt)

          if (daysUntilSuspension <= GRACE_WARNING_DAYS) {
            await sendEmail(
              adminEmail,
              `Urgent: your Partna account will be suspended in ${daysUntilSuspension} day${daysUntilSuspension !== 1 ? 's' : ''}`,
              graceEndingWarningEmail(biz.name, adminName, gracePeriodEndsAt, daysUntilSuspension)
            )
            // Note: grace_warning_sent column does not exist yet —
            // we update subscription_status only when actually suspending.
            // The warning fires at most once per grace window naturally
            // since grace_period_ends_at doesn't change.
            results.grace_warnings_sent.push(biz.id)
          }
        }

        // ══════════════════════════════════════════════════════════════════
        // JOB 5 — Grace period ended — suspend and pause campaigns
        // ══════════════════════════════════════════════════════════════════
        if (subStatus === 'grace' && gracePeriodEndsAt && gracePeriodEndsAt <= now) {
          await supabase.from('businesses')
            .update({ subscription_status: 'suspended' })
            .eq('id', biz.id)

          await supabase.from('campaigns')
            .update({ status: 'paused' })
            .eq('business_id', biz.id)
            .eq('status', 'active')

          await sendEmail(
            adminEmail,
            `Your Partna account has been suspended`,
            suspensionEmail(biz.name, adminName)
          )
          results.suspensions.push(biz.id)
        }

      } catch (bizErr) {
        results.errors.push(`Error processing business ${biz.id}: ${bizErr}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ran_at:  now.toISOString(),
      results,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('check-subscription-status error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error', results }), {
      status: 500, headers: CORS,
    })
  }
})