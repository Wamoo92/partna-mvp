import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)
  const [validSession, setValidSession]   = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setValidSession(true)
        setCheckingSession(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true)
      setCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError('')
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword)      { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Could not update password. Your reset link may have expired. Please request a new one.')
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/dashboard/login', { replace: true }), 3000)
    } catch (e) {
      console.error('Reset password error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const passwordsMatch = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword

  if (checkingSession) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-white)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-6)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      }}>
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
      </header>

      {/* ── Main ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-8) var(--space-6)',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Logo + title */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <div style={{
              width: 64, height: 64,
              background: 'var(--color-black)',
              border: success
                ? '3px solid var(--color-green)'
                : !validSession
                ? '3px solid var(--color-red)'
                : '3px solid var(--color-primary)',
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
              {success ? 'Password updated' : !validSession ? 'Link expired' : 'Set new password'}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              {success
                ? 'Redirecting you to login…'
                : !validSession
                ? 'This password reset link is invalid or has expired.'
                : 'Choose a strong password for your business account.'}
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'var(--color-white)',
            border: 'var(--border-thick)',
            boxShadow: 'var(--shadow-xl)',
            padding: 'var(--space-8)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          }}>

            {/* ── Invalid / expired ── */}
            {!validSession && !success && (
              <>
                <div style={{
                  background: 'var(--color-red)',
                  border: 'var(--border)',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 56, height: 56,
                    background: 'var(--color-black)', border: 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto var(--space-4)',
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>link_off</span>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                    Invalid or expired link
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', lineHeight: 'var(--leading-normal)' }}>
                    This password reset link is invalid or has expired. Reset links are valid for 1 hour.
                  </div>
                </div>
                <button onClick={() => navigate('/dashboard/login')} className="btn btn-primary btn-full btn-lg">
                  <span className="icon-outlined icon-sm">send</span>
                  Request a new link
                </button>
              </>
            )}

            {/* ── Success ── */}
            {success && (
              <>
                <div style={{
                  background: 'var(--color-green)',
                  border: 'var(--border)',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 56, height: 56,
                    background: 'var(--color-black)', border: '3px solid var(--color-white)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto var(--space-4)',
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>lock_reset</span>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 24" }}>
                    Password updated successfully
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', lineHeight: 'var(--leading-normal)' }}>
                    You will be redirected to the login page in a moment.
                  </div>
                </div>
                <button onClick={() => navigate('/dashboard/login', { replace: true })} className="btn btn-black btn-full btn-lg">
                  <span className="icon-outlined icon-sm">login</span>
                  Go to login now
                </button>
              </>
            )}

            {/* ── Reset form ── */}
            {validSession && !success && (
              <>
                <div className="input-group">
                  <label className="input-label">New password</label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">lock</span>
                    <input
                      type="password"
                      className="input"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleReset()}
                    />
                  </div>
                  <span className="input-hint">Minimum 8 characters.</span>
                </div>

                <div className="input-group">
                  <label className="input-label">Confirm new password</label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">lock</span>
                    <input
                      type="password"
                      className="input"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleReset()}
                    />
                  </div>
                </div>

                {/* Password match indicator */}
                {password.length >= 8 && confirmPassword.length >= 8 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                    color: passwordsMatch ? '#2D8B45' : '#C0392B',
                  }}>
                    <span className="icon-outlined icon-sm">
                      {passwordsMatch ? 'check_circle' : 'cancel'}
                    </span>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger">
                    <span className="icon-outlined alert-icon">error_outline</span>
                    <div className="alert-content">{error}</div>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="btn btn-primary btn-full btn-lg"
                  style={{ marginTop: 'var(--space-2)' }}
                >
                  {loading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Updating…</>
                    : <><span className="icon-outlined icon-sm">lock_reset</span> Update password</>
                  }
                </button>
              </>
            )}
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