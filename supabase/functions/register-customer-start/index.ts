import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!

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
    const { firstName, lastName, otherNames, phone, email } = await req.json()

    if (!firstName || !lastName || !phone || !email) return err('Please fill in all required fields.', req)
    const cleanPhone = String(phone).replace(/\s+/g, '')
    const cleanEmail = String(email).toLowerCase().trim()
    if (cleanPhone.length < 10)                              return err('Please enter a valid phone number.', req)
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) return err('Please enter a valid email address.', req)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // ── Resolve business (single verified business — same rule as before) ──
    const { data: biz } = await supabase
      .from('businesses').select('id').eq('kyb_status', 'verified').limit(1).maybeSingle()
    const businessId = biz?.id || null

    // ── Duplicate checks ──────────────────────────────────────────────────
    const { data: existingPhone } = await supabase
      .from('customers').select('id').eq('phone', cleanPhone).eq('business_id', businessId).maybeSingle()
    if (existingPhone) return err('This phone number is already registered. Please log in.', req)

    const { data: existingEmail } = await supabase
      .from('customers').select('id').eq('email', cleanEmail).maybeSingle()
    if (existingEmail) return err('This email address is already registered. Please log in.', req)

    // ── Partna identity (create if new) ───────────────────────────────────
    let partnaIdentityId: string | null = null
    let identityCreated = false
    const { data: existingIdentity } = await supabase
      .from('partna_identities').select('id').eq('phone', cleanPhone).maybeSingle()
    if (existingIdentity) {
      partnaIdentityId = existingIdentity.id
    } else {
      const { data: newIdentity } = await supabase
        .from('partna_identities').insert({ phone: cleanPhone, first_name: firstName, last_name: lastName }).select('id').single()
      if (newIdentity) { partnaIdentityId = newIdentity.id; identityCreated = true }
    }

    // ── Create customer ───────────────────────────────────────────────────
    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      business_id: businessId, partna_identity_id: partnaIdentityId,
      full_name: `${firstName} ${lastName}`, first_name: firstName, last_name: lastName,
      other_names: otherNames || null, phone: cleanPhone, email: cleanEmail,
      kyc_status: 'pending', registration_status: 'phone_unverified',
    }).select('id').single()
    if (customerError || !customer) {
      console.error('Customer insert error:', customerError)
      return err('Could not create account. Please try again.', req)
    }

    // ── Generate + store OTP ──────────────────────────────────────────────
    const otpCode   = Math.floor(10000 + Math.random() * 90000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications').insert({ phone: cleanPhone, otp_code: otpCode, status: 'pending', expires_at: expiresAt }).select('id').single()
    if (otpError || !otpRecord) {
      console.error('OTP insert error:', otpError)
      await supabase.from('customers').delete().eq('id', customer.id)
      if (identityCreated && partnaIdentityId) await supabase.from('partna_identities').delete().eq('id', partnaIdentityId)
      return err('Could not send OTP. Please try again.', req)
    }

    // ── Send the OTP SMS (delegated to send-otp-sms) ──────────────────────
    const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-otp-sms`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body:    JSON.stringify({ phone: cleanPhone, otp: otpCode }),
    })
    if (!smsRes.ok) {
      console.error('OTP SMS send failed:', await smsRes.text())
      // Roll back so the user can retry with the same phone/email.
      await supabase.from('otp_verifications').delete().eq('id', otpRecord.id)
      await supabase.from('customers').delete().eq('id', customer.id)
      if (identityCreated && partnaIdentityId) await supabase.from('partna_identities').delete().eq('id', partnaIdentityId)
      return err('OTP SMS could not be sent. Please check your phone number and try again.', req)
    }

    // The OTP code is never returned to the client — it is verified server-side.
    return json({ customerId: customer.id, otpId: otpRecord.id }, req)

  } catch (e) {
    console.error('register-customer-start error:', e)
    return err((e as Error).message || 'Unexpected error', req, 500)
  }
})
