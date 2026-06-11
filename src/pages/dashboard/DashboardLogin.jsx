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

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (signInError) {
        setError('Incorrect email or password. Please try again.')
        setLoading(false)
        return
      }

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

  async function handleForgotPassword() {
    setForgotError('')
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.')
      return
    }
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/dashboard/reset-password`,
        }
      )
      if (error) {
        setForgotError('Could not send reset email. Please try again.')
      } else {
        setForgotSuccess(true)
      }
    } catch (e) {
      setForgotError('Something went wrong. Please try again.')
    }
    setForgotLoading(false)
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

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: PARTNA_PRIMARY }}>
              <img src="/partna-icon.svg" alt="Partna" className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
              {showForgot ? 'Reset your password' : 'Welcome back'}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.45)' }}>
              {showForgot
                ? 'Enter your email and we\'ll send you a reset link'
                : 'Log in to your business dashboard'}
            </p>
          </div>

          {/* ── LOGIN FORM ── */}
          {!showForgot && (
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Password
                  </label>
                  <button
                    onClick={() => { setShowForgot(true); setForgotEmail(email); setError('') }}
                    className="text-xs font-semibold"
                    style={{ color: PARTNA_PRIMARY }}>
                    Forgot password?
                  </button>
                </div>
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
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {showForgot && (
            <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>
              {forgotSuccess ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(22,163,74,0.1)' }}>
                    ✉️
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
                      Check your email
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      We've sent a password reset link to
                    </div>
                    <div className="text-xs font-semibold mt-1" style={{ color: PARTNA_PRIMARY }}>
                      {forgotEmail}
                    </div>
                    <div className="text-xs mt-2" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      Click the link in the email to set a new password. The link expires in 1 hour.
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotEmail('') }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      placeholder="jane@yourbusiness.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                    />
                  </div>

                  {forgotError && (
                    <div className="text-xs px-4 py-3 rounded-xl"
                      style={{ background: '#FEE2E2', color: '#991B1B' }}>
                      {forgotError}
                    </div>
                  )}

                  <button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{
                      background: forgotLoading ? 'rgba(27,79,114,0.4)' : PARTNA_PRIMARY,
                      color: '#fff',
                    }}>
                    {forgotLoading ? 'Sending...' : 'Send reset link'}
                  </button>

                  <button
                    onClick={() => { setShowForgot(false); setForgotError(''); setForgotEmail('') }}
                    className="w-full py-2 rounded-xl text-xs font-semibold"
                    style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                    ← Back to login
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
          </div>

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