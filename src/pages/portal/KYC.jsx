import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function KYC({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [step, setStep]       = useState(0)
  const [nin, setNin]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null)

  // ── Business logic — unchanged ────────────────────────────

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
          dob:        customer.dob         || '',
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

  // ── Shared inline tokens — strict Sellin kit ──────────────

  const inputStyle = {
    display: 'block', width: '100%',
    padding: '10px 14px',
    fontSize: 14, fontWeight: 500, color: '#111111',
    background: '#FFFFFF',
    border: '1px solid #D5D9DD',
    borderRadius: 10, outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 14, fontWeight: 600,
    color: '#111111', letterSpacing: '-0.4px',
    marginBottom: 6,
  }

  const btnPrimary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: '#FFFFFF', background: '#111111',
    border: '1px solid #111111', borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const btnSecondary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: '#111111', background: '#FFFFFF',
    border: '1px solid #D5D9DD', borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  function focusInput(e)  { e.target.style.borderColor = '#111111' }
  function blurInput(e)   { e.target.style.borderColor = '#D5D9DD' }

  // Step title / subtitle helpers
  const stepTitle = step === 0 ? 'Verify your identity'
    : step === 1 ? 'Enter your NIN'
    : result?.verified ? 'Identity verified'
    : result?.unavailable ? 'Service unavailable'
    : 'Verification failed'

  const stepSub = step === 0 ? 'Unlock all platform features by verifying your National ID.'
    : step === 1 ? 'Your NIN is printed on the front of your Uganda National ID card.'
    : result?.verified ? `Welcome, ${result.verifiedName || customer.first_name}. All features are now unlocked.`
    : result?.unavailable ? 'The ID authority is temporarily unavailable. Please try again shortly.'
    : 'We could not verify the details you entered. Please check and try again.'

  // ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7EE', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: '#FFFFFF', borderBottom: '1px solid #D7D8CB',
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => step === 0 ? navigate('/portal/home') : step === 2 ? navigate('/portal/home') : setStep(step - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: '#111111', letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>

        <span style={{ fontSize: 14, fontWeight: 500, color: '#959687' }}>
          Identity Verification
        </span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Step indicator (steps 0 and 1 only) ── */}
          {step < 2 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {[0, 1].map((s) => {
                const done   = s < step
                const active = s === step
                const n      = s + 1
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 1 ? 1 : 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                      background: done || active ? '#111111' : '#FFFFFF',
                      border: `1px solid ${done || active ? '#111111' : '#D5D9DD'}`,
                      color: done || active ? '#FFFFFF' : '#898B90',
                      transition: 'all 0.2s',
                    }}>
                      {done ? '✓' : n}
                    </div>
                    {s < 1 && (
                      <div style={{ flex: 1, height: 1, background: done ? '#111111' : '#D5D9DD', transition: 'background 0.3s' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#959687', margin: '0 0 8px' }}>
              {step === 0 ? 'Step 1 of 2 — Overview'
               : step === 1 ? 'Step 2 of 2 — Verification'
               : 'Verification complete'}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111111', letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              {stepTitle}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#959687', lineHeight: '140%', margin: 0 }}>
              {stepSub}
            </p>
          </div>

          {/* ── STEP 0: Intro ── */}
          {step === 0 && (
            <>
              {/* What you'll need */}
              <div style={{ background: '#FFFFFF', border: '1px solid #D7D8CB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #D5D9DD' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#959687', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    What you'll need
                  </p>
                </div>
                {[
                  {
                    title: 'Your Uganda National ID card',
                    sub: 'The physical card issued by NIRA',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                        <path d="M6 15h4M14 15h4" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Your NIN number',
                    sub: 'Printed on the front of your ID card',
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                    ),
                  },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    borderBottom: i < arr.length - 1 ? '1px solid #D5D9DD' : 'none',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#E4E5DD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', margin: '0 0 2px' }}>{item.title}</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#959687', margin: 0 }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #D7D8CB', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#E4E5DD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', margin: '0 0 4px' }}>Verified in seconds</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#959687', margin: 0, lineHeight: '140%' }}>
                    We verify your NIN directly with NIRA. No photos required. Results are instant. Powered by SmileID.
                  </p>
                </div>
              </div>

              {/* Security note */}
              <div style={{ background: '#F6F7EE', border: '1px solid #D5D9DD', borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#959687', lineHeight: '140%' }}>
                Your information is encrypted and used only for identity verification.
              </div>

              <button
                style={btnPrimary} onClick={() => setStep(1)}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Start verification
              </button>

              <button
                style={btnSecondary} onClick={() => navigate('/portal/payment-source')}
                onMouseEnter={e => e.currentTarget.style.background = '#F6F7EE'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
              >
                Skip for now
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#898B90', margin: 0 }}>
                Skipping will limit your access to platform features. You can complete verification later from your Profile.
              </p>
            </>
          )}

          {/* ── STEP 1: Enter NIN ── */}
          {step === 1 && (
            <div style={{ background: '#FFFFFF', border: '1px solid #D7D8CB', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {error && (
                <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={labelStyle}>National ID Number (NIN)</label>
                <input
                  style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace' }}
                  type="text"
                  placeholder="CM9001XXXXXXXXX"
                  value={nin}
                  onChange={e => setNin(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  maxLength={20}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  onFocus={focusInput} onBlur={blurInput}
                />
                <p style={{ fontSize: 12, fontWeight: 500, color: '#898B90', margin: '4px 0 0' }}>
                  Enter the NIN exactly as it appears on your ID. Uganda NIDs typically start with CM or CF.
                </p>
              </div>

              {/* Details summary */}
              <div style={{ background: '#F6F7EE', border: '1px solid #D5D9DD', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #D5D9DD' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#959687', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Details we'll verify
                  </p>
                </div>
                {[
                  { label: 'First name', value: customer.first_name },
                  { label: 'Last name',  value: customer.last_name  },
                  { label: 'NIN',        value: nin || '—', mono: true },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: i < arr.length - 1 ? '1px solid #D5D9DD' : 'none',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#959687' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111111', fontFamily: row.mono ? 'monospace' : 'inherit', letterSpacing: row.mono ? '0.06em' : 'normal' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                style={btnPrimary}
                onClick={() => {
                  if (nin.length < 5) { setError('Please enter a valid NIN.'); return }
                  setError('')
                  handleVerify()
                }}
                disabled={loading}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {loading
                  ? <><div className="spinner spinner-sm spinner-light" /> Verifying with NIRA…</>
                  : 'Verify my identity'
                }
              </button>
            </div>
          )}

          {/* ── STEP 2: Result ── */}
          {step === 2 && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Verified */}
              {result.verified && (
                <>
                  <div style={{ background: '#E4F8EC', borderRadius: 12, padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#59886D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#111111', margin: 0 }}>Identity verified</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#59886D', margin: 0 }}>All platform features are now unlocked.</p>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #D7D8CB', borderRadius: 12, overflow: 'hidden' }}>
                    {[
                      { label: 'Status',    value: 'Verified by NIRA', color: '#59886D' },
                      { label: 'Name on ID', value: result.verifiedName || `${customer.first_name} ${customer.last_name}` },
                      { label: 'NIN',        value: nin, mono: true },
                    ].map((row, i, arr) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid #D5D9DD' : 'none',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#959687' }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: row.color || '#111111', fontFamily: row.mono ? 'monospace' : 'inherit' }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    style={btnPrimary} onClick={() => navigate('/portal/payment-source')}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Continue
                  </button>
                </>
              )}

              {/* Unavailable */}
              {result.unavailable && (
                <>
                  <div style={{ background: '#F8F0E4', border: '1px solid #EF8354', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#EF8354', lineHeight: '140%' }}>
                    The NIRA verification system is temporarily unavailable. This is not an issue with your ID. Please try again in a few minutes.
                  </div>

                  <button
                    style={btnPrimary} onClick={() => { setStep(1); setResult(null) }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Try again
                  </button>

                  <button
                    style={btnSecondary} onClick={() => navigate('/portal/home')}
                    onMouseEnter={e => e.currentTarget.style.background = '#F6F7EE'}
                    onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    Continue without verifying
                  </button>
                </>
              )}

              {/* Failed */}
              {!result.verified && !result.unavailable && (
                <>
                  <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                    {result.notFound
                      ? 'The NIN you entered was not found in the NIRA database. Please check your ID card and try again.'
                      : 'We could not verify your identity. Please check that your NIN matches your ID card exactly.'}
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #D7D8CB', borderRadius: 12, padding: '16px 18px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', margin: '0 0 12px' }}>Common reasons for failure</p>
                    {[
                      'NIN entered incorrectly — check for 0 vs O, 1 vs I',
                      'Name mismatch — your registered name must match your ID exactly',
                      'ID not yet registered in the NIRA database',
                    ].map((reason, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#959687', flexShrink: 0, marginTop: 6 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#959687', lineHeight: '140%' }}>{reason}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    style={btnPrimary} onClick={() => { setStep(1); setResult(null) }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Try again
                  </button>

                  <button
                    style={btnSecondary} onClick={() => navigate('/portal/home')}
                    onMouseEnter={e => e.currentTarget.style.background = '#F6F7EE'}
                    onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    Continue without verifying
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ padding: '16px 20px', borderTop: '1px solid #D5D9DD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#898B90' }}>Powered by Partna</span>
      </footer>

    </div>
  )
}