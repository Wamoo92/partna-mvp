import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

function generateDrawCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SC-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function sendSMS(customerId: string, phone: string, event: string, vars: Record<string, string>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

// Server-side campaign enrolment. Replaces the client-side insert in
// SelectCampaign.jsx. The caller is identified by their JWT; customer_id and
// business_id are derived from the customers row (never trusted from the client).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { campaignId, studentId } = await req.json()
    if (!campaignId) return json({ error: 'Missing campaignId' }, req, 400)

    // ── Authenticate ──────────────────────────────────────────────────────
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, req, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) return json({ error: 'Unauthorized' }, req, 401)

    const { data: customer } = await supabase
      .from('customers').select('id, business_id, phone, first_name').eq('auth_user_id', authUser.id).maybeSingle()
    if (!customer) return json({ error: 'Customer not found' }, req, 403)

    // ── Validate campaign belongs to the caller's business ────────────────
    const { data: campaign } = await supabase
      .from('campaigns').select('id, business_id, campaign_type, name, status').eq('id', campaignId).maybeSingle()
    if (!campaign) return json({ error: 'Campaign not found' }, req, 404)
    if (campaign.status !== 'active') return json({ error: 'Campaign is not active' }, req, 400)
    if (campaign.business_id !== customer.business_id) return json({ error: 'Forbidden' }, req, 403)

    // ── Education: validate the student and one-active-campaign rule ───────
    const isEdu = campaign.campaign_type === 'education_fees'
    let validStudentId: string | null = null
    if (isEdu) {
      if (!studentId) return json({ error: 'A student is required for this campaign.' }, req, 400)
      const { data: student } = await supabase
        .from('students').select('id, business_id, is_active').eq('id', studentId).maybeSingle()
      if (!student || student.business_id !== customer.business_id || !student.is_active) {
        return json({ error: 'Invalid student.' }, req, 403)
      }
      const { data: studentEnroll } = await supabase
        .from('customer_campaigns').select('id').eq('student_id', studentId).eq('status', 'active').limit(1).maybeSingle()
      if (studentEnroll) {
        return json({ error: 'This student is already enrolled in an active campaign.' }, req, 409)
      }
      validStudentId = studentId
    }

    // ── Idempotency: already enrolled in this campaign → return it ─────────
    const { data: existing } = await supabase
      .from('customer_campaigns').select('id')
      .eq('customer_id', customer.id).eq('campaign_id', campaignId).eq('status', 'active').limit(1).maybeSingle()
    if (existing) return json({ success: true, alreadyEnrolled: true, enrollmentId: existing.id }, req)

    // Was this their first active enrollment? (controls KYC vs home routing)
    const { count: priorCount } = await supabase
      .from('customer_campaigns').select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id).eq('status', 'active')
    const firstEnrollment = (priorCount || 0) === 0

    // ── Insert enrollment, then wallet, then link (rollback on wallet fail)─
    const drawCode = generateDrawCode()
    const { data: enrollment, error: enrollErr } = await supabase
      .from('customer_campaigns')
      .insert({
        customer_id: customer.id, campaign_id: campaignId, business_id: customer.business_id,
        draw_code: drawCode, status: 'active', ...(validStudentId ? { student_id: validStudentId } : {}),
      })
      .select('id').single()
    if (enrollErr || !enrollment) {
      console.error('enroll-campaign: enrollment insert failed', enrollErr)
      return json({ error: 'Could not enroll. Please try again.' }, req, 500)
    }

    const { data: wallet, error: walletErr } = await supabase
      .from('wallets').insert({ customer_id: customer.id, customer_campaign_id: enrollment.id, balance: 0 }).select('id').single()
    if (walletErr || !wallet) {
      // Roll back the enrollment so we never leave an orphaned, unfundable row.
      await supabase.from('customer_campaigns').delete().eq('id', enrollment.id)
      console.error('enroll-campaign: wallet insert failed, rolled back', walletErr)
      return json({ error: 'Could not create wallet. Please try again.' }, req, 500)
    }
    await supabase.from('customer_campaigns').update({ wallet_id: wallet.id }).eq('id', enrollment.id)

    if (customer.phone) {
      await sendSMS(customer.id, customer.phone, 'campaign_enrolled', { campaign: campaign.name, draw_code: drawCode })
    }

    return json({ success: true, enrollmentId: enrollment.id, walletId: wallet.id, firstEnrollment }, req)

  } catch (e) {
    console.error('enroll-campaign error:', e)
    return json({ error: 'Unexpected error' }, req, 500)
  }
})
