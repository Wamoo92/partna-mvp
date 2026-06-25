import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Login() {
  useEffect(() => { document.title = 'Login - Partna' }, [])

  const brand = useBrand()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showForgot, setShowForgot] = useState(false)
  const [forgotPhone, setForgotPhone] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')

  // ── Business logic — unchanged ────────────────────────────

  async function handleLogin() {
    setError('')
    if (!phone || !pin) { setError('Please enter your phone number and PIN.'); return }
    if (pin.length !== 4) { setError('PIN must be 4 digits.'); return }
    setLoading(true)
    try {
      const cleanPhone = phone.replace(/\s+/g, '')
      // Resolve the auth email server-side — the customers table is no longer
      // readable with the public anon key.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lookup-login-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ phone: cleanPhone }),
      })
      const customer = await res.json()
      if (!customer.found || !customer.email) { setError('Phone number not found. Please check and try again.'); setLoading(false); return }
      if (customer.registration_status !== 'complete') { setError('Account registration is incomplete. Please complete registration.'); setLoading(false); return }
      const password = `pin-${pin}-${cleanPhone}`
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: customer.email, password })
      if (signInError) { setError('Incorrect PIN. Please try again.'); setLoading(false); return }
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
    if (!cleanPhone) { setForgotError('Please enter your phone number.'); return }
    setForgotLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lookup-login-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ phone: cleanPhone }),
      })
      const lookup = await res.json()
      if (!lookup.found || !lookup.email) { setForgotError('No account found with that phone number.'); setForgotLoading(false); return }
      const customerEmail = lookup.email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(customerEmail, { redirectTo: `${window.location.origin}/portal/reset-pin` })
      if (resetError) { setForgotError('Could not send reset email. Please try again.'); setForgotLoading(false); return }
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

  // ── Shared inline tokens — strict Sellin kit ──────────────
  const input = {
    display: 'block', width: '100%',
    padding: '10px 14px',
    fontSize: 14, fontWeight: 500, color: '#111111',
    background: '#FFFFFF',
    border: '1px solid #D5D9DD',
    borderRadius: 10, outline: 'none',
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
    transition: 'opacity 0.15s',
  }

  const btnSecondary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: '#111111', background: '#FFFFFF',
    border: '1px solid #D5D9DD', borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'background 0.15s',
  }

  const linkBtn = {
    background: 'none', border: 'none', padding: 0,
    fontSize: 14, fontWeight: 600, color: '#111111',
    cursor: 'pointer',
    textDecoration: 'underline', textUnderlineOffset: 3,
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
          onClick={handleBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: '#111111', letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>

        <button onClick={() => navigate('/portal/register')} style={{ ...linkBtn, fontWeight: 500, color: '#959687', textDecoration: 'none', fontSize: 14 }}>
          Register
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#959687', marginBottom: 8, margin: '0 0 8px' }}>
              {showForgot ? 'Reset PIN' : 'Welcome back'}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111111', letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              {showForgot ? 'Forgot your PIN?' : 'Log in to your account.'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#959687', lineHeight: '140%', margin: 0 }}>
              {showForgot
                ? 'Enter your phone number and we\'ll send a reset link to your email.'
                : 'Enter your phone number and 4-digit PIN.'
              }
            </p>
          </div>

          {/* ── Form card ── */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #D7D8CB',
            borderRadius: 12, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>

            {/* ── LOGIN FORM ── */}
            {!showForgot && (
              <>
                {error && (
                  <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                    {error}
                  </div>
                )}

                <div>
                  <label style={label}>Phone number</label>
                  <input
                    style={input} type="tel" placeholder="+256 7XX XXX XXX"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ ...label, marginBottom: 0 }}>4-digit PIN</label>
                    <button
                      onClick={() => { setShowForgot(true); setForgotPhone(phone); setError('') }}
                      style={{ ...linkBtn, fontSize: 13, color: '#959687', fontWeight: 500 }}
                    >
                      Forgot PIN?
                    </button>
                  </div>
                  <input
                    style={{ ...input, textAlign: 'center', letterSpacing: '0.4em', fontSize: 22, fontWeight: 600 }}
                    type="password" inputMode="numeric" maxLength={4} placeholder="····"
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>

                <button
                  style={btnPrimary} onClick={handleLogin} disabled={loading}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {loading
                    ? <><div className="spinner spinner-sm spinner-light" /> Logging in…</>
                    : 'Log in'
                  }
                </button>

                <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 500, color: '#959687', margin: 0 }}>
                  Don't have an account?{' '}
                  <button onClick={() => navigate('/portal/register')} style={linkBtn}>Register</button>
                </p>
              </>
            )}

            {/* ── FORGOT PIN FORM ── */}
            {showForgot && !forgotSuccess && (
              <>
                {forgotError && (
                  <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                    {forgotError}
                  </div>
                )}

                <div>
                  <label style={label}>Phone number</label>
                  <input
                    style={input} type="tel" placeholder="+256 7XX XXX XXX"
                    value={forgotPhone} onChange={e => setForgotPhone(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#898B90', margin: '4px 0 0' }}>
                    We'll send a reset link to the email linked to this number.
                  </p>
                </div>

                <button
                  style={btnPrimary} onClick={handleForgotPIN} disabled={forgotLoading}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {forgotLoading
                    ? <><div className="spinner spinner-sm spinner-light" /> Sending…</>
                    : 'Send reset link'
                  }
                </button>

                <button
                  style={btnSecondary}
                  onClick={() => { setShowForgot(false); setForgotError(''); setForgotPhone('') }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F6F7EE'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  Back to log in
                </button>
              </>
            )}

            {/* ── FORGOT PIN SUCCESS ── */}
            {showForgot && forgotSuccess && (
              <>
                <div style={{ background: '#E4F8EC', borderRadius: 8, padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  {/* Check icon */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#59886D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#111111', margin: 0, letterSpacing: '-0.5px' }}>
                    Check your email
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#959687', margin: 0, lineHeight: '140%' }}>
                    We sent a reset link to
                  </p>
                  <div style={{ background: '#FFFFFF', border: '1px solid #D5D9DD', borderRadius: 8, padding: '6px 16px', fontSize: 14, fontWeight: 600, color: '#111111' }}>
                    {maskedEmail}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#898B90', margin: 0, lineHeight: '140%' }}>
                    Click the link in the email to set a new PIN. The link expires in 1 hour.
                  </p>
                </div>

                <button
                  style={btnSecondary}
                  onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotPhone('') }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F6F7EE'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  Back to log in
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