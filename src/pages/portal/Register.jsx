import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const BUSINESS_ID = 'a1b2c3d4-0000-0000-0000-000000000001'
const CAMPAIGN_ID = 'b1b2c3d4-0000-0000-0000-000000000001'

function generateDrawCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SC-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

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

      const { data: existingPhone } = await supabase
        .from('customers').select('id').eq('phone', cleanPhone).maybeSingle()
      if (existingPhone) {
        setError('This phone number is already registered. Please log in.')
        setLoading(false)
        return
      }

      const { data: existingEmail } = await supabase
        .from('customers').select('id').eq('email', cleanEmail).maybeSingle()
      if (existingEmail) {
        setError('This email address is already registered. Please log in.')
        setLoading(false)
        return
      }

      const drawCode = generateDrawCode()

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: BUSINESS_ID,
          campaign_id: CAMPAIGN_ID,
          full_name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          other_names: otherNames || null,
          phone: cleanPhone,
          email: cleanEmail,
          draw_code: drawCode,
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
        .insert({
          phone: cleanPhone,
          otp_code: otpCode,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select()
        .single()

      if (otpError) {
        console.error('OTP insert error:', otpError)
        setError('Could not send OTP. Please try again.')
        setLoading(false)
        return
      }

      setOtpId(otpRecord.id)
      // Demo: show OTP in alert
      // Production: send via Twilio SMS + Twilio SendGrid email
      alert(`Demo mode — your OTP is: ${otpCode}`)
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
        navigate('/portal/kyc', { replace: true })
      }, 500)

    } catch (err) {
      console.error('Step 3 error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          className="text-white text-xl leading-none">
          ←
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt={brand.businessName}
            className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold tracking-wide">
            {brand.businessName}
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 pb-8 text-center" style={{ background: brand.primaryColor }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="rounded-full transition-all"
              style={{
                width: s === step ? '24px' : '8px',
                height: '8px',
                background: s === step
                  ? brand.secondaryColor
                  : s < step
                  ? 'rgba(212,175,55,0.5)'
                  : 'rgba(255,255,255,0.25)',
              }} />
          ))}
        </div>
        <h1 className="text-white text-lg font-bold mb-1">
          {step === 1 && 'Create your account'}
          {step === 2 && 'Verify your phone'}
          {step === 3 && 'Set your PIN'}
        </h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {step === 1 && 'Step 1 of 3 — Personal details'}
          {step === 2 && 'Step 2 of 3 — Phone verification'}
          {step === 3 && 'Step 3 of 3 — Security PIN'}
        </p>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {step === 1 && (
          <>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>First name *</label>
                <input type="text" placeholder="Grace" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Last name *</label>
                <input type="text" placeholder="Nakamya" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Other names <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
              </label>
              <input type="text" placeholder="Middle name" value={otherNames}
                onChange={e => setOtherNames(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Phone number *</label>
              <input type="tel" placeholder="+256 7XX XXX XXX" value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Email address *</label>
              <input type="email" placeholder="grace@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                Used for account recovery if you forget your PIN
              </div>
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handleStep1} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-1"
              style={{ background: loading ? 'rgba(27,79,114,0.4)' : brand.primaryColor, color: '#fff', border: 'none' }}>
              {loading ? 'Please wait...' : 'Continue'}
            </button>

            <div className="text-center">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Already have an account? </span>
              <button onClick={() => navigate('/portal/login')}
                className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Log in
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="px-4 py-3 rounded-xl text-xs"
              style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
              A 5-digit OTP has been sent to <strong>{phone}</strong> and <strong>{email}</strong>.
              Enter it below to verify your phone number.
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Enter OTP</label>
              <input type="text" inputMode="numeric" maxLength={5}
                placeholder="_ _ _ _ _" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none text-center tracking-widest font-mono"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333', fontSize: '20px' }} />
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handleStep2} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-1"
              style={{ background: loading ? 'rgba(27,79,114,0.4)' : brand.primaryColor, color: '#fff', border: 'none' }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="px-4 py-3 rounded-xl text-xs"
              style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
              Phone verified. Create a 4-digit PIN you will use to log in.
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Create PIN</label>
              <input type="password" inputMode="numeric" maxLength={4}
                placeholder="••••" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest text-center"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333', fontSize: '20px' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={4}
                placeholder="••••" value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest text-center"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333', fontSize: '20px' }} />
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handleStep3} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-1"
              style={{ background: loading ? 'rgba(212,175,55,0.4)' : brand.secondaryColor, color: brand.primaryColor, border: 'none' }}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </>
        )}

      </div>

      <footer className="text-center py-4" style={{ background: '#f0f2f5' }}>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/partna-icon.svg" alt="Partna" className="w-5 h-5" />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>Powered by Partna</span>
        </div>
      </footer>

    </div>
  )
}