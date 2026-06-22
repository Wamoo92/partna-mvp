import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Helpers ────────────────────────────────────────────────────────────────

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateInviteToken() {
  return crypto.randomUUID()
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

async function sendEmail(to, subject, html) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    })
  } catch (e) {
    console.error('Welcome email error (non-critical):', e)
  }
}

function welcomeEmail({ contactName, businessName, registrationLink }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />

      <h2 style="font-size: 22px; font-weight: 600; color: #111; letter-spacing: -0.5px; margin: 0 0 12px;">
        Welcome to Partna, ${contactName}
      </h2>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Your <strong>${businessName}</strong> account has been created on Partna.
        Click the button below to set up your password and access your dashboard.
      </p>

      <a href="${registrationLink}"
        style="display: inline-block; padding: 13px 28px; background: #111; color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; margin: 0 0 24px;">
        Set up your account →
      </a>

      <p style="font-size: 13px; color: #959687; line-height: 1.6; margin: 0 0 8px;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 13px; color: #111; word-break: break-all; margin: 0 0 28px;">
        ${registrationLink}
      </p>

      <div style="border-top: 1px solid #D7D8CB; padding-top: 20px;">
        <p style="font-size: 12px; color: #959687; margin: 0; line-height: 1.6;">
          This link is unique to your account and can only be used once.
          If you did not expect this email, please ignore it or contact
          <a href="mailto:support@partna.io" style="color: #111; font-weight: 600;">support@partna.io</a>.
        </p>
      </div>

      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

const inputStyle = {
  display: 'block', width: '100%', padding: '9px 12px',
  fontSize: 13, fontWeight: 500, color: C.black,
  background: C.white, border: `1px solid ${C.grayLine}`,
  borderRadius: 8, outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  transition: 'border-color 0.15s', boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: C.black, marginBottom: 5,
}
const hintStyle = {
  fontSize: 11, fontWeight: 500, color: C.grayMid, marginTop: 4,
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  )
}

