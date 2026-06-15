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

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        customerEmail,
        { redirectTo: `${window.location.origin}/portal/reset-pin` }
      )

      if (resetError) {
        setForgotError('Could not send reset email. Please try again.')
        setForgotLoading(false)
        return
      }

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

  function handleBack() {
    if (showForgot) {
      setShowForgot(false)
      setForgotSuccess(false)
      setForgotError('')
      setForgotPhone('')
    } else {
      navigate('/portal')
    }
  }

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
          onClick={handleBack}
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
              width: 32,
              height: 32,
              border: '2px solid var(--color-primary)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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

      {/* ── Page title bar ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
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
          {showForgot ? 'Reset PIN' : 'Log In'}
        </div>
        <h1 style={{
          color: 'var(--color-white)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)',
          lineHeight: 'var(--leading-tight)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
          marginBottom: 'var(--space-2)',
        }}>
          {showForgot ? 'Forgot your PIN?' : 'Welcome back.'}
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: 'var(--text-sm)',
        }}>
          {showForgot
            ? 'Enter your phone number to receive a reset link.'
            : 'Log in to your savings account.'}
        </p>
      </div>

      {/* ── Form area ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-6) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* ── LOGIN FORM ── */}
        {!showForgot && (
          <>
            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Phone number</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">phone</span>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 7XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="input-label">4-digit PIN</label>
                <button
                  onClick={() => { setShowForgot(true); setForgotPhone(phone); setError('') }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-wide)',
                    textTransform: 'uppercase',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}>
                  Forgot PIN?
                </button>
              </div>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">lock</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="input"
                  placeholder="••••"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{ letterSpacing: '0.3em' }}
                />
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Logging in…</>
                : <><span className="icon-outlined icon-sm">login</span> Log in</>
              }
            </button>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Don't have an account?{' '}
              </span>
              <button
                onClick={() => navigate('/portal/register')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--color-black)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}>
                Register
              </button>
            </div>
          </>
        )}

        {/* ── FORGOT PIN FORM ── */}
        {showForgot && !forgotSuccess && (
          <>
            {forgotError && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{forgotError}</div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Phone number</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">phone</span>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 7XX XXX XXX"
                  value={forgotPhone}
                  onChange={e => setForgotPhone(e.target.value)}
                />
              </div>
              <span className="input-hint">
                We'll send a reset link to the email address linked to this phone number.
              </span>
            </div>

            <button
              onClick={handleForgotPIN}
              disabled={forgotLoading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {forgotLoading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Sending…</>
                : <><span className="icon-outlined icon-sm">send</span> Send reset link</>
              }
            </button>

            <button
              onClick={() => { setShowForgot(false); setForgotError(''); setForgotPhone('') }}
              className="btn btn-secondary btn-full"
            >
              <span className="icon-outlined icon-sm">arrow_back</span>
              Back to login
            </button>
          </>
        )}

        {/* ── FORGOT PIN SUCCESS ── */}
        {showForgot && forgotSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Success card */}
            <div className="card card-green" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-6)' }}>
              <div style={{
                width: 56,
                height: 56,
                background: 'var(--color-black)',
                border: 'var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>
                  mark_email_read
                </span>
              </div>
              <h2 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-black)',
                marginBottom: 'var(--space-2)',
                fontVariationSettings: "'wdth' 100, 'opsz' 24",
              }}>
                Check your email
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-3)' }}>
                We've sent a PIN reset link to
              </p>
              <div style={{
                display: 'inline-block',
                background: 'var(--color-black)',
                color: 'var(--color-white)',
                padding: '4px var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-wide)',
                marginBottom: 'var(--space-4)',
              }}>
                {maskedEmail}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                Click the link in the email to set a new PIN. The link expires in 1 hour.
              </p>
            </div>

            <button
              onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotPhone('') }}
              className="btn btn-black btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">arrow_back</span>
              Back to login
            </button>
          </div>
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