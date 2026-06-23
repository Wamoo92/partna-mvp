import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AT_USERNAME  = Deno.env.get('AT_USERNAME')!
const AT_API_KEY   = Deno.env.get('AT_API_KEY')!
const AT_SENDER_ID = Deno.env.get('AT_SENDER_ID') || ''
const AT_SMS_URL   = 'https://api.africastalking.com/version1/messaging'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.partna.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── SMS Templates ──────────────────────────────────────────────────────────
// Edit the text here to change what customers receive
// {variables} are replaced at send time

const TEMPLATES: Record<string, (vars: Record<string, string>) => string> = {

  deposit_confirmed: (v) =>
    `Partna: Your deposit of ${v.amount} has been confirmed. ` +
    `New balance: ${v.balance}. ` +
    `Campaign: ${v.campaign}. ` +
    `Ref: ${v.reference}. ` +
    `Visit www.partna.io to view your account.`,

  withdrawal_requested: (v) =>
    `Partna: Your withdrawal request of ${v.amount} has been submitted. ` +
    `Ref: ${v.reference}. ` +
    `Processing takes 1-2 business days. ` +
    `You will be notified once complete.`,

  withdrawal_completed: (v) =>
    `Partna: Your withdrawal of ${v.amount} has been processed successfully. ` +
    `Ref: ${v.reference}. ` +
    `Funds have been sent to your registered mobile money number.`,

  campaign_enrolled: (v) =>
    `Partna: Welcome to ${v.campaign}! ` +
    `Your savings campaign is now active. ` +
    `Start saving at www.partna.io`,

  pin_changed: (_v) =>
    `Partna: Your PIN has been changed successfully. ` +
    `If you did not make this change please contact support immediately at www.partna.io`,

  account_deleted: (_v) =>
    `Partna: Your account has been deactivated. ` +
    `Any remaining balance will be refunded within 5 working days. ` +
    `Thank you for using Partna.`,

  fee_payment_confirmed: (v) =>
    `Partna: Payment of ${v.amount} received for ${v.student_name} ` +
    `(${v.fee_type}) — ${v.campaign}. ` +
    `Total paid to date: ${v.total_paid}. ` +
    `Ref: ${v.reference}. ` +
    `Visit www.partna.io to view your account.`,

  card_grace_day1: (v) =>
    `Partna: Hi ${v.name}, your ${v.business_name} card subscription could not be renewed. ` +
    `Please deposit UGX ${v.amount} to keep your card active. ` +
    `You have 7 days before your card is locked. ` +
    `Visit www.partna.io to top up now.`,

  card_grace_day5: (v) =>
    `Partna: Hi ${v.name}, your ${v.business_name} card will be locked in 2 days. ` +
    `Deposit UGX ${v.amount} now to avoid losing access to your card and cashback rewards. ` +
    `Visit www.partna.io to top up immediately.`,

  // ── Campaign nudges ────────────────────────────────────────────────────

  campaign_milestone_savings: (v) =>
    `Partna: Hi ${v.name}, you have saved ${v.percentage}% of your ${v.campaign} target ` +
    `with ${v.business_name}. ` +
    `${Number(v.percentage) < 100 ? `UGX ${v.amount_remaining} to go — keep it up! ` : ''}` +
    `Visit www.partna.io to view your progress.`,

  campaign_milestone_fees: (v) =>
    `Partna: Hi ${v.name}, you have paid ${v.percentage}% of your ${v.campaign} target ` +
    `with ${v.business_name}. ` +
    `${Number(v.percentage) < 100 ? `UGX ${v.amount_remaining} remaining — keep going! ` : ''}` +
    `Visit www.partna.io to view your progress.`,

  campaign_deadline_7d: (v) =>
    `Partna: Hi ${v.name}, your ${v.campaign} deadline with ${v.business_name} is in 7 days. ` +
    `You still need UGX ${v.amount_remaining} to reach your target. ` +
    `Visit www.partna.io to make a payment now.`,

  campaign_deadline_1d: (v) =>
    `Partna: Hi ${v.name}, your ${v.campaign} deadline with ${v.business_name} is tomorrow. ` +
    `UGX ${v.amount_remaining} remaining — make your payment today at www.partna.io.`,

  campaign_complete: (v) =>
    `Partna: Hi ${v.name}, you have completed your ${v.campaign} target with ${v.business_name}. ` +
    `Well done! Visit www.partna.io to view your account.`,

  campaign_no_deposit: (v) =>
    `Partna: Hi ${v.name}, you have not made a payment toward ${v.campaign} with ${v.business_name} ` +
    `in ${v.days} days. You are ${v.percentage}% of the way there — keep going at www.partna.io.`,

}

// ── Phone number formatter ─────────────────────────────────────────────────
// Africa's Talking requires international format: +256XXXXXXXXX
function formatPhone(phone: string): string {
  if (!phone) return ''
  const clean = phone.replace(/[\s\-\(\)]/g, '')
  if (clean.startsWith('+256')) return clean
  if (clean.startsWith('256')) return '+' + clean
  if (clean.startsWith('0')) return '+256' + clean.slice(1)
  if (clean.startsWith('7')) return '+256' + clean
  return clean
}

// ── Send via Africa's Talking ──────────────────────────────────────────────
async function sendSMS(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formattedPhone = formatPhone(phone)
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' }

  const body = new URLSearchParams({
    username: AT_USERNAME,
    to:       formattedPhone,
    message,
  })
  if (AT_SENDER_ID) body.append('from', AT_SENDER_ID)

  try {
    const res = await fetch(AT_SMS_URL, {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey':       AT_API_KEY,
      },
      body: body.toString(),
    })

    const data = await res.json()
    const recipient = data.SMSMessageData?.Recipients?.[0]

    if (recipient?.status === 'Success') {
      return { success: true, messageId: recipient.messageId }
    }

    return {
      success: false,
      error: recipient?.status || 'Unknown AT error',
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Log SMS attempt to Supabase ────────────────────────────────────────────
async function logSMS(supabase: any, {
  customerId, phone, event, status, messageId, error
}: {
  customerId: string
  phone: string
  event: string
  status: string
  messageId?: string
  error?: string
}) {
  try {
    await supabase.from('sms_logs').insert({
      customer_id: customerId,
      phone,
      event,
      status,
      message_id: messageId || null,
      error: error || null,
    })
  } catch (e) {
    console.error('SMS log error:', e)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { event, phone, customerId, vars = {} } = await req.json()

    if (!event || !phone || !customerId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: event, phone, customerId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const template = TEMPLATES[event]
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown SMS event: ${event}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = template(vars)
    const result  = await sendSMS(phone, message)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await logSMS(supabase, {
      customerId,
      phone,
      event,
      status:    result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error:     result.error,
    })

    if (!result.success) {
      console.error(`SMS failed for event ${event} to ${phone}:`, result.error)
    }

    return new Response(JSON.stringify({
      success:   result.success,
      messageId: result.messageId,
      error:     result.error,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-sms error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})