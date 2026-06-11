import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const STATUS_STYLES = {
  draft:     { bg: 'rgba(0,0,0,0.06)',         color: 'rgba(0,0,0,0.4)',  label: 'Draft' },
  live:      { bg: 'rgba(22,163,74,0.1)',       color: '#16A34A',          label: '🟢 Live' },
  paused:    { bg: 'rgba(217,119,6,0.1)',       color: '#D97706',          label: '⏸ Paused' },
  completed: { bg: 'rgba(27,79,114,0.08)',      color: PARTNA_PRIMARY,     label: '✓ Completed' },
}

export default function VouchersPrizes({ admin, business }) {
  const [tab, setTab] = useState('vouchers')
  const [loading, setLoading] = useState(true)

  // Vouchers
  const [allVouchers, setAllVouchers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campaignVouchers, setCampaignVouchers] = useState([])
  const [currentVoucherIdx, setCurrentVoucherIdx] = useState(0)
  const [showApplyModal, setShowApplyModal] = useState(null)
  const [showRemoveModal, setShowRemoveModal] = useState(null)
  const [applyingCampaignId, setApplyingCampaignId] = useState('')
  const [applying, setApplying] = useState(false)

  // Prizes
  const [prizes, setPrizes] = useState([])
  const [prizeDraws, setPrizeDraws] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [qualifyingCounts, setQualifyingCounts] = useState({}) // prizeId → count

  // Run draw
  const [showRunDraw, setShowRunDraw] = useState(null)
  const [drawLoading, setDrawLoading] = useState(false)
  const [drawResult, setDrawResult] = useState(null)

  // Add prize modal
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [prizeCampaignId, setPrizeCampaignId] = useState('')
  const [prizeTitle, setPrizeTitle] = useState('')
  const [prizeDescription, setPrizeDescription] = useState('')
  const [prizeType, setPrizeType] = useState('discount')
  const [prizeProductId, setPrizeProductId] = useState('')
  const [prizeDiscountPct, setPrizeDiscountPct] = useState('')
  const [prizeWinners, setPrizeWinners] = useState(1)
  const [prizeDate, setPrizeDate] = useState('')
  const [prizeMinPct, setPrizeMinPct] = useState(50)
  const [prizeMinEntries, setPrizeMinEntries] = useState(5)
  const [savingPrize, setSavingPrize] = useState(false)

  // Pause/unpause
  const [togglingPrizeId, setTogglingPrizeId] = useState(null)

  const isRetail = business?.sector === 'Retail' || business?.sector === 'retail'

  useEffect(() => {
    if (business) loadAll()
  }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: campData } = await supabase
        .from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campData || [])
      const campaignIds = campData?.map(c => c.id) || []

      const { data: vData } = await supabase
        .from('vouchers').select('*, merchants(id, name, category, logo_url)')
        .eq('is_active', true)
      setAllVouchers(vData || [])

      if (campaignIds.length > 0) {
        const { data: cvData } = await supabase
          .from('campaign_vouchers').select('*').in('campaign_id', campaignIds)
        setCampaignVouchers(cvData || [])

        const { data: prizeData } = await supabase
          .from('prizes')
          .select('*, campaigns(name, target_amount), products(name, price)')
          .in('campaign_id', campaignIds)
          .order('created_at', { ascending: false })
        setPrizes(prizeData || [])

        const prizeIds = prizeData?.map(p => p.id) || []
        if (prizeIds.length > 0) {
          const { data: drawData } = await supabase
            .from('prize_draws').select('*, prizes(title)').in('prize_id', prizeIds)
            .order('drawn_at', { ascending: false })
          setPrizeDraws(drawData || [])
        }

        // Calculate qualifying counts per prize
        const { data: custData } = await supabase
          .from('customers').select('id, campaign_id')
          .eq('business_id', business.id)
        const custIds = (custData || []).map(c => c.id)

        if (custIds.length > 0) {
          const { data: walletData } = await supabase
            .from('wallets').select('customer_id, balance').in('customer_id', custIds)

          const counts = {}
          for (const prize of (prizeData || [])) {
            const campaign = campData?.find(c => c.id === prize.campaign_id)
            if (!campaign) { counts[prize.id] = 0; continue }
            const minBalance = Number(campaign.target_amount) * (Number(prize.min_balance_percentage) / 100)
            const campCustomerIds = (custData || [])
              .filter(c => c.campaign_id === prize.campaign_id)
              .map(c => c.id)
            const qualifying = (walletData || []).filter(w =>
              campCustomerIds.includes(w.customer_id) && Number(w.balance) >= minBalance
            )
            counts[prize.id] = qualifying.length
          }
          setQualifyingCounts(counts)
        }
      }

      const { data: custData } = await supabase
        .from('customers').select('id, first_name, last_name, draw_code, campaign_id')
        .eq('business_id', business.id)
      setCustomers(custData || [])

      if (isRetail) {
        const { data: prodData } = await supabase
          .from('products').select('id, name, price')
          .eq('business_id', business.id).eq('is_active', true)
        setProducts(prodData || [])
      }

    } catch (e) {
      console.error('VouchersPrizes load error:', e)
    }
    setLoading(false)
  }

  const subPkg = business?.subscription_package || 'starter'
  const pkgLimits = {
    starter: { maxVouchers: 3, prizes: false },
    growth:  { maxVouchers: 8, prizes: true },
    enterprise: { maxVouchers: null, prizes: true },
  }
  const limits = pkgLimits[subPkg] || pkgLimits.starter

  function isVoucherUnlocked(voucher) {
    if (limits.maxVouchers === null) return true
    const totalApplied = campaignVouchers.filter(cv =>
      campaigns.some(c => c.id === cv.campaign_id)
    ).length
    const appliedCount = campaignVouchers.filter(cv => cv.voucher_id === voucher.id).length
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
    } catch (e) { console.error('Apply voucher error:', e) }
    setApplying(false)
  }

  async function handleRemoveVoucher() {
    if (!showRemoveModal) return
    await supabase.from('campaign_vouchers').delete().eq('id', showRemoveModal.cv.id)
    setShowRemoveModal(null)
    await loadAll()
  }

  // ── Toggle prize pause/unpause (manual) ──
  async function handleTogglePause(prize) {
    setTogglingPrizeId(prize.id)
    try {
      const newStatus = prize.status === 'paused' ? 'live' : 'paused'
      await supabase.from('prizes').update({ status: newStatus }).eq('id', prize.id)
      setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, status: newStatus } : p))
    } catch (e) { console.error('Toggle pause error:', e) }
    setTogglingPrizeId(null)
  }

  // ── Run prize draw ──
  async function handleRunDraw(prize) {
    setDrawLoading(true)
    setDrawResult(null)
    try {
      const campaign = campaigns.find(c => c.id === prize.campaign_id)
      const minBalance = campaign
        ? Number(campaign.target_amount) * (Number(prize.min_balance_percentage) / 100)
        : 0

      const campCustomers = customers.filter(c => c.campaign_id === prize.campaign_id)
      const { data: wallets } = await supabase
        .from('wallets').select('customer_id, balance')
        .in('customer_id', campCustomers.map(c => c.id))

      const qualifying = (wallets || []).filter(w => Number(w.balance) >= minBalance)

      if (qualifying.length < prize.min_qualifying_users) {
        setDrawResult({
          error: `Not enough qualifying customers. Need ${prize.min_qualifying_users}, currently have ${qualifying.length}.`
        })
        setDrawLoading(false)
        return
      }

      // Select winners — no duplicate winners in same draw
      const winners = []
      const pool = [...qualifying]
      const numWinners = Math.min(prize.number_of_winners, pool.length)
      for (let i = 0; i < numWinners; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        const winner = pool.splice(idx, 1)[0]
        // Guard: skip if already in winners (shouldn't happen with splice but safety check)
        if (!winners.find(w => w.customer_id === winner.customer_id)) {
          winners.push(winner)
        }
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

        // Discount prizes — record on customer for Pay.jsx to apply
        if (prize.prize_type === 'discount' && prize.discount_percentage) {
          await supabase.from('customer_discounts').upsert({
            customer_id: winner.customer_id,
            campaign_id: prize.campaign_id,
            discount_percentage: Number(prize.discount_percentage),
            source: 'prize_draw',
            prize_id: prize.id,
            is_used: false,
          }, { onConflict: 'customer_id,campaign_id' })
        }
      }

      // Mark prize as completed after draw runs
      await supabase.from('prizes').update({ status: 'completed' }).eq('id', prize.id)

      setDrawResult({
        winners: winners.map(w => {
          const c = customers.find(cu => cu.id === w.customer_id)
          return { name: c ? `${c.first_name} ${c.last_name}` : 'Unknown', code: c?.draw_code || '—' }
        }),
        total: qualifying.length,
        type: prize.prize_type,
        discount: prize.discount_percentage,
      })
      await loadAll()
    } catch (e) {
      console.error('Run draw error:', e)
      setDrawResult({ error: 'Something went wrong running the draw.' })
    }
    setDrawLoading(false)
  }

  // ── Save prize ──
  async function handleSavePrize() {
    if (!prizeCampaignId || !prizeTitle || !prizeDate) return
    if (prizeType === 'item' && isRetail && !prizeProductId) return
    if (prizeType === 'discount' && !prizeDiscountPct) return
    setSavingPrize(true)
    try {
      await supabase.from('prizes').insert({
        campaign_id: prizeCampaignId,
        business_id: business.id,
        title: prizeTitle,
        description: prizeDescription || null,
        prize_type: prizeType,
        product_id: prizeType === 'item' ? prizeProductId || null : null,
        discount_percentage: prizeType === 'discount' ? Number(prizeDiscountPct) : null,
        draw_date: new Date(prizeDate).toISOString(),
        number_of_winners: prizeWinners,
        min_balance_percentage: prizeMinPct,
        min_qualifying_users: prizeMinEntries,
        status: 'draft',
        is_active: true,
      })
      resetAddPrize()
      await loadAll()
    } catch (e) { console.error('Save prize error:', e) }
    setSavingPrize(false)
  }

  function resetAddPrize() {
    setShowAddPrize(false)
    setPrizeCampaignId(''); setPrizeTitle(''); setPrizeDescription('')
    setPrizeType('discount'); setPrizeProductId(''); setPrizeDiscountPct('')
    setPrizeWinners(1); setPrizeDate(''); setPrizeMinPct(50); setPrizeMinEntries(5)
  }

  const currentVoucher = allVouchers[currentVoucherIdx] || null

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

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
              <button onClick={() => setShowRemoveModal(null)} className="text-xl"
                style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
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
              <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
                {showRunDraw.number_of_winners} winner{showRunDraw.number_of_winners !== 1 ? 's' : ''} · {qualifyingCounts[showRunDraw.id] || 0} qualifying customers
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Prize type: <span className="font-semibold capitalize">{showRunDraw.prize_type}</span>
                {showRunDraw.prize_type === 'discount' && showRunDraw.discount_percentage && (
                  <span> · <span className="font-semibold" style={{ color: PARTNA_GOLD }}>{showRunDraw.discount_percentage}% discount applied at payment</span></span>
                )}
                {showRunDraw.prize_type === 'item' && showRunDraw.products?.name && (
                  <span> · <span className="font-semibold" style={{ color: PARTNA_GOLD }}>{showRunDraw.products.name}</span></span>
                )}
              </div>
            </div>
            {drawResult ? (
              drawResult.error ? (
                <div className="px-4 py-3 rounded-xl mb-4 text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {drawResult.error}
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl mb-4"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div className="text-xs font-bold mb-2" style={{ color: '#16A34A' }}>🎉 Draw complete!</div>
                  <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {drawResult.total} qualifying · {drawResult.winners.length} winner{drawResult.winners.length !== 1 ? 's' : ''}
                  </div>
                  {drawResult.type === 'discount' && drawResult.discount && (
                    <div className="text-xs mb-2 font-semibold" style={{ color: PARTNA_GOLD }}>
                      {drawResult.discount}% discount applied to winners at payment
                    </div>
                  )}
                  {drawResult.type === 'item' && (
                    <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      Item prize entries added to your Sales page
                    </div>
                  )}
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
              <button onClick={resetAddPrize} className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
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
                <select value={prizeType}
                  onChange={e => { setPrizeType(e.target.value); setPrizeProductId(''); setPrizeDiscountPct('') }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  {isRetail && <option value="item">Item / Product prize</option>}
                  <option value="discount">Discount prize</option>
                </select>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  {prizeType === 'item'
                    ? 'Winner receives a product — added to your Sales page'
                    : 'Winner gets a % discount applied when they click Pay'}
                </div>
              </div>

              {prizeType === 'item' && isRetail && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Product *</label>
                  {products.length === 0 ? (
                    <div className="text-xs px-4 py-3 rounded-xl"
                      style={{ background: '#FEE2E2', color: '#991B1B' }}>
                      No active products found. Add products in the Products page first.
                    </div>
                  ) : (
                    <select value={prizeProductId} onChange={e => {
                      setPrizeProductId(e.target.value)
                      const prod = products.find(p => p.id === e.target.value)
                      if (prod && !prizeTitle) setPrizeTitle(prod.name)
                    }}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {formatUGX(p.price)}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {prizeType === 'discount' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Discount percentage *
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={100} value={prizeDiscountPct}
                      onChange={e => setPrizeDiscountPct(e.target.value)}
                      placeholder="e.g. 20"
                      className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    <span className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>%</span>
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Deducted from the amount owed when the winner clicks Pay
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Prize title *</label>
                <input type="text" value={prizeTitle} onChange={e => setPrizeTitle(e.target.value)}
                  placeholder={prizeType === 'discount' ? 'e.g. 20% off your purchase' : 'e.g. Free laptop prize'}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Draw date *</label>
                  <input type="date" value={prizeDate} onChange={e => setPrizeDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Winners</label>
                  <input type="number" min={1} max={10} value={prizeWinners}
                    onChange={e => setPrizeWinners(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Min. balance to qualify (% of target)
                  </label>
                  <input type="number" min={0} max={100} value={prizeMinPct}
                    onChange={e => setPrizeMinPct(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Min. qualifying entries to go live
                  </label>
                  <input type="number" min={1} value={prizeMinEntries}
                    onChange={e => setPrizeMinEntries(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Draw won't go live until this many customers qualify
                  </div>
                </div>
              </div>

            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={resetAddPrize}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>Cancel</button>
              <button onClick={handleSavePrize}
                disabled={
                  savingPrize || !prizeCampaignId || !prizeTitle || !prizeDate ||
                  (prizeType === 'item' && isRetail && !prizeProductId) ||
                  (prizeType === 'discount' && !prizeDiscountPct)
                }
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
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentVoucherIdx(i => Math.max(0, i - 1))}
                  disabled={currentVoucherIdx === 0}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: currentVoucherIdx === 0 ? 'rgba(0,0,0,0.06)' : PARTNA_PRIMARY, color: currentVoucherIdx === 0 ? 'rgba(0,0,0,0.2)' : '#fff' }}>
                  &#8592;
                </button>

                {currentVoucher && (() => {
                  const unlocked = isVoucherUnlocked(currentVoucher)
                  const appliedCampaigns = getVoucherCampaigns(currentVoucher.id)
                  const merchant = currentVoucher.merchants

                  return (
                    <div className="flex-1 rounded-2xl overflow-hidden"
                      style={{
                        background: '#fff',
                        border: unlocked ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)',
                        opacity: unlocked ? 1 : 0.65,
                        filter: unlocked ? 'none' : 'grayscale(0.6)',
                      }}>
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                              style={{ background: '#f0f2f5' }}>
                              {merchant?.logo_url ? (
                                <img src={merchant.logo_url} alt={merchant.name} className="w-12 h-12 object-contain" />
                              ) : (
                                <span className="text-2xl">🎫</span>
                              )}
                            </div>
                            <div>
                              <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{merchant?.name || ''}</div>
                              <div className="text-lg font-bold" style={{ color: unlocked ? PARTNA_PRIMARY : 'rgba(0,0,0,0.35)' }}>
                                {currentVoucher.title}
                              </div>
                            </div>
                          </div>
                          {unlocked && (
                            <button onClick={() => setShowApplyModal(currentVoucher)}
                              className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                              Apply to campaign
                            </button>
                          )}
                        </div>

                        <div className="text-xs mb-4 leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          {currentVoucher.description}
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          {unlocked ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                              ✓ Available on your plan
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)' }}>
                              🔒 Upgrade plan to unlock
                            </span>
                          )}
                        </div>

                        {appliedCampaigns.length > 0 && (
                          <div className="rounded-xl p-3" style={{ background: '#f8f9fa' }}>
                            <div className="text-xs font-bold mb-2" style={{ color: 'rgba(0,0,0,0.35)' }}>APPLIED TO</div>
                            {appliedCampaigns.map(({ cv, campaign }) => (
                              <div key={cv.id} className="flex items-center justify-between py-1">
                                <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{campaign.name}</span>
                                <button onClick={() => setShowRemoveModal({ cv, voucher: currentVoucher, campaign })}
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

                <button onClick={() => setCurrentVoucherIdx(i => Math.min(allVouchers.length - 1, i + 1))}
                  disabled={currentVoucherIdx === allVouchers.length - 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: currentVoucherIdx === allVouchers.length - 1 ? 'rgba(0,0,0,0.06)' : PARTNA_PRIMARY, color: currentVoucherIdx === allVouchers.length - 1 ? 'rgba(0,0,0,0.2)' : '#fff' }}>
                  &#8594;
                </button>
              </div>

              <div className="flex justify-center gap-1.5">
                {allVouchers.map((_, i) => (
                  <button key={i} onClick={() => setCurrentVoucherIdx(i)} className="rounded-full transition-all"
                    style={{ width: i === currentVoucherIdx ? '20px' : '6px', height: '6px', background: i === currentVoucherIdx ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                ))}
              </div>
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
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
                Prizes not available on Starter plan
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Upgrade to Growth or Enterprise to unlock prize draws for your campaigns.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Prize Draws</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Draws go live automatically when enough customers qualify. You can pause or unpause manually.
                  </div>
                </div>
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
                    const status = prize.status || 'draft'
                    const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.draft
                    const qualifying = qualifyingCounts[prize.id] || 0
                    const canRun = status === 'live'

                    return (
                      <div key={prize.id} className="rounded-2xl p-5" style={{ background: '#fff' }}>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                              style={{ background: 'rgba(27,79,114,0.08)' }}>
                              {prize.prize_type === 'item' ? '🎁' : '🏷️'}
                            </div>
                            <div>
                              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                {prize.prize_type === 'item' ? 'Item prize' : 'Discount prize'}
                              </div>
                              <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>{prize.title}</div>
                              {prize.prize_type === 'discount' && prize.discount_percentage && (
                                <div className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>
                                  {prize.discount_percentage}% off at payment
                                </div>
                              )}
                              {prize.prize_type === 'item' && prize.products?.name && (
                                <div className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>
                                  {prize.products.name}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label}
                          </span>
                        </div>

                        {/* Stats */}
                        {[
                          { label: 'Campaign', value: prize.campaigns?.name || '—' },
                          { label: 'Winners', value: prize.number_of_winners },
                          { label: 'Draw date', value: new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
                          { label: 'Min. balance', value: prize.min_balance_percentage + '% of target' },
                          {
                            label: 'Qualifying entries',
                            value: `${qualifying} / ${prize.min_qualifying_users} needed`,
                            color: qualifying >= prize.min_qualifying_users ? '#16A34A' : '#D97706',
                          },
                          { label: 'Draws run', value: prizeDraws.filter(d => d.prize_id === prize.id).length },
                        ].map((row, i, arr) => (
                          <div key={i} className="flex justify-between items-center py-1.5"
                            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                            <span className="text-xs font-semibold" style={{ color: row.color || PARTNA_PRIMARY }}>
                              {row.value}
                            </span>
                          </div>
                        ))}

                        {/* Draft — waiting for entries */}
                        {status === 'draft' && (
                          <div className="mt-3 px-3 py-2 rounded-xl text-xs text-center"
                            style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }}>
                            Waiting for {prize.min_qualifying_users - qualifying} more qualifying customer{prize.min_qualifying_users - qualifying !== 1 ? 's' : ''} to go live
                          </div>
                        )}

                        {/* Live — can run draw + pause */}
                        {status === 'live' && (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => { setShowRunDraw(prize); setDrawResult(null) }}
                              className="flex-1 py-2 rounded-xl text-xs font-bold"
                              style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                              🎲 Run draw
                            </button>
                            <button
                              onClick={() => handleTogglePause(prize)}
                              disabled={togglingPrizeId === prize.id}
                              className="px-3 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: 'rgba(217,119,6,0.08)', color: '#D97706' }}>
                              ⏸
                            </button>
                          </div>
                        )}

                        {/* Paused — can unpause */}
                        {status === 'paused' && (
                          <div className="mt-3 flex gap-2">
                            <div className="flex-1 py-2 rounded-xl text-xs font-semibold text-center"
                              style={{ background: 'rgba(217,119,6,0.08)', color: '#D97706' }}>
                              Draw paused
                            </div>
                            <button
                              onClick={() => handleTogglePause(prize)}
                              disabled={togglingPrizeId === prize.id}
                              className="px-3 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
                              ▶
                            </button>
                          </div>
                        )}

                        {/* Completed */}
                        {status === 'completed' && (
                          <div className="mt-3 py-2 rounded-xl text-xs font-semibold text-center"
                            style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                            ✓ Draw completed
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Past draws table */}
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
                        style={{
                          background: draw.status === 'fulfilled' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                          color: draw.status === 'fulfilled' ? '#16A34A' : '#D97706',
                        }}>
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