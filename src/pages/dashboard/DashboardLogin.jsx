import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function DashboardLogin() {
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [showForgot, setShowForgot]         = useState(false)
  const [forgotEmail, setForgotEmail]       = useState('')
  const [forgotLoading, setForgotLoading]   = useState(false)
  const [forgotSuccess, setForgotSuccess]   = useState(false)
  const [forgotError, setForgotError]       = useState('')

  async function handleLogin() {
    setError('')
    if (!email || !password)     { setError('Please enter your email and password.'); return }
    if (!email.includes('@'))    { setError('Please enter a valid email address.'); return }

    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(), password,
      })

      if (signInError) { setError('Incorrect email or password. Please try again.'); setLoading(false); return }

      const { data: adminData } = await supabase
        .from('business_admins').select('id').eq('email', email.toLowerCase().trim())

      if (!adminData || adminData.length === 0) {
        await supabase.auth.signOut()
        setError('No business admin account found for this email.')
        setLoading(false)
        return
      }

      navigate('/dashboard/overview', { replace: true })
    } catch (e) {
      console.error('Login error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    setForgotError('')
    if (!forgotEmail || !forgotEmail.includes('@')) { setForgotError('Please enter a valid email address.'); return }
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.toLowerCase().trim(),
        { redirectTo: `${window.location.origin}/dashboard/reset-password` }
      )
      if (error) setForgotError('Could not send reset email. Please try again.')
      else setForgotSuccess(true)
    } catch (e) {
      setForgotError('Something went wrong. Please try again.')
    }
    setForgotLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <header style={{
        background: 'var(--color-white)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <img src="/partna-icon.svg" alt="Partna" style={{ width: 32, height: 32 }} />
          <div>
            <div style={{
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-base)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 110, 'opsz' 16",
            }}>
              Part<span style={{ color: 'var(--color-primary)' }}>na</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
              Business Portal
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard/register')}
          className="btn btn-secondary btn-sm"
        >
          <span className="icon-outlined icon-xs">business</span>
          Create account
        </button>
      </header>

      {/* ── Main ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-6)',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Logo + title */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <div style={{
              width: 64, height: 64,
              background: 'var(--color-black)',
              border: '3px solid var(--color-primary)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <img src="/partna-icon.svg" alt="Partna" style={{ width: 36, height: 36 }} />
            </div>
            <h1 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 110, 'opsz' 30",
              marginBottom: 'var(--space-2)',
            }}>
              {showForgot ? 'Reset password' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              {showForgot
                ? "Enter your email and we'll send you a reset link"
                : 'Log in to your business dashboard'}
            </p>
          </div>

          {/* ── LOGIN FORM ── */}
          {!showForgot && (
            <div style={{
              background: 'var(--color-white)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}>
              {error && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{error}</div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Email address</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">mail</span>
                  <input
                    type="email"
                    className="input"
                    placeholder="jane@yourbusiness.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <label className="input-label" style={{ margin: 0 }}>Password</label>
                  <button
                    onClick={() => { setShowForgot(true); setForgotEmail(email); setError('') }}
                    style={{
                      background: 'none', border: 'none',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                      letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
                      color: 'var(--color-primary)', cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}>
                    Forgot password?
                  </button>
                </div>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">lock</span>
                  <input
                    type="password"
                    className="input"
                    placeholder="Your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
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

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                  Don't have an account?{' '}
                </span>
                <button
                  onClick={() => navigate('/dashboard/register')}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                    color: 'var(--color-black)', cursor: 'pointer',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                  Register your business
                </button>
              </div>
            </div>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {showForgot && (
            <div style={{
              background: 'var(--color-white)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}>
              {forgotSuccess ? (
                <>
                  <div style={{
                    background: 'var(--color-green)',
                    border: 'var(--border)',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: 56, height: 56,
                      background: 'var(--color-black)',
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto var(--space-4)',
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>mark_email_read</span>
                    </div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                      Check your email
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', lineHeight: 'var(--leading-normal)' }}>
                      We've sent a password reset link to{' '}
                      <strong style={{ color: 'var(--color-black)' }}>{forgotEmail}</strong>.
                      The link expires in 1 hour.
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotEmail('') }}
                    className="btn btn-black btn-full btn-lg"
                  >
                    <span className="icon-outlined icon-sm">arrow_back</span>
                    Back to login
                  </button>
                </>
              ) : (
                <>
                  {forgotError && (
                    <div className="alert alert-danger">
                      <span className="icon-outlined alert-icon">error_outline</span>
                      <div className="alert-content">{forgotError}</div>
                    </div>
                  )}

                  <div className="input-group">
                    <label className="input-label">Email address</label>
                    <div className="input-wrapper">
                      <span className="icon-outlined input-icon-left">mail</span>
                      <input
                        type="email"
                        className="input"
                        placeholder="jane@yourbusiness.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="btn btn-primary btn-full btn-lg"
                  >
                    {forgotLoading
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Sending…</>
                      : <><span className="icon-outlined icon-sm">send</span> Send reset link</>
                    }
                  </button>

                  <button
                    onClick={() => { setShowForgot(false); setForgotError(''); setForgotEmail('') }}
                    className="btn btn-secondary btn-full"
                  >
                    <span className="icon-outlined icon-sm">arrow_back</span>
                    Back to login
                  </button>
                </>
              )}
            </div>
          )}

          {/* Divider + customer portal link */}
          <div className="auth-divider" style={{ margin: 'var(--space-6) 0 var(--space-4)' }}>or</div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              Looking for the customer savings portal?{' '}
            </span>
            <button
              onClick={() => navigate('/portal')}
              style={{
                background: 'none', border: 'none',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                color: 'var(--color-black)', cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}>
              Go to customer portal
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--space-4) var(--space-6)',
        borderTop: '1.5px solid var(--color-grey-light)',
      }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
          © 2026 Partna. All rights reserved.
        </span>
      </footer>
    </div>
  )
}