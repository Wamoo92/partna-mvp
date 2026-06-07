import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function KYC({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [nin, setNin] = useState('')
  const [frontId, setFrontId] = useState(null)
  const [backId, setBackId] = useState(null)
  const [selfie, setSelfie] = useState(null)

  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview] = useState(null)
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

      // Production: upload images to Supabase Storage + submit to SmileID
      // Demo: record submission as pending
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

  function handleSkip() {
    navigate('/portal/payment-source', { replace: true })
  }

  function startAgain() {
    setStep(1)
    setNin('')
    setFrontId(null)
    setBackId(null)
    setSelfie(null)
    setFrontPreview(null)
    setBackPreview(null)
    setSelfiePreview(null)
    setError('')
  }

  const steps = ['NIN', 'Front of ID', 'Back of ID', 'Selfie']

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => step <= 1 ? navigate('/portal/home') : setStep(step - 1)}
          className="text-white text-xl leading-none">
          ←
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Identity Verification</div>
        </div>
      </header>

      {step >= 1 && step <= 4 && (
        <div className="px-5 pt-5 pb-8 text-center" style={{ background: brand.primaryColor }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="rounded-full transition-all"
                style={{
                  width: s === step ? '24px' : '8px',
                  height: '8px',
                  background: s === step
                    ? brand.secondaryColor
                    : s < step
                    ? 'rgba(212,175,55,0.5)'
                    : 'rgba(255,255,255,0.25)',
                }} />
            ))}
          </div>
          <h1 className="text-white text-lg font-bold mb-1">{steps[step - 1]}</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Step {step} of 4 — {
              step === 1 ? 'Enter your National ID number' :
              step === 2 ? 'Take a photo of the front of your ID' :
              step === 3 ? 'Take a photo of the back of your ID' :
              'Take a selfie for facial verification'
            }
          </p>
        </div>
      )}

      {(step === 0 || step === 5) && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">{step === 0 ? '🪪' : '✅'}</div>
          <h1 className="text-white text-xl font-bold mb-1">
            {step === 0 ? 'Verify your identity' : 'Verification submitted'}
          </h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {step === 0
              ? 'Complete KYC to unlock all platform features'
              : 'We will review your documents and notify you within 24 hours'}
          </p>
        </div>
      )}

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {step === 0 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                WHAT YOU WILL NEED
              </div>
              {[
                { icon: '🪪', label: 'Your National ID number (NIN)' },
                { icon: '📸', label: 'A photo of the front of your National ID' },
                { icon: '📸', label: 'A photo of the back of your National ID' },
                { icon: '🤳', label: 'A selfie for facial verification' },
              ].map((item, i, arr) => (
                <div key={i} className="flex items-center gap-3 py-2"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)' }}>
              <div className="text-xs leading-relaxed" style={{ color: brand.primaryColor }}>
                Your information is encrypted and used only for identity verification.
                Powered by SmileID — a trusted African identity verification provider.
              </div>
            </div>

            <button onClick={() => setStep(1)}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Start verification
            </button>

            <button onClick={handleSkip}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'transparent', color: 'rgba(0,0,0,0.4)', border: '1.5px solid rgba(0,0,0,0.12)' }}>
              Skip for now
            </button>

            <div className="text-center text-xs px-4" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Skipping will limit your access to platform features. You can complete verification later from your Profile.
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                National ID Number (NIN)
              </label>
              <input
                type="text"
                placeholder="CM9001XXXXXXX"
                value={nin}
                onChange={e => setNin(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-wider"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
              />
              <div className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Enter the NIN exactly as it appears on your National ID card
              </div>
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (nin.length < 5) { setError('Please enter a valid NIN.'); return }
                setError('')
                setStep(2)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
              {frontPreview ? (
                <div className="relative">
                  <img src={frontPreview} alt="Front of ID"
                    className="w-full object-cover rounded-2xl" style={{ maxHeight: '220px' }} />
                  <button
                    onClick={() => { setFrontId(null); setFrontPreview(null) }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-12 cursor-pointer gap-3">
                  <div className="text-4xl">📷</div>
                  <div className="text-sm font-semibold" style={{ color: brand.primaryColor }}>
                    Tap to take photo or upload
                  </div>
                  <div className="text-xs text-center px-6" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Make sure the ID is clearly visible, well lit and all text is readable
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => handleFileSelect(e, setFrontId, setFrontPreview)} />
                </label>
              )}
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!frontId) { setError('Please take or upload a photo of the front of your ID.'); return }
                setError('')
                setStep(3)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
              {backPreview ? (
                <div className="relative">
                  <img src={backPreview} alt="Back of ID"
                    className="w-full object-cover rounded-2xl" style={{ maxHeight: '220px' }} />
                  <button
                    onClick={() => { setBackId(null); setBackPreview(null) }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-12 cursor-pointer gap-3">
                  <div className="text-4xl">📷</div>
                  <div className="text-sm font-semibold" style={{ color: brand.primaryColor }}>
                    Tap to take photo or upload
                  </div>
                  <div className="text-xs text-center px-6" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Make sure the back of your ID is clearly visible and well lit
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => handleFileSelect(e, setBackId, setBackPreview)} />
                </label>
              )}
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!backId) { setError('Please take or upload a photo of the back of your ID.'); return }
                setError('')
                setStep(4)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
              {selfiePreview ? (
                <div className="relative">
                  <img src={selfiePreview} alt="Selfie"
                    className="w-full object-cover rounded-2xl" style={{ maxHeight: '280px' }} />
                  <button
                    onClick={() => { setSelfie(null); setSelfiePreview(null) }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-12 cursor-pointer gap-3">
                  <div className="text-4xl">🤳</div>
                  <div className="text-sm font-semibold" style={{ color: brand.primaryColor }}>
                    Tap to take a selfie
                  </div>
                  <div className="text-xs text-center px-6" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Look directly at the camera in a well lit area. Remove glasses if wearing any.
                  </div>
                  <input type="file" accept="image/*" capture="user" className="hidden"
                    onChange={e => handleFileSelect(e, setSelfie, setSelfiePreview)} />
                </label>
              )}
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!selfie) { setError('Please take a selfie to continue.'); return }
                setError('')
                handleSubmit()
              }}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{
                background: loading ? 'rgba(27,79,114,0.3)' : brand.secondaryColor,
                color: brand.primaryColor
              }}>
              {loading ? 'Submitting...' : 'Submit for verification'}
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                WHAT HAPPENS NEXT
              </div>
              {[
                { icon: '🔍', text: 'We will review your documents within 24 hours' },
                { icon: '📱', text: 'You will receive an SMS and email notification with the result' },
                { icon: '✅', text: 'Once verified, all platform features will be unlocked' },
              ].map((item, i, arr) => (
                <div key={i} className="flex items-start gap-3 py-2"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.6)' }}>{item.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/portal/payment-source', { replace: true })}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Continue
            </button>

            <button onClick={startAgain}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'transparent', color: brand.primaryColor, border: '1.5px solid rgba(27,79,114,0.2)' }}>
              Start again
            </button>
          </>
        )}

      </div>

      <footer className="text-center py-4" style={{ background: '#f0f2f5' }}>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/partna-icon.svg" alt="Partna" className="w-5 h-5" />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>Powered by Partna</span>
        </div>
      </footer>

    </div>
  )
}