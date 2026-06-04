import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { brand } from '../../lib/brandConfig'

export default function Login() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!phone || !pin) {
      setError('Please enter your phone number and PIN.')
      return
    }
    if (pin.length !== 4) {
      setError('PIN must be 4 digits.')
      return
    }

    setLoading(true)
    try {
      const email = `${phone.replace(/\s+/g, '')}@partna.app`
      const password = `pin-${pin}-${phone.replace(/\s+/g, '')}`

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Incorrect phone number or PIN. Please try again.')
        return
      }

      navigate('/portal/home')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header
        className="flex items-center px-4 py-3 gap-3"
        style={{ background: brand.primaryColor }}
      >
        <button
          onClick={() => navigate('/portal')}
          className="text-white text-xl leading-none"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <img
  src={brand.logoUrl}
  alt={brand.businessName}
  className="w-8 h-8 object-contain"
  style={{ mixBlendMode: 'screen' }}
/>
          <div className="text-white text-xs font-semibold tracking-wide">
            {brand.businessName}
          </div>
        </div>
      </header>

      {/* Top blue area */}
      <div
        className="px-5 pt-6 pb-10 text-center"
        style={{ background: brand.primaryColor }}
      >
        <h1 className="text-white text-xl font-bold mb-1">Welcome back</h1>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Log in to your savings account
        </p>
      </div>

      {/* Form card */}
      <div
        className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}
      >

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
            Phone number
          </label>
          <input
            type="tel"
            placeholder="+256 7XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: '#fff',
              border: `1.5px solid rgba(27,79,114,0.15)`,
              color: '#333',
            }}
          />
        </div>

        {/* PIN */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
            4-digit PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest"
            style={{
              background: '#fff',
              border: `1.5px solid rgba(27,79,114,0.15)`,
              color: '#333',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="text-xs px-4 py-3 rounded-xl"
            style={{ background: '#FEE2E2', color: '#991B1B' }}
          >
            {error}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold mt-2"
          style={{
            background: loading ? 'rgba(27,79,114,0.4)' : brand.primaryColor,
            color: '#fff',
            border: 'none',
          }}
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        {/* Register link */}
        <div className="text-center mt-2">
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
            Don't have an account?{' '}
          </span>
          <button
            onClick={() => navigate('/portal/register')}
            className="text-xs font-semibold"
            style={{ color: brand.primaryColor }}
          >
            Register
          </button>
        </div>

      </div>

      {/* Footer */}
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