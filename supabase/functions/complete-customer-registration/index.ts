import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin':  'https://www.partna.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { customerId, email, phone, pin } = await req.json()

    if (!customerId || !email || !phone || !pin) {
      return err('Missing required fields')
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return err('PIN must be exactly 4 digits')
    }

    const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const cleanPhone = phone.replace(/\s+/g, '')
    const cleanEmail = email.toLowerCase().trim()
    const password   = `pin-${pin}-${cleanPhone}`

    // ── 1. Verify customer record exists and is in expected state ─────────
    const { data: customer, error: customerFetchError } = await supabase
      .from('customers')
      .select('id, registration_status, auth_user_id')
      .eq('id', customerId)
      .eq('email', cleanEmail)
      .maybeSingle()

    if (customerFetchError || !customer) {
      return err('Customer record not found')
    }

    if (customer.registration_status === 'complete' && customer.auth_user_id) {
      // Already completed — return success so client can sign in
      return ok({ success: true, alreadyComplete: true })
    }

    // ── 2. Create auth user ───────────────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:         cleanEmail,
      password,
      email_confirm: true,
    })

    if (authError) {
      // If user already exists (e.g. from a previous partial attempt), look them up
      if (authError.message?.toLowerCase().includes('already registered') ||
          authError.message?.toLowerCase().includes('already been registered')) {
        // User exists — fetch their ID and proceed to update customer
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) return err('Could not retrieve existing auth user')
        const existingUser = users.find(u => u.email === cleanEmail)
        if (!existingUser) return err('Auth user not found after conflict')

        // Update customer record with existing auth user id
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            auth_user_id:        existingUser.id,
            registration_status: 'complete',
          })
          .eq('id', customerId)

        if (updateError) return err(`Could not update customer record: ${updateError.message}`)
        return ok({ success: true })
      }

      return err(`Could not create auth user: ${authError.message}`)
    }

    // ── 3. Update customer record with auth_user_id ───────────────────────
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        auth_user_id:        authData.user.id,
        registration_status: 'complete',
      })
      .eq('id', customerId)

    if (updateError) {
      // Clean up auth user if customer update fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return err(`Could not update customer record: ${updateError.message}`)
    }

    // ── 4. Return success — client will sign in ───────────────────────────
    return ok({ success: true })

  } catch (e) {
    console.error('complete-customer-registration error:', e)
    return err(e.message || 'Unexpected error', 500)
  }
})