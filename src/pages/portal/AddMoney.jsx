import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function nowDisplay() {
  return new Date().toLocaleString('en-UG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Shared summary table ───────────────────────────────────────────────────
function SummaryTable({ rows }) {
  return (
    <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: i < rows.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
          background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
          <span style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
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

  const [step, setStep]                       = useState(1)
  const [amount, setAmount]                   = useState('')
  const [network, setNetwork]                 = useState('mtn')
  const [momoPhone, setMomoPhone]             = useState('')
  const [loading, setLoading]                 = useState(false)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [error, setError]                     = useState('')
  const [txnReference, setTxnReference]       = useState('')

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

  async function handlePay() {
    setError('')
    if (momoPhone.replace(/\s/g, '').length < 10) {
      setError('Please enter a valid phone number.')
      return
    }
    if (!wallet) {
      setError('Could not find wallet. Please go back and try again.')
      return
    }

    setLoading(true)
    try {
      const newBalance = Number(wallet.balance) + parsedAmount
      const reference  = generateReference()
      setTxnReference(reference)

      const { error: txnError } = await supabase.from('transactions').insert({
        customer_id: customer.id,
        wallet_id:   wallet.id,
        campaign_id: enrollment?.campaign_id || null,
        type:        'deposit',
        amount:      parsedAmount,
        status:      'completed',
        network,
        reference,
      })

      if (txnError) {
        setError('Could not record transaction. Please try again.')
        setLoading(false)
        return
      }

      const { error: balanceError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id)

      if (balanceError) {
        setError('Could not update balance. Please try again.')
        setLoading(false)
        return
      }

      setStep(3)
    } catch (e) {
      console.error('Unexpected error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
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
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 1 || step === 3 ? navigate('/portal/home') : setStep(step - 1)}
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
          <span className="icon-outlined icon-sm">
            {step === 3 ? 'home' : 'arrow_back'}
          </span>
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

      {/* ── Step / success banner ── */}
      {step < 3 ? (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: '3px solid var(--color-green)',
          padding: 'var(--space-6) var(--space-5) var(--space-8)',
        }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-5)' }}>
            {[1, 2].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 2 ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: s <= step ? '2px solid var(--color-green)' : '2px solid rgba(255,255,255,0.2)',
                  background: s < step ? 'var(--color-green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all var(--transition-base)',
                }}>
                  {s < step
                    ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                    : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: s === step ? 'var(--color-green)' : 'rgba(255,255,255,0.3)' }}>{s}</span>
                  }
                </div>
                {s < 2 && (
                  <div style={{ flex: 1, height: 2, background: s < step ? 'var(--color-green)' : 'rgba(255,255,255,0.15)', transition: 'background var(--transition-slow)' }} />
                )}
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-block',
            background: 'var(--color-green)',
            border: 'var(--border)',
            padding: '3px var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color: 'var(--color-black)',
            marginBottom: 'var(--space-3)',
          }}>
            {step === 1 ? 'Step 1 of 2 — Amount' : 'Step 2 of 2 — Payment'}
          </div>
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {step === 1 ? 'How much to deposit?' : 'Mobile money details'}
          </h1>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: '3px solid var(--color-green)',
          padding: 'var(--space-8) var(--space-5)',
          textAlign: 'center',
        }}>
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
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}>
            Payment received
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
            Your balance has been updated
          </p>
          {txnReference && (
            <div style={{
              display: 'inline-block',
              marginTop: 'var(--space-3)',
              background: 'var(--color-primary)',
              border: 'var(--border)',
              padding: '4px var(--space-4)',
              fontFamily: 'monospace',
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-sm)',
              letterSpacing: '0.1em',
              color: 'var(--color-black)',
            }}>
              {txnReference}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* ── STEP 1: Amount ── */}
        {step === 1 && (
          <>
            {campaign && (
              <div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-black)',
                  letterSpacing: 'var(--tracking-widest)',
                  textTransform: 'uppercase',
                  marginBottom: 'var(--space-3)',
                  color: 'var(--color-grey)',
                }}>
                  Depositing into
                </div>
                <SummaryTable rows={[
                  { label: 'Campaign',        value: campaign.name },
                  { label: 'Current balance', value: formatUGX(wallet?.balance || 0) },
                  { label: 'Target amount',   value: formatUGX(campaign.target_amount) },
                ]} />
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Amount (UGX)</label>
              <div className="input-wrapper">
                <span style={{
                  position: 'absolute', left: 'var(--space-4)',
                  fontWeight: 'var(--weight-bold)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-grey)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}>
                  UGX
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="input input-lg"
                  style={{
                    paddingLeft: 56,
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--weight-black)',
                    letterSpacing: 'var(--tracking-tight)',
                    fontVariationSettings: "'wdth' 100, 'opsz' 30",
                  }}
                />
              </div>
              <span className="input-hint">Minimum deposit: UGX 1,000</span>
            </div>

            {/* Quick amount chips */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {[5000, 10000, 20000, 50000].map(preset => (
                <button
                  key={preset}
                  onClick={() => setAmount(formatAmountInput(String(preset)))}
                  style={{
                    padding: '6px var(--space-4)',
                    border: amount === formatAmountInput(String(preset))
                      ? '2px solid var(--color-black)'
                      : 'var(--border)',
                    background: amount === formatAmountInput(String(preset))
                      ? 'var(--color-black)'
                      : 'var(--color-white)',
                    color: amount === formatAmountInput(String(preset))
                      ? 'var(--color-white)'
                      : 'var(--color-black)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {formatUGX(preset)}
                </button>
              ))}
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (validAmount) { setError(''); setStep(2) }
                else setError('Please enter a valid amount of at least UGX 1,000.')
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 2: Mobile money ── */}
        {step === 2 && (
          <>
            <div>
              <label className="input-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
                Select network
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                {[
                  { id: 'mtn',    logo: '/mtn-logo.svg',    label: 'MTN MoMo'      },
                  { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money'  },
                ].map(net => (
                  <button
                    key={net.id}
                    onClick={() => setNetwork(net.id)}
                    style={{
                      flex: 1,
                      padding: 'var(--space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
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

            <div className="input-group">
              <label className="input-label">Mobile money number</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">phone</span>
                <input
                  type="tel"
                  className="input"
                  placeholder="+256 7XX XXX XXX"
                  value={momoPhone}
                  onChange={e => setMomoPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-black)',
                letterSpacing: 'var(--tracking-widest)',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
                color: 'var(--color-grey)',
              }}>
                Payment summary
              </div>
              <SummaryTable rows={[
                { label: 'Campaign',   value: campaign?.name || '—' },
                { label: 'Amount',     value: formatUGX(parsedAmount) },
                { label: 'Network',    value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money' },
                { label: 'Number',     value: momoPhone || '—' },
                { label: 'Date & time', value: nowDisplay() },
              ]} />
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                : <><span className="icon-outlined icon-sm">payments</span> Pay {formatUGX(parsedAmount)}</>
              }
            </button>
          </>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <>
            <div>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-black)',
                letterSpacing: 'var(--tracking-widest)',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
                color: 'var(--color-grey)',
              }}>
                Transaction details
              </div>
              <SummaryTable rows={[
                { label: 'Reference',        value: txnReference,                                       mono: true, color: 'var(--color-primary)' },
                { label: 'Campaign',         value: campaign?.name || '—' },
                { label: 'Amount deposited', value: formatUGX(parsedAmount) },
                { label: 'Network',          value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money' },
                { label: 'Number',           value: momoPhone },
                { label: 'Status',           value: 'Completed',                                        color: '#2D8B45' },
                { label: 'Date & time',      value: nowDisplay() },
              ]} />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-white)',
              border: 'var(--border)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)', flexShrink: 0 }}>
                mail
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                A receipt has been sent to <strong style={{ color: 'var(--color-black)' }}>{customer?.email}</strong>
              </span>
            </div>

            <button
              onClick={() => navigate('/portal/home')}
              className="btn btn-black btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">home</span>
              Back to home
            </button>

            <button
              onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
              className="btn btn-secondary btn-full"
            >
              <span className="icon-outlined icon-sm">receipt_long</span>
              View transactions
            </button>
          </>
        )}
      </div>
    </div>
  )
}