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

function ok(data: unknown, req: Request) {
  return new Response(JSON.stringify(data), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function err(message: string, req: Request, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { customerId, email, phone, pin } = await req.json()

    if (!customerId || !email || !phone || !pin) {
      return err('Missing required fields', req)
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return err('PIN must be exactly 4 digits', req)
    }

    const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const cleanPhone = phone.replace(/\s+/g, '')
    const cleanEmail = email.toLowerCase().trim()
    const password   = `pin-${pin}-${cleanPhone}`

    // ── 1. Verify customer record exists ──────────────────────────────────
    const { data: customer, error: customerFetchError } = await supabase
      .from('customers')
      .select('id, email, phone, registration_status, auth_user_id')
      .eq('id', customerId)
      .maybeSingle()

    if (customerFetchError || !customer) {
      return err('Customer record not found', req)
    }

    // ── 2. Already complete — return success so client can sign in ────────
    if (customer.registration_status === 'complete' && customer.auth_user_id) {
      return ok({ success: true, alreadyComplete: true }, req)
    }

    // ── 2a. Authorization gates (E-5 fix — prevent account takeover) ──────
    // The customer must have passed OTP verification (verify-otp sets
    // 'pin_pending') and must not already have an auth user attached.
    if (customer.registration_status !== 'pin_pending' || customer.auth_user_id) {
      return err('Phone not verified. Please verify your phone number before setting a PIN.', req, 403)
    }

    // The supplied email must match the record — blocks ID-substitution where an
    // attacker supplies a valid customerId but their own email.
    if (!customer.email || customer.email.toLowerCase().trim() !== cleanEmail) {
      return err('Email does not match our records.', req, 403)
    }

    // The supplied phone must match the record (the auth password is derived from it).
    const recordPhone = String(customer.phone || '').replace(/\s+/g, '')
    if (!recordPhone || recordPhone !== cleanPhone) {
      return err('Phone does not match our records.', req, 403)
    }

    // A verified OTP for this phone must exist and be recent (last 30 minutes).
    // (otp_verifications has no updated_at column; created_at is the freshness key.)
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: recentOtp } = await supabase
      .from('otp_verifications')
      .select('id')
      .eq('phone', recordPhone)
      .eq('status', 'verified')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!recentOtp) {
      return err('Your phone verification has expired. Please restart registration.', req, 403)
    }

    // ── 3. Create auth user ───────────────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:         cleanEmail,
      password,
      email_confirm: true,
    })

    if (authError) {
      // User already exists from a previous partial attempt — find and use them
      if (authError.message?.toLowerCase().includes('already registered') ||
          authError.message?.toLowerCase().includes('already been registered')) {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) return err('Could not retrieve existing auth user', req)
        const existingUser = users.find(u => u.email === cleanEmail)
        if (!existingUser) return err('Auth user not found after conflict', req)

        const { error: updateError } = await supabase
          .from('customers')
          .update({ auth_user_id: existingUser.id, registration_status: 'complete' })
          .eq('id', customerId)

        if (updateError) return err(`Could not update customer: ${updateError.message}`, req)
        return ok({ success: true }, req)
      }

      return err(`Could not create auth user: ${authError.message}`, req)
    }

    // ── 4. Update customer with auth_user_id and mark complete ────────────
    const { error: updateError } = await supabase
      .from('customers')
      .update({ auth_user_id: authData.user.id, registration_status: 'complete' })
      .eq('id', customerId)

    if (updateError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return err(`Could not update customer: ${updateError.message}`, req)
    }

    return ok({ success: true }, req)

  } catch (e) {
    console.error('complete-customer-registration error:', e)
    return err(e.message || 'Unexpected error', req, 500)
  }
})
