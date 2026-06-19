import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function PaymentSource({ customer, fromProfile = false }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [network, setNetwork] = useState(customer?.payment_network || 'mtn')
  const [number, setNumber]   = useState(customer?.payment_number  || '')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // ── Business logic — unchanged ────────────────────────────

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
        setError('Could not save payment source. Please try again.')
        setLoading(false)
        return
      }
      if (fromProfile) navigate('/portal/profile')
      else navigate('/portal/home', { replace: true })
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function handleBack() {
    if (fromProfile) navigate('/portal/profile')
    else navigate('/portal/home')
  }

  // ── Sellin tokens ─────────────────────────────────────────

  const inputStyle = {
    display: 'block', width: '100%',
    padding: '10px 14px',
    fontSize: 14, fontWeight: 500, color: '#111111',
    background: '#FFFFFF', border: '1px solid #D5D9DD',
    borderRadius: 10, outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s',
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
          onClick={handleBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: '#111111', letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#959687' }}>
          {fromProfile ? 'Edit payment source' : 'Payment source'}
        </span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#959687', margin: '0 0 8px' }}>
              {fromProfile ? 'Edit' : 'Setup'}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111111', letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              {fromProfile ? 'Update mobile money' : 'Add your mobile money'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#959687', lineHeight: '140%', margin: 0 }}>
              Link your mobile money account for faster deposits and withdrawals.
            </p>
          </div>

          {/* ── Form card ── */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #D7D8CB',
            borderRadius: 12, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* Network selector */}
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#111111', letterSpacing: '-0.4px', marginBottom: 12 }}>
                Select network
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { id: 'mtn',    logo: '/mtn-logo.svg',    label: 'MTN MoMo'     },
                  { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' },
                ].map(net => (
                  <button
                    key={net.id}
                    onClick={() => setNetwork(net.id)}
                    style={{
                      flex: 1, padding: '16px 12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      background: network === net.id ? '#111111' : '#FFFFFF',
                      border: network === net.id ? '1px solid #111111' : '1px solid #D5D9DD',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <img
                      src={net.logo}
                      alt={net.label}
                      style={{ width: 40, height: 40, objectFit: 'contain' }}
                    />
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: network === net.id ? '#FFFFFF' : '#111111',
                      letterSpacing: '-0.2px',
                    }}>
                      {net.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone number */}
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#111111', letterSpacing: '-0.4px', marginBottom: 6 }}>
                Mobile money number
              </label>
              <input
                style={inputStyle}
                type="tel"
                placeholder="+256 7XX XXX XXX"
                value={number}
                onChange={e => setNumber(e.target.value)}
                onFocus={e => e.target.style.borderColor = '#111111'}
                onBlur={e => e.target.style.borderColor = '#D5D9DD'}
              />
              <p style={{ fontSize: 12, fontWeight: 500, color: '#898B90', margin: '4px 0 0' }}>
                Only this number will be able to add or receive funds from your wallet.
              </p>
            </div>

            {/* Info notice */}
            <div style={{
              background: '#F6F7EE', border: '1px solid #D5D9DD',
              borderRadius: 8, padding: '12px 14px',
              fontSize: 13, fontWeight: 500, color: '#959687', lineHeight: '140%',
            }}>
              In the full version, your mobile money number will be verified against your identity to ensure only your number can transact on your account.
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#F8E4E4', borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: '#CC3939', lineHeight: '140%' }}>
                {error}
              </div>
            )}

            {/* Save button */}
            <button
              style={btnPrimary}
              onClick={handleSave}
              disabled={loading}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading
                ? <><div className="spinner spinner-sm spinner-light" /> Saving…</>
                : fromProfile ? 'Save changes' : 'Save and continue'
              }
            </button>

          </div>
          {/* end card */}

          {/* Skip */}
          {!fromProfile && (
            <>
              <button
                style={btnSecondary}
                onClick={() => navigate('/portal/home', { replace: true })}
                onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
              >
                Skip for now
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#898B90', margin: 0 }}>
                You can add your payment source later from your Profile.
              </p>
            </>
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