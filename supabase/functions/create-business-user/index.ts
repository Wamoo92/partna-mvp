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

// ── Welcome email HTML ─────────────────────────────────────────────────────
function welcomeEmail(contactName: string, email: string, businessName: string, tempPassword: string): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />

      <h2 style="font-size: 22px; font-weight: 600; color: #111; letter-spacing: -0.5px; margin: 0 0 12px;">
        Welcome to Partna, ${contactName}
      </h2>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Your <strong>${businessName}</strong> account has been created on Partna.
        Use the credentials below to log in to your dashboard for the first time.
        You will be prompted to set a new password on your first login.
      </p>

      <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; overflow: hidden; margin: 0 0 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #D5D9DD;">
          <span style="font-size: 13px; font-weight: 500; color: #959687;">Email</span>
          <span style="font-size: 13px; font-weight: 600; color: #111;">${email}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
          <span style="font-size: 13px; font-weight: 500; color: #959687;">Temporary password</span>
          <span style="font-size: 15px; font-weight: 700; color: #111; font-family: monospace; letter-spacing: 0.08em;">${tempPassword}</span>
        </div>
      </div>

      <a href="https://www.partna.io/dashboard/login"
        style="display: inline-block; padding: 13px 28px; background: #111; color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; margin: 0 0 24px;">
        Log in to your dashboard →
      </a>

      <p style="font-size: 13px; color: #959687; line-height: 1.6; margin: 0 0 8px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size: 13px; color: #111; word-break: break-all; margin: 0 0 28px;">
        https://www.partna.io/dashboard/login
      </p>

      <div style="border-top: 1px solid #D7D8CB; padding-top: 20px;">
        <p style="font-size: 12px; color: #959687; margin: 0; line-height: 1.6;">
          For security, you will be asked to change your password immediately after your first login.
          If you did not expect this email, please contact
          <a href="mailto:support@partna.io" style="color: #111; font-weight: 600;">support@partna.io</a>.
        </p>
      </div>

      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      email,
      password,
      businessName,
      sector,
      phone,
      website,
      address,
      contactName,
      contactPhone,
      plan,
      billingCycle,
      trialEndsAt,
      subscriptionExpiresAt,
      inviteToken,
    } = await req.json()

    // ── Validate required fields ───────────────────────────────────────────
    if (!email || !password || !businessName || !sector || !contactName || !plan || !inviteToken) {
      return err('Missing required fields')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // ── Step 1: Create auth user ───────────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      const msg = authError.message || ''
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        return err('This email is already registered. Please use a different email address.')
      }
      return err(`Could not create user account: ${msg}`)
    }

    const authUserId = authData.user.id

    // ── Step 2: Create business record ────────────────────────────────────
    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .insert({
        name:                    businessName,
        sector,
        phone:                   phone || null,
        website:                 website || null,
        address:                 address || null,
        admin_email:             email,
        contact_email:           email,
        subscription_package:    plan,
        subscription_status:     'active',
        subscription_expires_at: subscriptionExpiresAt,
        trial_ends_at:           trialEndsAt || null,
        kyb_status:              'verified',
        status:                  'active',
      })
      .select()
      .single()

    if (bizError || !bizData) {
      // Clean up auth user before returning error
      await supabase.auth.admin.deleteUser(authUserId)
      return err(`Could not create business record: ${bizError?.message || 'Unknown error'}`)
    }

    // ── Step 3: Create business admin record ──────────────────────────────
    const { error: adminError } = await supabase
      .from('business_admins')
      .insert({
        business_id:  bizData.id,
        auth_user_id: authUserId,
        full_name:    contactName,
        email:        email,
        phone:        contactPhone || null,
        role:         'owner',
        first_login:  true,
        invite_token: inviteToken,
      })

    if (adminError) {
      // Clean up business and auth user before returning error
      await supabase.from('businesses').delete().eq('id', bizData.id)
      await supabase.auth.admin.deleteUser(authUserId)
      return err(`Could not create admin record: ${adminError.message}`)
    }

    // ── Step 4: Send welcome email ─────────────────────────────────────────
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          to:      email,
          from:    'support',
          subject: `Welcome to Partna — your ${businessName} account is ready`,
          html:    welcomeEmail(contactName, email, businessName, password),
        }),
      })
    } catch (emailErr) {
      // Email failure is non-critical — account was created successfully
      console.error('Welcome email error (non-critical):', emailErr)
    }

    // ── Step 5: Return success ─────────────────────────────────────────────
    return ok({
      success:    true,
      businessId: bizData.id,
      authUserId,
    })

  } catch (e) {
    console.error('create-business-user error:', e)
    return err(e.message || 'Unexpected error', 500)
  }
})