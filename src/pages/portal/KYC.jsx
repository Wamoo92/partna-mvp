import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const STEP_LABELS = ['NIN', 'Front of ID', 'Back of ID', 'Selfie']
const STEP_SUBS   = [
  'Step 1 of 4 — Enter your National ID number',
  'Step 2 of 4 — Front of your National ID',
  'Step 3 of 4 — Back of your National ID',
  'Step 4 of 4 — Selfie for facial verification',
]

export default function KYC({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [nin, setNin]               = useState('')
  const [frontId, setFrontId]       = useState(null)
  const [backId, setBackId]         = useState(null)
  const [selfie, setSelfie]         = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview]   = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)

  function handleFileSelect(e, setter, previewSetter) {
    const file = e.target.files[0]
    if (!file) return
    setter(file)
    const reader = new FileReader()
    reader.onload = ev => previewSetter(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      await supabase
        .from('customers')
        .update({ nin: nin.toUpperCase(), kyc_status: 'pending' })
        .eq('id', customer.id)

      await supabase.from('kyc_submissions').insert({
        customer_id: customer.id,
        status: 'pending',
      })

      setStep(5)
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function startAgain() {
    setStep(1)
    setNin('')
    setFrontId(null); setBackId(null); setSelfie(null)
    setFrontPreview(null); setBackPreview(null); setSelfiePreview(null)
    setError('')
  }

  // Photo upload box — reused for steps 2, 3, 4
  function PhotoBox({ preview, onClear, onSelect, icon, hint, capture }) {
    return (
      <div style={{ border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {preview ? (
          <div style={{ position: 'relative' }}>
            <img src={preview} alt="ID preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            <button
              onClick={onClear}
              style={{
                position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
                width: 36, height: 36,
                background: 'var(--color-black)',
                border: '2px solid var(--color-white)',
                color: 'var(--color-white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
              <span className="icon-outlined icon-sm">close</span>
            </button>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--color-green)',
              borderTop: '2px solid var(--color-black)',
              padding: '6px var(--space-4)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
              <span className="icon-outlined icon-xs">check_circle</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                Photo ready
              </span>
            </div>
          </div>
        ) : (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-10) var(--space-5)',
            background: 'var(--color-white)',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 64, height: 64,
              background: 'var(--color-black)',
              border: 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>{icon}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                Tap to take photo or upload
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', maxWidth: 240, margin: '0 auto', lineHeight: 'var(--leading-normal)' }}>
                {hint}
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              capture={capture}
              style={{ display: 'none' }}
              onChange={onSelect}
            />
          </label>
        )}
      </div>
    )
  }

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
          onClick={() => step <= 1 ? navigate('/portal/home') : setStep(step - 1)}
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
          <span className="icon-outlined icon-sm">
            {step === 0 || step === 5 ? 'home' : 'arrow_back'}
          </span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          Identity Verification
        </div>
      </header>

      {/* ── Step / intro banner ── */}
      {step >= 1 && step <= 4 ? (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: '3px solid var(--color-primary)',
          padding: 'var(--space-6) var(--space-5) var(--space-8)',
        }}>
          {/* Step tracker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-5)' }}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 4 ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: s <= step ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                  background: s < step ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all var(--transition-base)',
                }}>
                  {s < step
                    ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                    : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: s === step ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)' }}>{s}</span>
                  }
                </div>
                {s < 4 && (
                  <div style={{ flex: 1, height: 2, background: s < step ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)', transition: 'background var(--transition-slow)' }} />
                )}
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-block',
            background: 'var(--color-primary)',
            border: 'var(--border)',
            padding: '3px var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color: 'var(--color-black)',
            marginBottom: 'var(--space-3)',
          }}>
            {STEP_SUBS[step - 1]}
          </div>
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {STEP_LABELS[step - 1]}
          </h1>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: `3px solid ${step === 5 ? 'var(--color-green)' : 'var(--color-primary)'}`,
          padding: 'var(--space-8) var(--space-5)',
          textAlign: 'center',
        }}>
          {step === 5 ? (
            <>
              <div style={{
                width: 64, height: 64,
                background: 'var(--color-green)',
                border: '3px solid var(--color-white)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>check</span>
              </div>
              <h1 style={{ color: 'var(--color-white)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', marginBottom: 'var(--space-2)' }}>
                Verification submitted
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
                We'll review your documents and notify you within 24 hours
              </p>
            </>
          ) : (
            <>
              <div style={{
                width: 64, height: 64,
                background: 'var(--color-primary)',
                border: '3px solid var(--color-white)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>badge</span>
              </div>
              <h1 style={{ color: 'var(--color-white)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', marginBottom: 'var(--space-2)' }}>
                Verify your identity
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
                Complete KYC to unlock all platform features
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── STEP 0: Intro ── */}
        {step === 0 && (
          <>
            {/* What you need */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>
                What you'll need
              </div>
              <div style={{ border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {[
                  { icon: 'badge',        label: 'Your National ID number (NIN)' },
                  { icon: 'photo_camera', label: 'A photo of the front of your National ID' },
                  { icon: 'photo_camera', label: 'A photo of the back of your National ID' },
                  { icon: 'face',         label: 'A selfie for facial verification' },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      background: 'var(--color-black)',
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 16, color: 'var(--color-white)' }}>{item.icon}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-black)', fontWeight: 'var(--weight-medium)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust note */}
            <div className="alert alert-info">
              <span className="icon-outlined alert-icon">security</span>
              <div className="alert-content">
                Your information is encrypted and used only for identity verification.
                Powered by SmileID — a trusted African identity verification provider.
              </div>
            </div>

            <button onClick={() => setStep(1)} className="btn btn-primary btn-full btn-lg">
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Start verification
            </button>

            <button
              onClick={() => navigate('/portal/payment-source', { replace: true })}
              className="btn btn-secondary btn-full"
            >
              Skip for now
            </button>

            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
              Skipping will limit your access to platform features. You can complete verification later from your Profile.
            </p>
          </>
        )}

        {/* ── STEP 1: NIN ── */}
        {step === 1 && (
          <>
            <div className="input-group">
              <label className="input-label">National ID number (NIN)</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">badge</span>
                <input
                  type="text"
                  className="input"
                  placeholder="CM9001XXXXXXX"
                  value={nin}
                  onChange={e => setNin(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}
                />
              </div>
              <span className="input-hint">Enter the NIN exactly as it appears on your National ID card.</span>
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
                setStep(2)
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 2: Front of ID ── */}
        {step === 2 && (
          <>
            <PhotoBox
              preview={frontPreview}
              onClear={() => { setFrontId(null); setFrontPreview(null) }}
              onSelect={e => handleFileSelect(e, setFrontId, setFrontPreview)}
              icon="credit_card"
              hint="Make sure the ID is clearly visible, well lit and all text is readable."
              capture="environment"
            />

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (!frontId) { setError('Please take or upload a photo of the front of your ID.'); return }
                setError('')
                setStep(3)
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 3: Back of ID ── */}
        {step === 3 && (
          <>
            <PhotoBox
              preview={backPreview}
              onClear={() => { setBackId(null); setBackPreview(null) }}
              onSelect={e => handleFileSelect(e, setBackId, setBackPreview)}
              icon="flip_to_back"
              hint="Make sure the back of your ID is clearly visible and well lit."
              capture="environment"
            />

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (!backId) { setError('Please take or upload a photo of the back of your ID.'); return }
                setError('')
                setStep(4)
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 4: Selfie ── */}
        {step === 4 && (
          <>
            <PhotoBox
              preview={selfiePreview}
              onClear={() => { setSelfie(null); setSelfiePreview(null) }}
              onSelect={e => handleFileSelect(e, setSelfie, setSelfiePreview)}
              icon="face"
              hint="Look directly at the camera in a well-lit area. Remove glasses if wearing any."
              capture="user"
            />

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (!selfie) { setError('Please take a selfie to continue.'); return }
                setError('')
                handleSubmit()
              }}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Submitting…</>
                : <><span className="icon-outlined icon-sm">verified_user</span> Submit for verification</>
              }
            </button>
          </>
        )}

        {/* ── STEP 5: Success ── */}
        {step === 5 && (
          <>
            {/* What happens next */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>
                What happens next
              </div>
              <div style={{ border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {[
                  { icon: 'search',              text: 'We will review your documents within 24 hours' },
                  { icon: 'notifications_active', text: 'You will receive an SMS and email notification with the result' },
                  { icon: 'lock_open',            text: 'Once verified, all platform features will be unlocked' },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      background: 'var(--color-green)',
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 1,
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-black)', lineHeight: 'var(--leading-normal)', fontWeight: 'var(--weight-medium)', paddingTop: 'var(--space-1)' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/portal/payment-source', { replace: true })}
              className="btn btn-primary btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>

            <button onClick={startAgain} className="btn btn-secondary btn-full">
              <span className="icon-outlined icon-sm">refresh</span>
              Start again
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