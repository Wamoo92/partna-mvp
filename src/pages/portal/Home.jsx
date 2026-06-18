import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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

const CAMPAIGN_ACCENTS = [
  'var(--color-primary)',
  'var(--color-yellow)',
  'var(--color-green)',
  'var(--color-red)',
]

function campaignAccent(index) {
  return CAMPAIGN_ACCENTS[index % CAMPAIGN_ACCENTS.length]
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
        const { data: cardData } = await supabase
          .from('cards').select('*').in('customer_campaign_id', enrollIds)
        const cardMap = {}
        ;(cardData || []).forEach(c => { cardMap[c.customer_campaign_id] = c })
        setCards(cardMap)
      }

      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20)
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
  const accent           = campaignAccent(activeIdx)

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

  const campaignTxns = transactions
    .filter(t => t.campaign_id === activeCampaign?.id)
    .slice(0, 5)

  const hasMultiple = enrollments.length > 1

  // ── Cashback tier strip ──────────────────────────────────────────────────
  // Shows the customer their current tier and what they need to reach the next one
  function getCashbackStrip() {
    if (!activeWallet || !activeCampaign || target === 0 || campaignLocked) return null
    const pct = (balance / target) * 100
    if (pct >= 100) return {
      icon: 'redeem',
      title: 'Platinum tier — 3% cashback',
      body: 'You\'ve reached the top tier. Earn 3% cashback at all Partna merchants.',
    }
    if (pct >= 75) return {
      icon: 'redeem',
      title: 'Gold tier — 2% cashback',
      body: `Save ${formatUGX(Math.max(target - balance, 0))} more to reach Platinum and earn 3% cashback.`,
    }
    if (pct >= 50) return {
      icon: 'redeem',
      title: 'Silver tier — 1.5% cashback',
      body: `Save ${formatUGX(Math.max(target * 0.75 - balance, 0))} more to reach Gold and earn 2% cashback.`,
    }
    if (pct >= 25) return {
      icon: 'redeem',
      title: 'Bronze tier — 1% cashback',
      body: `Save ${formatUGX(Math.max(target * 0.5 - balance, 0))} more to reach Silver and earn 1.5% cashback.`,
    }
    return {
      icon: 'redeem',
      title: 'Earn cashback rewards',
      body: `Save ${formatUGX(Math.max(target * 0.25 - balance, 0))} more to unlock Bronze tier and start earning 1% cashback.`,
    }
  }

  const cashbackStrip = getCashbackStrip()

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  if (enrollments.length === 0) return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-8)', gap: 'var(--space-4)',
    }}>
      <div className="empty-state">
        <span className="icon-outlined empty-state-icon">savings</span>
        <div className="empty-state-title">No campaigns yet</div>
        <p className="empty-state-body">
          You're not enrolled in any savings campaigns. Browse available campaigns to get started.
        </p>
        <button onClick={() => navigate('/portal/select-campaign')} className="btn btn-primary btn-lg">
          <span className="icon-outlined icon-sm">explore</span>
          Browse campaigns
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-3) var(--space-5)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 'var(--z-sticky)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {brand.logoUrl && (
            <div style={{ width: 32, height: 32, background: accent, border: '2px solid var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={brand.logoUrl} alt={brand.businessName} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
          )}
          <div>
            <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 14" }}>
              {brand.businessName}
            </div>
            <div style={{ color: accent === 'var(--color-primary)' ? 'var(--color-primary)' : accent, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
              {activeCampaign?.name || 'Savings Program'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={() => { signOut(); navigate('/portal') }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: '6px var(--space-3)', border: '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--color-white)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', cursor: 'pointer', transition: 'border-color var(--transition-base)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          >
            <span className="icon-outlined icon-xs">logout</span>
            Log out
          </button>
          <button
            onClick={() => navigate('/portal/profile')}
            style={{ width: 36, height: 36, background: accent, border: '2px solid var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: 'var(--color-black)', cursor: 'pointer', flexShrink: 0, letterSpacing: 'var(--tracking-tight)' }}>
            {customer?.first_name?.[0]}{customer?.last_name?.[0]}
          </button>
        </div>
      </header>

      {/* ── Campaign cancelled banner ── */}
      {campaignLocked && (
        <div style={{ background: 'var(--color-red)', borderBottom: '3px solid var(--color-black)', padding: 'var(--space-3) var(--space-5)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-black)', flexShrink: 0, marginTop: 1 }}>warning</span>
          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{brand.businessName} has cancelled this campaign</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>All funds will be automatically refunded to your payment source within 2–5 working days.</div>
          </div>
        </div>
      )}

      {/* ── KYC banner ── */}
      {kycPending && !campaignLocked && (
        <button onClick={() => navigate('/portal/kyc')} style={{ width: '100%', background: 'var(--color-yellow)', border: 'none', borderBottom: '3px solid var(--color-black)', padding: 'var(--space-3) var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', textAlign: 'left' }}>
          <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-black)', flexShrink: 0 }}>lock</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>Platform features are locked</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.6)' }}>Tap to complete your identity verification</div>
          </div>
          <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-black)', flexShrink: 0 }}>arrow_forward</span>
        </button>
      )}

      {/* ── Hero panel ── */}
      <div style={{ background: 'var(--color-black)', padding: 'var(--space-5) var(--space-5) var(--space-8)', borderBottom: `4px solid ${accent === 'var(--color-primary)' ? 'var(--color-primary)' : accent}` }}>

        {/* Balance */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-1)' }}>
            Welcome back, {customer?.first_name}
          </div>
          <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: 'var(--color-white)', lineHeight: 1, letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 112, 'opsz' 48", marginBottom: 'var(--space-1)' }}>
            {formatUGX(balance)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: campaignLocked ? 'var(--color-red)' : 'rgba(255,255,255,0.45)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
            {campaignLocked ? '⚠ Pending refund' : `Saved toward ${activeCampaign?.name || '—'}`}
          </div>
        </div>

        {/* Card carousel */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {hasMultiple && (
            <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0} style={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--color-white)', cursor: activeIdx === 0 ? 'not-allowed' : 'pointer', opacity: activeIdx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="icon-outlined icon-sm">chevron_left</span>
            </button>
          )}

          <div onClick={() => !campaignLocked && setCardFlipped(f => !f)} style={{ perspective: '800px', width: 300, height: 186, cursor: campaignLocked ? 'default' : 'pointer', flexShrink: 0 }}>
            <div style={{ width: 300, height: 186, position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.55s ease', transform: !campaignLocked && cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', filter: campaignLocked ? 'grayscale(0.8) opacity(0.6)' : 'none' }}>

              {/* Card front */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'var(--color-white)', border: '3px solid var(--color-black)', boxShadow: `6px 6px 0px 0px ${accent === 'var(--color-primary)' ? '#AE7AFF' : accent.replace('var(', '').replace(')', '')}`, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'var(--color-black)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--color-black)' }}>{brand.businessName}</div>
                  <div style={{ width: 34, height: 24, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)', border: '1.5px solid var(--color-black)' }} />
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>{activeCampaign?.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', letterSpacing: '0.15em', color: 'var(--color-black)' }}>{formatCardNumber(activeCard?.card_number)}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 2 }}>Cardholder</div>
                    <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-black)' }}>{customer?.first_name} {customer?.last_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 2 }}>{campaignLocked ? 'Status' : 'Expires'}</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)', color: campaignLocked ? '#C0392B' : 'var(--color-black)' }}>{campaignLocked ? 'LOCKED' : formatExpiry(activeCard?.expiry_date)}</div>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#EB001B', border: '2px solid var(--color-black)' }} />
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F79E1B', border: '2px solid var(--color-black)', marginLeft: -10 }} />
                  </div>
                </div>
                {!campaignLocked && (
                  <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey-mid)' }}>tap to flip</div>
                )}
              </div>

              {/* Card back */}
              {!campaignLocked && (
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'var(--color-black)', border: '3px solid var(--color-black)', boxShadow: '6px 6px 0px 0px var(--color-primary)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 28, left: 0, right: 0, height: 40, background: '#1a1a1a' }} />
                  <div style={{ position: 'absolute', top: 82, left: 16, right: 16, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 32, background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                    <div style={{ width: 48, height: 32, background: 'var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: 'var(--color-black)', border: '2px solid var(--color-black)' }}>{activeCard?.cvv || '•••'}</div>
                  </div>
                  <div style={{ position: 'absolute', top: 118, right: 16, fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>CVV</div>
                  <div style={{ position: 'absolute', bottom: 40, left: 16, fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>{formatCardNumber(activeCard?.card_number)}</div>
                  <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Valid thru</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)' }}>{formatExpiry(activeCard?.expiry_date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Draw code</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>{activeEnrollment?.draw_code || '——'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasMultiple && (
            <button onClick={() => setActiveIdx(i => Math.min(enrollments.length - 1, i + 1))} disabled={activeIdx === enrollments.length - 1} style={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--color-white)', cursor: activeIdx === enrollments.length - 1 ? 'not-allowed' : 'pointer', opacity: activeIdx === enrollments.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="icon-outlined icon-sm">chevron_right</span>
            </button>
          )}
        </div>

        {/* Dot indicators */}
        {hasMultiple && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 'var(--space-4)' }}>
            {enrollments.map((_, i) => (
              <button key={i} onClick={() => setActiveIdx(i)} style={{ width: i === activeIdx ? 20 : 6, height: 6, background: i === activeIdx ? 'var(--color-primary)' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all var(--transition-base)' }} />
            ))}
          </div>
        )}

        {/* Add another campaign */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <button onClick={() => navigate('/portal/select-campaign')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '6px var(--space-4)', border: '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--color-white)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', cursor: 'pointer', transition: 'border-color var(--transition-base)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          >
            <span className="icon-outlined icon-xs">add</span>
            Add campaign
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.6)' }}>{progress.toFixed(0)}% of goal</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.6)' }}>Target: {formatUGX(target)}</span>
          </div>
          <div className="progress-bar-track" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%`, background: campaignLocked ? 'rgba(255,255,255,0.3)' : progress >= 75 ? 'var(--color-green)' : progress >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.45)' }}>{formatUGX(remaining)} remaining</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.45)' }}>{daysRemaining} days left</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 96 }}>

        {/* Cashback tier strip */}
        {cashbackStrip && !campaignLocked && (
          <button
            onClick={() => navigate('/portal/card')}
            style={{ width: '100%', background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', textAlign: 'left', transition: 'box-shadow var(--transition-base)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
          >
            <div style={{ width: 36, height: 36, background: 'var(--color-primary)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-black)' }}>{cashbackStrip.icon}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{cashbackStrip.title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>{cashbackStrip.body}</div>
            </div>
            <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)', flexShrink: 0 }}>arrow_forward</span>
          </button>
        )}

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {[
            { label: 'Add money', icon: campaignLocked || kycPending ? 'lock' : 'add_circle', disabled: campaignLocked, onClick: () => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/add-money', { state: { enrollmentId: activeEnrollment?.id } })), accent: 'var(--color-green)' },
            { label: 'Pay',       icon: campaignLocked ? 'lock' : 'north',                    disabled: campaignLocked, onClick: () => !campaignLocked && navigate('/portal/pay', { state: { enrollmentId: activeEnrollment?.id } }),                                                                                accent: 'var(--color-primary)' },
            { label: 'Withdraw',  icon: campaignLocked || kycPending ? 'lock' : 'south',      disabled: campaignLocked, onClick: () => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/withdraw', { state: { enrollmentId: activeEnrollment?.id } })),                                   accent: 'var(--color-yellow)' },
          ].map(({ label, icon, disabled, onClick }) => (
            <button key={label} onClick={onClick} disabled={disabled} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-4) var(--space-3)', background: 'var(--color-white)', border: 'var(--border)', boxShadow: disabled ? 'none' : 'var(--shadow-sm)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'box-shadow var(--transition-base), transform var(--transition-fast)' }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}}
              onMouseLeave={e => { if (!disabled) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(0,0)' }}}
              onMouseDown={e => { if (!disabled) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translate(3px,3px)' }}}
              onMouseUp={e => { if (!disabled) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}}
            >
              <div style={{ width: 40, height: 40, background: disabled ? 'var(--color-grey-light)' : 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="icon-outlined" style={{ fontSize: 20, color: disabled ? 'var(--color-grey)' : 'var(--color-white)' }}>{icon}</span>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--color-black)' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* View card shortcut */}
        {!campaignLocked && (
          <button onClick={() => navigate('/portal/card', { state: { enrollmentId: activeEnrollment?.id } })} style={{ width: '100%', background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow var(--transition-base), transform var(--transition-fast)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(0,0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EB001B', border: '2px solid var(--color-black)' }} />
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F79E1B', border: '2px solid var(--color-black)', marginLeft: -8 }} />
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>View your savings card</span>
            </div>
            <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)' }}>arrow_forward</span>
          </button>
        )}

        {/* Recent activity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase' }}>Recent activity</span>
            <button onClick={() => navigate('/portal/transactions', { state: { enrollmentId: activeEnrollment?.id } })} style={{ background: 'none', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>See all</button>
          </div>
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {campaignTxns.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-grey)', fontSize: 'var(--text-sm)' }}>
                <span className="icon-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 'var(--space-2)', color: 'var(--color-grey-mid)' }}>receipt_long</span>
                No transactions yet for this campaign.
              </div>
            ) : campaignTxns.map((txn, i) => {
              const isDeposit  = txn.type === 'deposit'
              const isCashback = txn.type === 'cashback'
              return (
                <div key={txn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderTop: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 32, height: 32, background: isCashback ? 'var(--color-primary)' : isDeposit ? 'var(--color-green)' : 'var(--color-red)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="icon-outlined" style={{ fontSize: 16, color: 'var(--color-black)' }}>
                        {isCashback ? 'redeem' : isDeposit ? 'south' : 'north'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>
                        {isCashback ? 'Cashback' : txn.type === 'payment' ? 'Payment' : txn.type}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{formatDate(txn.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: isCashback || isDeposit ? '#2D8B45' : '#C0392B' }}>
                    {isCashback || isDeposit ? '+' : '-'}{formatUGX(txn.amount)}
                  </div>
                </div>
              )
            })}
          </div>
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
          const active = path === '/portal/home'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1) var(--space-3)', color: active ? 'var(--color-black)' : 'var(--color-grey)', position: 'relative' }}>
              {active && (
                <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: 'var(--color-primary)' }} />
              )}
              <span className="icon-outlined" style={{ fontSize: 22, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{icon}</span>
              <span style={{ fontWeight: active ? 'var(--weight-black)' : 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontSize: 9 }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}