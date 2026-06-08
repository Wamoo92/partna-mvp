import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

export default function DashboardLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      // Sign in with Supabase auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (signInError) {
        setError('Incorrect email or password. Please try again.')
        setLoading(false)
        return
      }

      // Verify this is a business admin (not a customer)
      const { data: adminData } = await supabase
        .from('business_admins')
        .select('id')
        .eq('email', email.toLowerCase().trim())

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-3">
          <img src="/partna-icon.svg" alt="Partna" className="w-8 h-8" />
          <div>
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Partna</div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Business Portal</div>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard/register')}
          className="text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ color: PARTNA_PRIMARY, border: `1.5px solid ${PARTNA_PRIMARY}` }}>
          Create account
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Logo card */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: PARTNA_PRIMARY }}>
              <img src="/partna-icon.svg" alt="Partna" className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Log in to your business dashboard
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="jane@yourbusiness.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              />
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold mt-1"
              style={{
                background: loading ? 'rgba(27,79,114,0.4)' : PARTNA_PRIMARY,
                color: '#fff',
              }}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <div className="text-center">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Don't have an account?{' '}
              </span>
              <button onClick={() => navigate('/dashboard/register')}
                className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                Register your business
              </button>
            </div>

          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
          </div>

          {/* Customer portal link */}
          <div className="text-center">
            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              Looking for the customer savings portal?{' '}
            </span>
            <button onClick={() => navigate('/portal')}
              className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
              Go to customer portal →
            </button>
          </div>

        </div>
      </div>

      <footer className="text-center py-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
          © 2026 Partna. All rights reserved.
        </span>
      </footer>

    </div>
  )
}