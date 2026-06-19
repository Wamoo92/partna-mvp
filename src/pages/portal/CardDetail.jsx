import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

function formatCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••'
  return num.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(dateStr) {
  if (!dateStr) return 'MM/YY'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

const TIER_COLORS = {
  bronze:   '#CD7F32',
  silver:   '#A8A9AD',
  gold:     '#CFA255',
  platinum: '#85A0C5',
  none:     '#898B90',
}

const TIER_LABELS = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
  none:     'No tier yet',
}

const TIER_RATES = {
  bronze:   '1%',
  silver:   '1.5%',
  gold:     '2%',
  platinum: '3%',
  none:     '0%',
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
}

export default function CardDetail({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [card, setCard]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [flipped, setFlipped]   = useState(false)
  const [enrollment, setEnrollment] = useState(null)
  const [tiers, setTiers]       = useState([])
  const [merchants, setMerchants] = useState([])

  useEffect(() => { if (customer) loadAll() }, [customer])

  // ── Data loading — unchanged ───────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    try {
      const { data: cardData } = await supabase
        .from('cards').select('*').eq('customer_id', customer.id)
      if (cardData?.length > 0) setCard(cardData[0])

      const { data: enrollData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(target_amount, name)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })
        .limit(1).maybeSingle()
      if (enrollData) setEnrollment(enrollData)

      const { data: tierData } = await supabase
        .from('cashback_tiers').select('*').order('min_percentage', { ascending: true })
      setTiers(tierData || [])

      const { data: merchantData } = await supabase
        .from('merchants').select('*').eq('is_active', true).order('name')
      setMerchants(merchantData || [])
    } catch (e) {
      console.error('CardDetail load error:', e)
    }
    setLoading(false)
  }

  // ── Tier calculations — unchanged ──────────────────────────────────────
  const currentTier    = enrollment?.tier || 'none'
  const tierColor      = TIER_COLORS[currentTier] || TIER_COLORS.none
  const tierLabel      = TIER_LABELS[currentTier] || 'No tier yet'
  const tierRate       = TIER_RATES[currentTier]  || '0%'
  const target         = Number(enrollment?.campaigns?.target_amount || 0)
  const currentTierObj = tiers.find(t => t.name.toLowerCase() === currentTier)
  const nextTierObj    = tiers.find(t => Number(t.min_percentage) > Number(currentTierObj?.min_percentage || 0))
  const withinRetention = (
    currentTier === 'platinum' &&
    enrollment?.tier_expires_at &&
    new Date(enrollment.tier_expires_at) > new Date()
  )
  const retentionExpiry = enrollment?.tier_expires_at
    ? new Date(enrollment.tier_expires_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const progressPct    = currentTierObj ? Number(currentTierObj.min_percentage) : 0
  const nextPct        = nextTierObj    ? Number(nextTierObj.min_percentage)     : 100
  const cashbackRate   = currentTierObj ? Number(currentTierObj.cashback_rate)   : 0

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/portal/home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 24, width: 'auto' }} />
            : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>My Card</span>
      </header>

      {/* ── Card display panel ── */}
      <div style={{ background: C.black, padding: '28px 20px 32px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

        {/* Flippable card */}
        <div
          onClick={() => setFlipped(f => !f)}
          style={{ perspective: '1000px', width: '100%', maxWidth: 320, height: 196, cursor: 'pointer' }}
        >
          <div style={{
            width: '100%', height: 196, position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>

            {/* Front */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              background: C.white, border: `1px solid ${C.stroke}`,
              borderRadius: 12, padding: 18,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>{brand.businessName}</span>
                <div style={{ width: 32, height: 22, borderRadius: 4, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)' }} />
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: C.black, letterSpacing: '0.14em' }}>
                {formatCardNumber(card?.card_number)}
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 500, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cardholder</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{customer?.first_name} {customer?.last_name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, fontWeight: 500, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expires</p>
                  <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{formatExpiry(card?.expiry_date)}</p>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EB001B', opacity: 0.9 }} />
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F79E1B', opacity: 0.9, marginLeft: -9 }} />
                </div>
              </div>
              <p style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 500, color: C.grayMid, margin: 0 }}>tap to flip</p>
            </div>

            {/* Back */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#1a1a1a', borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
            }}>
              <div style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 40, background: '#2a2a2a' }} />
              <div style={{ position: 'absolute', top: 84, left: 18, right: 18, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: 32, background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                <div style={{ width: 50, height: 32, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: C.black, borderRadius: 4 }}>
                  {card?.cvv || '•••'}
                </div>
              </div>
              <p style={{ position: 'absolute', top: 122, right: 18, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CVV</p>
              <p style={{ position: 'absolute', bottom: 40, left: 18, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', margin: 0 }}>
                {formatCardNumber(card?.card_number)}
              </p>
              <p style={{ position: 'absolute', bottom: 18, left: 18, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500, margin: 0 }}>
                Valid thru {formatExpiry(card?.expiry_date)}
              </p>
              <div style={{ position: 'absolute', bottom: 14, right: 18, display: 'flex' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EB001B', opacity: 0.7 }} />
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F79E1B', opacity: 0.7, marginLeft: -8 }} />
              </div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Tap card to flip</p>

        {/* Card details strip */}
        {card && (
          <div style={{ width: '100%', maxWidth: 320, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Card number', value: formatCardNumber(card.card_number), mono: true },
              { label: 'Expiry',      value: formatExpiry(card.expiry_date),     mono: true },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <p style={{ fontFamily: item.mono ? 'monospace' : 'inherit', fontWeight: 600, fontSize: 13, color: C.white, margin: 0, letterSpacing: item.mono ? '0.06em' : 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* No card state */}
        {!card && (
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /><line x1="4" y1="16" x2="7" y2="16" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 6px' }}>No card issued yet</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
              Your savings card will be issued once your account is verified and you make your first deposit.
            </p>
          </div>
        )}

        {/* Card settings */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Card settings</p>
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            {[
              { label: 'Freeze card',    sub: 'Temporarily block all card transactions'  },
              { label: 'Unfreeze card',  sub: 'Re-enable your card for transactions'      },
              { label: 'Order new card', sub: 'Request a replacement card'                },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{item.sub}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.grayMid, background: C.grayLight, borderRadius: 6, padding: '3px 10px', flexShrink: 0 }}>
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cashback tier progress */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cashback rewards</p>
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>

            {/* Current tier header */}
            <div style={{ background: C.black, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
                <div>
                  <p style={{ color: tierColor, fontWeight: 600, fontSize: 16, letterSpacing: '-0.5px', margin: '0 0 2px' }}>{tierLabel}</p>
                  <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: 500, margin: 0 }}>
                    {currentTier === 'none' ? 'Save more to unlock cashback' : `${tierRate} cashback at all Partna merchants`}
                  </p>
                </div>
              </div>
              {currentTier !== 'none' && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 26, fontWeight: 600, color: C.green, letterSpacing: '-1px', margin: '0 0 2px' }}>{tierRate}</p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', margin: 0 }}>cashback</p>
                </div>
              )}
            </div>

            {/* Retention notice */}
            {withinRetention && retentionExpiry && (
              <div style={{ padding: '12px 16px', background: C.bgGreen, borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>
                  Platinum retained until {retentionExpiry} — reward for completing your campaign early.
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>
                  {currentTier === 'none' ? '0% saved' : `${progressPct}% — ${tierLabel}`}
                </span>
                {nextTierObj && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>
                    {nextPct}% — {TIER_LABELS[nextTierObj.name.toLowerCase()]}
                  </span>
                )}
              </div>
              <div style={{ height: 6, borderRadius: 999, background: C.grayLight, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: tierColor, width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: nextTierObj ? C.secondary : C.green, margin: '8px 0 0', lineHeight: '140%' }}>
                {nextTierObj
                  ? <>Reach <strong style={{ color: C.black }}>{nextPct}%</strong> of your savings target to unlock <strong style={{ color: TIER_COLORS[nextTierObj.name.toLowerCase()] }}>{TIER_LABELS[nextTierObj.name.toLowerCase()]}</strong> ({(Number(nextTierObj.cashback_rate) * 100).toFixed(1)}% cashback)</>
                  : 'You are at the highest tier — enjoy 3% cashback at all merchants.'
                }
              </p>
            </div>

            {/* Tier ladder */}
            {tiers.map((tier, i) => {
              const tKey      = tier.name.toLowerCase()
              const color     = TIER_COLORS[tKey] || C.grayMid
              const isCurrent = tKey === currentTier
              return (
                <div key={tier.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: i < tiers.length - 1 ? `1px solid ${C.grayLine}` : 'none',
                  background: isCurrent ? C.bg : C.white,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? C.black : C.secondary }}>
                      {TIER_LABELS[tKey]}
                    </span>
                    {isCurrent && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '2px 8px' }}>Current</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>At {tier.min_percentage}%</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{(Number(tier.cashback_rate) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Merchant browse */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Partna merchants</p>

          {merchants.length === 0 ? (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 6px' }}>Merchants coming soon</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                Partner merchants will appear here. Use your card at these merchants to earn cashback on every purchase.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {merchants.map(m => (
                <div key={m.id} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {m.logo_url
                      ? <img src={m.logo_url} alt={m.name} style={{ width: 36, height: 36, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{m.name}</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
                      {m.category || 'Merchant'}{m.description ? ` · ${m.description}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 600, color: currentTier !== 'none' ? C.green : C.grayMid, margin: '0 0 2px', letterSpacing: '-0.5px' }}>
                      {currentTier !== 'none' ? `${(cashbackRate * 100).toFixed(1)}%` : '—'}
                    </p>
                    <p style={{ fontSize: 10, fontWeight: 500, color: C.grayMid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>cashback</p>
                  </div>
                </div>
              ))}
              <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>
                More merchants coming soon
              </p>
            </div>
          )}
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
          const active = path === '/portal/card'
          return (
            <button
              key={path} onClick={() => navigate(path)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: active ? C.black : C.grayMid }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.black : C.grayMid} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                {label === 'Home'    && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                {label === 'Card'    && <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>}
                {label === 'History' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>}
                {label === 'Profile' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>}
              </svg>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 500 }}>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}