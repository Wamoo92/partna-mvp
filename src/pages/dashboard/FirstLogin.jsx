import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
}

const inputStyle = {
  display: 'block', width: '100%', padding: '11px 14px',
  fontSize: 14, fontWeight: 500, color: C.black,
  background: C.white, border: `1px solid ${C.grayLine}`,
  borderRadius: 10, outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  transition: 'border-color 0.15s', boxSizing: 'border-box',
}

export default function FirstLogin({ admin, business, clearFirstLogin }) {
  const navigate = useNavigate()

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(false)

  // Strength indicators
  const hasLength    = newPassword.length >= 8
  const hasUpper     = /[A-Z]/.test(newPassword)
  const hasLower     = /[a-z]/.test(newPassword)
  const hasNumber    = /[0-9]/.test(newPassword)
  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore]
  const strengthColor = [C.grayLine, C.red, C.orange, C.orange, C.green][strengthScore]

  async function handleSubmit() {
    setError('')

    if (!newPassword)                    { setError('Please enter a new password.'); return }
    if (newPassword.length < 8)          { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (strengthScore < 2)               { setError('Please choose a stronger password.'); return }

    setSaving(true)
    try {
      // 1. Update auth password
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) throw pwError

      // 2. Clear first_login flag on the admin record
      const { error: dbError } = await supabase
        .from('business_admins')
        .update({ first_login: false })
        .eq('id', admin.id)

      if (dbError) throw dbError

      // 3. Update hook state so the guard doesn't re-intercept
      clearFirstLogin()

      setSuccess(true)
      setTimeout(() => navigate('/dashboard/overview'), 1800)

    } catch (e) {
      console.error('FirstLogin error:', e)
      setError(e.message || 'Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {business?.name && (
            <p style={{ fontSize: 13, fontWeight: 600, color: C.secondary, margin: 0 }}>{business.name}</p>
          )}
        </div>

        {/* Card */}
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: C.black, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Set your password
            </p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
              Welcome{admin?.full_name ? `, ${admin.full_name.split(' ')[0]}` : ''}. Please set a permanent password before accessing your dashboard.
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.bgGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>Password set successfully</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>Taking you to your dashboard…</p>
            </div>
          ) : (
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Error */}
              {error && (
                <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                  {error}
                </div>
              )}

              {/* New password */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>
                  New password
                </label>
                <input
                  type="password"
                  style={inputStyle}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError('') }}
                  placeholder="At least 8 characters"
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />

                {/* Strength bar */}
                {newPassword.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} style={{ flex: 1, height: 3, borderRadius: 999, background: n <= strengthScore ? strengthColor : C.grayLight, transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { label: '8+ chars', met: hasLength },
                          { label: 'Uppercase', met: hasUpper },
                          { label: 'Lowercase', met: hasLower },
                          { label: 'Number', met: hasNumber },
                        ].map(({ label, met }) => (
                          <span key={label} style={{ fontSize: 10, fontWeight: 600, color: met ? C.green : C.grayMid }}>
                            {met ? '✓ ' : '· '}{label}
                          </span>
                        ))}
                      </div>
                      {strengthLabel && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor }}>{strengthLabel}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  style={{
                    ...inputStyle,
                    borderColor: confirmPassword && confirmPassword !== newPassword ? C.red : C.grayLine,
                  }}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="Re-enter your password"
                  onFocus={e => e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? C.red : C.black}
                  onBlur={e => e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? C.red : C.grayLine}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '5px 0 0' }}>Passwords do not match</p>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  width: '100%', padding: '12px',
                  fontSize: 14, fontWeight: 600,
                  color: C.white, background: C.black,
                  border: 'none', borderRadius: 10,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: saving ? 0.7 : 1,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'opacity 0.15s',
                }}
              >
                {saving
                  ? <><div className="spinner spinner-sm spinner-light" /> Setting password…</>
                  : 'Set password and continue →'
                }
              </button>

              <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0, textAlign: 'center', lineHeight: '140%' }}>
                You will only need to do this once. Use this password to log in to your dashboard going forward.
              </p>

            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.grayMid, marginTop: 20 }}>
          Powered by <a href="https://www.partna.io" style={{ color: C.black, fontWeight: 600, textDecoration: 'none' }}>Partna</a>
        </p>
      </div>
    </div>
  )
}