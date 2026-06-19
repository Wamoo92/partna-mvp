import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Register() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [otherNames, setOtherNames] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [otp, setOtp] = useState('')
  const [otpId, setOtpId] = useState(null)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [customerId, setCustomerId] = useState(null)

  // ── Business logic — unchanged ────────────────────────────

  async function handleStep1() {
    setError('')
    if (!firstName || !lastName || !phone || !email) { setError('Please fill in all required fields.'); return }
    if (phone.replace(/\s+/g, '').length < 10) { setError('Please enter a valid phone number.'); return }
    if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email address.'); return }
    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')
      const cleanEmail = email.toLowerCase().trim()
      const { data: bizData } = await supabase.from('businesses').select('id').eq('kyb_status', 'verified').limit(1).maybeSingle()
      const resolvedBusinessId = bizData?.id || null
      const { data: existingPhone } = await supabase.from('customers').select('id').eq('phone', cleanPhone).eq('business_id', resolvedBusinessId).maybeSingle()
      if (existingPhone) { setError('This phone number is already registered. Please log in.'); setLoading(false); return }
      const { data: existingEmail } = await supabase.from('customers').select('id').eq('email', cleanEmail).maybeSingle()
      if (existingEmail) { setError('This email address is already registered. Please log in.'); setLoading(false); return }
      let partnaIdentityId = null
      const { data: existingIdentity } = await supabase.from('partna_identities').select('id').eq('phone', cleanPhone).maybeSingle()
      if (existingIdentity) {
        partnaIdentityId = existingIdentity.id
      } else {
        const { data: newIdentity, error: identityError } = await supabase.from('partna_identities').insert({ phone: cleanPhone, first_name: firstName, last_name: lastName }).select().single()
        if (!identityError && newIdentity) partnaIdentityId = newIdentity.id
      }
      const { data: customer, error: customerError } = await supabase.from('customers').insert({
        business_id: resolvedBusinessId, partna_identity_id: partnaIdentityId,
        full_name: `${firstName} ${lastName}`, first_name: firstName, last_name: lastName,
        other_names: otherNames || null, phone: cleanPhone, email: cleanEmail,
        kyc_status: 'pending', registration_status: 'phone_unverified',
      }).select().single()
      if (customerError) { console.error('Customer insert error:', customerError); setError('Could not create account. Please try again.'); setLoading(false); return }
      setCustomerId(customer.id)
      const otpCode = Math.floor(10000 + Math.random() * 90000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const { data: otpRecord, error: otpError } = await supabase.from('otp_verifications').insert({ phone: cleanPhone, otp_code: otpCode, status: 'pending', expires_at: expiresAt }).select().single()
      if (otpError) { console.error('OTP insert error:', otpError); setError('Could not send OTP. Please try again.'); setLoading(false); return }
      setOtpId(otpRecord.id)
      const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-otp-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ phone: cleanPhone, otp: otpCode }),
      })
      if (!smsRes.ok) { console.error('SMS send failed:', await smsRes.text()); setError('OTP SMS could not be sent. Please check your phone number and try again.'); setLoading(false); return }
      setStep(2)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2() {
    setError('')
    if (!otp || otp.length !== 5) { setError('Please enter the 5-digit OTP.'); return }
    setLoading(true)
    try {
      const { data: otpRecord, error: fetchError } = await supabase.from('otp_verifications').select('*').eq('id', otpId).single()
      if (fetchError || !otpRecord) { setError('OTP not found. Please go back and try again.'); setLoading(false); return }
      if (new Date(otpRecord.expires_at) < new Date()) { setError('OTP has expired. Please go back and request a new one.'); setLoading(false); return }
      if (otpRecord.otp_code !== otp) { setError('Incorrect OTP. Please check and try again.'); setLoading(false); return }
      await supabase.from('otp_verifications').update({ status: 'verified' }).eq('id', otpId)
      await supabase.from('customers').update({ registration_status: 'pin_pending' }).eq('id', customerId)
      setStep(3)
    } catch (err) {
      console.error('OTP verify error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep3() {
    setError('')
    if (!pin || pin.length !== 4) { setError('PIN must be exactly 4 digits.'); return }
    if (pin !== confirmPin) { setError('PINs do not match. Please try again.'); return }
    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')
      const cleanEmail = email.toLowerCase().trim()
      const password = `pin-${pin}-${cleanPhone}`
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password })
      if (authError) { console.error('Auth signup error:', authError); setError('Could not create login. Please try again.'); setLoading(false); return }
      await supabase.from('customers').update({ auth_user_id: authData.user.id, registration_status: 'complete' }).eq('id', customerId)
      await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      setTimeout(() => { navigate('/portal/select-campaign', { replace: true }) }, 500)
    } catch (err) {
      console.error('Step 3 error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step config ───────────────────────────────────────────

  const steps = [
    { label: 'Personal details', title: 'Create your account',  sub: 'Tell us a bit about yourself to get started.' },
    { label: 'Verify phone',     title: 'Verify your number',   sub: `We sent a 5-digit code to ${phone}.` },
    { label: 'Set PIN',          title: 'Set your PIN',         sub: "You'll use this every time you log in." },
  ]
  const current = steps[step - 1]

  // ── Inline style tokens — strict Sellin kit ───────────────
  const input = {
    display: 'block', width: '100%',
    padding: '10px 14px',
    fontSize: 14, fontWeight: 500, color: '#111111',
    background: '#FFFFFF',
    border: '1px solid #D5D9DD',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s',
  }

  const label = {
    display: 'block',
    fontSize: 14, fontWeight: 600,
    color: '#111111', letterSpacing: '-0.4px',
    marginBottom: 6,
  }

  const btnPrimary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: '#FFFFFF', background: '#111111',
    border: '1px solid #111111', borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const linkBtn = {
    background: 'none', border: 'none', padding: 0,
    fontSize: 14, fontWeight: 600, color: '#111111',
    cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  function focusInput(e)  { e.target.style.borderColor = '#111111' }
  function blurInput(e)   { e.target.style.borderColor = '#D5D9DD' }

  // ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7EE', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: '#FFFFFF', borderBottom: '1px solid #D7D8CB',
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: '#111111', letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>

        {step === 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#959687' }}>
            Have an account?&nbsp;
            <button onClick={() => navigate('/portal/login')} style={linkBtn}>Log in</button>
          </div>
        ) : (
          <button onClick={() => setStep(step - 1)} style={{ ...linkBtn, fontWeight: 500, color: '#959687', textDecoration: 'none' }}>
            ← Back
          </button>
        )}
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Stepper ── */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {steps.map((s, i) => {
              const n = i + 1
              const done   = n < step
              const active = n === step
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < steps.length ? 1 : 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: done || active ? '#111111' : '#FFFFFF',
                    border: `1px solid ${done || active ? '#111111' : '#D5D9DD'}`,
                    color: done || active ? '#FFFFFF' : '#898B90',
                    transition: 'all 0.2s',
                  }}>
                    {done ? '✓' : n}
                  </div>
                  {n < steps.length && (
                    <div style={{ flex: 1, height: 1, background: done ? '#111111' : '#D5D9DD', transition: 'background 0.3s' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#959687', marginBottom: 8 }}>
              Step {step} of 3 — {current.label}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111111', letterSpacing: '-1px', lineHeight: '130%', marginBottom: 6, margin: '0 0 6px' }}>
              {current.title}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#959687', lineHeight: '140%', margin: 0 }}>
              {current.sub}
            </p>
          </div>

          {/* ── Form card ── */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #D7D8CB',
            borderRadius: 12, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>

            {/* Error */}
            {error && (
              <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                {error}
              </div>
            )}

            {/* ── STEP 1 — Personal details ── */}
            {step === 1 && (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>First name <span style={{ color: '#CC3939' }}>*</span></label>
                    <input style={input} type="text" placeholder="John"
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Last name <span style={{ color: '#CC3939' }}>*</span></label>
                    <input style={input} type="text" placeholder="Doe"
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} />
                  </div>
                </div>

                <div>
                  <label style={label}>
                    Other names&nbsp;
                    <span style={{ fontWeight: 500, color: '#898B90' }}>(optional)</span>
                  </label>
                  <input style={input} type="text" placeholder="Middle name"
                    value={otherNames} onChange={e => setOtherNames(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput} />
                </div>

                <div>
                  <label style={label}>Phone number <span style={{ color: '#CC3939' }}>*</span></label>
                  <input style={input} type="tel" placeholder="+256 7XX XXX XXX"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput} />
                </div>

                <div>
                  <label style={label}>Email address <span style={{ color: '#CC3939' }}>*</span></label>
                  <input style={input} type="email" placeholder="john@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput} />
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#898B90', margin: '4px 0 0' }}>
                    Used for account recovery only.
                  </p>
                </div>

                <button style={btnPrimary} onClick={handleStep1} disabled={loading}>
                  {loading
                    ? <><div className="spinner spinner-sm spinner-light" /> Sending code…</>
                    : 'Continue'
                  }
                </button>
              </>
            )}

            {/* ── STEP 2 — OTP ── */}
            {step === 2 && (
              <>
                <div style={{ background: '#F6F7EE', border: '1px solid #D5D9DD', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#959687', lineHeight: '140%' }}>
                  A 5-digit code was sent to <strong style={{ color: '#111111', fontWeight: 600 }}>{phone}</strong>.
                </div>

                <div>
                  <label style={{ ...label, textAlign: 'center' }}>Verification code</label>
                  <input
                    style={{ ...input, textAlign: 'center', letterSpacing: '0.4em', fontSize: 28, fontWeight: 600 }}
                    type="text" inputMode="numeric" maxLength={5} placeholder="·····"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>

                <button style={btnPrimary} onClick={handleStep2} disabled={loading}>
                  {loading
                    ? <><div className="spinner spinner-sm spinner-light" /> Verifying…</>
                    : 'Verify code'
                  }
                </button>

                <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 500, color: '#959687', margin: 0 }}>
                  Didn't receive it?&nbsp;
                  <button onClick={() => { setStep(1); setOtp('') }} style={linkBtn}>Go back</button>
                </p>
              </>
            )}

            {/* ── STEP 3 — PIN ── */}
            {step === 3 && (
              <>
                <div style={{ background: '#E4F8EC', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#59886D', lineHeight: '140%' }}>
                  Phone verified. Create a 4-digit PIN to log in.
                </div>

                <div>
                  <label style={{ ...label, textAlign: 'center' }}>Create PIN</label>
                  <input
                    style={{ ...input, textAlign: 'center', letterSpacing: '0.5em', fontSize: 28, fontWeight: 600 }}
                    type="password" inputMode="numeric" maxLength={4} placeholder="····"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>

                <div>
                  <label style={{ ...label, textAlign: 'center' }}>Confirm PIN</label>
                  <input
                    style={{ ...input, textAlign: 'center', letterSpacing: '0.5em', fontSize: 28, fontWeight: 600 }}
                    type="password" inputMode="numeric" maxLength={4} placeholder="····"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>

                {pin.length === 4 && confirmPin.length === 4 && (
                  <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, margin: 0, color: pin === confirmPin ? '#59886D' : '#CC3939' }}>
                    {pin === confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
                  </p>
                )}

                <button style={btnPrimary} onClick={handleStep3} disabled={loading}>
                  {loading
                    ? <><div className="spinner spinner-sm spinner-light" /> Creating account…</>
                    : 'Create account'
                  }
                </button>
              </>
            )}

          </div>
          {/* end card */}

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ padding: '16px 20px', borderTop: '1px solid #D5D9DD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#898B90' }}>Powered by Partna</span>
      </footer>

    </div>
  )
}