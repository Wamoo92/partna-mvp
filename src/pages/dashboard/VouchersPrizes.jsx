import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

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

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Business card visual ──
function BusinessCard({ business, card, wallet }) {
  const [flipped, setFlipped] = useState(false)
  const balance = wallet ? Number(wallet.balance) : 0

  return (
    <div>
      <div className="cursor-pointer w-full"
        style={{ perspective: '1000px', height: '200px' }}
        onClick={() => setFlipped(!flipped)}>
        <div style={{
          width: '100%', height: '200px', position: 'relative',
          transformStyle: 'preserve-3d', transition: 'transform 0.6s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front */}
          <div className="rounded-2xl absolute inset-0 overflow-hidden"
            style={{
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              background: business?.primary_color || PARTNA_PRIMARY,
              border: `2px solid ${business?.secondary_color || PARTNA_GOLD}`,
            }}>
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, transparent 60%)' }} />
            <div className="absolute top-4 left-4">
              {business?.logo_url && business.logo_url !== '/partna-icon.svg' ? (
                <img src={business.logo_url} alt="" className="w-10 h-10 object-contain"
                  style={{ mixBlendMode: 'screen' }} />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  {business?.name?.[0] || 'B'}
                </div>
              )}
            </div>
            <div className="absolute top-4 right-4 flex">
              <div className="w-8 h-8 rounded-full opacity-90" style={{ background: '#EB001B' }} />
              <div className="w-8 h-8 rounded-full opacity-90 -ml-3" style={{ background: '#F79E1B' }} />
            </div>
            <div className="absolute rounded"
              style={{ width: '44px', height: '32px', top: '72px', left: '20px', background: 'linear-gradient(135deg,#EDE5A6,#CFA255)' }} />
            <div className="absolute font-mono font-semibold"
              style={{ bottom: '52px', left: '20px', right: '20px', color: 'rgba(255,255,255,0.9)', fontSize: '15px', letterSpacing: '2px' }}>
              {formatCardNumber(card?.card_number)}
            </div>
            <div className="absolute flex justify-between items-end"
              style={{ bottom: '18px', left: '20px', right: '20px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginBottom: '2px' }}>BUSINESS</div>
                <div className="font-semibold uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
                  {business?.name?.slice(0, 22)}
                </div>
              </div>
              <div className="text-right">
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginBottom: '2px' }}>EXPIRES</div>
                <div className="font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
                  {formatExpiry(card?.expiry_date)}
                </div>
              </div>
            </div>
            <div className="absolute bottom-1 left-0 right-0 text-center"
              style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>tap to flip</div>
          </div>
          {/* Back */}
          <div className="rounded-2xl absolute inset-0 overflow-hidden"
            style={{
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)', background: '#0f2d40',
              border: `2px solid ${business?.secondary_color || PARTNA_GOLD}`,
            }}>
            <div className="absolute w-full" style={{ height: '44px', top: '30px', background: '#111' }} />
            <div className="absolute flex items-center"
              style={{ top: '92px', left: '20px', right: '20px' }}>
              <div className="flex-1 rounded-l"
                style={{ height: '36px', background: 'repeating-linear-gradient(90deg, #e8e8e8 0px, #e8e8e8 4px, #ccc 4px, #ccc 8px)' }} />
              <div className="rounded-r flex items-center justify-center font-mono font-bold"
                style={{ width: '56px', height: '36px', background: '#fff', color: '#333', fontSize: '16px' }}>
                {card?.cvv || '•••'}
              </div>
            </div>
            <div className="absolute text-right"
              style={{ top: '132px', right: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>CVV</div>
            <div className="absolute font-mono"
              style={{ bottom: '36px', left: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '1px' }}>
              {formatCardNumber(card?.card_number)}
            </div>
            <div className="absolute"
              style={{ bottom: '18px', left: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
              Valid thru {formatExpiry(card?.expiry_date)}
            </div>
            <div className="absolute bottom-5 right-4 flex">
              <div className="w-7 h-7 rounded-full opacity-70" style={{ background: '#EB001B' }} />
              <div className="w-7 h-7 rounded-full opacity-70 -ml-2" style={{ background: '#F79E1B' }} />
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs mt-2 text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>Tap to flip</p>
    </div>
  )
}

export default function VouchersPrizes({ admin, business }) {
  const [tab, setTab] = useState('vouchers')
  const [loading, setLoading] = useState(true)

  // Vouchers
  const [allVouchers, setAllVouchers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campaignVouchers, setCampaignVouchers] = useState([]) // junction records
  const [currentVoucherIdx, setCurrentVoucherIdx] = useState(0)
  const [showApplyModal, setShowApplyModal] = useState(null) // voucher obj
  const [showRemoveModal, setShowRemoveModal] = useState(null) // { voucher, campaignVoucher }
  const [applyingCampaignId, setApplyingCampaignId] = useState('')
  const [applying, setApplying] = useState(false)

  // Prizes
  const [prizes, setPrizes] = useState([])
  const [prizeDraws, setPrizeDraws] = useState([])
  const [businessCard, setBusinessCard] = useState(null)
  const [businessWallet, setBusinessWallet] = useState(null)
  const [businessTxns, setBusinessTxns] = useState([])
  const [customers, setCustomers] = useState([])

  // Add money modal
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addNetwork, setAddNetwork] = useState('mtn')
  const [addPhone, setAddPhone] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState(false)

  // Withdraw modal
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)

  // Prize draw
  const [showRunDraw, setShowRunDraw] = useState(null)
  const [drawLoading, setDrawLoading] = useState(false)
  const [drawResult, setDrawResult] = useState(null)

  // Add prize modal
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [prizeCampaignId, setPrizeCampaignId] = useState('')
  const [prizeTitle, setPrizeTitle] = useState('')
  const [prizeDescription, setPrizeDescription] = useState('')
  const [prizeType, setPrizeType] = useState('item')
  const [prizeValue, setPrizeValue] = useState('')
  const [prizeWinners, setPrizeWinners] = useState(1)
  const [prizeDate, setPrizeDate] = useState('')
  const [prizeMinPct, setPrizeMinPct] = useState(50)
  const [savingPrize, setSavingPrize] = useState(false)

  useEffect(() => {
    if (business) loadAll()
  }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      // Campaigns
      const { data: campData } = await supabase
        .from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campData || [])
      const campaignIds = campData?.map(c => c.id) || []

      // All vouchers with merchant info
      const { data: vData } = await supabase
        .from('vouchers').select('*, merchants(id, name, category)')
        .eq('is_active', true)
      setAllVouchers(vData || [])

      // Campaign voucher assignments
      if (campaignIds.length > 0) {
        const { data: cvData } = await supabase
          .from('campaign_vouchers').select('*').in('campaign_id', campaignIds)
        setCampaignVouchers(cvData || [])
      }

      // Prizes
      if (campaignIds.length > 0) {
        const { data: prizeData } = await supabase
          .from('prizes').select('*, campaigns(name)').in('campaign_id', campaignIds)
          .order('created_at', { ascending: false })
        setPrizes(prizeData || [])

        const prizeIds = prizeData?.map(p => p.id) || []
        if (prizeIds.length > 0) {
          const { data: drawData } = await supabase
            .from('prize_draws').select('*, prizes(title)').in('prize_id', prizeIds)
            .order('drawn_at', { ascending: false })
          setPrizeDraws(drawData || [])
        }
      }

      // Business wallet + card
      const { data: walletData } = await supabase
        .from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      setBusinessWallet(walletData)

      const { data: cardData } = await supabase
        .from('business_cards').select('*').eq('business_id', business.id).maybeSingle()
      setBusinessCard(cardData)

      // Business transactions
      if (walletData) {
        const { data: txnData } = await supabase
          .from('business_transactions').select('*').eq('business_id', business.id)
          .order('created_at', { ascending: false }).limit(10)
        setBusinessTxns(txnData || [])
      }

      // Customers for prize draw
      const { data: custData } = await supabase
        .from('customers').select('id, first_name, last_name, draw_code')
        .eq('business_id', business.id)
      setCustomers(custData || [])

    } catch (e) {
      console.error('VouchersPrizes load error:', e)
    }
    setLoading(false)
  }

  // ── Subscription package limits ──
  const subPkg = business?.subscription_package || 'starter'
  const pkgLimits = {
    starter: { maxVouchers: 3, prizes: false },
    growth: { maxVouchers: 8, prizes: true, cashPrizes: false },
    enterprise: { maxVouchers: null, prizes: true, cashPrizes: true },
  }
  const limits = pkgLimits[subPkg] || pkgLimits.starter

  function isVoucherUnlocked(voucher) {
    // Unlocked if within package voucher limit (count applied to any campaign)
    if (limits.maxVouchers === null) return true
    const appliedCount = campaignVouchers.filter(cv =>
      campaigns.some(c => c.id === cv.campaign_id) &&
      cv.voucher_id === voucher.id
    ).length
    const totalApplied = campaignVouchers.filter(cv =>
      campaigns.some(c => c.id === cv.campaign_id)
    ).length
    return totalApplied < limits.maxVouchers || appliedCount > 0
  }

  function getVoucherCampaigns(voucherId) {
    return campaignVouchers
      .filter(cv => cv.voucher_id === voucherId)
      .map(cv => ({ cv, campaign: campaigns.find(c => c.id === cv.campaign_id) }))
      .filter(x => x.campaign)
  }

  async function handleApplyVoucher() {
    if (!showApplyModal || !applyingCampaignId) return
    setApplying(true)
    try {
      await supabase.from('campaign_vouchers').insert({
        campaign_id: applyingCampaignId,
        voucher_id: showApplyModal.id,
      })
      setShowApplyModal(null)
      setApplyingCampaignId('')
      await loadAll()
    } catch (e) {
      console.error('Apply voucher error:', e)
    }
    setApplying(false)
  }

  async function handleRemoveVoucher() {
    if (!showRemoveModal) return
    await supabase.from('campaign_vouchers').delete().eq('id', showRemoveModal.cv.id)
    setShowRemoveModal(null)
    await loadAll()
  }

  // ── Add money ──
  async function handleAddMoney() {
    setAddError('')
    const amount = parseInt(addAmount.replace(/,/g, ''), 10)
    if (!amount || amount < 1000) { setAddError('Minimum deposit is UGX 1,000.'); return }
    if (!addPhone || addPhone.replace(/\s/g, '').length < 10) { setAddError('Please enter a valid phone number.'); return }
    setAddLoading(true)
    try {
      let wallet = businessWallet
      if (!wallet) {
        const { data } = await supabase.from('business_wallets')
          .insert({ business_id: business.id, balance: 0 }).select().single()
        wallet = data
        setBusinessWallet(data)
      }
      const newBalance = Number(wallet.balance) + amount
      await supabase.from('business_wallets').update({ balance: newBalance }).eq('id', wallet.id)
      await supabase.from('business_transactions').insert({
        business_id: business.id,
        wallet_id: wallet.id,
        type: 'deposit',
        amount,
        status: 'completed',
        notes: `${addNetwork === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}: ${addPhone}`,
      })
      setAddSuccess(true)
      setAddAmount('')
      setAddPhone('')
      await loadAll()
    } catch (e) {
      setAddError('Could not process payment. Please try again.')
    }
    setAddLoading(false)
  }

  // ── Withdraw ──
  async function handleWithdraw() {
    setWithdrawError('')
    const amount = parseInt(withdrawAmount.replace(/,/g, ''), 10)
    const balance = businessWallet ? Number(businessWallet.balance) : 0
    if (!amount || amount < 1000) { setWithdrawError('Minimum withdrawal is UGX 1,000.'); return }
    if (amount > balance) { setWithdrawError('Amount exceeds your prize pot balance.'); return }
    if (!bankName || !accountName || !accountNumber) { setWithdrawError('Please fill in all bank details.'); return }
    setWithdrawLoading(true)
    try {
      const newBalance = balance - amount
      await supabase.from('business_wallets').update({ balance: newBalance }).eq('id', businessWallet.id)
      await supabase.from('business_transactions').insert({
        business_id: business.id,
        wallet_id: businessWallet.id,
        type: 'withdrawal',
        amount,
        status: 'completed',
        notes: `Bank: ${bankName} | ${accountName} | ${accountNumber}`,
      })
      setWithdrawSuccess(true)
      setWithdrawAmount('')
      setBankName('')
      setAccountName('')
      setAccountNumber('')
      await loadAll()
    } catch (e) {
      setWithdrawError('Could not process withdrawal. Please try again.')
    }
    setWithdrawLoading(false)
  }

  // ── Prize draw ──
  async function handleRunDraw(prize) {
    setDrawLoading(true)
    setDrawResult(null)
    try {
      const { data: wallets } = await supabase
        .from('wallets').select('customer_id, balance').in('customer_id', customers.map(c => c.id))
      const campaign = campaigns.find(c => c.id === prize.campaign_id)
      const minBalance = campaign
        ? Number(campaign.target_amount) * (Number(prize.min_balance_percentage) / 100) : 0
      const qualifying = wallets?.filter(w => Number(w.balance) >= minBalance) || []
      if (qualifying.length === 0) {
        setDrawResult({ error: 'No customers qualify for this draw yet.' })
        setDrawLoading(false)
        return
      }
      const winners = []
      const pool = [...qualifying]
      for (let i = 0; i < Math.min(prize.number_of_winners, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length)
        winners.push(pool.splice(idx, 1)[0])
      }
      for (const winner of winners) {
        const customer = customers.find(c => c.id === winner.customer_id)
        await supabase.from('prize_draws').insert({
          prize_id: prize.id,
          winner_customer_id: winner.customer_id,
          winning_code: customer?.draw_code || 'UNKNOWN',
          drawn_at: new Date().toISOString(),
          prize_type: prize.prize_type,
          status: 'pending',
        })
        if (prize.prize_type === 'cash' && prize.prize_value && businessWallet) {
          const { data: cWallet } = await supabase
            .from('wallets').select('*').eq('customer_id', winner.customer_id).single()
          if (cWallet) {
            await supabase.from('wallets').update({ balance: Number(cWallet.balance) + Number(prize.prize_value) }).eq('id', cWallet.id)
            const newPotBalance = Math.max(0, Number(businessWallet.balance) - Number(prize.prize_value))
            await supabase.from('business_wallets').update({ balance: newPotBalance }).eq('id', businessWallet.id)
          }
        }
      }
      setDrawResult({
        winners: winners.map(w => {
          const c = customers.find(cu => cu.id === w.customer_id)
          return { name: c ? `${c.first_name} ${c.last_name}` : 'Unknown', code: c?.draw_code || '—' }
        }),
        total: qualifying.length
      })
      await loadAll()
    } catch (e) {
      setDrawResult({ error: 'Something went wrong running the draw.' })
    }
    setDrawLoading(false)
  }

  // ── Save prize ──
  async function handleSavePrize() {
    if (!prizeCampaignId || !prizeTitle || !prizeDate) return
    setSavingPrize(true)
    await supabase.from('prizes').insert({
      campaign_id: prizeCampaignId,
      business_id: business.id,
      title: prizeTitle,
      description: setPrizeDescription || null,
      prize_type: prizeType,
      prize_value: prizeType === 'cash' ? parseInt(prizeValue.replace(/,/g, ''), 10) : null,
      draw_date: new Date(prizeDate).toISOString(),
      number_of_winners: prizeWinners,
      min_balance_percentage: prizeMinPct,
      is_active: true,
    })
    setShowAddPrize(false)
    setPrizeCampaignId(''); setPrizeTitle(''); setPrizeDescription('')
    setPrizeType('item'); setPrizeValue(''); setPrizeWinners(1)
    setPrizeDate(''); setPrizeMinPct(50)
    setSavingPrize(false)
    await loadAll()
  }

  const currentVoucher = allVouchers[currentVoucherIdx] || null
  const walletBalance = businessWallet ? Number(businessWallet.balance) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* ── ADD MONEY MODAL ── */}
      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
              <div className="flex items-center justify-between">
                <div className="text-white text-base font-bold">Add money to prize pot</div>
                <button onClick={() => { setShowAddMoney(false); setAddSuccess(false); setAddError(''); setAddAmount('') }}
                  className="text-white text-xl opacity-70">✕</button>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {addSuccess ? (
                <>
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Payment received</div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Prize pot balance updated.</div>
                  </div>
                  <button onClick={() => { setShowAddMoney(false); setAddSuccess(false) }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>Done</button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Amount (UGX)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                      <input type="text" inputMode="numeric" placeholder="0" value={addAmount}
                        onChange={e => setAddAmount(formatAmountInput(e.target.value))}
                        className="w-full pl-14 pr-4 py-3 rounded-xl text-xl font-bold outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }} />
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Minimum: UGX 1,000</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: PARTNA_PRIMARY }}>
                      Select network
                    </label>
                    <div className="flex gap-3">
                      {[{ id: 'mtn', logo: '/mtn-logo.svg', label: 'MTN MoMo' }, { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' }].map(net => (
                        <button key={net.id} onClick={() => setAddNetwork(net.id)}
                          className="flex-1 rounded-2xl p-3 flex flex-col items-center gap-2"
                          style={{ background: '#f8f9fa', border: addNetwork === net.id ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)' }}>
                          <img src={net.logo} alt={net.label} className="w-10 h-10 object-contain rounded-xl" />
                          <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{net.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Mobile money number</label>
                    <input type="tel" placeholder="+256 7XX XXX XXX" value={addPhone}
                      onChange={e => setAddPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  {addError && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{addError}</div>}
                  <button onClick={handleAddMoney} disabled={addLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: addLoading ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                    {addLoading ? 'Processing...' : `Add ${addAmount ? 'UGX ' + addAmount : 'money'}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WITHDRAW MODAL ── */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
              <div className="flex items-center justify-between">
                <div className="text-white text-base font-bold">Withdraw from prize pot</div>
                <button onClick={() => { setShowWithdraw(false); setWithdrawSuccess(false); setWithdrawError(''); setWithdrawAmount('') }}
                  className="text-white text-xl opacity-70">✕</button>
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Available: {formatUGX(walletBalance)}
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {withdrawSuccess ? (
                <>
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Withdrawal submitted</div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      Funds will be transferred to your bank account within 1–2 business days.
                    </div>
                  </div>
                  <button onClick={() => { setShowWithdraw(false); setWithdrawSuccess(false) }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>Done</button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Amount (UGX)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                      <input type="text" inputMode="numeric" placeholder="0" value={withdrawAmount}
                        onChange={e => setWithdrawAmount(formatAmountInput(e.target.value))}
                        className="w-full pl-14 pr-4 py-3 rounded-xl text-xl font-bold outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }} />
                    </div>
                  </div>
                  <div className="text-xs font-bold pt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>BANK DETAILS</div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Bank name</label>
                    <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                      placeholder="e.g. Stanbic Bank Uganda"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Account name</label>
                    <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                      placeholder="Name on bank account"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Account number</label>
                    <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                      placeholder="Bank account number"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  {withdrawError && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{withdrawError}</div>}
                  <button onClick={handleWithdraw} disabled={withdrawLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: withdrawLoading ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                    {withdrawLoading ? 'Processing...' : 'Withdraw to bank'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── APPLY VOUCHER MODAL ── */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Apply to campaign</div>
              <button onClick={() => { setShowApplyModal(null); setApplyingCampaignId('') }}
                className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Applying <strong>{showApplyModal.title}</strong> to a campaign
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {campaigns.length === 0 ? (
                <div className="text-xs text-center py-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  No campaigns yet. Create a campaign first.
                </div>
              ) : campaigns.map(c => {
                const alreadyApplied = campaignVouchers.some(cv => cv.campaign_id === c.id && cv.voucher_id === showApplyModal.id)
                return (
                  <button key={c.id}
                    onClick={() => !alreadyApplied && setApplyingCampaignId(c.id)}
                    disabled={alreadyApplied}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                    style={{
                      background: applyingCampaignId === c.id ? 'rgba(27,79,114,0.08)' : '#f8f9fa',
                      border: applyingCampaignId === c.id ? `2px solid ${PARTNA_PRIMARY}` : '2px solid rgba(0,0,0,0.06)',
                      opacity: alreadyApplied ? 0.5 : 1,
                    }}>
                    <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{c.name}</span>
                    {alreadyApplied && <span className="text-xs" style={{ color: '#16A34A' }}>✓ Applied</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowApplyModal(null); setApplyingCampaignId('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>Cancel</button>
              <button onClick={handleApplyVoucher} disabled={!applyingCampaignId || applying}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: !applyingCampaignId || applying ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                {applying ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REMOVE VOUCHER MODAL ── */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: '#DC2626' }}>Remove voucher</div>
              <button onClick={() => setShowRemoveModal(null)} className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Remove <strong>{showRemoveModal.voucher.title}</strong> from{' '}
              <strong>{showRemoveModal.campaign?.name}</strong>?
              Customers who have already claimed this voucher will not be affected.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRemoveModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>Cancel</button>
              <button onClick={handleRemoveVoucher}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#DC2626', color: '#fff' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RUN DRAW MODAL ── */}
      {showRunDraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Run Prize Draw</div>
              <button onClick={() => { setShowRunDraw(null); setDrawResult(null) }}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#f0f2f5' }}>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>{showRunDraw.title}</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                {showRunDraw.number_of_winners} winner{showRunDraw.number_of_winners !== 1 ? 's' : ''} will be randomly selected from qualifying customers.
              </div>
            </div>
            {drawResult ? (
              drawResult.error ? (
                <div className="px-4 py-3 rounded-xl mb-4 text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {drawResult.error}
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div className="text-xs font-bold mb-2" style={{ color: '#16A34A' }}>🎉 Draw complete!</div>
                  <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {drawResult.total} qualifying customers · {drawResult.winners.length} winner{drawResult.winners.length !== 1 ? 's' : ''}
                  </div>
                  {drawResult.winners.map((w, i) => (
                    <div key={i} className="flex justify-between items-center py-1">
                      <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{w.name}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: PARTNA_GOLD }}>{w.code}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="px-4 py-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', color: '#D97706' }}>
                ⚠ This action cannot be undone. The draw will be recorded and winners notified.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowRunDraw(null); setDrawResult(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                {drawResult ? 'Close' : 'Cancel'}
              </button>
              {!drawResult && (
                <button onClick={() => handleRunDraw(showRunDraw)} disabled={drawLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: drawLoading ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                  {drawLoading ? 'Running...' : '🎲 Run draw'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PRIZE MODAL ── */}
      {showAddPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 overflow-y-auto" style={{ background: '#fff', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Add prize draw</div>
              <button onClick={() => setShowAddPrize(false)} className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Campaign *</label>
                <select value={prizeCampaignId} onChange={e => setPrizeCampaignId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  <option value="">Select campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Prize type</label>
                <select value={prizeType} onChange={e => setPrizeType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  <option value="item">Item prize</option>
                  <option value="discount">Discount prize</option>
                  {limits.cashPrizes && <option value="cash">Cash prize</option>}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Prize title *</label>
                <input type="text" value={prizeTitle} onChange={e => setPrizeTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Description <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                </label>
                <textarea rows={2} value={prizeDescription} onChange={e => setPrizeDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              {prizeType === 'cash' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Cash value (UGX)</label>
                  <input type="text" inputMode="numeric" value={prizeValue}
                    onChange={e => setPrizeValue(formatAmountInput(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  <div className="text-xs" style={{ color: '#D97706' }}>
                    ⚠ Cash prizes must be funded in the prize pot before the draw can run
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Draw date *</label>
                  <input type="date" value={prizeDate} onChange={e => setPrizeDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Number of winners</label>
                  <input type="number" min={1} max={10} value={prizeWinners}
                    onChange={e => setPrizeWinners(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Min. balance to qualify (% of target)
                </label>
                <input type="number" min={0} max={100} value={prizeMinPct}
                  onChange={e => setPrizeMinPct(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddPrize(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>Cancel</button>
              <button onClick={handleSavePrize} disabled={savingPrize || !prizeCampaignId || !prizeTitle || !prizeDate}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: savingPrize ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                {savingPrize ? 'Saving...' : 'Create prize draw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex gap-2">
        {['vouchers', 'prizes'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold capitalize"
            style={{
              background: tab === t ? PARTNA_PRIMARY : '#fff',
              color: tab === t ? '#fff' : PARTNA_PRIMARY,
              border: `1.5px solid ${tab === t ? PARTNA_PRIMARY : 'rgba(27,79,114,0.2)'}`,
            }}>
            {t === 'vouchers' ? '🎫 Vouchers' : '🏆 Prizes'}
          </button>
        ))}
      </div>

      {/* ── VOUCHERS TAB ── */}
      {tab === 'vouchers' && (
        <div className="flex flex-col gap-4">
          {/* Package limit info */}
          <div className="px-4 py-3 rounded-xl text-xs"
            style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)', color: PARTNA_PRIMARY }}>
            Your <strong className="capitalize">{subPkg}</strong> plan includes{' '}
            {limits.maxVouchers === null ? 'unlimited vouchers' : `up to ${limits.maxVouchers} vouchers`}.{' '}
            {campaignVouchers.length} applied across your campaigns.
          </div>

          {allVouchers.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
              <div className="text-4xl mb-3">🎫</div>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No vouchers in the marketplace yet</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Vouchers are added by Partna and made available to all clients. Check back soon.
              </div>
            </div>
          ) : (
            <>
              {/* Carousel */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentVoucherIdx(i => Math.max(0, i - 1))}
                  disabled={currentVoucherIdx === 0}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: currentVoucherIdx === 0 ? 'rgba(0,0,0,0.06)' : PARTNA_PRIMARY, color: currentVoucherIdx === 0 ? 'rgba(0,0,0,0.2)' : '#fff' }}>
                  &#8592;
                </button>

                {currentVoucher && (() => {
                  const unlocked = isVoucherUnlocked(currentVoucher)
                  const merchantName = currentVoucher.merchants?.name || ''
                  const logo = getMerchantLogo(merchantName)
                  const appliedCampaigns = getVoucherCampaigns(currentVoucher.id)

                  return (
                    <div className="flex-1 rounded-2xl overflow-hidden"
                      style={{
                        background: '#fff',
                        border: unlocked ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)',
                        opacity: unlocked ? 1 : 0.65,
                        filter: unlocked ? 'none' : 'grayscale(0.6)',
                      }}>
                      <div className="p-5">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {logo ? (
                              <img src={logo} alt={merchantName} className="w-14 h-14 object-contain rounded-xl flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                style={{ background: 'rgba(27,79,114,0.08)' }}>🎫</div>
                            )}
                            <div>
                              <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{merchantName}</div>
                              <div className="text-lg font-bold" style={{ color: unlocked ? PARTNA_PRIMARY : 'rgba(0,0,0,0.35)' }}>
                                {currentVoucher.title}
                              </div>
                            </div>
                          </div>
                          {/* Apply button — top right, only when unlocked */}
                          {unlocked && (
                            <button
                              onClick={() => setShowApplyModal(currentVoucher)}
                              className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                              Apply to campaign
                            </button>
                          )}
                        </div>

                        <div className="text-xs mb-4 leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          {currentVoucher.description}
                        </div>

                        {/* Status */}
                        {unlocked ? (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                              ✓ Available on your plan
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)' }}>
                              🔒 Upgrade plan to unlock
                            </span>
                          </div>
                        )}

                        {/* Applied campaigns */}
                        {appliedCampaigns.length > 0 && (
                          <div className="rounded-xl p-3" style={{ background: '#f8f9fa' }}>
                            <div className="text-xs font-bold mb-2" style={{ color: 'rgba(0,0,0,0.35)' }}>
                              APPLIED TO
                            </div>
                            {appliedCampaigns.map(({ cv, campaign }) => (
                              <div key={cv.id} className="flex items-center justify-between py-1">
                                <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                                  {campaign.name}
                                </span>
                                <button
                                  onClick={() => setShowRemoveModal({ cv, voucher: currentVoucher, campaign })}
                                  className="text-xs px-2 py-0.5 rounded-lg"
                                  style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <button
                  onClick={() => setCurrentVoucherIdx(i => Math.min(allVouchers.length - 1, i + 1))}
                  disabled={currentVoucherIdx === allVouchers.length - 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: currentVoucherIdx === allVouchers.length - 1 ? 'rgba(0,0,0,0.06)' : PARTNA_PRIMARY, color: currentVoucherIdx === allVouchers.length - 1 ? 'rgba(0,0,0,0.2)' : '#fff' }}>
                  &#8594;
                </button>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-1.5">
                {allVouchers.map((_, i) => (
                  <button key={i} onClick={() => setCurrentVoucherIdx(i)} className="rounded-full transition-all"
                    style={{ width: i === currentVoucherIdx ? '20px' : '6px', height: '6px', background: i === currentVoucherIdx ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                ))}
              </div>

              {/* Counter */}
              <div className="text-center text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {currentVoucherIdx + 1} of {allVouchers.length} vouchers
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PRIZES TAB ── */}
      {tab === 'prizes' && (
        <div className="flex flex-col gap-6">

          {!limits.prizes ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
              <div className="text-3xl mb-3">🏆</div>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Prizes not available on Starter plan</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Upgrade to Growth or Enterprise to unlock prize draws for your campaigns.
              </div>
            </div>
          ) : (
            <>
              {/* Card + Prize Pot row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Business card */}
                <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>BUSINESS CARD</div>
                  <BusinessCard business={business} card={businessCard} wallet={businessWallet} />
                </div>

                {/* Prize pot */}
                <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: 'rgba(0,0,0,0.35)' }}>PRIZE POT</div>
                  <div className="text-3xl font-bold mb-1"
                    style={{ color: walletBalance > 0 ? '#16A34A' : 'rgba(0,0,0,0.3)' }}>
                    {formatUGX(walletBalance)}
                  </div>
                  <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Available for cash prize draws
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddMoney(true); setAddSuccess(false); setAddError('') }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                      + Add money
                    </button>
                    <button onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError('') }}
                      disabled={walletBalance === 0}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: walletBalance > 0 ? 'rgba(27,79,114,0.1)' : 'rgba(0,0,0,0.04)', color: walletBalance > 0 ? PARTNA_PRIMARY : 'rgba(0,0,0,0.3)' }}>
                      Withdraw
                    </button>
                  </div>

                  {/* Recent transactions */}
                  {businessTxns.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-bold mb-2" style={{ color: 'rgba(0,0,0,0.35)' }}>RECENT</div>
                      {businessTxns.slice(0, 3).map((txn, i) => (
                        <div key={txn.id} className="flex justify-between items-center py-1.5"
                          style={{ borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                            {txn.type === 'deposit' ? '↓ Added' : '↑ Withdrawn'}
                          </span>
                          <span className="text-xs font-semibold"
                            style={{ color: txn.type === 'deposit' ? '#16A34A' : '#DC2626' }}>
                            {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Prize draws section */}
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Prize Draws</div>
                <button onClick={() => setShowAddPrize(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  + Add prize draw
                </button>
              </div>

              {prizes.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
                  <div className="text-3xl mb-3">🎁</div>
                  <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No prize draws yet</div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Add a prize draw to incentivise saving across your campaigns.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {prizes.map(prize => {
                    const drawPassed = new Date(prize.draw_date) < new Date()
                    const pastDraws = prizeDraws.filter(d => d.prize_id === prize.id)
                    const canRunDraw = prize.prize_type !== 'cash' ||
                      (businessWallet && Number(businessWallet.balance) >= Number(prize.prize_value || 0))

                    return (
                      <div key={prize.id} className="rounded-2xl p-5" style={{ background: '#fff' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                              style={{ background: 'rgba(27,79,114,0.08)' }}>
                              {prize.prize_type === 'cash' ? '💰' : prize.prize_type === 'item' ? '🎁' : '🏷️'}
                            </div>
                            <div>
                              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                {prize.prize_type === 'cash' ? 'Cash prize' : prize.prize_type === 'item' ? 'Item prize' : 'Discount prize'}
                              </div>
                              <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>{prize.title}</div>
                              {prize.prize_type === 'cash' && prize.prize_value && (
                                <div className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>
                                  {formatUGX(prize.prize_value)}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: prize.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)', color: prize.is_active ? '#16A34A' : 'rgba(0,0,0,0.4)' }}>
                            {prize.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {[
                          { label: 'Campaign', value: prize.campaigns?.name || '—' },
                          { label: 'Winners', value: prize.number_of_winners },
                          { label: 'Draw date', value: new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
                          { label: 'Min. balance', value: prize.min_balance_percentage + '% of target' },
                          { label: 'Draws run', value: pastDraws.length },
                        ].map((row, i, arr) => (
                          <div key={i} className="flex justify-between items-center py-1.5"
                            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                            <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                          </div>
                        ))}

                        <div className="mt-3">
                          {canRunDraw ? (
                            <button onClick={() => { setShowRunDraw(prize); setDrawResult(null) }}
                              className="w-full py-2 rounded-xl text-xs font-bold"
                              style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                              🎲 Run draw
                            </button>
                          ) : (
                            <div className="w-full py-2 rounded-xl text-xs font-semibold text-center"
                              style={{ background: '#FEE2E2', color: '#DC2626' }}>
                              ⚠ Fund prize pot first
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Past draws */}
              {prizeDraws.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Past Prize Draws</div>
                  </div>
                  <div className="grid px-5 py-3 text-xs font-bold"
                    style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr', color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafafa' }}>
                    <span>Prize</span><span>Draw date</span><span>Winning code</span><span>Status</span>
                  </div>
                  {prizeDraws.map((draw, i) => (
                    <div key={draw.id} className="grid items-center px-5 py-3"
                      style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr', borderBottom: i < prizeDraws.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{draw.prizes?.title || '—'}</span>
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        {new Date(draw.drawn_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs font-mono font-bold" style={{ color: PARTNA_GOLD }}>{draw.winning_code}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                        style={{ background: draw.status === 'fulfilled' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)', color: draw.status === 'fulfilled' ? '#16A34A' : '#D97706' }}>
                        {draw.status === 'fulfilled' ? '✓ Fulfilled' : '⏳ Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}