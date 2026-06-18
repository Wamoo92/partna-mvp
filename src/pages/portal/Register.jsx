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

  async function handleStep1() {
    setError('')
    if (!firstName || !lastName || !phone || !email) {
      setError('Please fill in all required fields.')
      return
    }
    if (phone.replace(/\s+/g, '').length < 10) {
      setError('Please enter a valid phone number.')
      return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')
      const cleanEmail = email.toLowerCase().trim()

      const { data: bizData } = await supabase
        .from('businesses')
        .select('id')
        .eq('kyb_status', 'verified')
        .limit(1)
        .maybeSingle()

      const resolvedBusinessId = bizData?.id || null

      const { data: existingPhone } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', cleanPhone)
        .eq('business_id', resolvedBusinessId)
        .maybeSingle()

      if (existingPhone) {
        setError('This phone number is already registered. Please log in.')
        setLoading(false)
        return
      }

      const { data: existingEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (existingEmail) {
        setError('This email address is already registered. Please log in.')
        setLoading(false)
        return
      }

      let partnaIdentityId = null
      const { data: existingIdentity } = await supabase
        .from('partna_identities')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existingIdentity) {
        partnaIdentityId = existingIdentity.id
      } else {
        const { data: newIdentity, error: identityError } = await supabase
          .from('partna_identities')
          .insert({ phone: cleanPhone, first_name: firstName, last_name: lastName })
          .select()
          .single()

        if (!identityError && newIdentity) {
          partnaIdentityId = newIdentity.id
        }
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: resolvedBusinessId,
          partna_identity_id: partnaIdentityId,
          full_name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          other_names: otherNames || null,
          phone: cleanPhone,
          email: cleanEmail,
          kyc_status: 'pending',
          registration_status: 'phone_unverified',
        })
        .select()
        .single()

      if (customerError) {
        console.error('Customer insert error:', customerError)
        setError('Could not create account. Please try again.')
        setLoading(false)
        return
      }

      setCustomerId(customer.id)

      const otpCode = Math.floor(10000 + Math.random() * 90000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      const { data: otpRecord, error: otpError } = await supabase
        .from('otp_verifications')
        .insert({ phone: cleanPhone, otp_code: otpCode, status: 'pending', expires_at: expiresAt })
        .select()
        .single()

      if (otpError) {
        console.error('OTP insert error:', otpError)
        setError('Could not send OTP. Please try again.')
        setLoading(false)
        return
      }

      setOtpId(otpRecord.id)

      const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-otp-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: cleanPhone, otp: otpCode }),
      })

      if (!smsRes.ok) {
        console.error('SMS send failed:', await smsRes.text())
        setError('OTP SMS could not be sent. Please check your phone number and try again.')
        setLoading(false)
        return
      }

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
    if (!otp || otp.length !== 5) {
      setError('Please enter the 5-digit OTP.')
      return
    }

    setLoading(true)
    try {
      const { data: otpRecord, error: fetchError } = await supabase
        .from('otp_verifications').select('*').eq('id', otpId).single()

      if (fetchError || !otpRecord) {
        setError('OTP not found. Please go back and try again.')
        setLoading(false)
        return
      }
      if (new Date(otpRecord.expires_at) < new Date()) {
        setError('OTP has expired. Please go back and request a new one.')
        setLoading(false)
        return
      }
      if (otpRecord.otp_code !== otp) {
        setError('Incorrect OTP. Please check and try again.')
        setLoading(false)
        return
      }

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
    if (!pin || pin.length !== 4) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.')
      return
    }

    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')
      const cleanEmail = email.toLowerCase().trim()
      const password = `pin-${pin}-${cleanPhone}`

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })

      if (authError) {
        console.error('Auth signup error:', authError)
        setError('Could not create login. Please try again.')
        setLoading(false)
        return
      }

      await supabase.from('customers').update({
        auth_user_id: authData.user.id,
        registration_status: 'complete',
      }).eq('id', customerId)

      await supabase.auth.signInWithPassword({ email: cleanEmail, password })

      setTimeout(() => {
        navigate('/portal/select-campaign', { replace: true })
      }, 500)
    } catch (err) {
      console.error('Step 3 error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = ['Personal details', 'Verify phone', 'Set PIN']
  const stepTitles = ['Create your account', 'Verify your phone', 'Set your PIN']
  const stepSubs   = ['Step 1 of 3 — Personal details', 'Step 2 of 3 — Phone verification', 'Step 3 of 3 — Security PIN']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent',
            color: 'var(--color-white)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'border-color var(--transition-base)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {brand.logoUrl && (
            <div style={{
              width: 32, height: 32,
              border: '2px solid var(--color-primary)',
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src={brand.logoUrl} alt={brand.businessName}
                style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
          )}
          <span style={{
            color: 'var(--color-white)',
            fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-sm)',
            letterSpacing: 'var(--tracking-tight)',
          }}>
            {brand.businessName}
          </span>
        </div>
      </header>

      {/* ── Step banner ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
        {/* Step tracker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginBottom: 'var(--space-5)',
        }}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 3 ? 1 : 0 }}>
              {/* Circle */}
              <div style={{
                width: 28,
                height: 28,
                border: s <= step ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                background: s < step
                  ? 'var(--color-primary)'
                  : s === step
                  ? 'var(--color-black)'
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all var(--transition-base)',
              }}>
                {s < step
                  ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                  : <span style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-black)',
                      color: s === step ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
                    }}>{s}</span>
                }
              </div>
              {/* Connector line */}
              {s < 3 && (
                <div style={{
                  flex: 1,
                  height: 2,
                  background: s < step ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
                  transition: 'background var(--transition-slow)',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step label pill */}
        <div style={{
          display: 'inline-block',
          background: 'var(--color-primary)',
          border: 'var(--border)',
          padding: '3px var(--space-3)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'var(--color-black)',
          marginBottom: 'var(--space-3)',
        }}>
          {stepSubs[step - 1]}
        </div>

        <h1 style={{
          color: 'var(--color-white)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)',
          lineHeight: 'var(--leading-tight)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
        }}>
          {stepTitles[step - 1]}
        </h1>
      </div>

      {/* ── Form area ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-6) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* ── STEP 1 — Personal details ── */}
        {step === 1 && (
          <>
            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">
                  First name <span className="required">*</span>
                </label>
                <input type="text" className="input" placeholder="John"
                  value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">
                  Last name <span className="required">*</span>
                </label>
                <input type="text" className="input" placeholder="Doe"
                  value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                Other names{' '}
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>
                  (optional)
                </span>
              </label>
              <input type="text" className="input" placeholder="Middle name"
                value={otherNames} onChange={e => setOtherNames(e.target.value)} />
            </div>

            <div className="input-group">
              <label className="input-label">
                Phone number <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">phone</span>
                <input type="tel" className="input" placeholder="+256 7XX XXX XXX"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                Email address <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">mail</span>
                <input type="email" className="input" placeholder="johndoe@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <span className="input-hint">Used for account recovery if you forget your PIN.</span>
            </div>

            <button
              onClick={handleStep1}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Sending OTP…</>
                : <><span className="icon-outlined icon-sm">arrow_forward</span> Continue</>
              }
            </button>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Already have an account?{' '}
              </span>
              <button
                onClick={() => navigate('/portal/login')}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                  color: 'var(--color-black)', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>
                Log in
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2 — OTP verification ── */}
        {step === 2 && (
          <>
            <div className="alert alert-info" style={{ background: '#E8F4FD' }}>
              <span className="icon-outlined alert-icon" style={{ color: '#1565C0' }}>sms</span>
              <div className="alert-content">
                A 5-digit OTP has been sent via SMS to <strong>{phone}</strong>.
                Enter it below to verify your number.
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Enter OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                className="input"
                placeholder="_ _ _ _ _"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.4em',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-black)',
                  fontVariationSettings: "'wdth' 100, 'opsz' 30",
                }}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Didn't receive it?{' '}
              </span>
              <button
                onClick={() => { setStep(1); setOtp('') }}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                  color: 'var(--color-black)', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>
                Go back and resend
              </button>
            </div>

            <button
              onClick={handleStep2}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Verifying…</>
                : <><span className="icon-outlined icon-sm">verified</span> Verify OTP</>
              }
            </button>
          </>
        )}

        {/* ── STEP 3 — Set PIN ── */}
        {step === 3 && (
          <>
            <div className="alert alert-success">
              <span className="icon-outlined alert-icon">check_circle</span>
              <div className="alert-content">
                Phone verified. Create a 4-digit PIN you'll use to log in every time.
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Create PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="input"
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-black)',
                }}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="input"
                placeholder="••••"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-black)',
                }}
              />
            </div>

            {/* PIN match indicator */}
            {pin.length === 4 && confirmPin.length === 4 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                color: pin === confirmPin ? '#2D8B45' : '#C0392B',
              }}>
                <span className="icon-outlined icon-sm">
                  {pin === confirmPin ? 'check_circle' : 'cancel'}
                </span>
                {pin === confirmPin ? 'PINs match' : 'PINs do not match'}
              </div>
            )}

            <button
              onClick={handleStep3}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Creating account…</>
                : <><span className="icon-outlined icon-sm">person_add</span> Create account</>
              }
            </button>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={{
        padding: 'var(--space-4) var(--space-5)',
        borderTop: '1.5px solid var(--color-grey-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}>
        <img src="/partna-icon.svg" alt="Partna" style={{ width: 18, height: 18, opacity: 0.4 }} />
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          color: 'var(--color-grey)',
        }}>
          Powered by Partna
        </span>
      </footer>

    </div>
  )
}