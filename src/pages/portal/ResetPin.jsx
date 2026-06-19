import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  labelBg:  '#E4E5DD',
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

export default function ResetPin() {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [newPin, setNewPin]               = useState('')
  const [confirmPin, setConfirmPin]       = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)
  const [validSession, setValidSession]   = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [customer, setCustomer]           = useState(null)

  // ── Business logic — unchanged ─────────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setValidSession(true)
        const { data: custData } = await supabase.from('customers').select('phone, first_name').eq('email', session.user.email).maybeSingle()
        setCustomer(custData)
        setCheckingSession(false)
      }
    })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setValidSession(true)
        const { data: custData } = await supabase.from('customers').select('phone, first_name').eq('email', session.user.email).maybeSingle()
        setCustomer(custData)
      }
      setCheckingSession(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleResetPin() {
    setError('')
    if (!newPin || newPin.length !== 4) { setError('PIN must be exactly 4 digits.'); return }
    if (newPin !== confirmPin)           { setError('PINs do not match.'); return }
    if (!customer?.phone)               { setError('Could not find your account details. Please try again.'); return }
    setLoading(true)
    try {
      const cleanPhone  = customer.phone.replace(/\s+/g, '')
      const newPassword = `pin-${newPin}-${cleanPhone}`
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { setError('Could not update PIN. Your reset link may have expired. Please request a new one.'); setLoading(false); return }
      setSuccess(true)
      setTimeout(() => navigate('/portal/login', { replace: true }), 3000)
    } catch (e) {
      console.error('Reset PIN error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const pinsMatch = newPin.length === 4 && confirmPin.length === 4 && newPin === confirmPin
  const canSubmit = !loading && newPin.length === 4 && confirmPin.length === 4

  // ─────────────────────────────────────────────────────────────────────────

  if (checkingSession) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const inputStyle = {
    display: 'block', width: '100%',
    padding: '12px 14px',
    fontSize: 28, fontWeight: 600,
    color: C.black, background: C.white,
    border: `1px solid ${C.grayLine}`,
    borderRadius: 10, outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    textAlign: 'center', letterSpacing: '0.5em',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/portal/login')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>
          {success ? 'Complete' : !validSession ? 'Invalid link' : 'Reset PIN'}
        </span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Heading ── */}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              {success ? 'PIN updated' : !validSession ? 'Link expired' : 'Set a new PIN'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
              {success
                ? 'Redirecting you to login…'
                : !validSession
                ? 'This reset link is invalid or has expired.'
                : customer?.first_name
                  ? `Welcome back, ${customer.first_name}. Choose a new 4-digit PIN.`
                  : 'Choose a new 4-digit PIN for your account.'}
            </p>
          </div>

          {/* ── Invalid / expired ── */}
          {!validSession && !success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.bgRed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Invalid or expired link</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%', maxWidth: 280 }}>
                  This PIN reset link is invalid or has expired. Reset links are valid for 1 hour.
                </p>
              </div>
              <button
                onClick={() => navigate('/portal/login')}
                style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Request a new link
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0 }}>PIN updated successfully</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                  You will be redirected to the login page in a moment.
                </p>
              </div>
              <button
                onClick={() => navigate('/portal/login', { replace: true })}
                style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Go to login now
              </button>
            </div>
          )}

          {/* ── Reset form ── */}
          {validSession && !success && (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {error && (
                <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6, textAlign: 'center' }}>
                  New PIN
                </label>
                <input
                  style={inputStyle}
                  type="password" inputMode="numeric" maxLength={4} placeholder="····"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6, textAlign: 'center' }}>
                  Confirm new PIN
                </label>
                <input
                  style={inputStyle}
                  type="password" inputMode="numeric" maxLength={4} placeholder="····"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>

              {/* PIN fill indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 6, borderRadius: 999,
                    width: i < newPin.length ? 24 : 10,
                    background: i < newPin.length ? C.black : C.grayLight,
                    transition: 'all 0.15s',
                  }} />
                ))}
              </div>

              {/* Match indicator */}
              {newPin.length === 4 && confirmPin.length === 4 && (
                <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, margin: 0, color: pinsMatch ? C.green : C.red }}>
                  {pinsMatch ? '✓ PINs match' : '✗ PINs do not match'}
                </p>
              )}

              <button
                onClick={handleResetPin}
                disabled={!canSubmit}
                style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (canSubmit) e.currentTarget.style.opacity = '1' }}
              >
                {loading
                  ? <><div className="spinner spinner-sm spinner-light" /> Updating PIN…</>
                  : 'Set new PIN'
                }
              </button>

            </div>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ padding: '16px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>Powered by Partna</span>
      </footer>

    </div>
  )
}