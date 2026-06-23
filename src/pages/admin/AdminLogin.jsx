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
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
}

export default function AdminLogin() {
  useEffect(() => { document.title = 'Login - Partna' }, [])

  const navigate  = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setDebugInfo('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      if (authError) { setDebugInfo('Auth error: ' + authError.message); setError('Incorrect email or password.'); setLoading(false); return }
      const authedEmail = authData.user.email
      setDebugInfo('Authed as: ' + authedEmail)
      const { data: allAdmins, error: listError } = await supabase.from('admin_users').select('email')
      setDebugInfo(prev => prev + ' | All admins: ' + JSON.stringify(allAdmins) + ' | List error: ' + JSON.stringify(listError))
      const isAdmin = allAdmins && allAdmins.some(a => a.email.toLowerCase().trim() === authedEmail.toLowerCase().trim())
      setDebugInfo(prev => prev + ' | isAdmin: ' + isAdmin)
      if (!isAdmin) { await supabase.auth.signOut(); setError('Access denied. This account does not have admin privileges.'); setLoading(false); return }
      navigate('/admin/dashboard', { replace: true })
    } catch (e) {
      console.error('Admin login error:', e)
      setDebugInfo('Exception: ' + e.message)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const inputStyle = {
    display: 'block', width: '100%', padding: '10px 14px',
    fontSize: 14, fontWeight: 500, color: C.black,
    background: C.white, border: `1px solid ${C.grayLine}`,
    borderRadius: 10, outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: '0 0 6px' }}>
            Partna Admin
          </h1>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
            Internal operations portal
          </p>
        </div>

        {/* Card */}
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 16px rgba(17,17,17,0.08)' }}>

          {error && (
            <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
              {error}
            </div>
          )}

          {/* Debug panel — kept as-is for internal use */}
          {debugInfo && (
            <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #BAE6FD', borderRadius: 8, fontSize: 12, color: '#0369a1', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '140%' }}>
              {debugInfo}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6 }}>
              Email address
            </label>
            <input
              style={inputStyle} type="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@partna.io"
              autoComplete="email"
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              onFocus={e => e.target.style.borderColor = C.black}
              onBlur={e => e.target.style.borderColor = C.grayLine}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6 }}>
              Password
            </label>
            <input
              style={inputStyle} type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              onFocus={e => e.target.style.borderColor = C.black}
              onBlur={e => e.target.style.borderColor = C.grayLine}
            />
          </div>

          <button
            onClick={handleLogin} disabled={loading}
            style={{
              width: '100%', padding: '11px 18px', marginTop: 4,
              fontSize: 14, fontWeight: 600,
              color: C.white, background: C.black,
              border: `1px solid ${C.black}`, borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1' }}
          >
            {loading
              ? <><div className="spinner spinner-sm spinner-light" /> Signing in…</>
              : 'Sign in'
            }
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, fontWeight: 500, color: C.grayMid }}>
          Partna Admin Portal · Restricted access
        </p>

      </div>
    </div>
  )
}