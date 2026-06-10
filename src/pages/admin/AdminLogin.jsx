import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setDebugInfo('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      // Step 1 — Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (authError) {
        setDebugInfo('Auth error: ' + authError.message)
        setError('Incorrect email or password.')
        setLoading(false)
        return
      }

      const authedEmail = authData.user.email
      setDebugInfo('Authed as: ' + authedEmail)

      // Step 2 — Fetch all admin emails and check in JS
      const { data: allAdmins, error: listError } = await supabase
        .from('admin_users')
        .select('email')

      setDebugInfo(prev => prev + ' | All admins: ' + JSON.stringify(allAdmins) + ' | List error: ' + JSON.stringify(listError))

      const isAdmin = allAdmins && allAdmins.some(a => a.email.toLowerCase().trim() === authedEmail.toLowerCase().trim())

      setDebugInfo(prev => prev + ' | isAdmin: ' + isAdmin)

      if (!isAdmin) {
        await supabase.auth.signOut()
        setError('Access denied. This account does not have admin privileges.')
        setLoading(false)
        return
      }

      // Step 3 — Authorised — go to dashboard
      navigate('/admin/dashboard', { replace: true })

    } catch (e) {
      console.error('Admin login error:', e)
      setDebugInfo('Exception: ' + e.message)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#f0f2f5' }}>

      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: ADMIN_PRIMARY }}>
            <img src="/partna-icon.svg" alt="Partna" className="w-7 h-7" />
          </div>
          <div className="text-xl font-bold mb-1" style={{ color: ADMIN_PRIMARY }}>
            Partna Admin
          </div>
          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
            Internal operations portal
          </div>
        </div>

        <div className="rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {error && (
            <div className="text-xs px-3 py-2.5 rounded-xl"
              style={{ background: '#FEE2E2', color: '#991B1B' }}>
              {error}
            </div>
          )}

          {debugInfo && (
            <div className="text-xs px-3 py-2.5 rounded-xl break-all"
              style={{ background: '#f0f9ff', color: '#0369a1', fontFamily: 'monospace' }}>
              {debugInfo}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@partna.io"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold mt-1"
            style={{
              background: loading ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <div className="text-center mt-6 text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
          Partna Admin Portal · Restricted access
        </div>
      </div>
    </div>
  )
}