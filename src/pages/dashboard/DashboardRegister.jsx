import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

export default function DashboardRegister() {
  useEffect(() => { document.title = 'Register - Partna' }, [])

  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const token            = searchParams.get('token')

  // Token validation state
  const [validating, setValidating]     = useState(true)
  const [adminRecord, setAdminRecord]   = useState(null)
  const [business, setBusiness]         = useState(null)
  const [tokenInvalid, setTokenInvalid] = useState(false)

  // Password form state
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)

  // Password strength
  const hasLength = password.length >= 8
  const hasUpper  = /[A-Z]/.test(password)
  const hasLower  = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore]
  const strengthColor = [C.grayLine, C.red, C.orange, C.orange, C.green][strengthScore]

  // ── On mount — validate token ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenInvalid(true)
      setValidating(false)
      return
    }
    validateToken()
  }, [token])

  async function validateToken() {
    setValidating(true)
    try {
      // Find admin record with this invite token that hasn't registered yet
      const { data: adminData, error: adminError } = await supabase
        .from('business_admins')
        .select('*, businesses(id, name, sector, subscription_package)')
        .eq('invite_token', token)
        .is('auth_user_id', null)
        .maybeSingle()

      if (adminError || !adminData) {
        setTokenInvalid(true)
        setValidating(false)
        return
      }

      setAdminRecord(adminData)
      setBusiness(adminData.businesses || null)
    } catch (e) {
      console.error('Token validation error:', e)
      setTokenInvalid(true)
    }
    setValidating(false)
  }

  // ── Submit — set password and link auth user ───────────────────────────
  async function handleSubmit() {
    setError('')

    if (!password)                    { setError('Please enter a password.'); return }
    if (password.length < 8)          { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (strengthScore < 2)            { setError('Please choose a stronger password.'); return }

    setSaving(true)
    try {
      // 1. Create the auth user with the pre-set email and chosen password
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email:    adminRecord.email,
        password,
        options:  { emailRedirectTo: undefined },
      })

      if (signUpError) {
        if (signUpError.message?.includes('already registered')) {
          setError('This email is already registered. Please log in instead.')
        } else {
          setError(`Could not create account: ${signUpError.message}`)
        }
        setSaving(false)
        return
      }

      if (!authData?.user) {
        setError('Account creation failed. Please try again.')
        setSaving(false)
        return
      }

      // 2. Link auth_user_id to the admin record and clear invite token
      const { error: updateError } = await supabase
        .from('business_admins')
        .update({
          auth_user_id: authData.user.id,
          invite_token: null,
          first_login:  true, // force password change on first dashboard login
        })
        .eq('id', adminRecord.id)

      if (updateError) {
        console.error('Admin record update error:', updateError)
        // Non-fatal — account was created, they can still log in
      }

      // 3. Sign in immediately
      await supabase.auth.signInWithPassword({
        email:    adminRecord.email,
        password,
      })

      setSuccess(true)
      setTimeout(() => navigate('/dashboard/overview', { replace: true }), 1800)

    } catch (e) {
      console.error('Registration error:', e)
      setError('Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (validating) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="spinner spinner-lg" />
        <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Verifying your invitation…</p>
      </div>
    </div>
  )

  // ── Invalid / missing token ────────────────────────────────────────────
  if (tokenInvalid || !adminRecord) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, padding: '32px 28px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.bgOrange, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <p style={{ fontSize: 18, fontWeight: 600, color: C.black, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Registration is by invitation only
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: '0 0 24px', lineHeight: '150%' }}>
            {token
              ? 'This invitation link is invalid or has already been used. Please check the link in your welcome email or contact Partna support.'
              : 'If you have received a welcome email from Partna, please use the registration link in that email to set up your account.'
            }
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => navigate('/dashboard/login')}
              style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Go to login
            </button>
            <a
              href="mailto:support@partna.io"
              style={{ display: 'block', textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary, textDecoration: 'none' }}
            >
              Contact support →
            </a>
          </div>
        </div>

        <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, marginTop: 20 }}>
          Powered by <a href="https://www.partna.io" style={{ color: C.black, fontWeight: 600, textDecoration: 'none' }}>Partna</a>
        </p>
      </div>
    </div>
  )

  // ── Registration form ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.secondary, margin: 0 }}>Partna Business</p>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: C.black, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Set up your account
            </p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
              Welcome to Partna. Set a password to access your dashboard.
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bgGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>Account ready</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>Taking you to your dashboard…</p>
            </div>
          ) : (
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Pre-filled account details — read only */}
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, overflow: 'hidden' }}>
                {[
                  { label: 'Name',     value: adminRecord.full_name },
                  { label: 'Email',    value: adminRecord.email },
                  { label: 'Business', value: business?.name || '—' },
                  { label: 'Role',     value: 'Owner' },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                  {error}
                </div>
              )}

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>
                  Set your password
                </label>
                <input
                  type="password"
                  style={inputStyle}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="At least 8 characters"
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />

                {/* Strength bar */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} style={{ flex: 1, height: 3, borderRadius: 999, background: n <= strengthScore ? strengthColor : C.grayLight, transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { label: '8+ chars',  met: hasLength },
                          { label: 'Uppercase', met: hasUpper  },
                          { label: 'Lowercase', met: hasLower  },
                          { label: 'Number',    met: hasNumber },
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
                    borderColor: confirmPassword && confirmPassword !== password ? C.red : C.grayLine,
                  }}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="Re-enter your password"
                  onFocus={e => e.target.style.borderColor = confirmPassword && confirmPassword !== password ? C.red : C.black}
                  onBlur={e => e.target.style.borderColor = confirmPassword && confirmPassword !== password ? C.red : C.grayLine}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                {confirmPassword && confirmPassword !== password && (
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
                }}
              >
                {saving
                  ? <><div className="spinner spinner-sm spinner-light" /> Creating account…</>
                  : 'Create account and continue →'
                }
              </button>

              <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0, textAlign: 'center', lineHeight: '140%' }}>
                Already have an account?{' '}
                <button onClick={() => navigate('/dashboard/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.black, fontWeight: 600, fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', padding: 0 }}>
                  Log in
                </button>
              </p>

            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.grayMid, marginTop: 20 }}>
          Powered by <a href="https://www.partna.io" style={{ color: C.black, fontWeight: 600, textDecoration: 'none' }}>Partna</a>
        </p>
      </div>
    </div>
  )
}