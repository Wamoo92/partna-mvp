import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function AdminLogin() {
  const navigate  = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setDebugInfo('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(), password,
      })
      if (authError) {
        setDebugInfo('Auth error: ' + authError.message)
        setError('Incorrect email or password.')
        setLoading(false); return
      }

      const authedEmail = authData.user.email
      setDebugInfo('Authed as: ' + authedEmail)

      const { data: allAdmins, error: listError } = await supabase.from('admin_users').select('email')
      setDebugInfo(prev => prev + ' | All admins: ' + JSON.stringify(allAdmins) + ' | List error: ' + JSON.stringify(listError))

      const isAdmin = allAdmins && allAdmins.some(a => a.email.toLowerCase().trim() === authedEmail.toLowerCase().trim())
      setDebugInfo(prev => prev + ' | isAdmin: ' + isAdmin)

      if (!isAdmin) {
        await supabase.auth.signOut()
        setError('Access denied. This account does not have admin privileges.')
        setLoading(false); return
      }

      navigate('/admin/dashboard', { replace: true })
    } catch (e) {
      console.error('Admin login error:', e)
      setDebugInfo('Exception: ' + e.message)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

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
            Part<span style={{ color: 'var(--color-primary)' }}>na</span> Admin
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
            Internal operations portal
          </p>
        </div>

        {/* Card */}
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

          {/* Debug panel — keep as-is for internal use */}
          {debugInfo && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              background: '#f0f9ff',
              border: '1px solid #BAE6FD',
              fontSize: 'var(--text-xs)',
              color: '#0369a1',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              lineHeight: 'var(--leading-normal)',
            }}>
              {debugInfo}
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email address</label>
            <div className="input-wrapper">
              <span className="icon-outlined input-icon-left">mail</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@partna.io"
                autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <span className="icon-outlined input-icon-left">lock</span>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
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
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Signing in…</>
              : <><span className="icon-outlined icon-sm">login</span> Sign in</>
            }
          </button>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wide)',
          textTransform: 'uppercase',
          color: 'var(--color-grey)',
        }}>
          Partna Admin Portal · Restricted access
        </p>
      </div>
    </div>
  )
}