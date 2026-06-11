import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function ResetPin() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [customer, setCustomer] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setValidSession(true)
        // Fetch customer details for phone (needed to construct the PIN password)
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
    if (!newPin || newPin.length !== 4) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    if (!customer?.phone) {
      setError('Could not find your account details. Please try again.')
      return
    }

    setLoading(true)
    try {
      const cleanPhone = customer.phone.replace(/\s+/g, '')
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

  if (checkingSession) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={() => navigate('/portal/login')} className="text-white text-xl leading-none">
          ←
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt={brand.businessName}
            className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold tracking-wide">
            {brand.businessName}
          </div>
        </div>
      </header>

      <div className="px-5 pt-6 pb-10 text-center" style={{ background: brand.primaryColor }}>
        <h1 className="text-white text-xl font-bold mb-1">
          {success ? 'PIN updated' : 'Set new PIN'}
        </h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {success
            ? 'Redirecting you to login...'
            : customer?.first_name
              ? `Welcome back, ${customer.first_name}. Choose a new 4-digit PIN.`
              : 'Choose a new 4-digit PIN for your account'}
        </p>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* Invalid or expired link */}
        {!validSession && !success && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-4xl">⚠️</div>
            <div className="text-center">
              <div className="text-sm font-bold mb-1" style={{ color: brand.primaryColor }}>
                Invalid or expired link
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                This PIN reset link is invalid or has expired. Reset links are valid for 1 hour.
              </div>
            </div>
            <button
              onClick={() => navigate('/portal/login')}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Request a new link
            </button>
          </div>
        )}

        {/* Success state */}
        {success && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'rgba(22,163,74,0.1)' }}>
              ✓
            </div>
            <div className="text-center">
              <div className="text-sm font-bold mb-1" style={{ color: '#16A34A' }}>
                PIN updated successfully
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                You will be redirected to the login page in a moment.
              </div>
            </div>
            <button
              onClick={() => navigate('/portal/login', { replace: true })}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Go to login now
            </button>
          </div>
        )}

        {/* Reset PIN form */}
        {validSession && !success && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                New PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest text-center"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333', fontSize: '20px' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Confirm new PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest text-center"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333', fontSize: '20px' }}
              />
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            {/* PIN strength dots */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-3 h-3 rounded-full transition-all"
                  style={{
                    background: i < newPin.length
                      ? brand.primaryColor
                      : 'rgba(0,0,0,0.15)',
                  }} />
              ))}
            </div>

            <button
              onClick={handleResetPin}
              disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{
                background: (loading || newPin.length !== 4 || confirmPin.length !== 4)
                  ? 'rgba(27,79,114,0.3)'
                  : brand.primaryColor,
                color: '#fff',
              }}>
              {loading ? 'Updating PIN...' : 'Set new PIN'}
            </button>
          </>
        )}

      </div>

      <footer className="text-center py-4" style={{ background: '#f0f2f5' }}>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/partna-icon.svg" alt="Partna" className="w-5 h-5" />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
            Powered by Partna
          </span>
        </div>
      </footer>

    </div>
  )
}