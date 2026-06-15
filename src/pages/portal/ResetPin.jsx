import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function ResetPin() {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [newPin, setNewPin]           = useState('')
  const [confirmPin, setConfirmPin]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [customer, setCustomer]       = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setValidSession(true)
        const { data: custData } = await supabase
          .from('customers')
          .select('phone, first_name')
          .eq('email', session.user.email)
          .maybeSingle()
        setCustomer(custData)
        setCheckingSession(false)
      }
    })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setValidSession(true)
        const { data: custData } = await supabase
          .from('customers')
          .select('phone, first_name')
          .eq('email', session.user.email)
          .maybeSingle()
        setCustomer(custData)
      }
      setCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleResetPin() {
    setError('')
    if (!newPin || newPin.length !== 4)  { setError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin)            { setError('PINs do not match.'); return }
    if (!customer?.phone)                 { setError('Could not find your account details. Please try again.'); return }

    setLoading(true)
    try {
      const cleanPhone  = customer.phone.replace(/\s+/g, '')
      const newPassword = `pin-${newPin}-${cleanPhone}`
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

      if (updateError) {
        setError('Could not update PIN. Your reset link may have expired. Please request a new one.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => navigate('/portal/login', { replace: true }), 3000)
    } catch (e) {
      console.error('Reset PIN error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const pinsMatch   = newPin.length === 4 && confirmPin.length === 4 && newPin === confirmPin
  const canSubmit   = !loading && newPin.length === 4 && confirmPin.length === 4

  if (checkingSession) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => navigate('/portal/login')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {brand.logoUrl && (
            <div style={{
              width: 32, height: 32,
              background: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src={brand.logoUrl} alt={brand.businessName} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
          )}
          <span style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            {brand.businessName}
          </span>
        </div>
      </header>

      {/* ── Title banner ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: success
          ? '3px solid var(--color-green)'
          : !validSession
          ? '3px solid var(--color-red)'
          : '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
        <div style={{
          display: 'inline-block',
          background: success
            ? 'var(--color-green)'
            : !validSession
            ? 'var(--color-red)'
            : 'var(--color-primary)',
          border: 'var(--border)',
          padding: '3px var(--space-3)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'var(--color-black)',
          marginBottom: 'var(--space-3)',
        }}>
          {success ? 'Complete' : !validSession ? 'Invalid link' : 'Reset PIN'}
        </div>
        <h1 style={{
          color: 'var(--color-white)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
          marginBottom: 'var(--space-2)',
        }}>
          {success ? 'PIN updated' : !validSession ? 'Link expired' : 'Set new PIN'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
          {success
            ? 'Redirecting you to login…'
            : !validSession
            ? 'This reset link is invalid or has expired.'
            : customer?.first_name
              ? `Welcome back, ${customer.first_name}. Choose a new 4-digit PIN.`
              : 'Choose a new 4-digit PIN for your account.'}
        </p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── Invalid / expired ── */}
        {!validSession && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{
              background: 'var(--color-white)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
              padding: 'var(--space-8)',
              textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64,
                background: 'var(--color-red)',
                border: 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>link_off</span>
              </div>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                Invalid or expired link
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                This PIN reset link is invalid or has expired. Reset links are valid for 1 hour.
              </div>
            </div>

            <button
              onClick={() => navigate('/portal/login')}
              className="btn btn-primary btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">send</span>
              Request a new link
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{
              background: 'var(--color-green)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-md)',
              padding: 'var(--space-8)',
              textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64,
                background: 'var(--color-black)',
                border: '3px solid var(--color-white)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-white)' }}>lock_reset</span>
              </div>
              <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 24" }}>
                PIN updated successfully
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', lineHeight: 'var(--leading-normal)' }}>
                You will be redirected to the login page in a moment.
              </div>
            </div>

            <button
              onClick={() => navigate('/portal/login', { replace: true })}
              className="btn btn-black btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">login</span>
              Go to login now
            </button>
          </div>
        )}

        {/* ── Reset form ── */}
        {validSession && !success && (
          <>
            <div className="input-group">
              <label className="input-label">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input"
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-black)',
                }}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Confirm new PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input"
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-black)',
                }}
              />
            </div>

            {/* PIN fill indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: i < newPin.length ? 16 : 10,
                  height: 10,
                  background: i < newPin.length ? 'var(--color-black)' : 'var(--color-grey-light)',
                  border: 'var(--border)',
                  transition: 'all var(--transition-fast)',
                }} />
              ))}
            </div>

            {/* PIN match indicator */}
            {newPin.length === 4 && confirmPin.length === 4 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                color: pinsMatch ? '#2D8B45' : '#C0392B',
              }}>
                <span className="icon-outlined icon-sm">
                  {pinsMatch ? 'check_circle' : 'cancel'}
                </span>
                {pinsMatch ? 'PINs match' : 'PINs do not match'}
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={handleResetPin}
              disabled={!canSubmit}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Updating PIN…</>
                : <><span className="icon-outlined icon-sm">lock_reset</span> Set new PIN</>
              }
            </button>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={{
        padding: 'var(--space-4) var(--space-5)',
        borderTop: '1.5px solid var(--color-grey-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
      }}>
        <img src="/partna-icon.svg" alt="Partna" style={{ width: 18, height: 18, opacity: 0.4 }} />
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase',
          color: 'var(--color-grey)',
        }}>
          Powered by Partna
        </span>
      </footer>

    </div>
  )
}