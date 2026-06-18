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
  gold:     '#FFD700',
  platinum: '#E5E4E2',
  none:     'var(--color-grey-mid)',
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

export default function CardDetail({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [card, setCard]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [flipped, setFlipped]     = useState(false)

  // Cashback tier state
  const [enrollment, setEnrollment]   = useState(null)
  const [tiers, setTiers]             = useState([])
  const [merchants, setMerchants]     = useState([])

  useEffect(() => { if (customer) loadAll() }, [customer])

  async function loadAll() {
    setLoading(true)
    try {
      // Load card
      const { data: cardData } = await supabase
        .from('cards').select('*').eq('customer_id', customer.id)
      if (cardData?.length > 0) setCard(cardData[0])

      // Load first active enrollment (for tier info)
      const { data: enrollData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(target_amount, name)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (enrollData) setEnrollment(enrollData)

      // Load cashback tiers
      const { data: tierData } = await supabase
        .from('cashback_tiers')
        .select('*')
        .order('min_percentage', { ascending: true })
      setTiers(tierData || [])

      // Load active merchants
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setMerchants(merchantData || [])

    } catch (e) {
      console.error('CardDetail load error:', e)
    }
    setLoading(false)
  }

  // ── Tier progress calculation ─────────────────────────────────────────
  const currentTier     = enrollment?.tier || 'none'
  const tierColor       = TIER_COLORS[currentTier] || TIER_COLORS.none
  const tierLabel       = TIER_LABELS[currentTier] || 'No tier yet'
  const tierRate        = TIER_RATES[currentTier]  || '0%'

  // Calculate progress percentage from saved/paid vs target
  const target          = Number(enrollment?.campaigns?.target_amount || 0)
  // We use the wallet balance as a proxy for progress until
  // the batch job calculates the precise figure
  const currentTierObj  = tiers.find(t => t.name.toLowerCase() === currentTier)
  const nextTierObj     = tiers.find(t => Number(t.min_percentage) > Number(currentTierObj?.min_percentage || 0))

  // Retention window
  const withinRetention = (
    currentTier === 'platinum' &&
    enrollment?.tier_expires_at &&
    new Date(enrollment.tier_expires_at) > new Date()
  )
  const retentionExpiry = enrollment?.tier_expires_at
    ? new Date(enrollment.tier_expires_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Progress bar — percentage toward current or next tier threshold
  const progressPct = currentTierObj ? Number(currentTierObj.min_percentage) : 0
  const nextPct     = nextTierObj    ? Number(nextTierObj.min_percentage)     : 100

  // Cashback rate the customer gets at all merchants
  const cashbackRate = currentTierObj ? Number(currentTierObj.cashback_rate) : 0

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button onClick={() => navigate('/portal/home')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'var(--color-white)', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          My Card
        </div>
      </header>

      {/* ── Card display panel ── */}
      <div style={{ background: 'var(--color-black)', borderBottom: '3px solid var(--color-primary)', padding: 'var(--space-8) var(--space-5) var(--space-10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>

        {/* Flippable card */}
        <div onClick={() => setFlipped(f => !f)} style={{ perspective: '1000px', width: '100%', maxWidth: 340, height: 210, cursor: 'pointer' }}>
          <div style={{ width: '100%', height: 210, position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>

            {/* Front */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'var(--color-white)', border: '3px solid var(--color-black)', boxShadow: 'var(--shadow-xl)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--color-black)' }}>{brand.businessName}</div>
                <div style={{ width: 38, height: 28, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)', border: '1.5px solid var(--color-black)' }} />
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', letterSpacing: '0.15em', color: 'var(--color-black)' }}>{formatCardNumber(card?.card_number)}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 3 }}>Cardholder</div>
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-black)' }}>{customer?.first_name} {customer?.last_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 3 }}>Expires</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-black)' }}>{formatExpiry(card?.expiry_date)}</div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EB001B', border: '2px solid var(--color-black)' }} />
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F79E1B', border: '2px solid var(--color-black)', marginLeft: -10 }} />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey-mid)' }}>tap to flip</div>
            </div>

            {/* Back */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'var(--color-black)', border: '3px solid var(--color-black)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 32, left: 0, right: 0, height: 44, background: '#1a1a1a' }} />
              <div style={{ position: 'absolute', top: 92, left: 20, right: 20, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: 36, background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                <div style={{ width: 56, height: 36, background: 'var(--color-white)', border: '2px solid var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-lg)', color: 'var(--color-black)' }}>{card?.cvv || '•••'}</div>
              </div>
              <div style={{ position: 'absolute', top: 134, right: 20, fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>CVV</div>
              <div style={{ position: 'absolute', bottom: 42, left: 20, fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>{formatCardNumber(card?.card_number)}</div>
              <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', fontWeight: 'var(--weight-bold)' }}>Valid thru {formatExpiry(card?.expiry_date)}</div>
              <div style={{ position: 'absolute', bottom: 18, right: 20, display: 'flex' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EB001B', border: '2px solid rgba(255,255,255,0.1)', opacity: 0.8 }} />
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F79E1B', border: '2px solid rgba(255,255,255,0.1)', marginLeft: -10, opacity: 0.8 }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Tap card to flip</div>

        {/* Card details strip */}
        {card && (
          <div style={{ width: '100%', maxWidth: 340, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            {[
              { label: 'Card number', value: formatCardNumber(card.card_number), mono: true },
              { label: 'Expiry',      value: formatExpiry(card.expiry_date),     mono: true },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', padding: 'var(--space-3) var(--space-4)' }}>
                <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: item.mono ? 'monospace' : 'inherit', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)', letterSpacing: item.mono ? '0.08em' : 0 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* ── No card state ── */}
        {!card && (
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', textAlign: 'center' }}>
            <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>credit_card_off</span>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>No card issued yet</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>Your savings card will be issued once your account is verified and you make your first deposit.</div>
          </div>
        )}

        {/* ── Card settings ── */}
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>Card settings</div>
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {[
              { label: 'Freeze card',    sublabel: 'Temporarily block all card transactions', icon: 'ac_unit'        },
              { label: 'Unfreeze card',  sublabel: 'Re-enable your card for transactions',    icon: 'local_fire_department' },
              { label: 'Order new card', sublabel: 'Request a replacement card',              icon: 'add_card'       },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 36, height: 36, background: 'var(--color-grey-light)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)' }}>{item.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-black)' }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>{item.sublabel}</div>
                  </div>
                </div>
                <span className="badge badge-default no-dot" style={{ flexShrink: 0 }}>Coming soon</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cashback tier progress ── */}
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>Cashback rewards</div>
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

            {/* Current tier header */}
            <div style={{ background: 'var(--color-black)', padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: tierColor, boxShadow: `0 0 8px ${tierColor}`, flexShrink: 0 }} />
                <div>
                  <div style={{ color: tierColor, fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', letterSpacing: 'var(--tracking-tight)' }}>{tierLabel}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                    {currentTier === 'none' ? 'Save more to unlock cashback' : `${tierRate} cashback at all Partna merchants`}
                  </div>
                </div>
              </div>
              {currentTier !== 'none' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', color: '#2D8B45', letterSpacing: 'var(--tracking-tight)' }}>{tierRate}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.35)' }}>cashback</div>
                </div>
              )}
            </div>

            {/* Retention notice */}
            {withinRetention && retentionExpiry && (
              <div style={{ padding: 'var(--space-3) var(--space-5)', background: '#EAF3DE', borderBottom: '1.5px solid var(--color-grey-light)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="icon-outlined" style={{ fontSize: 16, color: '#2D8B45', flexShrink: 0 }}>verified</span>
                <span style={{ fontSize: 'var(--text-xs)', color: '#2D8B45', fontWeight: 'var(--weight-bold)' }}>
                  Platinum retained until {retentionExpiry} — reward for completing your campaign early.
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                  {currentTier === 'none' ? '0% saved' : `${progressPct}% — ${tierLabel}`}
                </span>
                {nextTierObj && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                    {nextPct}% — {TIER_LABELS[nextTierObj.name.toLowerCase()]}
                  </span>
                )}
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{
                  width: `${progressPct}%`,
                  background: tierColor,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {nextTierObj ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 'var(--space-2)' }}>
                  Reach <strong style={{ color: 'var(--color-black)' }}>{nextPct}%</strong> of your savings target to unlock{' '}
                  <strong style={{ color: TIER_COLORS[nextTierObj.name.toLowerCase()] }}>{TIER_LABELS[nextTierObj.name.toLowerCase()]}</strong>{' '}
                  ({(Number(nextTierObj.cashback_rate) * 100).toFixed(1)}% cashback)
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: '#2D8B45', marginTop: 'var(--space-2)', fontWeight: 'var(--weight-bold)' }}>
                  You are at the highest tier — enjoy 3% cashback at all merchants.
                </div>
              )}
            </div>

            {/* Tier ladder */}
            <div style={{ borderTop: '1.5px solid var(--color-grey-light)' }}>
              {tiers.map((tier, i) => {
                const tKey    = tier.name.toLowerCase()
                const color   = TIER_COLORS[tKey] || 'var(--color-grey)'
                const isCurrent = tKey === currentTier
                return (
                  <div key={tier.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', borderBottom: i < tiers.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: isCurrent ? 'var(--color-bg)' : 'var(--color-white)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: isCurrent ? 'var(--weight-black)' : 'var(--weight-regular)', color: isCurrent ? 'var(--color-black)' : 'var(--color-grey)' }}>
                        {TIER_LABELS[tKey]}
                      </span>
                      {isCurrent && <span className="badge badge-success no-dot" style={{ fontSize: 9 }}>Current</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>At {tier.min_percentage}%</span>
                      <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                        {(Number(tier.cashback_rate) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Merchant browse ── */}
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>Partna merchants</div>

          {merchants.length === 0 ? (
            <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-8)', textAlign: 'center' }}>
              <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>storefront</span>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Merchants coming soon</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>Partner merchants will appear here. Use your card at these merchants to earn cashback on every purchase.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {merchants.map(m => (
                <div key={m.id} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  {/* Logo */}
                  <div style={{ width: 48, height: 48, background: 'var(--color-bg)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {m.logo_url ? (
                      <img src={m.logo_url} alt={m.name} style={{ width: 40, height: 40, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <span className="icon-outlined" style={{ fontSize: 24, color: 'var(--color-grey-mid)' }}>storefront</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                      {m.category || 'Merchant'}
                      {m.description ? ` · ${m.description}` : ''}
                    </div>
                  </div>
                  {/* Cashback rate for current tier */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', color: currentTier !== 'none' ? '#2D8B45' : 'var(--color-grey-mid)' }}>
                      {currentTier !== 'none' ? `${(cashbackRate * 100).toFixed(1)}%` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-grey)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontWeight: 'var(--weight-bold)' }}>cashback</div>
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', paddingTop: 'var(--space-2)' }}>
                More merchants coming soon
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-white)', borderTop: 'var(--border-thick)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: 'var(--space-2) var(--space-4)', zIndex: 'var(--z-sticky)' }}>
        {[
          { label: 'Home',    icon: 'home',         path: '/portal/home'         },
          { label: 'Card',    icon: 'credit_card',  path: '/portal/card'         },
          { label: 'History', icon: 'receipt_long', path: '/portal/transactions' },
          { label: 'Profile', icon: 'person',       path: '/portal/profile'      },
        ].map(({ label, icon, path }) => {
          const active = path === '/portal/card'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1) var(--space-3)', position: 'relative' }}>
              {active && (
                <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: 'var(--color-primary)' }} />
              )}
              <span className="icon-outlined" style={{ fontSize: 22, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{icon}</span>
              <span style={{ fontWeight: active ? 'var(--weight-black)' : 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontSize: 9, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}