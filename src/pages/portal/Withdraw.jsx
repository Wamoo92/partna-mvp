import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function toOpenFloatNetwork(network) {
  if (network === 'mtn') return 'MTN'
  if (network === 'airtel') return 'AirtelMoney'
  return network
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

function getCarrierFee(amt) {
  if (amt <= 15000)   return 570
  if (amt <= 45000)   return 800
  if (amt <= 125000)  return 1350
  if (amt <= 250000)  return 2500
  if (amt <= 500000)  return 4100
  if (amt <= 1000000) return 6000
  return 7250
}

function getFees(amt) {
  if (!amt || isNaN(amt)) return { partnaFee: 0, carrierFee: 0, tax: 0, totalFees: 0, netAmount: 0 }
  const partnaFee  = Math.round(amt * 0.03)
  const carrierFee = getCarrierFee(amt)
  const tax        = Math.round(amt * 0.005)
  const totalFees  = partnaFee + carrierFee + tax
  const netAmount  = amt - totalFees
  return { partnaFee, carrierFee, tax, totalFees, netAmount }
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

function ReceiveRow({ netAmount }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-4)',
      background: 'var(--color-black)', border: 'var(--border)',
      marginTop: 'var(--space-1)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>
        You receive
      </span>
      <span style={{
        fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)',
        color: 'var(--color-green)', fontVariationSettings: "'wdth' 100, 'opsz' 20",
      }}>
        {formatUGX(netAmount)}
      </span>
    </div>
  )
}

// ── Send SMS via Edge Function (non-blocking) ──────────────────────────────
async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    // Non-critical — never block the withdrawal flow
    console.error('SMS send error:', e)
  }
}

