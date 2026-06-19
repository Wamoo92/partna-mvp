import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  grayLight:'#ECECEC',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
}

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(false)
  const [validSession, setValidSession]       = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setValidSession(true); setCheckingSession(false)
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
      if (updateError) { setError('Could not update password. Your reset link may have expired. Please request a new one.'); setLoading(false); return }
      setSuccess(true)
      setTimeout(() => navigate('/dashboard/login', { replace: true }), 3000)
    } catch (e) { console.error('Reset password error:', e); setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  const passwordsMatch = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword

  const inputStyle = { display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
  const btnPrimary = { width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }

  if (checkingSession) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>Partna</p>
          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>Business Portal</p>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo + heading */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 16px rgba(17,17,17,0.15)' }}>
              {success ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : !validSession ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: '0 0 6px' }}>
              {success ? 'Password updated' : !validSession ? 'Link expired' : 'Set new password'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              {success ? 'Redirecting you to login…' : !validSession ? 'This password reset link is invalid or has expired.' : 'Choose a strong password for your business account.'}
            </p>
          </div>

          {/* Card */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 16px rgba(17,17,17,0.08)' }}>

            {/* Invalid / expired */}
            {!validSession && !success && (
              <>
                <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Invalid or expired link</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>This password reset link is invalid or has expired. Reset links are valid for 1 hour.</p>
                </div>
                <button onClick={() => navigate('/dashboard/login')} style={btnPrimary}>Request a new link</button>
              </>
            )}

            {/* Success */}
            {success && (
              <>
                <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Password updated successfully</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>You will be redirected to the login page in a moment.</p>
                </div>
                <button onClick={() => navigate('/dashboard/login', { replace: true })} style={btnPrimary}>Go to login now</button>
              </>
            )}

            {/* Reset form */}
            {validSession && !success && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>New password</label>
                  <input style={inputStyle} type="password" placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>Minimum 8 characters.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 6 }}>Confirm new password</label>
                  <input style={inputStyle} type="password" placeholder="Re-enter your new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>

                {/* Match indicator */}
                {password.length >= 8 && confirmPassword.length >= 8 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: passwordsMatch ? C.green : C.red }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {passwordsMatch ? <path d="M20 6L9 17l-5-5" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
                    </svg>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}

                {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>{error}</div>}

                <button onClick={handleReset} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? <><div className="spinner spinner-sm spinner-light" /> Updating…</> : 'Update password'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '14px 24px', borderTop: `1px solid ${C.grayLine}` }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>© 2026 Partna. All rights reserved.</span>
      </footer>

    </div>
  )
}