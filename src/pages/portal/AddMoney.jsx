import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
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
}

export default function AddMoney({
 customer }) {
  useEffect(() => { document.title = 'Add Money - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const enrollmentId = location.state?.enrollmentId || null

  const [amount, setAmount]                       = useState('')
  const [loading, setLoading]                     = useState(false)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [error, setError]                         = useState('')
  const [enrollment, setEnrollment]               = useState(null)
  const [wallet, setWallet]                       = useState(null)
  const [campaign, setCampaign]                   = useState(null)

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const validAmount  = !isNaN(parsedAmount) && parsedAmount >= 1000

  useEffect(() => { if (customer) loadEnrollment() }, [customer, enrollmentId])

  // ── Business logic — unchanged ─────────────────────────────────────────

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
      // pesapal-initiate now derives the customer from the caller's JWT and
      // verifies wallet ownership, so send the user's access token.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Your session has expired. Please log in again.'); setLoading(false); return }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pesapal-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount: parsedAmount, currency: 'UGX',
          walletId: wallet.id, campaignId: enrollment?.campaign_id || null, enrollmentId: enrollmentId || null,
          // So Pesapal redirects the customer back to THIS subdomain (keeps session).
          returnOrigin: window.location.origin,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.redirect_url) {
        setError(data.error || 'Could not initiate payment. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.redirect_url
    } catch (e) {
      console.error('Initiate payment error:', e)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loadingEnrollment) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const balance = wallet?.balance || 0
  const target  = campaign?.target_amount || 0

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/portal/home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>Add money</span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 8px' }}>Deposit</p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              How much to deposit?
            </h1>
            {campaign && (
              <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
                Saving toward <strong style={{ color: C.black, fontWeight: 600 }}>{campaign.name}</strong>
              </p>
            )}
          </div>

          {/* ── Campaign summary card ── */}
          {campaign && (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
              {[
                { label: 'Campaign',        value: campaign.name },
                { label: 'Current balance', value: formatUGX(balance) },
                { label: 'Target amount',   value: formatUGX(target) },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none',
                  background: i % 2 === 0 ? C.white : C.bg,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Amount card ── */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Amount input */}
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6 }}>
                Amount (UGX)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none',
                }}>
                  UGX
                </span>
                <input
                  type="text" inputMode="numeric" placeholder="0"
                  value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
                  style={{
                    display: 'block', width: '100%',
                    padding: '12px 14px 12px 52px',
                    fontSize: 28, fontWeight: 600, color: C.black,
                    background: C.white, border: `1px solid ${C.grayLine}`,
                    borderRadius: 10, outline: 'none',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    letterSpacing: '-0.5px',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>
                Minimum deposit: UGX 1,000
              </p>
            </div>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[5000, 10000, 20000, 50000].map(preset => {
                const presetStr = formatAmountInput(String(preset))
                const isActive  = amount === presetStr
                return (
                  <button
                    key={preset}
                    onClick={() => setAmount(presetStr)}
                    style={{
                      padding: '7px 14px',
                      fontSize: 13, fontWeight: 600,
                      background: isActive ? C.black : C.white,
                      color:      isActive ? C.white : C.black,
                      border: `1px solid ${isActive ? C.black : C.grayLine}`,
                      borderRadius: 10,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {formatUGX(preset)}
                  </button>
                )
              })}
            </div>

            {/* What happens next */}
            {validAmount && (
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  What happens next
                </p>
                {[
                  "You'll be redirected to Pesapal's secure payment page.",
                  'Choose MTN MoMo or Airtel Money and enter your PIN.',
                  `Once confirmed, ${formatUGX(parsedAmount)} will be added to your savings.`,
                ].map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.black }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>{text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => {
                if (!validAmount) { setError('Please enter a valid amount of at least UGX 1,000.'); return }
                setError('')
                handleInitiatePayment()
              }}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 18px',
                fontSize: 14, fontWeight: 600,
                color: C.white, background: C.green,
                border: `1px solid ${C.green}`, borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1' }}
            >
              {loading
                ? <><div className="spinner spinner-sm spinner-light" /> Redirecting to payment…</>
                : `Pay ${validAmount ? formatUGX(parsedAmount) : ''} with Pesapal`
              }
            </button>

            {/* Security note */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>
                Payments secured by Pesapal · PCI/DSS Compliant
              </span>
            </div>

          </div>
          {/* end card */}

        </div>
      </div>

    </div>
  )
}