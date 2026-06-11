import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function Login() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Forgot PIN states
  const [showForgot, setShowForgot] = useState(false)
  const [forgotPhone, setForgotPhone] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')

  async function handleLogin() {
    setError('')
    if (!phone || !pin) {
      setError('Please enter your phone number and PIN.')
      return
    }
    if (pin.length !== 4) {
      setError('PIN must be 4 digits.')
      return
    }

    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')

      const { data: customers } = await supabase
        .from('customers')
        .select('email, registration_status')
        .eq('phone', cleanPhone)

      if (!customers || customers.length === 0) {
        setError('Phone number not found. Please check and try again.')
        setLoading(false)
        return
      }

      const customer = customers[0]

      if (!customer.email) {
        setError('Account not fully set up. Please register again.')
        setLoading(false)
        return
      }

      if (customer.registration_status !== 'complete') {
        setError('Account registration is incomplete. Please complete registration.')
        setLoading(false)
        return
      }

      const password = `pin-${pin}-${cleanPhone}`
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer.email,
        password,
      })

      if (signInError) {
        setError('Incorrect PIN. Please try again.')
        setLoading(false)
        return
      }

      navigate('/portal/home')
    } catch (err) {
      console.error('Login error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPIN() {
    setForgotError('')
    const cleanPhone = forgotPhone.replace(/\s+/g, '')
    if (!cleanPhone) {
      setForgotError('Please enter your phone number.')
      return
    }

    setForgotLoading(true)
    try {
      // Look up customer by phone to get their email
      const { data: customers } = await supabase
        .from('customers')
        .select('email')
        .eq('phone', cleanPhone)

      if (!customers || customers.length === 0) {
        setForgotError('No account found with that phone number.')
        setForgotLoading(false)
        return
      }

      const customerEmail = customers[0].email
      if (!customerEmail) {
        setForgotError('No email address found for this account.')
        setForgotLoading(false)
        return
      }

      // Send Supabase password reset email
      // The reset link redirects to the portal reset-pin page
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        customerEmail,
        { redirectTo: `${window.location.origin}/portal/reset-pin` }
      )

      if (resetError) {
        setForgotError('Could not send reset email. Please try again.')
        setForgotLoading(false)
        return
      }

      // Mask the email for display: dan***@gmail.com
      const [local, domain] = customerEmail.split('@')
      const masked = local.slice(0, 3) + '***@' + domain
      setMaskedEmail(masked)
      setForgotSuccess(true)
    } catch (e) {
      console.error('Forgot PIN error:', e)
      setForgotError('Something went wrong. Please try again.')
    }
    setForgotLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => {
            if (showForgot) { setShowForgot(false); setForgotSuccess(false); setForgotError(''); setForgotPhone('') }
            else navigate('/portal')
          }}
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

      <div className="px-5 pt-6 pb-10 text-center" style={{ background: brand.primaryColor }}>
        <h1 className="text-white text-xl font-bold mb-1">
          {showForgot ? 'Reset your PIN' : 'Welcome back'}
        </h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {showForgot
            ? 'Enter your phone number to receive a reset link'
            : 'Log in to your savings account'}
        </p>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* ── LOGIN FORM ── */}
        {!showForgot && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Phone number
              </label>
              <input
                type="tel"
                placeholder="+256 7XX XXX XXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                  4-digit PIN
                </label>
                <button
                  onClick={() => { setShowForgot(true); setForgotPhone(phone); setError('') }}
                  className="text-xs font-semibold"
                  style={{ color: brand.primaryColor }}>
                  Forgot PIN?
                </button>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
              />
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{
                background: loading ? 'rgba(27,79,114,0.4)' : brand.primaryColor,
                color: '#fff', border: 'none',
              }}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <div className="text-center mt-2">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Don't have an account?{' '}
              </span>
              <button onClick={() => navigate('/portal/register')}
                className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Register
              </button>
            </div>
          </>
        )}

        {/* ── FORGOT PIN FORM ── */}
        {showForgot && !forgotSuccess && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Phone number
              </label>
              <input
                type="tel"
                placeholder="+256 7XX XXX XXX"
                value={forgotPhone}
                onChange={e => setForgotPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
              />
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                We'll send a reset link to the email address linked to this phone number
              </div>
            </div>

            {forgotError && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {forgotError}
              </div>
            )}

            <button
              onClick={handleForgotPIN}
              disabled={forgotLoading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{
                background: forgotLoading ? 'rgba(27,79,114,0.4)' : brand.primaryColor,
                color: '#fff',
              }}>
              {forgotLoading ? 'Sending...' : 'Send reset link'}
            </button>

            <button
              onClick={() => { setShowForgot(false); setForgotError(''); setForgotPhone('') }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.5)' }}>
              ← Back to login
            </button>
          </>
        )}

        {/* ── FORGOT PIN SUCCESS ── */}
        {showForgot && forgotSuccess && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'rgba(22,163,74,0.1)' }}>
              ✉️
            </div>
            <div className="text-center">
              <div className="text-sm font-bold mb-1" style={{ color: brand.primaryColor }}>
                Check your email
              </div>
              <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
                We've sent a PIN reset link to
              </div>
              <div className="text-xs font-semibold mb-2" style={{ color: brand.primaryColor }}>
                {maskedEmail}
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Click the link in the email to set a new PIN. The link expires in 1 hour.
              </div>
            </div>
            <button
              onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotPhone('') }}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Back to login
            </button>
          </div>
        )}

      </div>

      <footer className="text-center py-4" style={{ background: '#f0f2f5' }}>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/partna-icon.svg" alt="Partna" className="w-5 h-5" />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
            Powered by Partna
          </span>
        </div>
      </footer>

    </div>
  )
}