export default function Withdraw({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const enrollmentId = location.state?.enrollmentId || null

  const [step, setStep]                           = useState(1)
  const [amount, setAmount]                       = useState('')
  const [network, setNetwork]                     = useState('mtn')
  const [momoPhone, setMomoPhone]                 = useState('')
  const [loading, setLoading]                     = useState(false)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [error, setError]                         = useState('')
  const [txnReference, setTxnReference]           = useState('')

  const [enrollment, setEnrollment] = useState(null)
  const [wallet, setWallet]         = useState(null)
  const [campaign, setCampaign]     = useState(null)

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const balance      = wallet ? Number(wallet.balance) : 0
  const validAmount  = !isNaN(parsedAmount) && parsedAmount >= 5000 && parsedAmount <= balance
  const fees         = getFees(parsedAmount)
  const networkLabel = network === 'mtn' ? 'MTN MoMo' : 'Airtel Money'

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

  async function handleWithdraw() {
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
      const newBalance       = Number(wallet.balance) - parsedAmount
      if (newBalance < 0) { setError('Insufficient balance.'); setLoading(false); return }

      const reference        = generateReference()
      setTxnReference(reference)
      const openFloatNetwork = toOpenFloatNetwork(network)
      const cleanPhone       = momoPhone.replace(/\s/g, '')

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id:        customer.id,
          wallet_id:          wallet.id,
          campaign_id:        enrollment?.campaign_id || null,
          type:               'withdrawal',
          amount:             parsedAmount,
          status:             'pending',
          network:            openFloatNetwork,
          withdrawal_network: openFloatNetwork,
          withdrawal_phone:   cleanPhone,
          reference,
          notes: `${networkLabel}: ${momoPhone}`,
        })
        .select()

      if (txnError) {
        setError('Could not record transaction. Please try again.')
        setLoading(false)
        return
      }

      const txnId = txnData?.[0]?.id
      if (txnId) {
        await supabase.from('transaction_fees').insert({
          transaction_id: txnId,
          customer_id:    customer.id,
          network:        openFloatNetwork,
          fee_type:       'withdrawal',
          charged_to:     'user',
          partna_fee:     fees.partnaFee,
          carrier_fee:    fees.carrierFee,
          tax:            fees.tax,
          total_fees:     fees.totalFees,
          net_amount:     fees.netAmount,
        })
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

      // ── Send withdrawal requested SMS (non-blocking) ──
      // Use the customer's registered phone, not the withdrawal destination
      const smsPhone = customer?.phone || momoPhone
      sendSMS(customer.id, smsPhone, 'withdrawal_requested', {
        amount:    formatUGX(parsedAmount),
        reference,
      })

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
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 1 || step === 3 ? navigate('/portal/home') : setStep(step - 1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: 'var(--color-white)',
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
            Withdraw
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
          borderBottom: '3px solid var(--color-yellow)',
          padding: 'var(--space-6) var(--space-5) var(--space-8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-5)' }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 2 ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: s <= step ? '2px solid var(--color-yellow)' : '2px solid rgba(255,255,255,0.2)',
                  background: s < step ? 'var(--color-yellow)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all var(--transition-base)',
                }}>
                  {s < step
                    ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                    : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: s === step ? 'var(--color-yellow)' : 'rgba(255,255,255,0.3)' }}>{s}</span>
                  }
                </div>
                {s < 2 && (
                  <div style={{ flex: 1, height: 2, background: s < step ? 'var(--color-yellow)' : 'rgba(255,255,255,0.15)', transition: 'background var(--transition-slow)' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{
            display: 'inline-block', background: 'var(--color-yellow)', border: 'var(--border)',
            padding: '3px var(--space-3)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
            color: 'var(--color-black)', marginBottom: 'var(--space-3)',
          }}>
            {step === 1 ? 'Step 1 of 2 — Amount' : 'Step 2 of 2 — Payment'}
          </div>
          <h1 style={{
            color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {step === 1 ? 'How much to withdraw?' : 'Withdrawal details'}
          </h1>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-black)', borderBottom: '3px solid var(--color-yellow)',
          padding: 'var(--space-8) var(--space-5)', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, background: 'var(--color-yellow)',
            border: '3px solid var(--color-white)', boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}>
            <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>schedule</span>
          </div>
          <h1 style={{
            color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}>
            Withdrawal requested
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
            Your request is being processed
          </p>
          {txnReference && (
            <div style={{
              display: 'inline-block', marginTop: 'var(--space-3)',
              background: 'var(--color-primary)', border: 'var(--border)',
              padding: '4px var(--space-4)', fontFamily: 'monospace',
              fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)',
              letterSpacing: '0.1em', color: 'var(--color-black)',
            }}>
              {txnReference}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── STEP 1: Amount ── */}
        {step === 1 && (
          <>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', marginBottom: 'var(--space-3)', color: 'var(--color-grey)' }}>
                Withdrawing from
              </div>
              <SummaryTable rows={[
                { label: 'Campaign',          value: campaign?.name || '—' },
                { label: 'Available balance', value: formatUGX(balance) },
              ]} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button onClick={() => setAmount(formatAmountInput(String(balance)))} className="btn btn-sm btn-warning">
                  Withdraw all
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Amount (UGX)</label>
              <div className="input-wrapper">
                <span style={{ position: 'absolute', left: 'var(--space-4)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1 }}>UGX</span>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="input input-lg"
                  style={{ paddingLeft: 56, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 30" }}
                />
              </div>
              <span className="input-hint">Minimum withdrawal: UGX 5,000</span>
            </div>

            {validAmount && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', marginBottom: 'var(--space-3)', color: 'var(--color-grey)' }}>
                  Fee preview
                </div>
                <SummaryTable rows={[
                  { label: 'Withdrawal amount',       value: formatUGX(parsedAmount) },
                  { label: 'Partna service fee (3%)', value: '− ' + formatUGX(fees.partnaFee),  color: '#C0392B' },
                  { label: 'Carrier fee',             value: '− ' + formatUGX(fees.carrierFee), color: '#C0392B' },
                  { label: 'Tax (0.5%)',              value: '− ' + formatUGX(fees.tax),         color: '#C0392B' },
                ]} />
                <ReceiveRow netAmount={fees.netAmount} />
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
                if (!validAmount) {
                  if (isNaN(parsedAmount) || parsedAmount < 5000) setError('Minimum withdrawal is UGX 5,000.')
                  else if (parsedAmount > balance) setError('Amount exceeds your available balance of ' + formatUGX(balance) + '.')
                  return
                }
                setError(''); setStep(2)
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
              <label className="input-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Select network</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                {[
                  { id: 'mtn',    logo: '/mtn-logo.svg',    label: 'MTN MoMo'     },
                  { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' },
                ].map(net => (
                  <button key={net.id} onClick={() => setNetwork(net.id)} style={{
                    flex: 1, padding: 'var(--space-4)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
                    background: network === net.id ? 'var(--color-black)' : 'var(--color-white)',
                    border: network === net.id ? '3px solid var(--color-black)' : 'var(--border)',
                    boxShadow: network === net.id ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer', transition: 'all var(--transition-base)',
                  }}>
                    <img src={net.logo} alt={net.label} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: network === net.id ? 'var(--color-white)' : 'var(--color-black)' }}>
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
                <input type="tel" className="input" placeholder="+256 7XX XXX XXX" value={momoPhone} onChange={e => setMomoPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', marginBottom: 'var(--space-3)', color: 'var(--color-grey)' }}>
                Withdrawal summary
              </div>
              <SummaryTable rows={[
                { label: 'Campaign',                value: campaign?.name || '—' },
                { label: 'Withdrawal amount',       value: formatUGX(parsedAmount) },
                { label: 'Partna service fee (3%)', value: '− ' + formatUGX(fees.partnaFee),  color: '#C0392B' },
                { label: 'Carrier fee',             value: '− ' + formatUGX(fees.carrierFee), color: '#C0392B' },
                { label: 'Tax (0.5%)',              value: '− ' + formatUGX(fees.tax),         color: '#C0392B' },
                { label: 'Network',                 value: networkLabel },
                { label: 'Number',                  value: momoPhone || '—' },
                { label: 'Date & time',             value: nowDisplay() },
              ]} />
              <ReceiveRow netAmount={fees.netAmount} />
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button onClick={handleWithdraw} disabled={loading} className="btn btn-primary btn-full btn-lg">
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                : <><span className="icon-outlined icon-sm">south</span> Withdraw {formatUGX(parsedAmount)}</>
              }
            </button>
          </>
        )}

        {/* ── STEP 3: Pending ── */}
        {step === 3 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
              padding: 'var(--space-4)', background: 'var(--color-yellow)',
              border: 'var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-black)', flexShrink: 0, marginTop: 1 }}>schedule</span>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Processing time</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.65)', lineHeight: 'var(--leading-normal)' }}>
                  Withdrawals typically take <strong>1–2 business days</strong> to process.
                  You'll receive an SMS notification once your withdrawal has been processed.
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', marginBottom: 'var(--space-3)', color: 'var(--color-grey)' }}>
                Transaction details
              </div>
              <SummaryTable rows={[
                { label: 'Reference',          value: txnReference,                      mono: true, color: 'var(--color-primary)' },
                { label: 'Campaign',           value: campaign?.name || '—' },
                { label: 'Amount withdrawn',   value: formatUGX(parsedAmount) },
                { label: 'Partna service fee', value: '− ' + formatUGX(fees.partnaFee),  color: '#C0392B' },
                { label: 'Carrier fee',        value: '− ' + formatUGX(fees.carrierFee), color: '#C0392B' },
                { label: 'Tax',                value: '− ' + formatUGX(fees.tax),         color: '#C0392B' },
                { label: 'Network',            value: networkLabel },
                { label: 'Number',             value: momoPhone },
                { label: 'Status',             value: 'Pending',                          color: '#8A6700' },
                { label: 'Date & time',        value: nowDisplay() },
              ]} />
              <ReceiveRow netAmount={fees.netAmount} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-white)', border: 'var(--border)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)', flexShrink: 0 }}>sms</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                An SMS confirmation has been sent to <strong style={{ color: 'var(--color-black)' }}>{customer?.phone}</strong>
              </span>
            </div>

            <button onClick={() => navigate('/portal/home')} className="btn btn-black btn-full btn-lg">
              <span className="icon-outlined icon-sm">home</span>
              Back to home
            </button>

            <button onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })} className="btn btn-secondary btn-full">
              <span className="icon-outlined icon-sm">receipt_long</span>
              View transactions
            </button>
          </>
        )}
      </div>
    </div>
  )
}