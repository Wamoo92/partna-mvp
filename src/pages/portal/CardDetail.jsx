import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
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
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

// ── Email helpers ──────────────────────────────────────────────────────────

async function sendEmail(to, subject, html) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ to, subject, html, from: 'support' }),
    })
  } catch (e) {
    console.error('Card email error (non-critical):', e)
  }
}

function cardActivationEmail({ customerName, businessName, cardNumber, expiry, nextBillingDate }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />

      <h2 style="font-size: 22px; font-weight: 600; color: #111; letter-spacing: -0.5px; margin: 0 0 12px;">
        Your virtual card is active
      </h2>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your ${businessName} Partna virtual card has been activated successfully.
        You can now use it to earn cashback rewards at Partna partner merchants.
      </p>

      <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; overflow: hidden; margin: 0 0 24px;">
        ${[
          ['Card number', cardNumber],
          ['Expires',     expiry],
          ['Next renewal', nextBillingDate],
          ['Monthly fee', 'UGX 5,000'],
        ].map(([label, value], i, arr) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; ${i < arr.length - 1 ? 'border-bottom: 1px solid #D5D9DD;' : ''}">
            <span style="font-size: 13px; font-weight: 500; color: #959687;">${label}</span>
            <span style="font-size: 13px; font-weight: 600; color: #111; font-family: monospace;">${value}</span>
          </div>
        `).join('')}
      </div>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 12px;">
        <strong>How cashback works</strong>
      </p>
      <ul style="font-size: 15px; color: #444; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
        <li>Save more to unlock higher cashback tiers — Bronze, Silver, Gold, and Platinum</li>
        <li>Use your card at Partna partner merchants to earn cashback automatically</li>
        <li>Your cashback rate increases as you reach more of your savings target</li>
      </ul>

      <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        View your card and track your cashback tier at
        <a href="https://www.partna.io/portal/card" style="color: #111; font-weight: 600;">www.partna.io/portal/card</a>.
      </p>

      <div style="border-top: 1px solid #D7D8CB; padding-top: 20px;">
        <p style="font-size: 12px; color: #959687; margin: 0; line-height: 1.6;">
          Your subscription renews monthly at UGX 5,000 from your savings wallet.
          You can cancel at any time from your card page.
          Questions? Contact <a href="mailto:support@partna.io" style="color: #111; font-weight: 600;">support@partna.io</a>.
        </p>
      </div>

      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function cardCancellationEmail({ customerName, businessName, billingPeriodEnd }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />

      <h2 style="font-size: 22px; font-weight: 600; color: #111; letter-spacing: -0.5px; margin: 0 0 12px;">
        Card subscription cancelled
      </h2>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your ${businessName} Partna card subscription has been cancelled.
      </p>

      <div style="background: #F8F0E4; border: 1px solid #EF8354; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="font-size: 14px; font-weight: 600; color: #EF8354; margin: 0 0 4px;">What happens next</p>
        <p style="font-size: 14px; color: #EF8354; margin: 0; line-height: 1.6;">
          Your card will remain active until <strong>${billingPeriodEnd}</strong>.
          After this date your card will be locked and cashback rewards will no longer apply.
          No refund will be given for the current billing period.
        </p>
      </div>

      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        If you cancelled by mistake or want to reactivate your card, visit your card page at
        <a href="https://www.partna.io/portal/card" style="color: #111; font-weight: 600;">www.partna.io/portal/card</a>
        before <strong>${billingPeriodEnd}</strong> to reinstate your subscription.
      </p>

      <div style="border-top: 1px solid #D7D8CB; padding-top: 20px;">
        <p style="font-size: 12px; color: #959687; margin: 0; line-height: 1.6;">
          Questions? Contact <a href="mailto:support@partna.io" style="color: #111; font-weight: 600;">support@partna.io</a>.
        </p>
      </div>

      <p style="font-size: 13px; color: #959687; margin: 24px 0 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function CardDetail({
 customer, business }) {
  useEffect(() => { document.title = 'My Card - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()

  const [card, setCard]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [flipped, setFlipped]         = useState(false)
  const [enrollment, setEnrollment]   = useState(null)
  const [tiers, setTiers]             = useState([])
  const [merchants, setMerchants]     = useState([])

  const [subscription, setSubscription]   = useState(null)
  const [walletBalance, setWalletBalance] = useState(0)

  const [showActivateModal, setShowActivateModal]     = useState(false)
  const [activating, setActivating]                   = useState(false)
  const [activateError, setActivateError]             = useState('')
  const [activateSuccess, setActivateSuccess]         = useState(false)

  const [showOrderModal, setShowOrderModal]           = useState(false)
  const [ordering, setOrdering]                       = useState(false)
  const [orderError, setOrderError]                   = useState('')
  const [orderSuccess, setOrderSuccess]               = useState(false)
  const [orderCollectionCode, setOrderCollectionCode] = useState('')

  const [showCancelModal, setShowCancelModal]         = useState(false)
  const [cancelling, setCancelling]                   = useState(false)
  const [cancelError, setCancelError]                 = useState('')

  const plan        = business?.subscription_package || 'starter'
  const cardEnabled = plan === 'growth' || plan === 'enterprise'

  const cardActive         = subscription && (subscription.status === 'active' || subscription.status === 'grace_period')
  const cardLapsed         = subscription && (subscription.status === 'lapsed')
  const physicalOrdered    = subscription?.physical_status === 'ordered'
  const physicalDispatched = subscription?.physical_status === 'dispatched'
  const physicalDelivered  = subscription?.physical_status === 'delivered'
  const hasPhysical        = physicalOrdered || physicalDispatched || physicalDelivered

  useEffect(() => { if (customer) loadAll() }, [customer])

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

      const { data: subData } = await supabase
        .from('card_subscriptions')
        .select('*')
        .eq('customer_id', customer.id)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setSubscription(subData || null)

      // A customer can now have multiple wallets (one per enrollment), so scope to
      // the active enrollment's wallet rather than .maybeSingle() on customer_id
      // (which would throw when more than one wallet exists).
      let bal = 0
      if (enrollData?.wallet_id) {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', enrollData.wallet_id)
          .maybeSingle()
        bal = Number(walletData?.balance || 0)
      }
      setWalletBalance(bal)

    } catch (e) {
      console.error('CardDetail load error:', e)
    }
    setLoading(false)
  }

  // ── Activate virtual card ──────────────────────────────────────────────
  async function handleActivate() {
    setActivating(true); setActivateError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/activate-card`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setActivateError(data.error || 'Activation failed. Please try again.'); setActivating(false); return }

      setActivateSuccess(true)
      setWalletBalance(data.new_balance)
      await loadAll()

      // The activation welcome email is now sent server-side by the activate-card
      // Edge Function (the email relay is locked to admins/service-role).

      setTimeout(() => { setShowActivateModal(false); setActivateSuccess(false) }, 1800)
    } catch (e) {
      setActivateError('Something went wrong. Please try again.')
    }
    setActivating(false)
  }

  // ── Order physical card ────────────────────────────────────────────────
  async function handleOrderPhysical() {
    setOrdering(true); setOrderError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/order-physical-card`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setOrderError(data.error || 'Order failed. Please try again.'); setOrdering(false); return }
      setOrderSuccess(true)
      setOrderCollectionCode(data.collection_code)
      setWalletBalance(data.new_balance)
      await loadAll()
    } catch (e) {
      setOrderError('Something went wrong. Please try again.')
    }
    setOrdering(false)
  }

  // ── Cancel subscription ────────────────────────────────────────────────
  async function handleCancel() {
    setCancelling(true); setCancelError('')
    try {
      // Cancellation + confirmation email now happen server-side (card_subscriptions
      // is service-role only, so the client could not update it directly).
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-card-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setCancelError(data.error || 'Could not cancel subscription. Please try again.'); setCancelling(false); return }
      setShowCancelModal(false)
      await loadAll()
    } catch (e) {
      setCancelError('Could not cancel subscription. Please try again.')
    }
    setCancelling(false)
  }

  // ── Tier calculations — unchanged ──────────────────────────────────────
  const currentTier    = enrollment?.tier || 'none'
  const tierColor      = TIER_COLORS[currentTier] || TIER_COLORS.none
  const tierLabel      = TIER_LABELS[currentTier] || 'No tier yet'
  const tierRate       = TIER_RATES[currentTier]  || '0%'
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
  const progressPct  = currentTierObj ? Number(currentTierObj.min_percentage) : 0
  const nextPct      = nextTierObj    ? Number(nextTierObj.min_percentage)     : 100
  const cashbackRate = currentTierObj ? Number(currentTierObj.cashback_rate)   : 0

  const navItems = [
    { label: 'Home',    path: '/portal/home'         },
    { label: 'Card',    path: '/portal/card'         },
    { label: 'History', path: '/portal/transactions' },
    { label: 'Profile', path: '/portal/profile'      },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══ ACTIVATE MODAL ══ */}
      {showActivateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.white, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activateSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bgGreen, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, color: C.black, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Card activated!</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Your virtual card is now active. Check your email for details.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 17, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>Activate your card</p>
                  <button onClick={() => { setShowActivateModal(false); setActivateError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { label: 'Virtual card subscription', value: 'UGX 5,000 / month' },
                    { label: 'First charge',              value: 'Today' },
                    { label: 'Your wallet balance',       value: formatUGX(walletBalance), color: walletBalance >= 5000 ? C.green : C.red },
                    { label: 'Balance after activation',  value: formatUGX(Math.max(walletBalance - 5000, 0)), color: walletBalance >= 5000 ? C.black : C.red },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {walletBalance < 5000 && (
                  <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
                    You need at least UGX 5,000 in your wallet to activate. Please deposit funds first.
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '160%' }}>
                  By activating, you agree to a monthly subscription fee of <strong style={{ color: C.black }}>UGX 5,000</strong> deducted from your savings wallet. The subscription renews automatically each month. You can cancel at any time from this page. No refunds are given for partial months. If your balance is insufficient, your card will enter a 7-day grace period before being locked.
                </div>
                {activateError && (
                  <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{activateError}</div>
                )}
                <button
                  onClick={handleActivate}
                  disabled={activating || walletBalance < 5000}
                  style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, color: C.white, background: walletBalance < 5000 ? C.grayMid : C.black, border: 'none', borderRadius: 12, cursor: walletBalance < 5000 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {activating ? <><div className="spinner spinner-sm spinner-light" /> Activating…</> : 'Activate card — UGX 5,000'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ ORDER PHYSICAL CARD MODAL ══ */}
      {showOrderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.white, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orderSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bgGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>Physical card ordered!</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '150%', maxWidth: 280 }}>
                  You will receive an email with your collection code when your card is ready. Bring your National ID and the code to collect it.
                </p>
                {orderCollectionCode && (
                  <div style={{ background: C.bg, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: '14px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your collection code</p>
                    <p style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: C.black, margin: 0, letterSpacing: '0.15em' }}>{orderCollectionCode}</p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: '6px 0 0' }}>Also visible on this page until delivery</p>
                  </div>
                )}
                <button onClick={() => { setShowOrderModal(false); setOrderSuccess(false) }} style={{ padding: '12px 28px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 17, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>Order physical card</p>
                  <button onClick={() => { setShowOrderModal(false); setOrderError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { label: 'One-time issuing fee',            value: 'UGX 20,000',           note: 'Charged today' },
                    { label: 'Monthly subscription (physical)', value: 'UGX 10,000 / month',   note: 'Starts from delivery date' },
                    { label: 'Your wallet balance',             value: formatUGX(walletBalance), color: walletBalance >= 20000 ? C.green : C.red },
                    { label: 'Balance after order',             value: formatUGX(Math.max(walletBalance - 20000, 0)), color: walletBalance >= 20000 ? C.black : C.red },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary, display: 'block' }}>{row.label}</span>
                        {row.note && <span style={{ fontSize: 11, fontWeight: 500, color: C.grayMid }}>{row.note}</span>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black, flexShrink: 0 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {walletBalance < 20000 && (
                  <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
                    You need at least UGX 20,000 in your wallet to cover the issuing fee. Please deposit funds first.
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '160%' }}>
                  By ordering, you agree to a one-time issuing fee of <strong style={{ color: C.black }}>UGX 20,000</strong> charged immediately. Your monthly subscription will change to <strong style={{ color: C.black }}>UGX 10,000/month</strong> starting from the date your card is delivered. Your card will be ready for collection at <strong style={{ color: C.black }}>{brand.businessName}</strong> within 5–7 working days. You will receive an email with a collection code when it is ready. Bring your National ID and the code to collect. No refunds are given on the issuing fee.
                </div>
                {orderError && (
                  <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{orderError}</div>
                )}
                <button
                  onClick={handleOrderPhysical}
                  disabled={ordering || walletBalance < 20000}
                  style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, color: C.white, background: walletBalance < 20000 ? C.grayMid : C.black, border: 'none', borderRadius: 12, cursor: walletBalance < 20000 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {ordering ? <><div className="spinner spinner-sm spinner-light" /> Ordering…</> : 'Order card — UGX 20,000'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ CANCEL SUBSCRIPTION MODAL ══ */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.white, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>Cancel subscription</p>
              <button onClick={() => { setShowCancelModal(false); setCancelError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
              Your card will remain active until the end of your current billing period. No refund will be given for the current month. Your card will then be locked.
            </div>
            {cancelError && (
              <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{cancelError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowCancelModal(false); setCancelError('') }} style={{ flex: 1, padding: '13px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, cursor: 'pointer' }}>
                Keep card
              </button>
              <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: '13px', fontSize: 14, fontWeight: 600, color: C.white, background: C.red, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: cancelling ? 0.7 : 1 }}>
                {cancelling ? <><div className="spinner spinner-sm spinner-light" /> Cancelling…</> : 'Cancel subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/portal/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 24, width: 'auto' }} />
            : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>My Card</span>
      </header>

      {/* ══ STATE 1 — ACTIVATION GATE ══ */}
      {!cardActive && !cardLapsed && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 24, textAlign: 'center' }}>
          <div style={{ width: 240, height: 148, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', filter: 'grayscale(1) opacity(0.45)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.black }}>{brand.businessName}</span>
              <div style={{ width: 26, height: 18, borderRadius: 3, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)' }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.black, letterSpacing: '0.12em' }}>•••• •••• •••• ••••</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 8, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase' }}>Cardholder</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.black, margin: 0 }}>{customer?.first_name} {customer?.last_name}</p>
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#EB001B', opacity: 0.7 }} />
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F79E1B', opacity: 0.7, marginLeft: -7 }} />
              </div>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 600, color: C.black, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Activate your savings card</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '150%', maxWidth: 280 }}>
              Get access to your virtual card, cashback rewards, and the option to order a physical card.
            </p>
          </div>
          <button onClick={() => setShowActivateModal(true)} style={{ padding: '14px 36px', fontSize: 15, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 12, cursor: 'pointer', width: '100%', maxWidth: 320 }}>
            Activate virtual card
          </button>
        </div>
      )}

      {/* ══ LAPSED STATE ══ */}
      {cardLapsed && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 20, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bgRed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 600, color: C.black, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Card locked</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '150%', maxWidth: 280 }}>
              Your card subscription lapsed due to insufficient balance. Reactivate to restore access to your card and cashback rewards.
            </p>
          </div>
          <button onClick={() => setShowActivateModal(true)} style={{ padding: '14px 36px', fontSize: 15, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 12, cursor: 'pointer', width: '100%', maxWidth: 320 }}>
            Reactivate card — UGX 5,000
          </button>
        </div>
      )}

      {/* ══ STATE 2 — ACTIVE CARD VIEW ══ */}
      {cardActive && (
        <>
          {subscription?.status === 'grace_period' && (
            <div style={{ background: C.bgOrange, borderBottom: `1px solid ${C.orange}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.orange, margin: '0 0 1px' }}>Subscription renewal failed</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.85 }}>
                  Please deposit UGX {Number(subscription.monthly_fee).toLocaleString()} to avoid your card being locked.
                </p>
              </div>
            </div>
          )}

          {/* Card display panel */}
          <div style={{ background: C.black, padding: '28px 20px 32px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div onClick={() => setFlipped(f => !f)} style={{ perspective: '1000px', width: '100%', maxWidth: 320, height: 196, cursor: 'pointer' }}>
              <div style={{ width: '100%', height: 196, position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.55s ease', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* Front */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 12px 32px rgba(0,0,0,0.32)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>{brand.businessName}</span>
                    <div style={{ width: 32, height: 22, borderRadius: 4, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)' }} />
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: C.black, letterSpacing: '0.14em' }}>{formatCardNumber(card?.card_number)}</span>
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
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: '#1a1a1a', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.32)' }}>
                  <div style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 40, background: '#2a2a2a' }} />
                  <div style={{ position: 'absolute', top: 84, left: 18, right: 18, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 32, background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                    <div style={{ width: 50, height: 32, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: C.black, borderRadius: 4 }}>{card?.cvv || '•••'}</div>
                  </div>
                  <p style={{ position: 'absolute', top: 122, right: 18, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CVV</p>
                  <p style={{ position: 'absolute', bottom: 40, left: 18, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', margin: 0 }}>{formatCardNumber(card?.card_number)}</p>
                  <p style={{ position: 'absolute', bottom: 18, left: 18, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500, margin: 0 }}>Valid thru {formatExpiry(card?.expiry_date)}</p>
                  <div style={{ position: 'absolute', bottom: 14, right: 18, display: 'flex' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EB001B', opacity: 0.7 }} />
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F79E1B', opacity: 0.7, marginLeft: -8 }} />
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Tap card to flip</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: subscription?.card_type === 'physical' ? C.blue : C.green, background: subscription?.card_type === 'physical' ? 'rgba(133,160,197,0.15)' : C.bgGreen, borderRadius: 6, padding: '3px 10px' }}>
                {subscription?.card_type === 'physical' ? 'Physical card' : 'Virtual card'} · Active
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
                Renews {subscription?.next_billing_date ? formatDate(subscription.next_billing_date) : '—'}
              </span>
            </div>

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

          {/* Body */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {hasPhysical && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Physical card</p>
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: subscription?.collection_code && !physicalDelivered ? `1px solid ${C.grayLine}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: physicalDelivered ? C.green : physicalDispatched ? C.blue : C.orange, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>
                          {physicalDelivered ? 'Card delivered' : physicalDispatched ? 'Card dispatched — ready to collect' : 'Card ordered — awaiting dispatch'}
                        </p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
                          {physicalDelivered ? `Delivered ${formatDate(subscription?.physical_delivered_at)}`
                            : physicalDispatched ? 'Visit your institution to collect your card'
                            : 'Partna will notify you when your card is ready'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {subscription?.collection_code && !physicalDelivered && (
                    <div style={{ padding: '16px', background: C.bg, borderTop: `1px solid ${C.grayLine}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your collection code</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <p style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: C.black, margin: 0, letterSpacing: '0.2em' }}>{subscription.collection_code}</p>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '8px 0 0', lineHeight: '140%' }}>
                        Show this code and your National ID when you collect your card from {brand.businessName}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {subscription?.card_type === 'virtual' && !hasPhysical && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Physical card</p>
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 3px' }}>Order a physical card</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>UGX 20,000 issuing fee · UGX 10,000/month · Ready in 5–7 days</p>
                  </div>
                  <button onClick={() => setShowOrderModal(true)} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>Order card</button>
                </div>
              </div>
            )}

            {/* Card settings */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Card settings</p>
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                {[
                  { label: 'Freeze card',   sub: 'Temporarily block all card transactions' },
                  { label: 'Unfreeze card', sub: 'Re-enable your card for transactions'     },
                ].map((item, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{item.sub}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.grayMid, background: C.grayLight, borderRadius: 6, padding: '3px 10px', flexShrink: 0 }}>Coming soon</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.red, margin: '0 0 2px' }}>Cancel subscription</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>Your card will be locked at end of billing period</p>
                  </div>
                  <button onClick={() => setShowCancelModal(true)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                </div>
              </div>
            </div>

            {/* Cashback tier progress — unchanged */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cashback rewards</p>
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
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
                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{currentTier === 'none' ? '0% saved' : `${progressPct}% — ${tierLabel}`}</span>
                    {nextTierObj && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{nextPct}% — {TIER_LABELS[nextTierObj.name.toLowerCase()]}</span>}
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: C.grayLight, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: tierColor, width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: (nextTierObj || !currentTierObj) ? C.secondary : C.green, margin: '8px 0 0', lineHeight: '140%' }}>
                    {nextTierObj
                      ? <>Reach <strong style={{ color: C.black }}>{nextPct}%</strong> of your savings target to unlock <strong style={{ color: TIER_COLORS[nextTierObj.name.toLowerCase()] }}>{TIER_LABELS[nextTierObj.name.toLowerCase()]}</strong> ({(Number(nextTierObj.cashback_rate) * 100).toFixed(1)}% cashback)</>
                      : currentTierObj
                        ? 'You are at the highest tier — enjoy 3% cashback at all merchants.'
                        : 'Save toward your target to unlock your first cashback tier.'
                    }
                  </p>
                </div>
                {tiers.map((tier, i) => {
                  const tKey      = tier.name.toLowerCase()
                  const color     = TIER_COLORS[tKey] || C.grayMid
                  const isCurrent = tKey === currentTier
                  return (
                    <div key={tier.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < tiers.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: isCurrent ? C.bg : C.white }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? C.black : C.secondary }}>{TIER_LABELS[tKey]}</span>
                        {isCurrent && <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '2px 8px' }}>Current</span>}
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

            {/* Merchants — unchanged */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Partna merchants</p>
              {merchants.length === 0 ? (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
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
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{m.category || 'Merchant'}{m.description ? ` · ${m.description}` : ''}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 18, fontWeight: 600, color: currentTier !== 'none' ? C.green : C.grayMid, margin: '0 0 2px', letterSpacing: '-0.5px' }}>
                          {currentTier !== 'none' ? `${(cashbackRate * 100).toFixed(1)}%` : '—'}
                        </p>
                        <p style={{ fontSize: 10, fontWeight: 500, color: C.grayMid, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>cashback</p>
                      </div>
                    </div>
                  ))}
                  <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>More merchants coming soon</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`, zIndex: 100 }}>
        {navItems.map(({ label, path }) => {
          const active = path === '/portal/card'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: active ? C.black : C.grayMid }}>
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