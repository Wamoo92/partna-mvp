import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

function getMerchantLogo(name) {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('kfc'))       return '/kfc-logo.svg'
  if (n.includes('shell'))     return '/shell-logo.svg'
  if (n.includes('java') || n.includes('cj')) return '/cjs-logo.svg'
  if (n.includes('carrefour')) return '/carrefour-logo.svg'
  if (n.includes('glovo'))     return '/glovo-logo.svg'
  return null
}

function fmt(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function VoucherCountdown({ campaignStart, campaignEnd, fraction }) {
  const [timeLeft, setTimeLeft] = useState('...')
  useEffect(() => {
    if (!campaignStart || !campaignEnd || fraction == null) { setTimeLeft('--'); return }
    const start  = new Date(campaignStart).getTime()
    const end    = new Date(campaignEnd).getTime()
    const expiry = start + (end - start) * Number(fraction)
    function calc() {
      const diff = expiry - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(d + 'd ' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'))
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [campaignStart, campaignEnd, fraction])
  return timeLeft
}

function PrizeCountdown({ drawDate }) {
  const [timeLeft, setTimeLeft] = useState('...')
  useEffect(() => {
    if (!drawDate) { setTimeLeft('--'); return }
    const target = new Date(drawDate).getTime()
    function calc() {
      const diff = target - Date.now()
      if (diff <= 0) { setTimeLeft('Draw complete'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(d + 'd ' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'))
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [drawDate])
  return timeLeft
}

export default function Rewards({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  // Read enrollmentId from router state (passed from Home carousel)
  const enrollmentId = location.state?.enrollmentId || null

  const [campaign, setCampaign]             = useState(null)
  const [wallet, setWallet]                 = useState(null)
  const [enrollment, setEnrollment]         = useState(null)
  const [vouchers, setVouchers]             = useState([])
  const [claims, setClaims]                 = useState([])
  const [prizes, setPrizes]                 = useState([])
  const [prizeDraws, setPrizeDraws]         = useState([])
  const [showWinners, setShowWinners]       = useState(false)
  const [loading, setLoading]               = useState(true)
  const [claimModal, setClaimModal]         = useState(null)
  const [termsChecked, setTermsChecked]     = useState(false)
  const [claiming, setClaiming]             = useState(false)
  const [successVoucher, setSuccessVoucher] = useState(null)
  const [current, setCurrent]               = useState(0)

  useEffect(() => { if (customer) loadAll() }, [customer, enrollmentId])

  async function loadAll() {
    setLoading(true)
    try {
      // ── Load enrollment (prefer enrollmentId from state, fall back to first active) ──
      let query = supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')

      if (enrollmentId) {
        query = query.eq('id', enrollmentId)
      } else {
        query = query.order('enrolled_at', { ascending: true }).limit(1)
      }

      const { data: enrollmentData } = await query.maybeSingle()

      if (!enrollmentData) { setLoading(false); return }

      setEnrollment(enrollmentData)
      setCampaign(enrollmentData.campaigns)
      setWallet(enrollmentData.wallets)

      const campaignId = enrollmentData.campaign_id
      const drawCode   = enrollmentData.draw_code

      // ── Vouchers for this campaign ──
      const { data: cvData } = await supabase
        .from('campaign_vouchers')
        .select('voucher_id')
        .eq('campaign_id', campaignId)

      if (cvData?.length > 0) {
        const ids = cvData.map(cv => cv.voucher_id)
        const { data: vData } = await supabase
          .from('vouchers').select('*, merchants(id, name)').in('id', ids).eq('is_active', true)
        setVouchers(vData || [])
      } else {
        const { data: vData } = await supabase
          .from('vouchers').select('*, merchants(id, name)')
          .eq('campaign_id', campaignId).eq('is_active', true)
        setVouchers(vData || [])
      }

      // ── Customer's claimed vouchers ──
      const { data: claimData } = await supabase
        .from('voucher_claims').select('voucher_id').eq('customer_id', customer.id)
      if (claimData) setClaims(claimData.map(c => c.voucher_id))

      // ── Prizes for this campaign ──
      const { data: prizeData } = await supabase
        .from('prizes').select('*').eq('campaign_id', campaignId).eq('is_active', true)
      if (prizeData) setPrizes(prizeData)

      // ── Prize draws — filter by campaign ──
      const { data: drawData } = await supabase
        .from('prize_draws')
        .select('*, prizes(id, title, campaign_id)')
        .order('drawn_at', { ascending: false })
      if (drawData) setPrizeDraws(drawData.filter(d => d.prizes?.campaign_id === campaignId))

      // Store draw code for winner display (from enrollment, not customer)
      setEnrollment(prev => ({ ...prev, draw_code: drawCode }))

    } catch (e) {
      console.error('Rewards load error:', e)
    }
    setLoading(false)
  }

  const balance = wallet   ? Number(wallet.balance)         : 0
  const target  = campaign ? Number(campaign.target_amount) : 0
  const pct     = target > 0 ? Math.min((balance / target) * 100, 100) : 0

  // Draw code now comes from enrollment, not customer
  const drawCode = enrollment?.draw_code || customer?.draw_code || null

  function isExpiredByFraction(fraction) {
    if (!campaign) return false
    const start  = new Date(campaign.created_at).getTime()
    const end    = new Date(campaign.target_date).getTime()
    const expiry = start + (end - start) * Number(fraction)
    return Date.now() > expiry
  }

  function isUnlocked(v) {
    const minBal = target * (Number(v.min_balance_percentage) / 100)
    return balance >= minBal && !isExpiredByFraction(v.expiry_offset_fraction)
  }

  function isClaimed(v)      { return claims.includes(v.id) }
  function minBalDisplay(v)  { return fmt(target * Number(v.min_balance_percentage) / 100) }
  function prizeQualifies(p) { return balance >= target * (Number(p.min_balance_percentage) / 100) }
  function prizeProgress(p) {
    const minBal = target * (Number(p.min_balance_percentage) / 100)
    return minBal === 0 ? 100 : Math.min((balance / minBal) * 100, 100)
  }

  async function handleClaim() {
    if (!claimModal || !termsChecked) return
    setClaiming(true)
    const res = await supabase.from('voucher_claims').insert({
      voucher_id: claimModal.id,
      customer_id: customer.id,
    })
    if (!res.error) {
      setClaims([...claims, claimModal.id])
      setSuccessVoucher(claimModal)
      setClaimModal(null)
      setTermsChecked(false)
    }
    setClaiming(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  const v        = vouchers[current] || null
  const unlocked = v ? isUnlocked(v) : false
  const claimed  = v ? isClaimed(v) : false
  const expired  = v ? isExpiredByFraction(v.expiry_offset_fraction) : false
  const merchantName = v?.merchants?.name || ''
  const logo     = v ? getMerchantLogo(merchantName) : null
  const needMore = v ? Math.max((target * Number(v.min_balance_percentage) / 100) - balance, 0) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Success overlay ── */}
      {successVoucher && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 'var(--z-modal)',
          background: 'var(--color-black)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-6)',
          gap: 'var(--space-4)',
        }}>
          <div style={{
            width: '100%', maxWidth: 360,
            background: 'var(--color-white)',
            border: '3px solid var(--color-primary)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'var(--color-primary)',
              borderBottom: '3px solid var(--color-black)',
              padding: 'var(--space-4) var(--space-5)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-black)' }}>card_giftcard</span>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)' }}>
                  {successVoucher.merchants?.name || ''}
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-black)' }}>
                  {successVoucher.title}
                </div>
              </div>
            </div>
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                {successVoucher.description}
              </p>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                {successVoucher.terms_and_conditions}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: 'var(--border)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                  {brand.businessName} — Powered by Partna
                </span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-black)' }}>
                  {customer?.first_name} {customer?.last_name}
                </span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            Screenshot to save
          </div>
          <button onClick={() => setSuccessVoucher(null)} className="btn btn-primary btn-lg">
            <span className="icon-outlined icon-sm">check</span>
            Done
          </button>
        </div>
      )}

      {/* ── Claim modal ── */}
      {claimModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                  {claimModal.merchants?.name || ''}
                </div>
                <span className="modal-title">{claimModal.title}</span>
              </div>
              <button onClick={() => { setClaimModal(null); setTermsChecked(false) }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                {claimModal.terms_and_conditions}
              </div>
              <label className="checkbox-group">
                <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
                <span className="checkbox-label">I agree to the terms and conditions</span>
              </label>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setClaimModal(null); setTermsChecked(false) }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleClaim} disabled={!termsChecked || claiming} className="btn btn-primary" style={{ flex: 1 }}>
                {claiming
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Claiming…</>
                  : 'Confirm'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winners modal ── */}
      {showWinners && (
        <div className="modal-backdrop" style={{ alignItems: 'flex-end' }}>
          <div className="modal" style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <span className="modal-title">Prize draw winners</span>
              <button onClick={() => setShowWinners(false)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body">
              {prizeDraws.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                  <span className="icon-outlined empty-state-icon">emoji_events</span>
                  <div className="empty-state-title">No draws yet</div>
                  <p className="empty-state-body">No prize draws have taken place yet.</p>
                </div>
              ) : (
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-black)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)' }}>Prize</span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)', textAlign: 'right' }}>Winning code</span>
                  </div>
                  {prizeDraws.map((draw, i) => {
                    // Compare against enrollment draw_code, not customer.draw_code
                    const isWinner = draw.winning_code === drawCode
                    return (
                      <div key={draw.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        padding: 'var(--space-3) var(--space-4)',
                        borderBottom: i < prizeDraws.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                        background: isWinner ? 'var(--color-green)' : i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                      }}>
                        <div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                            {draw.prizes?.title || 'Prize'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                            {new Date(draw.drawn_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: isWinner ? '#2D8B45' : 'var(--color-black)' }}>
                            {draw.winning_code}
                          </div>
                          {isWinner && (
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: '#2D8B45', marginTop: 2 }}>
                              That's you!
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        position: 'sticky', top: 0, zIndex: 'var(--z-sticky)',
      }}>
        <button onClick={() => navigate('/portal/home')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)',
          background: 'transparent', color: 'var(--color-white)', cursor: 'pointer', flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div>
          <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            Rewards
          </div>
          {campaign && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              {campaign.name}
            </div>
          )}
        </div>
      </header>

      {/* ── Balance / progress hero ── */}
      <div style={{ background: 'var(--color-black)', borderBottom: '3px solid var(--color-primary)', padding: 'var(--space-6) var(--space-5) var(--space-8)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-1)' }}>
          Current balance
        </div>
        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', color: 'var(--color-white)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 110, 'opsz' 36", marginBottom: 'var(--space-3)' }}>
          {fmt(balance)}
        </div>
        <div className="progress-bar-track" style={{ background: 'rgba(255,255,255,0.15)', marginBottom: 'var(--space-2)' }}>
          <div className="progress-bar-fill" style={{
            width: pct + '%',
            background: pct >= 100 ? 'var(--color-green)' : pct >= 75 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.45)' }}>{pct.toFixed(0)}% of savings goal</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.45)' }}>{fmt(target)} target</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* ── Prizes ── */}
        {prizes.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-black)' }}>emoji_events</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase' }}>Prize draw</span>
              </div>
              <button onClick={() => setShowWinners(true)} style={{ background: 'none', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                See all winners
              </button>
            </div>

            {prizes.map(prize => {
              const qualifies  = prizeQualifies(prize)
              const progress   = prizeProgress(prize)
              const minBal     = target * (Number(prize.min_balance_percentage) / 100)
              const drawPassed = new Date(prize.draw_date) < new Date()
              const prizeTypeIcon = prize.prize_type === 'cash' ? 'payments' : prize.prize_type === 'item' ? 'redeem' : 'discount'

              return (
                <div key={prize.id} style={{
                  background: 'var(--color-white)',
                  border: qualifies ? '3px solid var(--color-black)' : 'var(--border)',
                  boxShadow: qualifies ? 'var(--shadow-md)' : 'none',
                  marginBottom: 'var(--space-3)', overflow: 'hidden',
                  opacity: !qualifies ? 0.75 : 1,
                }}>
                  <div style={{
                    background: qualifies ? 'var(--color-primary)' : 'var(--color-grey-light)',
                    borderBottom: 'var(--border)', padding: 'var(--space-2) var(--space-4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className="icon-outlined" style={{ fontSize: 16 }}>{prizeTypeIcon}</span>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                        {prize.prize_type === 'cash' ? 'Cash prize' : prize.prize_type === 'item' ? 'Item prize' : 'Discount prize'}
                      </span>
                    </div>
                    {qualifies && <span className="badge badge-black no-dot">Qualified</span>}
                  </div>

                  <div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-lg)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 20", marginBottom: 4 }}>
                          {prize.title}
                        </div>
                        {prize.prize_type === 'cash' && prize.prize_value && (
                          <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xl)', color: '#2D8B45', letterSpacing: 'var(--tracking-tight)' }}>
                            {fmt(prize.prize_value)}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-4)' }}>
                        <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 4 }}>
                          Your code
                        </div>
                        <div style={{
                          fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)',
                          background: qualifies ? 'var(--color-black)' : 'var(--color-grey-light)',
                          color: qualifies ? 'var(--color-primary)' : 'var(--color-grey)',
                          padding: '4px var(--space-3)', border: 'var(--border)', letterSpacing: '0.1em',
                        }}>
                          {drawCode || '——'}
                        </div>
                      </div>
                    </div>

                    {prize.description && (
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--space-3)' }}>
                        {prize.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      {[
                        { label: 'Winners', value: prize.number_of_winners + (prize.number_of_winners === 1 ? ' winner' : ' winners') },
                        { label: 'Min. balance', value: fmt(minBal) },
                        { label: drawPassed ? 'Draw date' : 'Draw in', value: drawPassed
                            ? new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
                            : <PrizeCountdown drawDate={prize.draw_date} />, mono: !drawPassed },
                      ].map((item, i) => (
                        <div key={i}>
                          <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)', fontFamily: item.mono ? 'monospace' : 'inherit', color: 'var(--color-black)' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>Qualification progress</span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: qualifies ? '#2D8B45' : 'var(--color-black)' }}>{Math.min(progress, 100).toFixed(0)}%</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: Math.min(progress, 100) + '%', background: qualifies ? 'var(--color-green)' : 'var(--color-primary)' }} />
                      </div>
                    </div>

                    {qualifies ? (
                      <div className="alert alert-success" style={{ marginTop: 'var(--space-3)' }}>
                        <span className="icon-outlined alert-icon">check_circle</span>
                        <div className="alert-content">You qualify for this prize draw</div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>
                        Save {fmt(Math.max(minBal - balance, 0))} more to qualify
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Vouchers ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="icon-outlined" style={{ fontSize: 20 }}>local_activity</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase' }}>Vouchers</span>
            </div>
            {vouchers.length > 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>{current + 1} / {vouchers.length}</span>
            )}
          </div>

          {vouchers.length === 0 ? (
            <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-10)', textAlign: 'center' }}>
              <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>local_activity</span>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>No vouchers available</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>Vouchers for this campaign will appear here once added.</div>
            </div>
          ) : v && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} style={{ width: 36, height: 36, flexShrink: 0, background: current === 0 ? 'var(--color-grey-light)' : 'var(--color-black)', border: 'var(--border)', color: current === 0 ? 'var(--color-grey)' : 'var(--color-white)', cursor: current === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="icon-outlined icon-sm">chevron_left</span>
                </button>

                <div style={{ flex: 1, background: 'var(--color-white)', border: (unlocked && !claimed) ? '3px solid var(--color-black)' : 'var(--border)', boxShadow: (unlocked && !claimed) ? 'var(--shadow-md)' : 'none', overflow: 'hidden', opacity: (claimed || expired) ? 0.7 : 1, filter: unlocked ? 'none' : 'grayscale(0.3)' }}>
                  <div style={{ background: claimed ? 'var(--color-green)' : expired ? 'var(--color-red)' : unlocked ? 'var(--color-primary)' : 'var(--color-grey-light)', borderBottom: 'var(--border)', padding: '5px var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="icon-outlined" style={{ fontSize: 14 }}>{claimed ? 'check_circle' : expired ? 'cancel' : unlocked ? 'lock_open' : 'lock'}</span>
                    <span style={{ fontSize: 9, fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase' }}>
                      {claimed ? 'Claimed' : expired ? 'Expired' : unlocked ? 'Unlocked — ready to claim' : 'Locked'}
                    </span>
                  </div>

                  <div style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      {logo ? (
                        <div style={{ width: 56, height: 56, flexShrink: 0, border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <img src={logo} alt={merchantName} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <div style={{ width: 56, height: 56, flexShrink: 0, border: 'var(--border)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="icon-outlined" style={{ fontSize: 24, color: 'var(--color-grey)' }}>local_activity</span>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', marginBottom: 2 }}>{merchantName}</div>
                        <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-lg)', letterSpacing: 'var(--tracking-tight)', color: unlocked ? 'var(--color-black)' : 'var(--color-grey)', fontVariationSettings: "'wdth' 100, 'opsz' 20" }}>
                          {v.title}
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: 'var(--text-sm)', color: unlocked ? 'var(--color-grey)' : 'var(--color-grey-mid)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--space-4)' }}>
                      {v.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 4 }}>Minimum balance</div>
                        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: unlocked ? 'var(--color-black)' : 'var(--color-grey)' }}>{minBalDisplay(v)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 4 }}>{expired ? 'Status' : 'Expires in'}</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: expired ? '#C0392B' : claimed ? '#2D8B45' : '#8A6700' }}>
                          {expired ? 'Expired' : claimed ? 'Claimed' : (
                            campaign ? <VoucherCountdown campaignStart={campaign.created_at} campaignEnd={campaign.target_date} fraction={v.expiry_offset_fraction} /> : '--'
                          )}
                        </div>
                      </div>
                    </div>

                    {claimed ? (
                      <div style={{ padding: 'var(--space-3)', background: 'var(--color-green)', border: 'var(--border)', textAlign: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                        <span className="icon-outlined icon-sm">check_circle</span>Claimed
                      </div>
                    ) : expired ? (
                      <div style={{ padding: 'var(--space-3)', background: 'var(--color-red)', border: 'var(--border)', textAlign: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                        <span className="icon-outlined icon-sm">cancel</span>Expired
                      </div>
                    ) : unlocked ? (
                      <button onClick={() => setClaimModal(v)} className="btn btn-primary btn-full">
                        <span className="icon-outlined icon-sm">redeem</span>Claim voucher
                      </button>
                    ) : (
                      <div style={{ padding: 'var(--space-3)', background: 'var(--color-grey-light)', border: 'var(--border)', textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-grey)' }}>
                        {needMore > 0 ? `Save ${fmt(needMore)} more to unlock` : 'Locked'}
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={() => setCurrent(c => Math.min(vouchers.length - 1, c + 1))} disabled={current === vouchers.length - 1} style={{ width: 36, height: 36, flexShrink: 0, background: current === vouchers.length - 1 ? 'var(--color-grey-light)' : 'var(--color-black)', border: 'var(--border)', color: current === vouchers.length - 1 ? 'var(--color-grey)' : 'var(--color-white)', cursor: current === vouchers.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="icon-outlined icon-sm">chevron_right</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 'var(--space-4)' }}>
                {vouchers.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 20 : 6, height: 6, background: i === current ? 'var(--color-black)' : 'var(--color-grey-mid)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all var(--transition-base)' }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-white)', borderTop: 'var(--border-thick)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: 'var(--space-2) var(--space-4)', zIndex: 'var(--z-sticky)' }}>
        {[
          { label: 'Home',    icon: 'home',          path: '/portal/home'         },
          { label: 'Rewards', icon: 'card_giftcard', path: '/portal/rewards'      },
          { label: 'History', icon: 'receipt_long',  path: '/portal/transactions' },
          { label: 'Profile', icon: 'person',        path: '/portal/profile'      },
        ].map(({ label, icon, path }) => {
          const active = path === '/portal/rewards'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1) var(--space-3)', position: 'relative' }}>
              {active && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: 'var(--color-primary)' }} />}
              <span className="icon-outlined" style={{ fontSize: 22, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{icon}</span>
              <span style={{ fontWeight: active ? 'var(--weight-black)' : 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontSize: 9, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}