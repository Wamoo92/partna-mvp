import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'
import { getEffectiveStatus } from '../../lib/campaignUtils'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••'
  return num.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(dateStr) {
  if (!dateStr) return 'MM/YY'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

function formatUGX(amount) {
  return 'UGX ' + Number(amount).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
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
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Home({ customer, signOut }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [enrollments, setEnrollments]   = useState([])
  const [cards, setCards]               = useState({})
  const [activeIdx, setActiveIdx]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [cardFlipped, setCardFlipped]   = useState(false)
  const [transactions, setTransactions] = useState([])

  useEffect(() => { if (customer) fetchData() }, [customer])
  useEffect(() => { setCardFlipped(false) }, [activeIdx])

  // ── Data fetching — unchanged ──────────────────────────────────────────
  async function fetchData() {
    setLoading(true)
    try {
      const { data: enrollData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })
      setEnrollments(enrollData || [])
      if (enrollData?.length > 0) {
        const enrollIds = enrollData.map(e => e.id)
        const { data: cardData } = await supabase.from('cards').select('*').in('customer_campaign_id', enrollIds)
        const cardMap = {}
        ;(cardData || []).forEach(c => { cardMap[c.customer_campaign_id] = c })
        setCards(cardMap)
      }
      const { data: txnData } = await supabase
        .from('transactions').select('*').eq('customer_id', customer.id)
        .order('created_at', { ascending: false }).limit(20)
      setTransactions(txnData || [])
    } catch (err) {
      console.error('Error fetching home data:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeEnrollment = enrollments[activeIdx] || null
  const activeCampaign   = activeEnrollment?.campaigns || null
  const activeWallet     = activeEnrollment?.wallets   || null
  const activeCard       = activeEnrollment ? cards[activeEnrollment.id] : null

  const balance   = activeWallet   ? Number(activeWallet.balance)         : 0
  const target    = activeCampaign ? Number(activeCampaign.target_amount) : 0
  const progress  = target > 0     ? Math.min((balance / target) * 100, 100) : 0
  const remaining = target > 0     ? Math.max(target - balance, 0)           : 0
  const daysRemaining = activeCampaign?.target_date
    ? Math.max(Math.ceil((new Date(activeCampaign.target_date).getTime() - Date.now()) / 86400000), 0)
    : 0

  const kycPending     = customer?.kyc_status === 'pending'
  const campaignStatus = activeCampaign ? getEffectiveStatus(activeCampaign) : 'active'
  const campaignLocked = campaignStatus === 'paused' || campaignStatus === 'deleted'
  const hasMultiple    = enrollments.length > 1

  const campaignTxns = transactions
    .filter(t => t.campaign_id === activeCampaign?.id)
    .slice(0, 5)

  // ── Cashback tier — unchanged ──────────────────────────────────────────
  function getCashbackStrip() {
    if (!activeWallet || !activeCampaign || target === 0 || campaignLocked) return null
    const pct = (balance / target) * 100
    if (pct >= 100) return { title: 'Platinum tier — 3% cashback', body: "You've reached the top tier. Earn 3% cashback at all Partna merchants." }
    if (pct >= 75)  return { title: 'Gold tier — 2% cashback',     body: `Save ${formatUGX(Math.max(target - balance, 0))} more to reach Platinum and earn 3% cashback.` }
    if (pct >= 50)  return { title: 'Silver tier — 1.5% cashback', body: `Save ${formatUGX(Math.max(target * 0.75 - balance, 0))} more to reach Gold and earn 2% cashback.` }
    if (pct >= 25)  return { title: 'Bronze tier — 1% cashback',   body: `Save ${formatUGX(Math.max(target * 0.5 - balance, 0))} more to reach Silver and earn 1.5% cashback.` }
    return { title: 'Earn cashback rewards', body: `Save ${formatUGX(Math.max(target * 0.25 - balance, 0))} more to unlock Bronze tier and start earning 1% cashback.` }
  }
  const cashbackStrip = getCashbackStrip()

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  // ── Empty state ────────────────────────────────────────────────────────
  if (enrollments.length === 0) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 9a7 7 0 1 0-13.33 3H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h.27A7 7 0 0 0 11 20.9V22h2v-1.1A7 7 0 0 0 19.73 17H20a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1.67A7 7 0 0 0 19 9z" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: C.black, letterSpacing: '-0.5px', margin: 0 }}>No campaigns yet</h2>
        <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, maxWidth: 260, lineHeight: '140%' }}>
          You're not enrolled in any savings campaigns. Browse available campaigns to get started.
        </p>
        <button
          onClick={() => navigate('/portal/select-campaign')}
          style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', marginTop: 8 }}
        >
          Browse campaigns
        </button>
      </div>
    </div>
  )

  // ── Progress bar colour ────────────────────────────────────────────────
  const progressColor = campaignLocked ? C.grayLine
    : progress >= 75 ? C.green
    : progress >= 50 ? C.orange
    : C.blue

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 24, width: 'auto' }} />
            : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { signOut(); navigate('/portal') }}
            style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, color: C.secondary, background: 'none', border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer' }}
          >
            Log out
          </button>
          <button
            onClick={() => navigate('/portal/profile')}
            style={{ width: 34, height: 34, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: C.black, cursor: 'pointer', flexShrink: 0 }}
          >
            {customer?.first_name?.[0]}{customer?.last_name?.[0]}
          </button>
        </div>
      </header>

      {/* ── Campaign locked banner ── */}
      {campaignLocked && (
        <div style={{ background: C.bgRed, borderBottom: `1px solid ${C.red}`, padding: '12px 20px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.red, margin: '0 0 2px' }}>{brand.businessName} has cancelled this campaign</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: 0, opacity: 0.75 }}>All funds will be automatically refunded to your payment source within 2–5 working days.</p>
          </div>
        </div>
      )}

      {/* ── KYC banner ── */}
      {kycPending && !campaignLocked && (
        <button
          onClick={() => navigate('/portal/kyc')}
          style={{ width: '100%', background: C.bgOrange, borderBottom: `1px solid ${C.orange}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: 'none', textAlign: 'left' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.orange, margin: '0 0 1px' }}>Platform features are locked</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.8 }}>Tap to complete your identity verification</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Hero panel ── */}
      <div style={{ background: C.black, padding: '24px 20px 28px', borderBottom: `3px solid ${C.grayLine}` }}>

        {/* Balance */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Welcome back, {customer?.first_name}
          </p>
          <p style={{ fontSize: 36, fontWeight: 600, color: C.white, letterSpacing: '-1px', lineHeight: 1, margin: '0 0 4px' }}>
            {formatUGX(balance)}
          </p>
          <p style={{ fontSize: 12, fontWeight: 500, color: campaignLocked ? C.red : 'rgba(255,255,255,0.40)', margin: 0 }}>
            {campaignLocked ? '⚠ Pending refund' : `Saved toward ${activeCampaign?.name || '—'}`}
          </p>
        </div>

        {/* Card carousel */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          {hasMultiple && (
            <button
              onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid rgba(255,255,255,0.2)`, background: 'transparent', color: C.white, cursor: activeIdx === 0 ? 'not-allowed' : 'pointer', opacity: activeIdx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}
            >
              ‹
            </button>
          )}

          {/* Card */}
          <div
            onClick={() => !campaignLocked && setCardFlipped(f => !f)}
            style={{ perspective: '800px', width: 288, height: 178, cursor: campaignLocked ? 'default' : 'pointer', flexShrink: 0 }}
          >
            <div style={{
              width: 288, height: 178, position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s ease',
              transform: !campaignLocked && cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              filter: campaignLocked ? 'grayscale(0.7) opacity(0.6)' : 'none',
            }}>
              {/* Card front */}
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                background: C.white, border: `1px solid ${C.stroke}`,
                borderRadius: 12, padding: 18,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>{brand.businessName}</span>
                  <div style={{ width: 30, height: 20, borderRadius: 4, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>{activeCampaign?.name}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '0.14em' }}>
                  {formatCardNumber(activeCard?.card_number)}
                </span>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 500, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cardholder</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{customer?.first_name} {customer?.last_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 9, fontWeight: 500, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{campaignLocked ? 'Status' : 'Expires'}</p>
                    <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: campaignLocked ? C.red : C.black, margin: 0 }}>
                      {campaignLocked ? 'LOCKED' : formatExpiry(activeCard?.expiry_date)}
                    </p>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EB001B', opacity: 0.9 }} />
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F79E1B', opacity: 0.9, marginLeft: -8 }} />
                  </div>
                </div>
                {!campaignLocked && (
                  <p style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 500, color: C.grayMid, margin: 0 }}>tap to flip</p>
                )}
              </div>

              {/* Card back */}
              {!campaignLocked && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: '#1a1a1a', borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                }}>
                  <div style={{ position: 'absolute', top: 28, left: 0, right: 0, height: 36, background: '#2a2a2a' }} />
                  <div style={{ position: 'absolute', top: 76, left: 16, right: 16, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 28, background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                    <div style={{ width: 44, height: 28, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: C.black, borderRadius: 4 }}>
                      {activeCard?.cvv || '•••'}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 36, left: 16, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                    {formatCardNumber(activeCard?.card_number)}
                  </div>
                  <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valid thru</p>
                      <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{formatExpiry(activeCard?.expiry_date)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Draw code</p>
                      <p style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: C.green, margin: 0 }}>{activeEnrollment?.draw_code || '——'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasMultiple && (
            <button
              onClick={() => setActiveIdx(i => Math.min(enrollments.length - 1, i + 1))}
              disabled={activeIdx === enrollments.length - 1}
              style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid rgba(255,255,255,0.2)`, background: 'transparent', color: C.white, cursor: activeIdx === enrollments.length - 1 ? 'not-allowed' : 'pointer', opacity: activeIdx === enrollments.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}
            >
              ›
            </button>
          )}
        </div>

        {/* Dot indicators */}
        {hasMultiple && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            {enrollments.map((_, i) => (
              <button
                key={i} onClick={() => setActiveIdx(i)}
                style={{ width: i === activeIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === activeIdx ? C.white : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }}
              />
            ))}
          </div>
        )}

        {/* Add campaign link */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button
            onClick={() => navigate('/portal/select-campaign')}
            style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'none', border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 999, padding: '5px 14px', cursor: 'pointer' }}
          >
            + Add campaign
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>{progress.toFixed(0)}% of goal</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>Target: {formatUGX(target)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: progressColor, width: `${progress}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>{formatUGX(remaining)} remaining</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>{daysRemaining} days left</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 96 }}>

        {/* Cashback tier strip */}
        {cashbackStrip && !campaignLocked && (
          <button
            onClick={() => navigate('/portal/card')}
            style={{ width: '100%', background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = C.accent}
            onMouseLeave={e => e.currentTarget.style.background = C.white}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.black} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px', letterSpacing: '-0.4px' }}>{cashbackStrip.title}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '130%' }}>{cashbackStrip.body}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Add money', disabled: campaignLocked, onClick: () => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/add-money', { state: { enrollmentId: activeEnrollment?.id } })) },
            { label: 'Pay',       disabled: campaignLocked, onClick: () => !campaignLocked && navigate('/portal/pay', { state: { enrollmentId: activeEnrollment?.id } }) },
            { label: 'Withdraw',  disabled: campaignLocked, onClick: () => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/withdraw', { state: { enrollmentId: activeEnrollment?.id } })) },
          ].map(({ label, disabled, onClick }) => (
            <button
              key={label} onClick={onClick} disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 8px',
                background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = C.accent }}
              onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = C.white }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: disabled ? C.grayLight : C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {label === 'Add money' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={disabled ? C.grayMid : C.black} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
                {label === 'Pay' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={disabled ? C.grayMid : C.black} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                )}
                {label === 'Withdraw' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={disabled ? C.grayMid : C.black} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: disabled ? C.grayMid : C.black, letterSpacing: '-0.2px' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* View card shortcut */}
        {!campaignLocked && (
          <button
            onClick={() => navigate('/portal/card', { state: { enrollmentId: activeEnrollment?.id } })}
            style={{ width: '100%', background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = C.accent}
            onMouseLeave={e => e.currentTarget.style.background = C.white}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#EB001B', opacity: 0.85 }} />
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F79E1B', opacity: 0.85, marginLeft: -7 }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>View your savings card</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Recent activity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-0.5px' }}>Recent activity</span>
            <button
              onClick={() => navigate('/portal/transactions', { state: { enrollmentId: activeEnrollment?.id } })}
              style={{ fontSize: 13, fontWeight: 600, color: C.black, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              See all
            </button>
          </div>

          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            {campaignTxns.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>No transactions yet for this campaign.</p>
              </div>
            ) : campaignTxns.map((txn, i) => {
              const isDeposit  = txn.type === 'deposit'
              const isCashback = txn.type === 'cashback'
              const amountColor = isCashback || isDeposit ? C.green : C.red
              const iconBg = isCashback ? 'rgba(197,133,179,0.15)'
                : isDeposit ? C.bgGreen : C.bgRed
              const iconColor = isCashback ? '#C585B3'
                : isDeposit ? C.green : C.red
              return (
                <div key={txn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.grayLine}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        {isCashback
                          ? <><path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /></>
                          : isDeposit
                          ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>
                          : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>
                        }
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px', textTransform: 'capitalize' }}>
                        {isCashback ? 'Cashback' : txn.type === 'payment' ? 'Payment' : txn.type}
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{formatDate(txn.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: amountColor }}>
                    {isCashback || isDeposit ? '+' : '-'}{formatUGX(txn.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.white, borderTop: `1px solid ${C.stroke}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '10px 0', paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 100,
      }}>
        {[
          { label: 'Home',    path: '/portal/home'         },
          { label: 'Card',    path: '/portal/card'         },
          { label: 'History', path: '/portal/transactions' },
          { label: 'Profile', path: '/portal/profile'      },
        ].map(({ label, path }) => {
          const active = path === '/portal/home'
          return (
            <button
              key={path} onClick={() => navigate(path)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: active ? C.black : C.grayMid }}
            >
              {/* Icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.black : C.grayMid} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                {label === 'Home'    && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                {label === 'Card'    && <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>}
                {label === 'History' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>}
                {label === 'Profile' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>}
              </svg>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, letterSpacing: '0.02em' }}>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}