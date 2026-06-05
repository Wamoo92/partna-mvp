import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { brand } from '../../lib/brandConfig'

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

function Countdown({ campaignStart, campaignEnd, fraction }) {
  const [timeLeft, setTimeLeft] = useState('...')

  useEffect(() => {
    if (!campaignStart || !campaignEnd || fraction == null) {
      setTimeLeft('--')
      return
    }

    const start = new Date(campaignStart).getTime()
    const end = new Date(campaignEnd).getTime()
    const expiry = start + (end - start) * Number(fraction)

    function calc() {
      const diff = expiry - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(
        d + 'd ' +
        String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0')
      )
    }

    calc()
    const timer = setInterval(calc, 1000)
    return function() { clearInterval(timer) }
  }, [campaignStart, campaignEnd, fraction])

  return timeLeft
}

export default function Rewards({ customer }) {
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [vouchers, setVouchers] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimModal, setClaimModal] = useState(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [successVoucher, setSuccessVoucher] = useState(null)
  const [current, setCurrent] = useState(0)

  useEffect(function() {
    if (customer) loadAll()
  }, [customer])

  async function loadAll() {
    setLoading(true)

    try {
      const r1 = await supabase.from('campaigns').select('*').eq('id', CAMPAIGN_ID)
      if (r1.data && r1.data.length > 0) setCampaign(r1.data[0])
    } catch(e) {}

    try {
      const r2 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r2.data && r2.data.length > 0) setWallet(r2.data[0])
    } catch(e) {}

    try {
      const r3 = await supabase.from('vouchers').select('*').eq('campaign_id', CAMPAIGN_ID).eq('is_active', true)
      if (r3.data) {
        const r5 = await supabase.from('merchants').select('id, name')
        const merchantMap = {}
        if (r5.data) r5.data.forEach(function(m) { merchantMap[m.id] = m.name })
        const withMerchants = r3.data.map(function(v) {
          return Object.assign({}, v, { merchants: { name: merchantMap[v.merchant_id] || '' } })
        })
        setVouchers(withMerchants)
      }
    } catch(e) {}

    try {
      const r4 = await supabase.from('voucher_claims').select('voucher_id').eq('customer_id', customer.id)
      if (r4.data) setClaims(r4.data.map(function(c) { return c.voucher_id }))
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

  function isUnlocked(v) {
    const minBal = target * (Number(v.min_balance_percentage) / 100)
    return balance >= minBal && !isExpiredByFraction(v.expiry_offset_fraction)
  }

  function isClaimed(v) {
    return claims.includes(v.id)
  }

  function minBalDisplay(v) {
    return fmt(target * Number(v.min_balance_percentage) / 100)
  }

  function polarXY(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arc(cx, cy, r, a1, a2) {
    const s = polarXY(cx, cy, r, a1)
    const e = polarXY(cx, cy, r, a2)
    return 'M ' + s.x + ' ' + s.y + ' A ' + r + ' ' + r + ' 0 ' + (a2 - a1 > 180 ? 1 : 0) + ' 1 ' + e.x + ' ' + e.y
  }

  const segs = [
    { start: 0, end: 90, m: 10, color: '#F59E0B' },
    { start: 93, end: 183, m: 25, color: '#D97706' },
    { start: 186, end: 276, m: 50, color: '#16A34A' },
    { start: 279, end: 369, m: 75, color: '#15803D' },
  ]

  async function handleClaim() {
    if (!claimModal || !termsChecked) return
    setClaiming(true)
    const res = await supabase.from('voucher_claims').insert({
      voucher_id: claimModal.id,
      customer_id: customer.id,
    })
    if (!res.error) {
      setClaims(claims.concat([claimModal.id]))
      setSuccessVoucher(claimModal)
      setClaimModal(null)
      setTermsChecked(false)
    }
    setClaiming(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const v = vouchers[current] || null
  const unlocked = v ? isUnlocked(v) : false
  const claimed = v ? isClaimed(v) : false
  const expired = v ? isExpiredByFraction(v.expiry_offset_fraction) : false
  const merchantName = v && v.merchants ? v.merchants.name : ''
  const logo = v ? getMerchantLogo(merchantName) : null
  const needMore = v ? (target * Number(v.min_balance_percentage) / 100) - balance : 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {successVoucher && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{ background: brand.primaryColor }}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"
            style={{ background: '#fff', border: '3px solid ' + brand.secondaryColor }}>
            <div className="text-4xl mb-3">🎉</div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {successVoucher.merchants ? successVoucher.merchants.name : ''}
            </div>
            <div className="text-2xl font-bold mb-2" style={{ color: brand.primaryColor }}>
              {successVoucher.title}
            </div>
            <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {successVoucher.description}
            </div>
            <div className="text-xs px-4 py-2 rounded-xl mb-3"
              style={{ background: 'rgba(27,79,114,0.07)', color: brand.primaryColor }}>
              St. Catherines Savings Program - Powered by Partna
            </div>
            <div className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {successVoucher.terms_and_conditions}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
              {customer ? customer.first_name + ' ' + customer.last_name : ''}
            </div>
          </div>
          <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Screenshot to save</p>
          <button onClick={function() { setSuccessVoucher(null) }}
            className="mt-4 px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
            Done
          </button>
        </div>
      )}

      {claimModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-5"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#fff' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  {claimModal.merchants ? claimModal.merchants.name : ''}
                </div>
                <div className="text-base font-bold" style={{ color: brand.primaryColor }}>
                  {claimModal.title}
                </div>
              </div>
              <button onClick={function() { setClaimModal(null); setTermsChecked(false) }}
                className="text-lg ml-3" style={{ color: 'rgba(0,0,0,0.3)' }}>x</button>
            </div>
            <div className="text-xs px-3 py-2 rounded-xl mb-4 leading-relaxed"
              style={{ background: 'rgba(27,79,114,0.06)', color: 'rgba(0,0,0,0.6)' }}>
              {claimModal.terms_and_conditions}
            </div>
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={termsChecked}
                onChange={function(e) { setTermsChecked(e.target.checked) }}
                className="mt-0.5 w-4 h-4 flex-shrink-0" />
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>
                I agree to the terms and conditions
              </span>
            </label>
            <div className="flex gap-3">
              <button onClick={function() { setClaimModal(null); setTermsChecked(false) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: brand.primaryColor }}>Cancel</button>
              <button onClick={handleClaim} disabled={!termsChecked || claiming}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: (!termsChecked || claiming) ? 'rgba(27,79,114,0.3)' : brand.primaryColor,
                  color: '#fff'
                }}>
                {claiming ? 'Claiming' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={function() { navigate('/portal/home') }} className="text-white text-xl">&#8592;</button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Rewards</div>
        </div>
      </header>

      <div className="flex flex-col items-center pt-6 pb-8 px-5" style={{ background: brand.primaryColor }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          {segs.map(function(s, i) {
            return (
              <path key={i} d={arc(80, 80, 62, s.start, s.end)} fill="none"
                stroke={pct >= s.m ? s.color : 'rgba(255,255,255,0.15)'}
                strokeWidth="14" strokeLinecap="round" />
            )
          })}
          <text x="80" y="74" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
            {pct.toFixed(0)}%
          </text>
          <text x="80" y="92" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10">
            of goal
          </text>
        </svg>

        <div className="flex gap-3 mt-2">
          {segs.map(function(s) {
            return (
              <div key={s.m} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: pct >= s.m ? s.color : 'rgba(255,255,255,0.25)' }} />
                <span className="text-xs" style={{ color: pct >= s.m ? s.color : 'rgba(255,255,255,0.4)' }}>
                  {s.m}%
                </span>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-3">
          <div className="text-white text-sm font-semibold">{fmt(balance)} saved</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Save more to unlock better vouchers
          </div>
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 px-4 py-5" style={{ background: '#f0f2f5', marginTop: '-16px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>Vouchers</div>
          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {vouchers.length > 0 ? (current + 1) + ' of ' + vouchers.length : ''}
          </div>
        </div>

        {vouchers.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'rgba(0,0,0,0.4)' }}>
            No vouchers available
          </div>
        )}

        {vouchers.length > 0 && v && (
          <div className="flex items-center gap-3">

            <button onClick={function() { setCurrent(function(c) { return Math.max(0, c - 1) }) }}
              disabled={current === 0}
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
              }}>

              <div className="p-4">

                <div className="flex items-center gap-3 mb-4">
                  {logo && (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: '#f8f8f8' }}>
                      <img src={logo} alt={merchantName}
                        className="w-14 h-14 object-contain" />
                    </div>
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
                    <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>
                      Minimum balance
                    </div>
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
    ? <Countdown
        campaignStart={campaign.created_at}
        campaignEnd={campaign.target_date}
        fraction={v.expiry_offset_fraction}
      />
    : '--'
)}
                    </div>
                  </div>
                </div>

                {claimed ? (
                  <div className="w-full py-3 rounded-xl text-sm font-bold text-center"
                    style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                    Claimed
                  </div>
                ) : expired ? (
                  <div className="w-full py-3 rounded-xl text-sm font-bold text-center"
                    style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                    Expired
                  </div>
                ) : unlocked ? (
                  <button onClick={function() { setClaimModal(v) }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
                    Claim Voucher
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-xl text-xs font-semibold text-center"
                    style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.35)' }}>
                    Save {fmt(needMore)} more to unlock
                  </div>
                )}
              </div>
            </div>

            <button onClick={function() { setCurrent(function(c) { return Math.min(vouchers.length - 1, c + 1) }) }}
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
            {vouchers.map(function(_, i) {
              return (
                <button key={i} onClick={function() { setCurrent(i) }}
                  className="rounded-full"
                  style={{
                    width: i === current ? '20px' : '6px',
                    height: '6px',
                    background: i === current ? brand.primaryColor : 'rgba(0,0,0,0.15)',
                  }} />
              )
            })}
          </div>
        )}
      </div>

      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map(function(item) {
          return (
            <button key={item.path} onClick={function() { navigate(item.path) }} className="flex flex-col items-center gap-1">
              <span className="text-lg leading-none"
                style={{ color: item.path === '/portal/rewards' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
                {item.icon}
              </span>
              <span className="text-xs"
                style={{
                  color: item.path === '/portal/rewards' ? brand.primaryColor : 'rgba(0,0,0,0.3)',
                  fontWeight: item.path === '/portal/rewards' ? 600 : 400
                }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
