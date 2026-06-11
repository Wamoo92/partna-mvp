import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash
    // onAuthStateChange fires with event 'PASSWORD_RECOVERY' when the link is clicked
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setValidSession(true)
        setCheckingSession(false)
      } else if (event === 'SIGNED_IN' && session) {
        // Already signed in via recovery link
        setValidSession(true)
        setCheckingSession(false)
      }
    })

    // Also check existing session in case page was refreshed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true)
      }
      setCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError('')
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Could not update password. Your reset link may have expired. Please request a new one.')
        setLoading(false)
        return
      }
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/dashboard/login', { replace: true }), 3000)
    } catch (e) {
      console.error('Reset password error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (checkingSession) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header className="flex items-center px-6 py-4 border-b"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-3">
          <img src="/partna-icon.svg" alt="Partna" className="w-8 h-8" />
          <div>
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Partna</div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Business Portal</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: PARTNA_PRIMARY }}>
              <img src="/partna-icon.svg" alt="Partna" className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
              {success ? 'Password updated' : 'Set new password'}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.45)' }}>
              {success
                ? 'Redirecting you to login...'
                : 'Choose a strong password for your account'}
            </p>
          </div>

          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>

            {/* Invalid or expired link */}
            {!validSession && !success && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="text-4xl">⚠️</div>
                <div className="text-center">
                  <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
                    Invalid or expired link
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    This password reset link is invalid or has expired. Reset links are valid for 1 hour.
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/login')}
                  className="w-full py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Request a new link
                </button>
              </div>
            )}

            {/* Success state */}
            {success && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: 'rgba(22,163,74,0.1)' }}>
                  ✓
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold mb-1" style={{ color: '#16A34A' }}>
                    Password updated successfully
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    You will be redirected to the login page in a moment.
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/login', { replace: true })}
                  className="w-full py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Go to login now
                </button>
              </div>
            )}

            {/* Reset form */}
            {validSession && !success && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    New password
                  </label>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                  />
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    Minimum 8 characters
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                  />
                </div>

                {error && (
                  <div className="text-xs px-4 py-3 rounded-xl"
                    style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold mt-1"
                  style={{
                    background: loading ? 'rgba(27,79,114,0.4)' : PARTNA_PRIMARY,
                    color: '#fff',
                  }}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </>
            )}
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