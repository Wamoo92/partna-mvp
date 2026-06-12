import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'
import { getEffectiveStatus } from '../../lib/campaignUtils'

// ── Shade utility: shifts a hex color lighter or darker by a percentage ──
function shadeHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * percent / 100)))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)))
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(255 * percent / 100)))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// Returns a distinct shade for each campaign index
function campaignCardColor(primaryColor, index) {
  const shades = [0, 20, -20, 35, -35, 50, -50]
  return shadeHex(primaryColor, shades[index % shades.length])
}

function formatCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••'
  return num.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(dateStr) {
  if (!dateStr) return 'MM/YY'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

export default function Home({ customer, signOut }) {
  const brand = useBrand()
  const navigate = useNavigate()

  const [enrollments, setEnrollments] = useState([])
  const [cards, setCards] = useState({}) // keyed by enrollment id
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    if (customer) fetchData()
  }, [customer])

  useEffect(() => {
    setCardFlipped(false)
  }, [activeIdx])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch all active enrollments with campaign + wallet data
      const { data: enrollData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })

      setEnrollments(enrollData || [])

      // Fetch cards per enrollment
      if (enrollData && enrollData.length > 0) {
        const enrollIds = enrollData.map(e => e.id)
        const { data: cardData } = await supabase
          .from('cards')
          .select('*')
          .in('customer_campaign_id', enrollIds)

        const cardMap = {}
        ;(cardData || []).forEach(c => { cardMap[c.customer_campaign_id] = c })
        setCards(cardMap)
      }

      // Fetch recent transactions across all campaigns
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
  const activeCampaign = activeEnrollment?.campaigns || null
  const activeWallet = activeEnrollment?.wallets || null
  const activeCard = activeEnrollment ? cards[activeEnrollment.id] : null
  const activeCardColor = campaignCardColor(brand.primaryColor, activeIdx)

  const balance = activeWallet ? Number(activeWallet.balance) : 0
  const target = activeCampaign ? Number(activeCampaign.target_amount) : 0
  const progress = target > 0 ? Math.min((balance / target) * 100, 100) : 0
  const remaining = target > 0 ? Math.max(target - balance, 0) : 0
  const daysRemaining = activeCampaign?.target_date
    ? Math.max(Math.ceil((new Date(activeCampaign.target_date).getTime() - Date.now()) / 86400000), 0)
    : 0

  const kycPending = customer?.kyc_status === 'pending'
  const campaignStatus = activeCampaign ? getEffectiveStatus(activeCampaign) : 'active'
  const campaignLocked = campaignStatus === 'paused' || campaignStatus === 'deleted'

  // Transactions filtered to active campaign
  const campaignTxns = transactions.filter(t => t.campaign_id === activeCampaign?.id).slice(0, 5)

  function formatUGX(amount) {
    return 'UGX ' + Number(amount).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function txIcon(type) { return type === 'deposit' ? '↓' : '↑' }
  function txColor(type) { return type === 'deposit' ? '#16A34A' : '#DC2626' }

  function getRewardsStrip() {
    if (!activeWallet || !activeCampaign || target === 0 || campaignLocked) return null
    const pct = (balance / target) * 100
    if (pct >= 75) return { title: '🎯 Next voucher at 100%', body: 'Save ' + formatUGX(Math.max(target - balance, 0)) + ' more to reach your goal' }
    if (pct >= 50) return { title: '🎯 Next voucher at 75%', body: 'Save ' + formatUGX(Math.max(target * 0.75 - balance, 0)) + ' more to unlock your next voucher' }
    if (pct >= 25) return { title: '🎯 Next voucher at 50%', body: 'Save ' + formatUGX(Math.max(target * 0.50 - balance, 0)) + ' more to unlock your next voucher' }
    return { title: '🎯 First voucher at 25%', body: 'Save ' + formatUGX(Math.max(target * 0.25 - balance, 0)) + ' more to unlock your first voucher' }
  }

  const rewardsStrip = getRewardsStrip()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  if (enrollments.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: '#f0f2f5' }}>
        <div className="text-3xl">🎯</div>
        <div className="text-sm font-bold text-center" style={{ color: brand.primaryColor }}>
          You're not enrolled in any campaigns yet
        </div>
        <button onClick={() => navigate('/portal/select-campaign')}
          className="px-6 py-3 rounded-xl text-sm font-bold"
          style={{ background: brand.primaryColor, color: '#fff' }}>
          Browse campaigns
        </button>
      </div>
    )
  }

  const CARD_W = 300
  const CARD_H = 190
  const hasMultiple = enrollments.length > 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3"
        style={{ background: campaignLocked ? '#6B7280' : activeCardColor }}>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt={brand.businessName} className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-white text-xs font-semibold">{brand.businessName}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {activeCampaign?.name || 'Savings Program'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { signOut(); navigate('/portal') }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            Log out
          </button>
          <button onClick={() => navigate('/portal/profile')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
            {customer?.first_name?.[0]}{customer?.last_name?.[0]}
          </button>
        </div>
      </header>

      {/* Campaign cancelled banner */}
      {campaignLocked && (
        <div className="w-full flex items-start gap-3 px-4 py-4" style={{ background: '#DC2626' }}>
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="text-left flex-1">
            <div className="text-xs font-bold text-white">
              {brand.businessName} has cancelled this campaign
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              All funds will be automatically refunded to your payment source within 2–5 working days.
            </div>
          </div>
        </div>
      )}

      {/* KYC banner */}
      {kycPending && !campaignLocked && (
        <button onClick={() => navigate('/portal/kyc')}
          className="w-full flex items-center gap-3 px-4 py-3"
          style={{ background: '#D97706' }}>
          <span className="text-lg flex-shrink-0">🔒</span>
          <div className="text-left flex-1">
            <div className="text-xs font-bold text-white">Platform features are locked</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Tap to complete your identity verification
            </div>
          </div>
          <span className="text-white text-sm flex-shrink-0">→</span>
        </button>
      )}

      {/* Hero */}
      <div className="px-5 pt-5 pb-10"
        style={{ background: campaignLocked ? '#6B7280' : activeCardColor }}>

        <div className="mb-4">
          <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Welcome back, {customer?.first_name}
          </div>
          <div className="text-white text-3xl font-bold mb-0.5">{formatUGX(balance)}</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {campaignLocked ? 'pending refund' : `saved toward ${activeCampaign?.name || '—'}`}
          </div>
        </div>

        {/* ── CAMPAIGN CARD CAROUSEL ── */}
        <div className="flex items-center justify-center gap-3 mb-5">

          {hasMultiple && (
            <button
              onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{
                background: activeIdx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
                opacity: activeIdx === 0 ? 0.4 : 1,
              }}>
              ←
            </button>
          )}

          {/* Flippable card */}
          <div
            className={campaignLocked ? '' : 'cursor-pointer'}
            style={{ perspective: '800px', width: `${CARD_W}px`, height: `${CARD_H}px` }}
            onClick={() => !campaignLocked && setCardFlipped(!cardFlipped)}>
            <div style={{
              width: `${CARD_W}px`, height: `${CARD_H}px`,
              position: 'relative', transformStyle: 'preserve-3d',
              transition: 'transform 0.6s ease',
              transform: !campaignLocked && cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              filter: campaignLocked ? 'grayscale(1) opacity(0.6)' : 'none',
            }}>

              {/* ── CARD FRONT ── */}
              <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                background: campaignLocked ? '#9CA3AF' : activeCardColor,
                border: `2px solid ${brand.secondaryColor}`,
              }}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, transparent 60%)' }} />
                {/* Logo */}
                <div className="absolute top-4 left-4">
                  <img src={brand.logoUrl} alt="" className="object-contain"
                    style={{ width: '36px', height: '36px', mixBlendMode: 'screen' }} />
                </div>
                {/* Mastercard circles */}
                <div className="absolute top-4 right-4 flex">
                  <div className="w-7 h-7 rounded-full opacity-90" style={{ background: '#EB001B' }} />
                  <div className="w-7 h-7 rounded-full opacity-90 -ml-3" style={{ background: '#F79E1B' }} />
                </div>
                {/* Chip */}
                <div className="absolute rounded"
                  style={{ width: '40px', height: '28px', top: '70px', left: '16px', background: 'linear-gradient(135deg,#EDE5A6,#CFA255)' }} />
                {/* Campaign name — top right mid */}
                <div className="absolute font-semibold"
                  style={{ top: '72px', right: '16px', color: 'rgba(255,255,255,0.65)', fontSize: '9px', maxWidth: '140px', textAlign: 'right' }}>
                  {activeCampaign?.name}
                </div>
                {/* Card number */}
                <div className="absolute font-mono font-semibold"
                  style={{ bottom: '44px', left: '16px', right: '16px', color: 'rgba(255,255,255,0.9)', fontSize: '15px', letterSpacing: '2px' }}>
                  {formatCardNumber(activeCard?.card_number)}
                </div>
                {/* Cardholder + Expiry */}
                <div className="absolute flex justify-between items-end"
                  style={{ bottom: '16px', left: '16px', right: '16px' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginBottom: '2px' }}>CARD HOLDER</div>
                    <div className="font-semibold uppercase tracking-wide"
                      style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>
                      {customer?.first_name} {customer?.last_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginBottom: '2px' }}>
                      {campaignLocked ? 'STATUS' : 'EXPIRES'}
                    </div>
                    <div className="font-mono font-semibold"
                      style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>
                      {campaignLocked ? 'LOCKED' : formatExpiry(activeCard?.expiry_date)}
                    </div>
                  </div>
                </div>
                {!campaignLocked && (
                  <div className="absolute bottom-1 left-0 right-0 text-center"
                    style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px' }}>tap to flip</div>
                )}
              </div>

              {/* ── CARD BACK ── */}
              {!campaignLocked && (
                <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)', background: '#0f2d40',
                  border: `2px solid ${brand.secondaryColor}`,
                }}>
                  {/* Magnetic stripe */}
                  <div className="absolute w-full" style={{ height: '40px', top: '28px', background: '#111' }} />
                  {/* Signature strip + CVV */}
                  <div className="absolute flex items-center" style={{ top: '86px', left: '16px', right: '16px' }}>
                    <div className="flex-1 rounded-l"
                      style={{ height: '32px', background: 'repeating-linear-gradient(90deg, #e8e8e8 0px, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                    <div className="rounded-r flex items-center justify-center font-mono font-bold"
                      style={{ width: '48px', height: '32px', background: '#fff', color: '#333', fontSize: '14px' }}>
                      {activeCard?.cvv || '•••'}
                    </div>
                  </div>
                  <div className="absolute text-right"
                    style={{ top: '122px', right: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>CVV</div>
                  {/* Card number on back */}
                  <div className="absolute font-mono"
                    style={{ bottom: '40px', left: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '1px' }}>
                    {formatCardNumber(activeCard?.card_number)}
                  </div>
                  {/* Expiry + draw code on back */}
                  <div className="absolute flex justify-between items-end"
                    style={{ bottom: '16px', left: '16px', right: '16px' }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px', marginBottom: '1px' }}>VALID THRU</div>
                      <div className="font-mono" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                        {formatExpiry(activeCard?.expiry_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px', marginBottom: '1px' }}>DRAW CODE</div>
                      <div className="font-mono font-bold" style={{ color: brand.secondaryColor, fontSize: '10px' }}>
                        {activeEnrollment?.draw_code || '——'}
                      </div>
                    </div>
                  </div>
                  {/* Mastercard circles */}
                  <div className="absolute top-4 right-4 flex">
                    <div className="w-6 h-6 rounded-full opacity-70" style={{ background: '#EB001B' }} />
                    <div className="w-6 h-6 rounded-full opacity-70 -ml-2" style={{ background: '#F79E1B' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasMultiple && (
            <button
              onClick={() => setActiveIdx(i => Math.min(enrollments.length - 1, i + 1))}
              disabled={activeIdx === enrollments.length - 1}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{
                background: activeIdx === enrollments.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
                opacity: activeIdx === enrollments.length - 1 ? 0.4 : 1,
              }}>
              →
            </button>
          )}
        </div>

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="flex justify-center gap-1.5 mb-4">
            {enrollments.map((_, i) => (
              <button key={i} onClick={() => setActiveIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === activeIdx ? '20px' : '6px',
                  height: '6px',
                  background: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                }} />
            ))}
          </div>
        )}

        {/* Add another campaign */}
        <div className="flex justify-center mb-4">
          <button onClick={() => navigate('/portal/select-campaign')}
            className="text-xs font-semibold px-4 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            + Add another campaign
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            <span>{progress.toFixed(0)}% of goal</span>
            <span>Target: {formatUGX(target)}</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-2 rounded-full transition-all" style={{
              width: `${progress}%`,
              background: campaignLocked ? 'rgba(255,255,255,0.4)'
                : progress >= 75 ? '#22C55E'
                : progress >= 50 ? brand.secondaryColor
                : '#F59E0B',
            }} />
          </div>
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span>{formatUGX(remaining)} remaining</span>
          <span>{daysRemaining} days left</span>
        </div>
      </div>

      {/* Bottom content */}
      <div className="rounded-t-3xl flex-1 flex flex-col gap-4 px-5 py-5"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {rewardsStrip && !campaignLocked && (
          <div className="rounded-2xl px-4 py-3"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}>
            <div className="text-xs font-semibold mb-0.5" style={{ color: brand.primaryColor }}>
              {rewardsStrip.title}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>{rewardsStrip.body}</div>
          </div>
        )}

        <div className="flex gap-3">
          {/* Action buttons */}
          <div className="flex flex-col gap-3" style={{ width: '140px', flexShrink: 0 }}>
            <button
              disabled={campaignLocked}
              onClick={() => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/add-money', { state: { enrollmentId: activeEnrollment?.id } }))}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{
                background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)',
                opacity: campaignLocked ? 0.4 : 1,
                cursor: campaignLocked ? 'not-allowed' : 'pointer',
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}>
                {campaignLocked || kycPending ? '🔒' : '+'}
              </div>
              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Add money</span>
            </button>

            <button
              disabled={campaignLocked}
              onClick={() => !campaignLocked && navigate('/portal/pay', { state: { enrollmentId: activeEnrollment?.id } })}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{
                background: campaignLocked ? '#9CA3AF' : brand.primaryColor,
                opacity: campaignLocked ? 0.4 : 1,
                cursor: campaignLocked ? 'not-allowed' : 'pointer',
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <span className="text-white text-lg">↑</span>
              </div>
              <span className="text-xs font-semibold text-white">Pay</span>
            </button>

            <button
              disabled={campaignLocked}
              onClick={() => !campaignLocked && (kycPending ? navigate('/portal/kyc') : navigate('/portal/withdraw', { state: { enrollmentId: activeEnrollment?.id } }))}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{
                background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)',
                opacity: campaignLocked ? 0.4 : 1,
                cursor: campaignLocked ? 'not-allowed' : 'pointer',
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}>
                {campaignLocked || kycPending ? '🔒' : '↓'}
              </div>
              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Withdraw</span>
            </button>
          </div>

          {/* Recent activity — filtered to active campaign */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: brand.primaryColor }}>Recent activity</div>
              <button onClick={() => navigate('/portal/transactions', { state: { enrollmentId: activeEnrollment?.id } })}
                className="text-xs font-semibold" style={{ color: brand.secondaryColor }}>
                See all
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden flex-1" style={{ background: '#fff' }}>
              {campaignTxns.length === 0 ? (
                <div className="px-4 py-6 text-center h-full flex flex-col items-center justify-center">
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    No transactions yet for this campaign.
                  </div>
                </div>
              ) : (
                campaignTxns.map((txn, i) => (
                  <div key={txn.id} className="flex items-center justify-between px-3 py-2.5"
                    style={{ borderBottom: i < campaignTxns.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                        {txIcon(txn.type)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold capitalize" style={{ color: '#333' }}>
                          {txn.type === 'payment' ? 'Payment' : txn.type}
                        </div>
                        <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '10px' }}>
                          {formatDate(txn.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold flex-shrink-0" style={{ color: txColor(txn.type) }}>
                      {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {!campaignLocked && (
          <button onClick={() => navigate('/portal/card', { state: { enrollmentId: activeEnrollment?.id } })}
            className="w-full rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="flex">
                <div className="w-5 h-5 rounded-full" style={{ background: '#EB001B' }} />
                <div className="w-5 h-5 rounded-full -ml-2" style={{ background: '#F79E1B' }} />
              </div>
              <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                View your savings card
              </div>
            </div>
            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>→</span>
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map((item) => (
          <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1">
            <span className="text-lg leading-none"
              style={{ color: item.path === '/portal/home' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs" style={{
              color: item.path === '/portal/home' ? brand.primaryColor : 'rgba(0,0,0,0.3)',
              fontWeight: item.path === '/portal/home' ? 600 : 400,
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}