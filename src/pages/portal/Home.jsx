import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function Home({ customer, signOut }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [card, setCard] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [cardFlipped, setCardFlipped] = useState(false)

  useEffect(() => {
    if (customer) fetchData()
  }, [customer])

  async function fetchData() {
    setLoading(true)
    try {
      const campaignId = customer.campaign_id || 'b1b2c3d4-0000-0000-0000-000000000001'

      const r1 = await supabase.from('campaigns').select('*').eq('id', campaignId)
      if (r1.data && r1.data.length > 0) setCampaign(r1.data[0])

      const r2 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r2.data && r2.data.length > 0) setWallet(r2.data[0])

      const r3 = await supabase.from('cards').select('*').eq('customer_id', customer.id)
      if (r3.data && r3.data.length > 0) setCard(r3.data[0])

      const r4 = await supabase.from('transactions').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(5)
      setTransactions(r4.data || [])

    } catch (err) {
      console.error('Error fetching home data:', err)
    } finally {
      setLoading(false)
    }
  }

  const balance = wallet ? Number(wallet.balance) : 0
  const target = campaign ? Number(campaign.target_amount) : 1500000
  const progress = Math.min((balance / target) * 100, 100)
  const remaining = Math.max(target - balance, 0)
  const daysRemaining = campaign?.target_date
    ? Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0)
    : 0

  const kycPending = customer?.kyc_status === 'pending'

  function formatUGX(amount) {
    return 'UGX ' + Number(amount).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-UG', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
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

  function txIcon(type) {
    switch (type) {
      case 'deposit': return '↓'
      case 'payment': return '↑'
      case 'withdrawal': return '↑'
      default: return '·'
    }
  }

  function txColor(type) {
    return type === 'deposit' ? '#16A34A' : '#DC2626'
  }

  function getRewardsStrip() {
    if (!wallet || !campaign) return null
    const pct = (balance / target) * 100
    if (pct >= 75) {
      return {
        title: '🎯 Next voucher at 100%',
        body: 'Save ' + formatUGX(Math.max(target - balance, 0)) + ' more to reach your savings goal',
      }
    } else if (pct >= 50) {
      return {
        title: '🎯 Next voucher at 75%',
        body: 'Save ' + formatUGX(Math.max(target * 0.75 - balance, 0)) + ' more to unlock your next voucher',
      }
    } else if (pct >= 25) {
      return {
        title: '🎯 Next voucher at 50%',
        body: 'Save ' + formatUGX(Math.max(target * 0.50 - balance, 0)) + ' more to unlock your next voucher',
      }
    } else {
      return {
        title: '🎯 First voucher at 25%',
        body: 'Save ' + formatUGX(Math.max(target * 0.25 - balance, 0)) + ' more to unlock your first voucher',
      }
    }
  }

  const rewardsStrip = getRewardsStrip()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  const CARD_W = 300
  const CARD_H = 190

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center justify-between px-4 py-3" style={{ background: brand.primaryColor }}>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt={brand.businessName} className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-white text-xs font-semibold">{brand.businessName}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Savings Program</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { signOut(); navigate('/portal') }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            Log out
          </button>
          <button
            onClick={() => navigate('/portal/profile')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
            {customer?.first_name?.[0]}{customer?.last_name?.[0]}
          </button>
        </div>
      </header>

      {kycPending && (
        <button
          onClick={() => navigate('/portal/kyc')}
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

      <div className="px-5 pt-5 pb-10" style={{ background: brand.primaryColor }}>
        <div className="mb-4">
          <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Welcome back, {customer?.first_name}
          </div>
          <div className="text-white text-3xl font-bold mb-0.5">{formatUGX(balance)}</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            saved toward {campaign?.name}
          </div>
        </div>

        <div className="flex justify-center mb-5">
          <div className="cursor-pointer"
            style={{ perspective: '800px', width: `${CARD_W}px`, height: `${CARD_H}px` }}
            onClick={() => setCardFlipped(!cardFlipped)}>
            <div style={{
              width: `${CARD_W}px`, height: `${CARD_H}px`,
              position: 'relative', transformStyle: 'preserve-3d',
              transition: 'transform 0.6s ease',
              transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                background: brand.primaryColor, border: `2px solid ${brand.secondaryColor}`,
              }}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, transparent 60%)' }} />
                <div className="absolute top-4 left-4">
                  <img src={brand.logoUrl} alt="" className="object-contain"
                    style={{ width: '36px', height: '36px', mixBlendMode: 'screen' }} />
                </div>
                <div className="absolute top-4 right-4 flex">
                  <div className="w-7 h-7 rounded-full opacity-90" style={{ background: '#EB001B' }} />
                  <div className="w-7 h-7 rounded-full opacity-90 -ml-3" style={{ background: '#F79E1B' }} />
                </div>
                <div className="absolute rounded"
                  style={{ width: '40px', height: '28px', top: '70px', left: '16px', background: 'linear-gradient(135deg,#EDE5A6,#CFA255)' }} />
                <div className="absolute font-mono font-semibold tracking-widest"
                  style={{ bottom: '44px', left: '16px', right: '16px', color: 'rgba(255,255,255,0.9)', fontSize: '15px', letterSpacing: '2px' }}>
                  {formatCardNumber(card?.card_number)}
                </div>
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
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginBottom: '2px' }}>EXPIRES</div>
                    <div className="font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>
                      {formatExpiry(card?.expiry_date)}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-1 left-0 right-0 text-center"
                  style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px' }}>tap to flip</div>
              </div>

              <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)', background: '#0f2d40',
                border: `2px solid ${brand.secondaryColor}`,
              }}>
                <div className="absolute w-full" style={{ height: '40px', top: '28px', background: '#111' }} />
                <div className="absolute flex items-center" style={{ top: '86px', left: '16px', right: '16px' }}>
                  <div className="flex-1 rounded-l"
                    style={{ height: '32px', background: 'repeating-linear-gradient(90deg, #e8e8e8 0px, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
                  <div className="rounded-r flex items-center justify-center font-mono font-bold"
                    style={{ width: '48px', height: '32px', background: '#fff', color: '#333', fontSize: '14px' }}>
                    {card?.cvv || '•••'}
                  </div>
                </div>
                <div className="absolute text-right"
                  style={{ top: '122px', right: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>CVV</div>
                <div className="absolute font-mono"
                  style={{ bottom: '28px', left: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '1px' }}>
                  {formatCardNumber(card?.card_number)}
                </div>
                <div className="absolute"
                  style={{ bottom: '12px', left: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>
                  Valid thru {formatExpiry(card?.expiry_date)}
                </div>
                <div className="absolute bottom-4 right-4 flex">
                  <div className="w-6 h-6 rounded-full opacity-70" style={{ background: '#EB001B' }} />
                  <div className="w-6 h-6 rounded-full opacity-70 -ml-2" style={{ background: '#F79E1B' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            <span>{progress.toFixed(0)}% of goal</span>
            <span>{formatUGX(target)}</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-2 rounded-full transition-all" style={{
              width: `${progress}%`,
              background: progress >= 75 ? '#22C55E' : progress >= 50 ? brand.secondaryColor : '#F59E0B',
            }} />
          </div>
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span>{formatUGX(remaining)} remaining</span>
          <span>{daysRemaining} days left</span>
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col gap-4 px-5 py-5"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {rewardsStrip && (
          <div className="rounded-2xl px-4 py-3"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}>
            <div className="text-xs font-semibold mb-0.5" style={{ color: brand.primaryColor }}>
              {rewardsStrip.title}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {rewardsStrip.body}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex flex-col gap-3" style={{ width: '140px', flexShrink: 0 }}>
            <button
              onClick={() => kycPending ? navigate('/portal/kyc') : navigate('/portal/add-money')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-light"
                style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}>
                {kycPending ? '🔒' : '+'}
              </div>
              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Add money</span>
            </button>

            <button onClick={() => navigate('/portal/pay')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{ background: brand.primaryColor }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <span className="text-white text-lg">↑</span>
              </div>
              <span className="text-xs font-semibold text-white">Pay fees</span>
            </button>

            <button
              onClick={() => kycPending ? navigate('/portal/kyc') : navigate('/portal/withdraw')}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl"
              style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}>
                {kycPending ? '🔒' : '↓'}
              </div>
              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Withdraw</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: brand.primaryColor }}>Recent activity</div>
              <button onClick={() => navigate('/portal/transactions')}
                className="text-xs font-semibold" style={{ color: brand.secondaryColor }}>
                See all
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden flex-1" style={{ background: '#fff' }}>
              {transactions.length === 0 ? (
                <div className="px-4 py-6 text-center h-full flex flex-col items-center justify-center">
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    No transactions yet. Add money to get started.
                  </div>
                </div>
              ) : (
                transactions.map((txn, i) => (
                  <div key={txn.id} className="flex items-center justify-between px-3 py-2.5"
                    style={{ borderBottom: i < transactions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                        {txIcon(txn.type)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold capitalize" style={{ color: '#333' }}>
                          {txn.type === 'payment' ? 'Fee payment' : txn.type}
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

        <button onClick={() => navigate('/portal/card')}
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

      </div>

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
              fontWeight: item.path === '/portal/home' ? 600 : 400
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}