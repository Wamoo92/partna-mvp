import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  labelBg:  '#E4E5DD',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
}

export default function DashboardLogin() {
  useEffect(() => { document.title = 'Login - Partna' }, [])

  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [showForgot, setShowForgot]       = useState(false)
  const [forgotEmail, setForgotEmail]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError]     = useState('')

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function handleLogin() {
    setError('')
    if (!email || !password)  { setError('Please enter your email and password.'); return }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return }
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      if (signInError) { setError('Incorrect email or password. Please try again.'); setLoading(false); return }
      const { data: adminData } = await supabase.from('business_admins').select('id').eq('email', email.toLowerCase().trim())
      if (!adminData || adminData.length === 0) { await supabase.auth.signOut(); setError('No business admin account found for this email.'); setLoading(false); return }
      navigate('/dashboard/overview', { replace: true })
    } catch (e) { console.error('Login error:', e); setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  async function handleForgotPassword() {
    setForgotError('')
    if (!forgotEmail || !forgotEmail.includes('@')) { setForgotError('Please enter a valid email address.'); return }
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.toLowerCase().trim(), { redirectTo: `${window.location.origin}/dashboard/reset-password` })
      if (error) setForgotError('Could not send reset email. Please try again.')
      else setForgotSuccess(true)
    } catch (e) { setForgotError('Something went wrong. Please try again.') }
    setForgotLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const inputStyle = { display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
  const btnPrimary = { width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top nav ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>Partna</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>Business Portal</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard/register')}
          style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'}
          onMouseLeave={e => e.currentTarget.style.background = C.white}
        >
          Create account
        </button>
      </header>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo + heading */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: '0 0 6px' }}>
              {showForgot ? 'Reset password' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              {showForgot
                ? "Enter your email and we'll send you a reset link"
                : 'Log in to your business dashboard'}
            </p>
          </div>

          {/* ── LOGIN FORM ── */}
          {!showForgot && (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 16px rgba(17,17,17,0.08)' }}>
              {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>{error}</div>}

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>Email address</label>
                <input style={inputStyle} type="email" placeholder="jane@yourbusiness.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: C.black }}>Password</label>
                  <button onClick={() => { setShowForgot(true); setForgotEmail(email); setError('') }}
                    style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Forgot password?
                  </button>
                </div>
                <input style={inputStyle} type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>

              <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1' }}
              >
                {loading ? <><div className="spinner spinner-sm spinner-light" /> Logging in…</> : 'Log in'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
                Don't have an account?{' '}
                <button onClick={() => navigate('/dashboard/register')}
                  style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Register your business
                </button>
              </p>
            </div>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {showForgot && (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 16px rgba(17,17,17,0.08)' }}>
              {forgotSuccess ? (
                <>
                  <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Check your email</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                      We've sent a password reset link to <strong style={{ color: C.black }}>{forgotEmail}</strong>. The link expires in 1 hour.
                    </p>
                  </div>
                  <button onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotEmail('') }} style={btnPrimary}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                    Back to login
                  </button>
                </>
              ) : (
                <>
                  {forgotError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red }}>{forgotError}</div>}
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>Email address</label>
                    <input style={inputStyle} type="email" placeholder="jane@yourbusiness.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  <button onClick={handleForgotPassword} disabled={forgotLoading} style={{ ...btnPrimary, opacity: forgotLoading ? 0.75 : 1 }}
                    onMouseEnter={e => { if (!forgotLoading) e.currentTarget.style.opacity = '0.85' }} onMouseLeave={e => { if (!forgotLoading) e.currentTarget.style.opacity = '1' }}>
                    {forgotLoading ? <><div className="spinner spinner-sm spinner-light" /> Sending…</> : 'Send reset link'}
                  </button>
                  <button onClick={() => { setShowForgot(false); setForgotError(''); setForgotEmail('') }} style={btnSecondary}
                    onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                    Back to login
                  </button>
                </>
              )}
            </div>
          )}

          {/* Divider + customer portal link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: C.grayLine }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>or</span>
            <div style={{ flex: 1, height: 1, background: C.grayLine }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
            Looking for the customer savings portal?{' '}
            <button onClick={() => navigate('/portal')}
              style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Go to customer portal
            </button>
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '14px 24px', borderTop: `1px solid ${C.grayLine}` }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>© 2026 Partna. All rights reserved.</span>
      </footer>

    </div>
  )
}