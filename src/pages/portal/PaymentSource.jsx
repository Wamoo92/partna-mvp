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

  function handleBack() {
    if (fromProfile) navigate('/portal/profile')
    else navigate('/portal/home')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <button
          onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent',
            color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          Payment Source
        </div>
      </header>

      {/* ── Title banner ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
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
          {fromProfile ? 'Edit' : 'Setup'}
        </div>
        <h1 style={{
          color: 'var(--color-white)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
          marginBottom: 'var(--space-2)',
        }}>
          {fromProfile ? 'Update mobile money' : 'Add your mobile money'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
          Link your mobile money account for faster deposits and withdrawals.
        </p>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* Network selector */}
        <div>
          <label className="input-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
            Select network
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {[
              { id: 'mtn',    logo: '/mtn-logo.svg',    label: 'MTN MoMo'     },
              { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' },
            ].map(net => (
              <button
                key={net.id}
                onClick={() => setNetwork(net.id)}
                style={{
                  flex: 1,
                  padding: 'var(--space-4)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
                  background: network === net.id ? 'var(--color-black)' : 'var(--color-white)',
                  border: network === net.id ? '3px solid var(--color-black)' : 'var(--border)',
                  boxShadow: network === net.id ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)',
                }}
              >
                <img src={net.logo} alt={net.label} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-black)',
                  letterSpacing: 'var(--tracking-wide)',
                  textTransform: 'uppercase',
                  color: network === net.id ? 'var(--color-white)' : 'var(--color-black)',
                }}>
                  {net.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Phone input */}
        <div className="input-group">
          <label className="input-label">Mobile money number</label>
          <div className="input-wrapper">
            <span className="icon-outlined input-icon-left">phone</span>
            <input
              type="tel"
              className="input"
              placeholder="+256 7XX XXX XXX"
              value={number}
              onChange={e => setNumber(e.target.value)}
            />
          </div>
          <span className="input-hint">
            Only this number will be able to add or receive funds from your wallet.
          </span>
        </div>

        {/* Info notice */}
        <div className="alert alert-info">
          <span className="icon-outlined alert-icon">verified_user</span>
          <div className="alert-content">
            In the full version, your mobile money number will be verified against your identity
            to ensure only your number can transact on your account.
          </div>
        </div>

        {error && (
          <div className="alert alert-danger">
            <span className="icon-outlined alert-icon">error_outline</span>
            <div className="alert-content">{error}</div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: 'var(--space-2)' }}
        >
          {loading
            ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
            : <><span className="icon-outlined icon-sm">{fromProfile ? 'save' : 'arrow_forward'}</span> {fromProfile ? 'Save changes' : 'Save and continue'}</>
          }
        </button>

        {!fromProfile && (
          <>
            <button
              onClick={() => navigate('/portal/home', { replace: true })}
              className="btn btn-secondary btn-full"
            >
              Skip for now
            </button>
            <p style={{
              textAlign: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-grey)',
              fontWeight: 'var(--weight-medium)',
            }}>
              You can add your payment source later from your Profile.
            </p>
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