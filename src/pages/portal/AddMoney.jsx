import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function SummaryTable({ rows }) {
  return (
    <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: i < rows.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
          background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
          <span style={{
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            color: row.color || 'var(--color-black)',
            fontFamily: row.mono ? 'monospace' : 'inherit',
          }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AddMoney({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const enrollmentId = location.state?.enrollmentId || null

  const [step, setStep]                         = useState(1)
  const [amount, setAmount]                     = useState('')
  const [loading, setLoading]                   = useState(false)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [error, setError]                       = useState('')

  const [enrollment, setEnrollment] = useState(null)
  const [wallet, setWallet]         = useState(null)
  const [campaign, setCampaign]     = useState(null)

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const validAmount  = !isNaN(parsedAmount) && parsedAmount >= 1000

  useEffect(() => { if (customer) loadEnrollment() }, [customer, enrollmentId])

  async function loadEnrollment() {
    setLoadingEnrollment(true)
    try {
      let q = supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')

      if (enrollmentId) {
        q = q.eq('id', enrollmentId)
      } else {
        q = q.order('enrolled_at', { ascending: true }).limit(1)
      }

      const { data } = await q.maybeSingle()
      if (data) { setEnrollment(data); setCampaign(data.campaigns); setWallet(data.wallets) }
    } catch (e) {
      console.error('Load enrollment error:', e)
    }
    setLoadingEnrollment(false)
  }

  async function handleInitiatePayment() {
    setError('')
    if (!wallet) { setError('Could not find wallet. Please go back and try again.'); return }

    setLoading(true)
    try {
      // Call pesapal-initiate Edge Function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pesapal-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          amount:       parsedAmount,
          currency:     'UGX',
          customer: {
            id:         customer.id,
            email:      customer.email,
            phone:      customer.phone,
            first_name: customer.first_name,
            last_name:  customer.last_name,
          },
          walletId:     wallet.id,
          campaignId:   enrollment?.campaign_id || null,
          enrollmentId: enrollmentId || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.redirect_url) {
        setError(data.error || 'Could not initiate payment. Please try again.')
        setLoading(false)
        return
      }

      // Redirect customer to Pesapal payment page
      // They will return to pesapal-callback Edge Function after paying
      window.location.href = data.redirect_url

    } catch (e) {
      console.error('Initiate payment error:', e)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (loadingEnrollment) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => navigate('/portal/home')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div>
          <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            Add Money
          </div>
          {campaign && (
            <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
              {campaign.name}
            </div>
          )}
        </div>
      </header>

      {/* ── Banner ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-green)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
        <div style={{
          display: 'inline-block',
          background: 'var(--color-green)', border: 'var(--border)',
          padding: '3px var(--space-3)',
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
          color: 'var(--color-black)', marginBottom: 'var(--space-3)',
        }}>
          Deposit
        </div>
        <h1 style={{
          color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
        }}>
          How much to deposit?
        </h1>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Campaign context */}
        {campaign && (
          <SummaryTable rows={[
            { label: 'Campaign',        value: campaign.name },
            { label: 'Current balance', value: formatUGX(wallet?.balance || 0) },
            { label: 'Target amount',   value: formatUGX(campaign.target_amount) },
          ]} />
        )}

        {/* Amount input */}
        <div className="input-group">
          <label className="input-label">Amount (UGX)</label>
          <div className="input-wrapper">
            <span style={{
              position: 'absolute', left: 'var(--space-4)',
              fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)',
              color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1,
            }}>UGX</span>
            <input
              type="text" inputMode="numeric" placeholder="0"
              value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
              className="input input-lg"
              style={{ paddingLeft: 56, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)' }}
            />
          </div>
          <span className="input-hint">Minimum deposit: UGX 1,000</span>
        </div>

        {/* Quick amount chips */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[5000, 10000, 20000, 50000].map(preset => (
            <button key={preset} onClick={() => setAmount(formatAmountInput(String(preset)))} style={{
              padding: '6px var(--space-4)',
              border: amount === formatAmountInput(String(preset)) ? '2px solid var(--color-black)' : 'var(--border)',
              background: amount === formatAmountInput(String(preset)) ? 'var(--color-black)' : 'var(--color-white)',
              color: amount === formatAmountInput(String(preset)) ? 'var(--color-white)' : 'var(--color-black)',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}>
              {formatUGX(preset)}
            </button>
          ))}
        </div>

        {/* What happens next info box */}
        {validAmount && (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-white)',
            border: 'var(--border)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>
              What happens next
            </div>
            {[
              { icon: 'open_in_new',   text: `You'll be redirected to Pesapal's secure payment page` },
              { icon: 'phone_android', text: 'Choose MTN MoMo or Airtel Money and enter your PIN' },
              { icon: 'check_circle',  text: `Once confirmed, ${formatUGX(parsedAmount)} will be added to your savings` },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            <span className="icon-outlined alert-icon">error_outline</span>
            <div className="alert-content">{error}</div>
          </div>
        )}

        <button
          onClick={() => {
            if (!validAmount) { setError('Please enter a valid amount of at least UGX 1,000.'); return }
            setError('')
            handleInitiatePayment()
          }}
          disabled={loading}
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: 'var(--space-2)' }}
        >
          {loading
            ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Redirecting to payment…</>
            : <><span className="icon-outlined icon-sm">open_in_new</span> Pay {validAmount ? formatUGX(parsedAmount) : ''} with Pesapal</>
          }
        </button>

        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
          <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-grey)' }}>lock</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
            Payments secured by Pesapal · PCI/DSS Compliant
          </span>
        </div>
      </div>
    </div>
  )
}