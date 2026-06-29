import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'
import LoadError from '../../components/LoadError'
import { CARRIER_FEE, PARTNA_WITHDRAWAL_FEE_PERCENT, MIN_WITHDRAWAL } from '../../lib/constants'

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
  return new Date().toLocaleString('en-UG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function getFees(amt) {
  if (!amt || isNaN(amt)) return { partnaFee: 0, carrierFee: 0, totalFees: 0, netAmount: 0 }
  const partnaFee  = Math.round(amt * PARTNA_WITHDRAWAL_FEE_PERCENT)
  const carrierFee = CARRIER_FEE
  const totalFees  = partnaFee + carrierFee
  const netAmount  = Math.max(0, amt - totalFees)
  return { partnaFee, carrierFee, totalFees, netAmount }
}

async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error:', e) }
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
}

// ── Shared summary table ───────────────────────────────────────────────────
function SummaryTable({ rows }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px',
          borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none',
          background: i % 2 === 0 ? C.white : C.bg,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── "You receive" row ─────────────────────────────────────────────────────
function ReceiveRow({ netAmount }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: C.black, borderRadius: '0 0 12px 12px', marginTop: -1 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>You receive</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: C.green, letterSpacing: '-0.5px' }}>{formatUGX(netAmount)}</span>
    </div>
  )
}