function SectionTitle({ title }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.grayLine}`, paddingBottom: 10, marginBottom: 4 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function OnboardBusiness() {
  const navigate = useNavigate()

  // Form fields
  const [businessName, setBusinessName]       = useState('')
  const [sector, setSector]                   = useState('')
  const [phone, setPhone]                     = useState('')
  const [website, setWebsite]                 = useState('')
  const [address, setAddress]                 = useState('')
  const [contactName, setContactName]         = useState('')
  const [contactEmail, setContactEmail]       = useState('')
  const [contactPhone, setContactPhone]       = useState('')
  const [plan, setPlan]                       = useState('starter')
  const [billingCycle, setBillingCycle]       = useState('monthly')
  const [trialDays, setTrialDays]             = useState('90')

  // Submission state
  const [submitting, setSubmitting]           = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(null) // { businessName, contactName, contactEmail, tempPassword }

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    if (!businessName.trim())  return 'Business name is required.'
    if (!sector)               return 'Please select a sector.'
    if (!contactName.trim())   return 'Contact name is required.'
    if (!contactEmail.trim())  return 'Contact email is required.'
    if (!contactEmail.includes('@')) return 'Please enter a valid email address.'
    if (!plan)                 return 'Please select a subscription plan.'
    const days = parseInt(trialDays, 10)
    if (isNaN(days) || days < 0) return 'Trial days must be a number of 0 or more.'
    return null
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true); setError('')

    try {
      const now          = new Date()
      const tempPassword = generateTempPassword()
      const inviteToken  = generateInviteToken()
      const trialDaysInt = parseInt(trialDays, 10)
      const trialEndsAt  = trialDaysInt > 0 ? addDays(now, trialDaysInt) : null

      // ── 1. Create auth user ────────────────────────────────────────────
      // Uses the service role client so Partna admin can create users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email:          contactEmail.trim().toLowerCase(),
        password:       tempPassword,
        email_confirm:  true,
      })

      if (authError) {
        if (authError.message?.includes('already registered')) {
          setError('This email is already registered. Please use a different email address.')
        } else {
          setError(`Could not create user account: ${authError.message}`)
        }
        setSubmitting(false); return
      }

      const authUserId = authData.user.id

      // ── 2. Create business record ──────────────────────────────────────
      const { data: bizData, error: bizError } = await supabase
        .from('businesses')
        .insert({
          name:                   businessName.trim(),
          sector,
          phone:                  phone.trim() || null,
          website:                website.trim() || null,
          address:                address.trim() || null,
          admin_email:            contactEmail.trim().toLowerCase(),
          subscription_package:   plan,
          subscription_status:    'active',
          subscription_expires_at: trialEndsAt || addDays(now, billingCycle === 'annual' ? 365 : 30),
          trial_ends_at:          trialEndsAt,
          kyb_status:             'not_submitted',
          status:                 'active',
        })
        .select()
        .single()

      if (bizError || !bizData) {
        // Rollback auth user
        await supabase.auth.admin.deleteUser(authUserId)
        setError(`Could not create business record: ${bizError?.message || 'Unknown error'}`)
        setSubmitting(false); return
      }

      // ── 3. Create business admin record ───────────────────────────────
      const { error: adminError } = await supabase
        .from('business_admins')
        .insert({
          business_id:  bizData.id,
          auth_user_id: authUserId,
          full_name:    contactName.trim(),
          email:        contactEmail.trim().toLowerCase(),
          phone:        contactPhone.trim() || null,
          role:         'owner',
          first_login:  true,
          invite_token: inviteToken,
        })

      if (adminError) {
        // Rollback both
        await supabase.from('businesses').delete().eq('id', bizData.id)
        await supabase.auth.admin.deleteUser(authUserId)
        setError(`Could not create admin record: ${adminError.message}`)
        setSubmitting(false); return
      }

      // ── 4. Send welcome email ──────────────────────────────────────────
      const registrationLink = `https://www.partna.io/dashboard/register?token=${inviteToken}`
      await sendEmail(
        contactEmail.trim().toLowerCase(),
        `Welcome to Partna — set up your ${businessName.trim()} account`,
        welcomeEmail({
          contactName:      contactName.trim(),
          businessName:     businessName.trim(),
          registrationLink,
        })
      )

      // ── 5. Show success ────────────────────────────────────────────────
      setSuccess({
        businessName:  businessName.trim(),
        contactName:   contactName.trim(),
        contactEmail:  contactEmail.trim().toLowerCase(),
        tempPassword,
        trialDays:     trialDaysInt,
        plan,
      })

    } catch (e) {
      console.error('Onboard error:', e)
      setError('Something went wrong. Please try again.')
    }

    setSubmitting(false)
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, overflow: 'hidden' }}>

          {/* Green header */}
          <div style={{ background: C.green, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: 20, fontWeight: 600, color: C.white, margin: 0, letterSpacing: '-0.5px' }}>
              {success.businessName} onboarded
            </p>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
              Account created and welcome email sent to {success.contactEmail}
            </p>
          </div>

          {/* Details */}
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Business',       value: success.businessName },
              { label: 'Contact',        value: success.contactName },
              { label: 'Email',          value: success.contactEmail },
              { label: 'Plan',           value: success.plan.charAt(0).toUpperCase() + success.plan.slice(1) },
              { label: 'Free trial',     value: success.trialDays > 0 ? `${success.trialDays} days` : 'No trial — billing starts immediately' },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
              </div>
            ))}

            {/* Temp password — for Partna admin reference */}
            <div style={{ margin: '16px 0 0', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Temporary password (admin reference only)</p>
              <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: C.black, margin: '0 0 6px', letterSpacing: '0.08em' }}>{success.tempPassword}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: 0 }}>
                This password is not shown again. The business admin will be prompted to change it on first login. The welcome email contains their registration link — not this password.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '0 28px 24px', display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setSuccess(null); setBusinessName(''); setSector(''); setPhone(''); setWebsite(''); setAddress(''); setContactName(''); setContactEmail(''); setContactPhone(''); setPlan('starter'); setBillingCycle('monthly'); setTrialDays('90') }}
              style={{ flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Onboard another
            </button>
            <button
              onClick={() => navigate('/admin/businesses')}
              style={{ flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              View all businesses
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Back link */}
      <button
        onClick={() => navigate('/admin/businesses')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.secondary, fontSize: 13, fontWeight: 500, padding: '0 0 20px', fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to businesses
      </button>

      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.grayLine}`, background: C.black }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: C.white, margin: '0 0 3px', letterSpacing: '-0.5px' }}>Onboard new business</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Creates the business account, sends a welcome email with a registration link
          </p>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Error */}
          {error && (
            <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.red }}>
              {error}
            </div>
          )}

          {/* ── Business details ── */}
          <SectionTitle title="Business details" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Business name *">
              <input type="text" style={inputStyle} value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Kampala Parents School"
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>

            <Field label="Sector *">
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={sector} onChange={e => setSector(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}>
                <option value="">Select sector</option>
                <option value="Education">Education</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Retail">Retail</option>
                <option value="Travel">Travel</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Business phone" hint="Optional">
              <input type="text" style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +256 700 000000"
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>

            <Field label="Website" hint="Optional">
              <input type="text" style={inputStyle} value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="e.g. www.school.ac.ug"
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>
          </div>

          <Field label="Address" hint="Optional — street, area, city">
            <input type="text" style={inputStyle} value={address} onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Plot 12 Kololo Hill Drive, Kampala"
              onFocus={e => e.target.style.borderColor = C.black}
              onBlur={e => e.target.style.borderColor = C.grayLine} />
          </Field>

          {/* ── Contact / first admin ── */}
          <SectionTitle title="Primary contact (first admin)" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Full name *">
              <input type="text" style={inputStyle} value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="e.g. Sarah Nakato"
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>

            <Field label="Email address *" hint="This will be their dashboard login email">
              <input type="email" style={inputStyle} value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                placeholder="e.g. sarah@school.ac.ug"
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>
          </div>

          <Field label="Contact phone" hint="Optional">
            <input type="text" style={inputStyle} value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="e.g. +256 700 000000"
              onFocus={e => e.target.style.borderColor = C.black}
              onBlur={e => e.target.style.borderColor = C.grayLine} />
          </Field>

          {/* ── Subscription ── */}
          <SectionTitle title="Subscription" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="Plan *">
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={plan} onChange={e => setPlan(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}>
                <option value="starter">Starter — $49/mo</option>
                <option value="growth">Growth — $149/mo</option>
                <option value="enterprise">Enterprise — $399/mo</option>
              </select>
            </Field>

            <Field label="Billing cycle *">
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={billingCycle} onChange={e => setBillingCycle(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </Field>

            <Field label="Free trial days" hint="0 = no trial, billing starts immediately">
              <input type="number" min="0" max="365" style={inputStyle} value={trialDays} onChange={e => setTrialDays(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine} />
            </Field>
          </div>

          {/* Trial summary */}
          {parseInt(trialDays, 10) > 0 && (
            <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>
              Free trial runs for <strong>{trialDays} days</strong> from today. Billing starts on{' '}
              <strong>{new Date(addDays(new Date(), parseInt(trialDays, 10))).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
            </div>
          )}

          {parseInt(trialDays, 10) === 0 && (
            <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.orange }}>
              No free trial. The {billingCycle === 'annual' ? '365-day' : '30-day'} billing period starts immediately.
            </div>
          )}

          {/* Submit */}
          <div style={{ borderTop: `1px solid ${C.grayLine}`, paddingTop: 20, display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/admin/businesses')}
              style={{ padding: '11px 20px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: submitting ? 0.7 : 1, fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {submitting
                ? <><div className="spinner spinner-sm spinner-light" /> Creating account…</>
                : 'Create account and send welcome email'
              }
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}