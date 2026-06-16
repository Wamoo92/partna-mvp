import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function KYC({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  // step 0 = intro, step 1 = enter NIN, step 2 = result
  const [step, setStep]       = useState(0)
  const [nin, setNin]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null) // { verified, notFound, unavailable, verifiedName }

  async function handleVerify() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smileid-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          customerId: customer.id,
          nin:        nin.toUpperCase().trim(),
          firstName:  customer.first_name  || '',
          lastName:   customer.last_name   || '',
          dob:        customer.dob         || '', // YYYY-MM-DD
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed. Please try again.')
        setLoading(false)
        return
      }

      setResult(data)
      setStep(2)
    } catch (e) {
      console.error('KYC verify error:', e)
      setError('Something went wrong. Please check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 0 ? navigate('/portal/home') : setStep(step - 1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">
            {step === 2 ? 'home' : 'arrow_back'}
          </span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          Identity Verification
        </div>
      </header>

      {/* ── Banner ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: `3px solid ${
          step === 2 && result?.verified  ? 'var(--color-green)'
          : step === 2 && !result?.verified ? 'var(--color-red)'
          : 'var(--color-primary)'
        }`,
        padding: 'var(--space-8) var(--space-5)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64,
          background: step === 2 && result?.verified  ? 'var(--color-green)'
                    : step === 2 && !result?.verified ? 'var(--color-red)'
                    : 'var(--color-primary)',
          border: '3px solid var(--color-white)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>
            {step === 2 && result?.verified  ? 'verified_user'
             : step === 2 && !result?.verified ? 'gpp_bad'
             : 'badge'}
          </span>
        </div>
        <h1 style={{
          color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
          marginBottom: 'var(--space-2)',
        }}>
          {step === 0 ? 'Verify your identity'
           : step === 1 ? 'Enter your NIN'
           : result?.verified ? 'Identity verified'
           : result?.unavailable ? 'Service unavailable'
           : 'Verification failed'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
          {step === 0 ? 'Verify your National ID to unlock all platform features'
           : step === 1 ? 'Your NIN is on your physical National ID card'
           : result?.verified ? `Welcome, ${result.verifiedName || customer.first_name}`
           : result?.unavailable ? 'The ID authority is temporarily unavailable'
           : 'We could not verify the details you entered'}
        </p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── STEP 0: Intro ── */}
        {step === 0 && (
          <>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                What you'll need
              </div>
              <div style={{ border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {[
                  { icon: 'badge',   text: 'Your Uganda National ID card' },
                  { icon: 'looks_one', text: 'Your NIN number (printed on the front of your ID)' },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <div style={{
                      width: 36, height: 36, flexShrink: 0,
                      background: 'var(--color-black)', border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-white)' }}>{item.icon}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--color-white)', border: 'var(--border)',
              display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>
                bolt
              </span>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                  Verified in seconds
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                  We verify your NIN directly with the National Identification and Registration Authority (NIRA). No photos required. Results are instant.
                </div>
              </div>
            </div>

            <div className="alert alert-info">
              <span className="icon-outlined alert-icon">security</span>
              <div className="alert-content">
                Your information is encrypted and used only for identity verification. Powered by SmileID — a trusted African identity verification provider.
              </div>
            </div>

            <button onClick={() => setStep(1)} className="btn btn-primary btn-full btn-lg">
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Start verification
            </button>

            <button onClick={() => navigate('/portal/payment-source')} className="btn btn-secondary btn-full">
              Skip for now
            </button>

            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
              Skipping will limit your access to platform features. You can complete verification later from your Profile.
            </p>
          </>
        )}

        {/* ── STEP 1: Enter NIN ── */}
        {step === 1 && (
          <>
            <div className="input-group">
              <label className="input-label">National ID Number (NIN)</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">badge</span>
                <input
                  type="text"
                  className="input"
                  placeholder="CM9001XXXXXXXXX"
                  value={nin}
                  onChange={e => setNin(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  style={{ textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontFamily: 'monospace' }}
                  maxLength={20}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <span className="input-hint">Enter the NIN exactly as it appears on your National ID card. Uganda NIDs typically start with CM or CF.</span>
            </div>

            {/* Pre-filled info we'll send to NIRA */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                Details we'll verify
              </div>
              <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                {[
                  { label: 'First name', value: customer.first_name },
                  { label: 'Last name',  value: customer.last_name  },
                  { label: 'NIN',        value: nin || '—', mono: true },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: row.mono ? 'monospace' : 'inherit', letterSpacing: row.mono ? 'var(--tracking-wide)' : 'normal' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (nin.length < 5) { setError('Please enter a valid NIN.'); return }
                setError('')
                handleVerify()
              }}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Verifying with NIRA…</>
                : <><span className="icon-outlined icon-sm">verified_user</span> Verify my identity</>
              }
            </button>
          </>
        )}

        {/* ── STEP 2: Result ── */}
        {step === 2 && result && (
          <>
            {result.verified ? (
              <>
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  {[
                    { label: 'Status',    value: 'Verified by NIRA', color: '#2D8B45' },
                    { label: 'Name on ID', value: result.verifiedName || `${customer.first_name} ${customer.last_name}` },
                    { label: 'NIN',       value: nin, mono: true },
                  ].map((row, i, arr) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                      background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                    }}>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: row.color || 'var(--color-black)', fontFamily: row.mono ? 'monospace' : 'inherit' }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="alert alert-success">
                  <span className="icon-outlined alert-icon">check_circle</span>
                  <div className="alert-content">
                    Your identity has been verified. All platform features are now unlocked.
                  </div>
                </div>

                <button onClick={() => navigate('/portal/payment-source')} className="btn btn-primary btn-full btn-lg">
                  <span className="icon-outlined icon-sm">arrow_forward</span>
                  Continue
                </button>
              </>
            ) : result.unavailable ? (
              <>
                <div className="alert alert-warning">
                  <span className="icon-outlined alert-icon">warning</span>
                  <div className="alert-content">
                    The NIRA verification system is temporarily unavailable. This is not an issue with your ID. Please try again in a few minutes.
                  </div>
                </div>

                <button onClick={() => { setStep(1); setResult(null) }} className="btn btn-primary btn-full btn-lg">
                  <span className="icon-outlined icon-sm">refresh</span>
                  Try again
                </button>

                <button onClick={() => navigate('/portal/home')} className="btn btn-secondary btn-full">
                  Continue without verifying
                </button>
              </>
            ) : (
              <>
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">
                    {result.notFound
                      ? 'The NIN you entered was not found in the NIRA database. Please check your ID card and try again.'
                      : 'We could not verify your identity. Please check that your NIN matches your ID card exactly and try again.'}
                  </div>
                </div>

                <div style={{
                  padding: 'var(--space-4)', background: 'var(--color-white)', border: 'var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                }}>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>Common reasons for failure</div>
                  {[
                    'NIN entered incorrectly — check for 0 vs O, 1 vs I',
                    'Name mismatch — your registered name must match your ID exactly',
                    'ID not yet registered in the NIRA database',
                  ].map((reason, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-grey)', flexShrink: 0, marginTop: 2 }}>chevron_right</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>{reason}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => { setStep(1); setResult(null) }} className="btn btn-primary btn-full btn-lg">
                  <span className="icon-outlined icon-sm">refresh</span>
                  Try again
                </button>

                <button onClick={() => navigate('/portal/home')} className="btn btn-secondary btn-full">
                  Continue without verifying
                </button>
              </>
            )}
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
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>
          Powered by Partna
        </span>
      </footer>
    </div>
  )
}