export default function Withdraw({
 customer, refetch }) {
  useEffect(() => { document.title = 'Withdraw - Partna' }, [])

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
  const [loadError, setLoadError]                 = useState(false)
  const [error, setError]                         = useState('')
  const [txnReference, setTxnReference]           = useState('')
  const [enrollment, setEnrollment]               = useState(null)
  const [wallet, setWallet]                       = useState(null)
  const [campaign, setCampaign]                   = useState(null)

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const balance      = wallet ? Number(wallet.balance) : 0
  const validAmount  = !isNaN(parsedAmount) && parsedAmount >= MIN_WITHDRAWAL && parsedAmount <= balance
  const fees         = getFees(parsedAmount)
  // Withdrawals go to the customer's saved payment source — not chosen here.
  const hasPaymentSource = !!(customer?.payment_network && customer?.payment_number)
  const savedNumber      = customer?.payment_number || ''
  const networkLabel     = customer?.payment_network === 'mtn' ? 'MTN MoMo' : customer?.payment_network === 'airtel' ? 'Airtel Money' : (customer?.payment_network || '—')
  const networkLogo      = customer?.payment_network === 'mtn' ? '/mtn-logo.svg' : customer?.payment_network === 'airtel' ? '/airtel-logo.svg' : null

  // Depend on customer?.id (not the object) so the post-withdrawal silent refetch —
  // which replaces the customer object — does not re-run loadEnrollment and flash the
  // spinner over the success screen.
  useEffect(() => { if (customer) loadEnrollment() }, [customer?.id, enrollmentId])

  // ── Business logic — unchanged ────────────────────────────────────────

  async function loadEnrollment() {
    setLoadingEnrollment(true); setLoadError(false)
    try {
      let q = supabase.from('customer_campaigns').select('*, campaigns(*), wallets(*)').eq('customer_id', customer.id).eq('status', 'active')
      if (enrollmentId) { q = q.eq('id', enrollmentId) } else { q = q.order('enrolled_at', { ascending: true }).limit(1) }
      const { data } = await q.maybeSingle()
      if (data) { setEnrollment(data); setCampaign(data.campaigns); setWallet(data.wallets) }
    } catch (e) { console.error('Load enrollment error:', e); setLoadError(true) }
    setLoadingEnrollment(false)
  }

  async function handleWithdraw() {
    setError('')
    if (!hasPaymentSource) { setError('Please add a mobile money payment source in your profile first.'); return }
    if (!wallet) { setError('Could not find wallet. Please go back and try again.'); return }
    setLoading(true)
    try {
      // Balance debit, withdrawal record, fees and SMS happen server-side (service
      // role). The payout destination is the customer's SAVED payment source — the
      // server reads it, so the client no longer sends network/phone.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Your session has expired. Please log in again.'); setLoading(false); return }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-withdrawal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ enrollmentId: enrollment.id, amount: parsedAmount }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error || 'Could not process withdrawal. Please try again.'); setLoading(false); return }
      setTxnReference(data.reference)
      if (refetch) await refetch()
      setStep(3)
    } catch (e) { console.error('Unexpected error:', e); setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loadingEnrollment) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (loadError) return <LoadError onRetry={loadEnrollment} />

  const btnPrimary   = { width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSecondary = { width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
  const inputStyle   = { display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }

  const isSuccess = step === 3

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => step === 1 || isSuccess ? navigate('/portal/home') : setStep(step - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>Withdraw</span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Stepper (steps 1 & 2 only) ── */}
          {!isSuccess && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {[1, 2].map((s) => {
                const done = s < step; const active = s === step
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 2 ? 1 : 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: done || active ? C.black : C.white, border: `1px solid ${done || active ? C.black : C.grayLine}`, color: done || active ? C.white : C.grayMid, transition: 'all 0.2s' }}>
                      {done ? '✓' : s}
                    </div>
                    {s < 2 && <div style={{ flex: 1, height: 1, background: done ? C.black : C.grayLine, transition: 'background 0.3s' }} />}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Heading ── */}
          <div>
            {!isSuccess ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 8px' }}>
                  {step === 1 ? 'Step 1 of 2 — Amount' : 'Step 2 of 2 — Payment details'}
                </p>
                <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
                  {step === 1 ? 'How much to withdraw?' : 'Withdrawal details'}
                </h1>
                {campaign && <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>{campaign.name}</p>}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingBottom: 4 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: 0 }}>Withdrawal requested</h1>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Your request is being processed</p>
                {txnReference && (
                  <div style={{ background: C.labelBg, borderRadius: 8, padding: '6px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: C.black, letterSpacing: '0.08em' }}>
                    {txnReference}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── STEP 1: Amount ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Balance summary */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                {[
                  { label: 'Campaign',          value: campaign?.name || '—' },
                  { label: 'Available balance', value: formatUGX(balance) },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Amount input card */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>Amount (UGX)</label>
                  <button onClick={() => setAmount(formatAmountInput(String(balance)))} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, color: C.white, background: C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Withdraw all
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
                  <input
                    type="text" inputMode="numeric" placeholder="0"
                    value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
                    style={{ ...inputStyle, paddingLeft: 52, fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px' }}
                    onFocus={e => e.target.style.borderColor = C.black}
                    onBlur={e => e.target.style.borderColor = C.grayLine}
                  />
                </div>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0 }}>Minimum withdrawal: UGX 5,000</p>
              </div>

              {/* Fee preview */}
              {validAmount && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee preview</p>
                  <div style={{ borderRadius: 12, overflow: 'hidden' }}>
                    <SummaryTable rows={[
                      { label: 'Withdrawal amount',       value: formatUGX(parsedAmount) },
                      { label: 'Partna service fee (2%)', value: '− ' + formatUGX(fees.partnaFee),  color: C.red },
                      { label: 'Mobile money fee (flat)', value: '− ' + formatUGX(fees.carrierFee), color: C.red },
                    ]} />
                    <ReceiveRow netAmount={fees.netAmount} />
                  </div>
                </div>
              )}

              {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>{error}</div>}

              <button
                style={btnPrimary}
                onClick={() => {
                  if (!validAmount) {
                    if (isNaN(parsedAmount) || parsedAmount < MIN_WITHDRAWAL) setError(`Minimum withdrawal is ${formatUGX(MIN_WITHDRAWAL)}.`)
                    else if (parsedAmount > balance) setError('Amount exceeds your available balance of ' + formatUGX(balance) + '.')
                    return
                  }
                  setError(''); setStep(2)
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── STEP 2: Mobile money ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Saved payment source — read-only (set in Profile) */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>Withdrawing to</label>
                {hasPaymentSource ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '12px 14px' }}>
                    {networkLogo && <img src={networkLogo} alt={networkLabel} style={{ width: 38, height: 38, objectFit: 'contain' }} />}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{networkLabel}</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, fontFamily: 'monospace' }}>{savedNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: C.bgRed, borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                    No payment source on file. Add your mobile money number in your profile to withdraw.
                  </div>
                )}
                <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0, lineHeight: '140%' }}>
                  Withdrawals are sent to your saved payment source. To change it, update your{' '}
                  <button onClick={() => navigate('/portal/payment-source')} style={{ background: 'none', border: 'none', padding: 0, color: C.black, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>payment source</button>.
                </p>
              </div>

              {/* Summary */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Withdrawal summary</p>
                <div style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <SummaryTable rows={[
                    { label: 'Campaign',                   value: campaign?.name || '—' },
                    { label: 'Withdrawal amount',          value: formatUGX(parsedAmount) },
                    { label: 'Partna service fee (2%)',    value: '− ' + formatUGX(fees.partnaFee),  color: C.red },
                    { label: 'Mobile money fee (flat)',    value: '− ' + formatUGX(fees.carrierFee), color: C.red },
                    { label: 'Network',                    value: networkLabel },
                    { label: 'Number',                     value: savedNumber || '—' },
                    { label: 'Date & time',                value: nowDisplay() },
                  ]} />
                  <ReceiveRow netAmount={fees.netAmount} />
                </div>
              </div>

              {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>{error}</div>}

              <button
                style={{ ...btnPrimary, background: C.orange, borderColor: C.orange, opacity: loading || !hasPaymentSource ? 0.6 : 1, cursor: loading || !hasPaymentSource ? 'not-allowed' : 'pointer' }}
                onClick={handleWithdraw} disabled={loading || !hasPaymentSource}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1' }}
              >
                {loading
                  ? <><div className="spinner spinner-sm spinner-light" /> Processing…</>
                  : `Withdraw ${formatUGX(parsedAmount)}`
                }
              </button>
            </div>
          )}

          {/* ── STEP 3: Pending ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Processing notice */}
              <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.orange, margin: '0 0 4px' }}>Processing time</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.orange, margin: 0, lineHeight: '140%' }}>
                    Withdrawals typically take <strong>1–2 business days</strong> to process. You'll receive an SMS once done.
                  </p>
                </div>
              </div>

              {/* Transaction details */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Transaction details</p>
                <div style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <SummaryTable rows={[
                    { label: 'Reference',               value: txnReference,                     mono: true, color: C.green },
                    { label: 'Campaign',                value: campaign?.name || '—' },
                    { label: 'Amount withdrawn',        value: formatUGX(parsedAmount) },
                    { label: 'Partna service fee (2%)', value: '− ' + formatUGX(fees.partnaFee),  color: C.red },
                    { label: 'Mobile money fee (flat)', value: '− ' + formatUGX(fees.carrierFee), color: C.red },
                    { label: 'Network',                 value: networkLabel },
                    { label: 'Number',                  value: momoPhone },
                    { label: 'Status',                  value: 'Pending',                         color: C.orange },
                    { label: 'Date & time',             value: nowDisplay() },
                  ]} />
                  <ReceiveRow netAmount={fees.netAmount} />
                </div>
              </div>

              {/* SMS confirmation */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>
                  An SMS confirmation has been sent to <strong style={{ color: C.black }}>{customer?.phone}</strong>
                </span>
              </div>

              <button style={btnPrimary} onClick={() => navigate('/portal/home')} onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                Back to home
              </button>
              <button style={btnSecondary} onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })} onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                View transactions
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}