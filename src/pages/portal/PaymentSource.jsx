import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function PaymentSource({ customer, fromProfile = false }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [network, setNetwork] = useState(customer?.payment_network || 'mtn')
  const [number, setNumber] = useState(customer?.payment_number || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    const cleanNumber = number.replace(/\s+/g, '')
    if (cleanNumber.length < 10) {
      setError('Please enter a valid mobile money number.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ payment_network: network, payment_number: cleanNumber })
        .eq('id', customer.id)

      if (updateError) {
        console.error('Payment source error:', updateError)
        setError('Could not save payment source. Please try again.')
        setLoading(false)
        return
      }

      if (fromProfile) {
        navigate('/portal/profile')
      } else {
        navigate('/portal/home', { replace: true })
      }
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function handleSkip() {
    navigate('/portal/home', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => fromProfile ? navigate('/portal/profile') : navigate('/portal/home')}
          className="text-white text-xl leading-none">
          ←
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Payment Source</div>
        </div>
      </header>

      <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
        <div className="text-4xl mb-3">📱</div>
        <h1 className="text-white text-xl font-bold mb-1">Add your mobile money</h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Link your mobile money account for faster deposits and withdrawals
        </p>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        <div>
          <label className="text-xs font-semibold mb-2 block" style={{ color: brand.primaryColor }}>
            Select your mobile money network
          </label>
          <div className="flex gap-3">
            {[
              { id: 'mtn', logo: '/mtn-logo.svg', label: 'MTN MoMo' },
              { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' },
            ].map(net => (
              <button key={net.id} onClick={() => setNetwork(net.id)}
                className="flex-1 rounded-2xl p-3 flex flex-col items-center gap-2"
                style={{
                  background: '#fff',
                  border: network === net.id ? `2px solid ${brand.secondaryColor}` : '2px solid rgba(0,0,0,0.06)',
                }}>
                <img src={net.logo} alt={net.label} className="w-12 h-12 object-contain rounded-xl" />
                <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{net.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
            Mobile money number
          </label>
          <input type="tel" placeholder="+256 7XX XXX XXX" value={number}
            onChange={e => setNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
            Only this number will be able to add or receive funds from your wallet
          </div>
        </div>

        <div className="rounded-2xl px-4 py-3"
          style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)' }}>
          <div className="text-xs leading-relaxed" style={{ color: brand.primaryColor }}>
            In the full version, your mobile money number will be verified against your identity to ensure only your number can transact on your account.
          </div>
        </div>

        {error && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: loading ? 'rgba(27,79,114,0.3)' : brand.primaryColor, color: '#fff' }}>
          {loading ? 'Saving...' : fromProfile ? 'Save changes' : 'Save and continue'}
        </button>

        {!fromProfile && (
          <button onClick={handleSkip}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'transparent', color: 'rgba(0,0,0,0.4)', border: '1.5px solid rgba(0,0,0,0.12)' }}>
            Skip for now
          </button>
        )}

        {!fromProfile && (
          <div className="text-center text-xs px-4" style={{ color: 'rgba(0,0,0,0.35)' }}>
            You can add your payment source later from your Profile
          </div>
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