import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const CAMPAIGN_ID = 'b1b2c3d4-0000-0000-0000-000000000001'

function getMerchantLogo(name) {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('kfc')) return '/kfc-logo.svg'
  if (n.includes('shell')) return '/shell-logo.svg'
  if (n.includes('java') || n.includes('cj')) return '/cjs-logo.svg'
  if (n.includes('carrefour')) return '/carrefour-logo.svg'
  if (n.includes('glovo')) return '/glovo-logo.svg'
  return null
}

function VoucherCountdown({ campaignStart, campaignEnd, fraction }) {
  const [timeLeft, setTimeLeft] = useState('...')
  useEffect(() => {
    if (!campaignStart || !campaignEnd || fraction == null) { setTimeLeft('--'); return }
    const start = new Date(campaignStart).getTime()
    const end = new Date(campaignEnd).getTime()
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
  const brand = useBrand()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [vouchers, setVouchers] = useState([])
  const [claims, setClaims] = useState([])
  const [prizes, setPrizes] = useState([])
  const [prizeDraws, setPrizeDraws] = useState([])
  const [showWinners, setShowWinners] = useState(false)
  const [loading, setLoading] = useState(true)
  const [claimModal, setClaimModal] = useState(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [successVoucher, setSuccessVoucher] = useState(null)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (customer) loadAll()
  }, [customer])

  async function loadAll() {
    setLoading(true)

    // Campaign
    try {
      const r1 = await supabase.from('campaigns').select('*').eq('id', CAMPAIGN_ID)
      if (r1.data && r1.data.length > 0) setCampaign(r1.data[0])
    } catch(e) {}

    // Wallet
    try {
      const r2 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r2.data && r2.data.length > 0) setWallet(r2.data[0])
    } catch(e) {}

    // Vouchers — fetch via campaign_vouchers junction table, then hydrate with voucher + merchant data
    try {
      const { data: cvData } = await supabase
        .from('campaign_vouchers')
        .select('voucher_id')
        .eq('campaign_id', CAMPAIGN_ID)

      if (cvData && cvData.length > 0) {
        const voucherIds = cvData.map(cv => cv.voucher_id)
        const { data: vData } = await supabase
          .from('vouchers')
          .select('*, merchants(id, name)')
          .in('id', voucherIds)
          .eq('is_active', true)
        setVouchers(vData || [])
      } else {
        // Fallback: direct campaign_id on vouchers (legacy)
        const { data: vData } = await supabase
          .from('vouchers')
          .select('*, merchants(id, name)')
          .eq('campaign_id', CAMPAIGN_ID)
          .eq('is_active', true)
        setVouchers(vData || [])
      }
    } catch(e) { console.error('Vouchers load error:', e) }

    // Voucher claims for this customer
    try {
      const { data: claimData } = await supabase
        .from('voucher_claims')
        .select('voucher_id')
        .eq('customer_id', customer.id)
      if (claimData) setClaims(claimData.map(c => c.voucher_id))
    } catch(e) {}

    // Prizes for this campaign
    try {
      const { data: prizeData } = await supabase
        .from('prizes')
        .select('*')
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('is_active', true)
      if (prizeData) setPrizes(prizeData)
    } catch(e) {}

    // Prize draws — fetch all draws, join prizes separately
    try {
      const { data: drawData } = await supabase
        .from('prize_draws')
        .select('*, prizes(id, title, campaign_id)')
        .order('drawn_at', { ascending: false })
      // Filter to only draws for this campaign's prizes
      if (drawData) {
        setPrizeDraws(drawData.filter(d => d.prizes?.campaign_id === CAMPAIGN_ID))
      }
    } catch(e) {}

    setLoading(false)
  }

  const balance = wallet ? Number(wallet.balance) : 0
  const target = campaign ? Number(campaign.target_amount) : 1500000
  const pct = Math.min((balance / target) * 100, 100)

  function fmt(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function isExpiredByFraction(fraction) {
    if (!campaign) return false
    const start = new Date(campaign.created_at).getTime()
    const end = new Date(campaign.target_date).getTime()
    const expiry = start + (end - start) * Number(fraction)
    return Date.now() > expiry
  }

  // Unlock logic: wallet balance >= minimum threshold for this voucher
  function isUnlocked(v) {
    const minBal = target * (Number(v.min_balance_percentage) / 100)
    return balance >= minBal && !isExpiredByFraction(v.expiry_offset_fraction)
  }

  function isClaimed(v) { return claims.includes(v.id) }

  function minBalDisplay(v) {
    return fmt(target * Number(v.min_balance_percentage) / 100)
  }

  // Prize qualification: wallet balance >= prize minimum threshold
  function prizeQualifies(prize) {
    const minBal = target * (Number(prize.min_balance_percentage) / 100)
    return balance >= minBal
  }

  function prizeProgress(prize) {
    const minBal = target * (Number(prize.min_balance_percentage) / 100)
    if (minBal === 0) return 100
    return Math.min((balance / minBal) * 100, 100)
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  const v = vouchers[current] || null
  const unlocked = v ? isUnlocked(v) : false
  const claimed = v ? isClaimed(v) : false
  const expired = v ? isExpiredByFraction(v.expiry_offset_fraction) : false
  const merchantName = v?.merchants?.name || ''
  const logo = v ? getMerchantLogo(merchantName) : null
  const needMore = v ? Math.max((target * Number(v.min_balance_percentage) / 100) - balance, 0) : 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* ── Success overlay ── */}
      {successVoucher && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{ background: brand.primaryColor }}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"
            style={{ background: '#fff', border: '3px solid ' + brand.secondaryColor }}>
            <div className="text-4xl mb-3">🎉</div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {successVoucher.merchants?.name || ''}
            </div>
            <div className="text-2xl font-bold mb-2" style={{ color: brand.primaryColor }}>
              {successVoucher.title}
            </div>
            <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {successVoucher.description}
            </div>
            <div className="text-xs px-4 py-2 rounded-xl mb-3"
              style={{ background: 'rgba(27,79,114,0.07)', color: brand.primaryColor }}>
              {brand.businessName} Savings Program — Powered by Partna
            </div>
            <div className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {successVoucher.terms_and_conditions}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
              {customer ? customer.first_name + ' ' + customer.last_name : ''}
            </div>
          </div>
          <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Screenshot to save</p>
          <button onClick={() => setSuccessVoucher(null)}
            className="mt-4 px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
            Done
          </button>
        </div>
      )}

      {/* ── Claim modal ── */}
      {claimModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-5"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#fff' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  {claimModal.merchants?.name || ''}
                </div>
                <div className="text-base font-bold" style={{ color: brand.primaryColor }}>
                  {claimModal.title}
                </div>
              </div>
              <button onClick={() => { setClaimModal(null); setTermsChecked(false) }}
                className="text-lg ml-3" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="text-xs px-3 py-2 rounded-xl mb-4 leading-relaxed"
              style={{ background: 'rgba(27,79,114,0.06)', color: 'rgba(0,0,0,0.6)' }}>
              {claimModal.terms_and_conditions}
            </div>
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={termsChecked}
                onChange={e => setTermsChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0" />
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>
                I agree to the terms and conditions
              </span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => { setClaimModal(null); setTermsChecked(false) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: brand.primaryColor }}>Cancel</button>
              <button onClick={handleClaim} disabled={!termsChecked || claiming}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: (!termsChecked || claiming) ? 'rgba(27,79,114,0.3)' : brand.primaryColor,
                  color: '#fff',
                }}>
                {claiming ? 'Claiming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winners modal ── */}
      {showWinners && (
        <div className="fixed inset-0 z-40 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-t-3xl p-5 pb-8"
            style={{ background: '#fff', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>Prize Draw Winners</div>
              <button onClick={() => setShowWinners(false)}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            {prizeDraws.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🏆</div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  No prize draws have taken place yet
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="grid grid-cols-2 px-4 py-2" style={{ background: brand.primaryColor }}>
                  <div className="text-xs font-bold text-white">Prize</div>
                  <div className="text-xs font-bold text-white text-right">Winning Code</div>
                </div>
                {prizeDraws.map((draw, i) => (
                  <div key={draw.id} className="grid grid-cols-2 px-4 py-3"
                    style={{ borderBottom: i < prizeDraws.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                        {draw.prizes?.title || 'Prize'}
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        {new Date(draw.drawn_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold"
                        style={{ color: draw.winning_code === customer?.draw_code ? '#16A34A' : brand.primaryColor }}>
                        {draw.winning_code}
                      </div>
                      {draw.winning_code === customer?.draw_code && (
                        <div className="text-xs font-semibold" style={{ color: '#16A34A' }}>That's you! 🎉</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={() => navigate('/portal/home')} className="text-white text-xl">&#8592;</button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Rewards</div>
        </div>
      </header>

      {/* ── Hero / progress ── */}
      <div className="px-5 pt-5 pb-8" style={{ background: brand.primaryColor }}>
        <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Current balance</div>
        <div className="text-white text-2xl font-bold mb-1">{fmt(balance)}</div>
        <div className="w-full h-1.5 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <div className="h-1.5 rounded-full transition-all"
            style={{
              width: pct + '%',
              background: pct >= 100 ? '#22C55E' : pct >= 75 ? '#22C55E' : pct >= 50 ? brand.secondaryColor : '#F59E0B',
            }} />
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span>{pct.toFixed(0)}% of savings goal</span>
          <span>{fmt(target)} target</span>
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 px-4 py-5 flex flex-col gap-5"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* ── Prizes ── */}
        {prizes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>🏆 Prize Draw</div>
              <button onClick={() => setShowWinners(true)}
                className="text-xs font-semibold" style={{ color: brand.secondaryColor }}>
                See all winners
              </button>
            </div>
            {prizes.map(prize => {
              const qualifies = prizeQualifies(prize)
              const progress = prizeProgress(prize)
              const minBal = target * (Number(prize.min_balance_percentage) / 100)
              const drawPassed = new Date(prize.draw_date) < new Date()
              return (
                <div key={prize.id} className="rounded-2xl overflow-hidden mb-3"
                  style={{
                    background: '#fff',
                    border: qualifies ? `2px solid ${brand.secondaryColor}` : '2px solid rgba(0,0,0,0.06)',
                    opacity: !qualifies ? 0.75 : 1,
                  }}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: qualifies ? 'rgba(27,79,114,0.08)' : '#f0f2f5' }}>
                          {prize.prize_type === 'cash' ? '💰' : prize.prize_type === 'item' ? '🎁' : '🏷️'}
                        </div>
                        <div>
                          <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>
                            {prize.prize_type === 'cash' ? 'Cash Prize' : prize.prize_type === 'item' ? 'Item Prize' : 'Discount Prize'}
                          </div>
                          <div className="text-base font-bold"
                            style={{ color: qualifies ? brand.primaryColor : 'rgba(0,0,0,0.35)' }}>
                            {prize.title}
                          </div>
                          {prize.prize_type === 'cash' && prize.prize_value && (
                            <div className="text-xs font-semibold"
                              style={{ color: qualifies ? brand.secondaryColor : 'rgba(0,0,0,0.3)' }}>
                              {fmt(prize.prize_value)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>Your code</div>
                        <div className="text-xs font-mono font-bold px-2 py-1 rounded-lg"
                          style={{
                            background: qualifies ? 'rgba(27,79,114,0.08)' : '#f0f2f5',
                            color: qualifies ? brand.primaryColor : 'rgba(0,0,0,0.3)',
                          }}>
                          {customer?.draw_code || '——'}
                        </div>
                      </div>
                    </div>

                    {prize.description && (
                      <div className="text-xs mb-3 leading-relaxed"
                        style={{ color: qualifies ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }}>
                        {prize.description}
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>Winners</div>
                        <div className="text-xs font-semibold"
                          style={{ color: qualifies ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
                          {prize.number_of_winners} {prize.number_of_winners === 1 ? 'winner' : 'winners'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>Min. balance</div>
                        <div className="text-xs font-semibold"
                          style={{ color: qualifies ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
                          {fmt(minBal)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>
                          {drawPassed ? 'Draw date' : 'Draw in'}
                        </div>
                        <div className="text-xs font-bold font-mono"
                          style={{ color: drawPassed ? 'rgba(0,0,0,0.4)' : qualifies ? '#D97706' : 'rgba(0,0,0,0.3)' }}>
                          {drawPassed
                            ? new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
                            : <PrizeCountdown drawDate={prize.draw_date} />
                          }
                        </div>
                      </div>
                    </div>

                    <div className="mb-1">
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(0,0,0,0.35)' }}>
                        <span>Qualification progress</span>
                        <span>{Math.min(progress, 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: '#f0f2f5' }}>
                        <div className="h-2 rounded-full transition-all"
                          style={{
                            width: Math.min(progress, 100) + '%',
                            background: qualifies ? '#16A34A' : brand.secondaryColor,
                          }} />
                      </div>
                    </div>

                    {qualifies ? (
                      <div className="text-xs font-semibold mt-2 text-center" style={{ color: '#16A34A' }}>
                        ✓ You qualify for this prize draw
                      </div>
                    ) : (
                      <div className="text-xs mt-2 text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>
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
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>Vouchers</div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {vouchers.length > 0 ? (current + 1) + ' of ' + vouchers.length : ''}
            </div>
          </div>

          {vouchers.length === 0 && (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
              <div className="text-2xl mb-2">🎫</div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                No vouchers available
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
                Vouchers for this campaign will appear here once they've been added.
              </div>
            </div>
          )}

          {vouchers.length > 0 && v && (
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{
                  background: current === 0 ? 'rgba(0,0,0,0.06)' : brand.primaryColor,
                  color: current === 0 ? 'rgba(0,0,0,0.2)' : '#fff',
                }}>
                &#8592;
              </button>

              <div className="flex-1 rounded-2xl overflow-hidden"
                style={{
                  background: '#fff',
                  border: (unlocked && !claimed) ? '2px solid ' + brand.secondaryColor : '2px solid rgba(0,0,0,0.06)',
                  opacity: (claimed || expired) ? 0.7 : 1,
                  filter: unlocked ? 'none' : 'grayscale(0.4)',
                }}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {logo ? (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src={logo} alt={merchantName} className="w-14 h-14 object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: 'rgba(27,79,114,0.06)' }}>🎫</div>
                    )}
                    <div>
                      <div className="text-xs mb-0.5"
                        style={{ color: unlocked ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)' }}>
                        {merchantName}
                      </div>
                      <div className="text-lg font-bold leading-tight"
                        style={{ color: unlocked ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
                        {v.title}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs mb-4 leading-relaxed"
                    style={{ color: unlocked ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' }}>
                    {v.description}
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>Minimum balance</div>
                      <div className="text-sm font-bold"
                        style={{ color: unlocked ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
                        {minBalDisplay(v)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>
                        {expired ? 'Status' : 'Expires in'}
                      </div>
                      <div className="text-xs font-bold font-mono"
                        style={{ color: expired ? '#DC2626' : claimed ? '#16A34A' : '#D97706' }}>
                        {expired ? 'Expired' : claimed ? 'Claimed' : (
                          campaign
                            ? <VoucherCountdown campaignStart={campaign.created_at} campaignEnd={campaign.target_date} fraction={v.expiry_offset_fraction} />
                            : '--'
                        )}
                      </div>
                    </div>
                  </div>

                  {claimed ? (
                    <div className="w-full py-3 rounded-xl text-sm font-bold text-center"
                      style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                      Claimed ✓
                    </div>
                  ) : expired ? (
                    <div className="w-full py-3 rounded-xl text-sm font-bold text-center"
                      style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                      Expired
                    </div>
                  ) : unlocked ? (
                    <button onClick={() => setClaimModal(v)}
                      className="w-full py-3 rounded-xl text-sm font-bold"
                      style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
                      Claim Voucher
                    </button>
                  ) : (
                    <div className="w-full py-3 rounded-xl text-xs font-semibold text-center"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.35)' }}>
                      {needMore > 0 ? `Save ${fmt(needMore)} more to unlock` : 'Locked'}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setCurrent(c => Math.min(vouchers.length - 1, c + 1))}
                disabled={current === vouchers.length - 1}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{
                  background: current === vouchers.length - 1 ? 'rgba(0,0,0,0.06)' : brand.primaryColor,
                  color: current === vouchers.length - 1 ? 'rgba(0,0,0,0.2)' : '#fff',
                }}>
                &#8594;
              </button>
            </div>
          )}

          {vouchers.length > 0 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {vouchers.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all"
                  style={{
                    width: i === current ? '20px' : '6px',
                    height: '6px',
                    background: i === current ? brand.primaryColor : 'rgba(0,0,0,0.15)',
                  }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1">
            <span className="text-lg leading-none"
              style={{ color: item.path === '/portal/rewards' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs"
              style={{
                color: item.path === '/portal/rewards' ? brand.primaryColor : 'rgba(0,0,0,0.3)',
                fontWeight: item.path === '/portal/rewards' ? 600 : 400,
              }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}