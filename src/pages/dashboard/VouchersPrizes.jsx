import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

const STATUS_CONFIG = {
  draft:     { badge: 'badge-default', icon: 'edit_note',     label: 'Draft'     },
  live:      { badge: 'badge-success', icon: 'play_circle',   label: 'Live'      },
  paused:    { badge: 'badge-warning', icon: 'pause_circle',  label: 'Paused'    },
  completed: { badge: 'badge-primary', icon: 'check_circle',  label: 'Completed' },
}

export default function VouchersPrizes({ admin, business }) {
  const [tab, setTab]       = useState('vouchers')
  const [loading, setLoading] = useState(true)

  // Vouchers
  const [allVouchers, setAllVouchers]         = useState([])
  const [campaigns, setCampaigns]             = useState([])
  const [campaignVouchers, setCampaignVouchers] = useState([])
  const [currentVoucherIdx, setCurrentVoucherIdx] = useState(0)
  const [showApplyModal, setShowApplyModal]   = useState(null)
  const [showRemoveModal, setShowRemoveModal] = useState(null)
  const [applyingCampaignId, setApplyingCampaignId] = useState('')
  const [applying, setApplying]               = useState(false)

  // Prizes
  const [prizes, setPrizes]               = useState([])
  const [prizeDraws, setPrizeDraws]       = useState([])
  const [customers, setCustomers]         = useState([])
  const [products, setProducts]           = useState([])
  const [qualifyingCounts, setQualifyingCounts] = useState({})
  const [showRunDraw, setShowRunDraw]     = useState(null)
  const [drawLoading, setDrawLoading]     = useState(false)
  const [drawResult, setDrawResult]       = useState(null)
  const [showAddPrize, setShowAddPrize]   = useState(false)
  const [togglingPrizeId, setTogglingPrizeId] = useState(null)

  // Add prize form
  const [prizeCampaignId, setPrizeCampaignId]   = useState('')
  const [prizeTitle, setPrizeTitle]             = useState('')
  const [prizeDescription, setPrizeDescription] = useState('')
  const [prizeType, setPrizeType]               = useState('discount')
  const [prizeProductId, setPrizeProductId]     = useState('')
  const [prizeDiscountPct, setPrizeDiscountPct] = useState('')
  const [prizeWinners, setPrizeWinners]         = useState(1)
  const [prizeDate, setPrizeDate]               = useState('')
  const [prizeMinPct, setPrizeMinPct]           = useState(50)
  const [prizeMinEntries, setPrizeMinEntries]   = useState(5)
  const [savingPrize, setSavingPrize]           = useState(false)

  const isRetail = business?.sector === 'Retail' || business?.sector === 'retail'

  useEffect(() => { if (business) loadAll() }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: campData } = await supabase.from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campData || [])
      const campaignIds = campData?.map(c => c.id) || []

      const { data: vData } = await supabase.from('vouchers').select('*, merchants(id, name, category, logo_url)').eq('is_active', true)
      setAllVouchers(vData || [])

      if (campaignIds.length > 0) {
        const { data: cvData } = await supabase.from('campaign_vouchers').select('*').in('campaign_id', campaignIds)
        setCampaignVouchers(cvData || [])

        const { data: prizeData } = await supabase.from('prizes')
          .select('*, campaigns(name, target_amount), products(name, price)')
          .in('campaign_id', campaignIds).order('created_at', { ascending: false })
        setPrizes(prizeData || [])

        const prizeIds = prizeData?.map(p => p.id) || []
        if (prizeIds.length > 0) {
          const { data: drawData } = await supabase.from('prize_draws').select('*, prizes(title)')
            .in('prize_id', prizeIds).order('drawn_at', { ascending: false })
          setPrizeDraws(drawData || [])
        }

        const { data: custData } = await supabase.from('customers').select('id, campaign_id').eq('business_id', business.id)
        const custIds = (custData || []).map(c => c.id)
        if (custIds.length > 0) {
          const { data: walletData } = await supabase.from('wallets').select('customer_id, balance').in('customer_id', custIds)
          const counts = {}
          for (const prize of (prizeData || [])) {
            const campaign = campData?.find(c => c.id === prize.campaign_id)
            if (!campaign) { counts[prize.id] = 0; continue }
            const minBalance = Number(campaign.target_amount) * (Number(prize.min_balance_percentage) / 100)
            const campCustIds = (custData || []).filter(c => c.campaign_id === prize.campaign_id).map(c => c.id)
            counts[prize.id] = (walletData || []).filter(w => campCustIds.includes(w.customer_id) && Number(w.balance) >= minBalance).length
          }
          setQualifyingCounts(counts)
        }
      }

      const { data: custAllData } = await supabase.from('customers').select('id, first_name, last_name, draw_code, campaign_id').eq('business_id', business.id)
      setCustomers(custAllData || [])

      if (isRetail) {
        const { data: prodData } = await supabase.from('products').select('id, name, price').eq('business_id', business.id).eq('is_active', true)
        setProducts(prodData || [])
      }
    } catch (e) { console.error('VouchersPrizes load error:', e) }
    setLoading(false)
  }

  const subPkg   = business?.subscription_package || 'starter'
  const pkgLimits = { starter: { maxVouchers: 3, prizes: false }, growth: { maxVouchers: 8, prizes: true }, enterprise: { maxVouchers: null, prizes: true } }
  const limits   = pkgLimits[subPkg] || pkgLimits.starter

  function isVoucherUnlocked(voucher) {
    if (limits.maxVouchers === null) return true
    const totalApplied = campaignVouchers.filter(cv => campaigns.some(c => c.id === cv.campaign_id)).length
    const appliedCount = campaignVouchers.filter(cv => cv.voucher_id === voucher.id).length
    return totalApplied < limits.maxVouchers || appliedCount > 0
  }

  function getVoucherCampaigns(voucherId) {
    return campaignVouchers.filter(cv => cv.voucher_id === voucherId)
      .map(cv => ({ cv, campaign: campaigns.find(c => c.id === cv.campaign_id) }))
      .filter(x => x.campaign)
  }

  async function handleApplyVoucher() {
    if (!showApplyModal || !applyingCampaignId) return
    setApplying(true)
    try {
      await supabase.from('campaign_vouchers').insert({ campaign_id: applyingCampaignId, voucher_id: showApplyModal.id })
      setShowApplyModal(null); setApplyingCampaignId(''); await loadAll()
    } catch (e) { console.error('Apply voucher error:', e) }
    setApplying(false)
  }

  async function handleRemoveVoucher() {
    if (!showRemoveModal) return
    await supabase.from('campaign_vouchers').delete().eq('id', showRemoveModal.cv.id)
    setShowRemoveModal(null); await loadAll()
  }

  async function handleTogglePause(prize) {
    setTogglingPrizeId(prize.id)
    try {
      const newStatus = prize.status === 'paused' ? 'live' : 'paused'
      await supabase.from('prizes').update({ status: newStatus }).eq('id', prize.id)
      setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, status: newStatus } : p))
    } catch (e) { console.error('Toggle pause error:', e) }
    setTogglingPrizeId(null)
  }

  async function handleRunDraw(prize) {
    setDrawLoading(true); setDrawResult(null)
    try {
      const campaign   = campaigns.find(c => c.id === prize.campaign_id)
      const minBalance = campaign ? Number(campaign.target_amount) * (Number(prize.min_balance_percentage) / 100) : 0
      const campCustomers = customers.filter(c => c.campaign_id === prize.campaign_id)
      const { data: wallets } = await supabase.from('wallets').select('customer_id, balance').in('customer_id', campCustomers.map(c => c.id))
      const qualifying = (wallets || []).filter(w => Number(w.balance) >= minBalance)

      if (qualifying.length < prize.min_qualifying_users) {
        setDrawResult({ error: `Not enough qualifying customers. Need ${prize.min_qualifying_users}, currently have ${qualifying.length}.` })
        setDrawLoading(false); return
      }

      const winners = []; const pool = [...qualifying]
      const numWinners = Math.min(prize.number_of_winners, pool.length)
      for (let i = 0; i < numWinners; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        const winner = pool.splice(idx, 1)[0]
        if (!winners.find(w => w.customer_id === winner.customer_id)) winners.push(winner)
      }

      for (const winner of winners) {
        const customer = customers.find(c => c.id === winner.customer_id)
        await supabase.from('prize_draws').insert({
          prize_id: prize.id, winner_customer_id: winner.customer_id,
          winning_code: customer?.draw_code || 'UNKNOWN',
          drawn_at: new Date().toISOString(), prize_type: prize.prize_type, status: 'pending',
        })
        if (prize.prize_type === 'discount' && prize.discount_percentage) {
          await supabase.from('customer_discounts').upsert({
            customer_id: winner.customer_id, campaign_id: prize.campaign_id,
            discount_percentage: Number(prize.discount_percentage), source: 'prize_draw',
            prize_id: prize.id, is_used: false,
          }, { onConflict: 'customer_id,campaign_id' })
        }
      }

      await supabase.from('prizes').update({ status: 'completed' }).eq('id', prize.id)
      setDrawResult({
        winners: winners.map(w => { const c = customers.find(cu => cu.id === w.customer_id); return { name: c ? `${c.first_name} ${c.last_name}` : 'Unknown', code: c?.draw_code || '—' } }),
        total: qualifying.length, type: prize.prize_type, discount: prize.discount_percentage,
      })
      await loadAll()
    } catch (e) { console.error('Run draw error:', e); setDrawResult({ error: 'Something went wrong running the draw.' }) }
    setDrawLoading(false)
  }

  async function handleSavePrize() {
    if (!prizeCampaignId || !prizeTitle || !prizeDate) return
    if (prizeType === 'item' && isRetail && !prizeProductId) return
    if (prizeType === 'discount' && !prizeDiscountPct) return
    setSavingPrize(true)
    try {
      await supabase.from('prizes').insert({
        campaign_id: prizeCampaignId, business_id: business.id, title: prizeTitle,
        description: prizeDescription || null, prize_type: prizeType,
        product_id: prizeType === 'item' ? prizeProductId || null : null,
        discount_percentage: prizeType === 'discount' ? Number(prizeDiscountPct) : null,
        draw_date: new Date(prizeDate).toISOString(), number_of_winners: prizeWinners,
        min_balance_percentage: prizeMinPct, min_qualifying_users: prizeMinEntries,
        status: 'draft', is_active: true,
      })
      resetAddPrize(); await loadAll()
    } catch (e) { console.error('Save prize error:', e) }
    setSavingPrize(false)
  }

  function resetAddPrize() {
    setShowAddPrize(false); setPrizeCampaignId(''); setPrizeTitle(''); setPrizeDescription('')
    setPrizeType('discount'); setPrizeProductId(''); setPrizeDiscountPct('')
    setPrizeWinners(1); setPrizeDate(''); setPrizeMinPct(50); setPrizeMinEntries(5)
  }

  const currentVoucher = allVouchers[currentVoucherIdx] || null

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── APPLY VOUCHER MODAL ── */}
      {showApplyModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Apply to campaign</span>
              <button onClick={() => { setShowApplyModal(null); setApplyingCampaignId('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Applying <strong style={{ color: 'var(--color-black)' }}>{showApplyModal.title}</strong> to a campaign:
              </p>
              {campaigns.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', textAlign: 'center', padding: 'var(--space-4)' }}>
                  No campaigns yet. Create a campaign first.
                </div>
              ) : (
                campaigns.map(c => {
                  const alreadyApplied = campaignVouchers.some(cv => cv.campaign_id === c.id && cv.voucher_id === showApplyModal.id)
                  return (
                    <button key={c.id} onClick={() => !alreadyApplied && setApplyingCampaignId(c.id)} disabled={alreadyApplied}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: 'var(--space-3) var(--space-4)',
                        background: applyingCampaignId === c.id ? 'var(--color-black)' : 'var(--color-white)',
                        border: applyingCampaignId === c.id ? '2px solid var(--color-black)' : 'var(--border)',
                        color: applyingCampaignId === c.id ? 'var(--color-white)' : 'var(--color-black)',
                        opacity: alreadyApplied ? 0.5 : 1,
                        cursor: alreadyApplied ? 'default' : 'pointer',
                        transition: 'all var(--transition-base)',
                        fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
                      }}>
                      <span>{c.name}</span>
                      {alreadyApplied && <span className="badge badge-success no-dot">Applied</span>}
                    </button>
                  )
                })
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowApplyModal(null); setApplyingCampaignId('') }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleApplyVoucher} disabled={!applyingCampaignId || applying} className="btn btn-primary" style={{ flex: 1 }}>
                {applying
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Applying…</>
                  : <><span className="icon-outlined icon-sm">check</span> Confirm</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REMOVE VOUCHER MODAL ── */}
      {showRemoveModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#C0392B' }}>
              <span className="modal-title">Remove voucher</span>
              <button onClick={() => setShowRemoveModal(null)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Remove <strong style={{ color: 'var(--color-black)' }}>{showRemoveModal.voucher.title}</strong> from{' '}
                <strong style={{ color: 'var(--color-black)' }}>{showRemoveModal.campaign?.name}</strong>?
                Customers who have already claimed this voucher will not be affected.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRemoveModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleRemoveVoucher} className="btn btn-danger" style={{ flex: 1 }}>
                <span className="icon-outlined icon-sm">delete</span>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RUN DRAW MODAL ── */}
      {showRunDraw && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Run prize draw</span>
              <button onClick={() => { setShowRunDraw(null); setDrawResult(null) }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Prize summary */}
              <div style={{ background: 'var(--color-bg)', border: 'var(--border)', padding: 'var(--space-4)' }}>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                  {showRunDraw.title}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                  {showRunDraw.number_of_winners} winner{showRunDraw.number_of_winners !== 1 ? 's' : ''} · {qualifyingCounts[showRunDraw.id] || 0} qualifying customers · Prize type: <span style={{ fontWeight: 'var(--weight-bold)', textTransform: 'capitalize' }}>{showRunDraw.prize_type}</span>
                  {showRunDraw.prize_type === 'discount' && showRunDraw.discount_percentage && (
                    <span> — <strong>{showRunDraw.discount_percentage}% discount at payment</strong></span>
                  )}
                  {showRunDraw.prize_type === 'item' && showRunDraw.products?.name && (
                    <span> — <strong>{showRunDraw.products.name}</strong></span>
                  )}
                </div>
              </div>

              {drawResult ? (
                drawResult.error ? (
                  <div className="alert alert-danger">
                    <span className="icon-outlined alert-icon">error_outline</span>
                    <div className="alert-content">{drawResult.error}</div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--color-green)', border: 'var(--border)', padding: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <span className="icon-outlined" style={{ fontSize: 22 }}>celebration</span>
                      <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)' }}>Draw complete!</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', marginBottom: 'var(--space-3)' }}>
                      {drawResult.total} qualifying · {drawResult.winners.length} winner{drawResult.winners.length !== 1 ? 's' : ''}
                      {drawResult.type === 'discount' && drawResult.discount && (
                        <div style={{ fontWeight: 'var(--weight-bold)', marginTop: 4 }}>{drawResult.discount}% discount applied to winners at payment</div>
                      )}
                      {drawResult.type === 'item' && (
                        <div style={{ marginTop: 4 }}>Item prize entries added to your Sales page.</div>
                      )}
                    </div>
                    {drawResult.winners.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderTop: i > 0 ? '1.5px solid rgba(0,0,0,0.1)' : 'none' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{w.name}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', background: 'var(--color-black)', color: 'var(--color-primary)', padding: '2px var(--space-2)' }}>
                          {w.code}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="alert alert-warning">
                  <span className="icon-outlined alert-icon">warning</span>
                  <div className="alert-content">
                    This action cannot be undone. The draw will be recorded and winners notified.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowRunDraw(null); setDrawResult(null) }} className="btn btn-secondary" style={{ flex: 1 }}>
                {drawResult ? 'Close' : 'Cancel'}
              </button>
              {!drawResult && (
                <button onClick={() => handleRunDraw(showRunDraw)} disabled={drawLoading} className="btn btn-primary" style={{ flex: 1 }}>
                  {drawLoading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Running…</>
                    : <><span className="icon-outlined icon-sm">casino</span> Run draw</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PRIZE MODAL ── */}
      {showAddPrize && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Add prize draw</span>
              <button onClick={resetAddPrize} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '70vh', overflowY: 'auto' }}>

              <div className="input-group">
                <label className="input-label">Campaign <span className="required">*</span></label>
                <select className="input" value={prizeCampaignId} onChange={e => setPrizeCampaignId(e.target.value)}>
                  <option value="">Select campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Prize type</label>
                <select className="input" value={prizeType} onChange={e => { setPrizeType(e.target.value); setPrizeProductId(''); setPrizeDiscountPct('') }}>
                  {isRetail && <option value="item">Item / Product prize</option>}
                  <option value="discount">Discount prize</option>
                </select>
                <span className="input-hint">
                  {prizeType === 'item' ? 'Winner receives a product — added to your Sales page.' : 'Winner gets a % discount applied when they click Pay.'}
                </span>
              </div>

              {prizeType === 'item' && isRetail && (
                <div className="input-group">
                  <label className="input-label">Product <span className="required">*</span></label>
                  {products.length === 0 ? (
                    <div className="alert alert-danger">
                      <span className="icon-outlined alert-icon">error_outline</span>
                      <div className="alert-content">No active products found. Add products in the Products page first.</div>
                    </div>
                  ) : (
                    <select className="input" value={prizeProductId} onChange={e => { setPrizeProductId(e.target.value); const prod = products.find(p => p.id === e.target.value); if (prod && !prizeTitle) setPrizeTitle(prod.name) }}>
                      <option value="">Select product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatUGX(p.price)}</option>)}
                    </select>
                  )}
                </div>
              )}

              {prizeType === 'discount' && (
                <div className="input-group">
                  <label className="input-label">Discount percentage <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <input type="number" min={1} max={100} className="input" value={prizeDiscountPct}
                      onChange={e => setPrizeDiscountPct(e.target.value)} placeholder="e.g. 20"
                      style={{ paddingRight: 40 }} />
                    <span style={{ position: 'absolute', right: 'var(--space-4)', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', color: 'var(--color-grey)', pointerEvents: 'none' }}>%</span>
                  </div>
                  <span className="input-hint">Deducted from the amount owed when the winner clicks Pay.</span>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Prize title <span className="required">*</span></label>
                <input type="text" className="input" value={prizeTitle} onChange={e => setPrizeTitle(e.target.value)}
                  placeholder={prizeType === 'discount' ? 'e.g. 20% off your purchase' : 'e.g. Free laptop prize'} />
              </div>

              <div className="input-group">
                <label className="input-label">Description <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                <textarea className="input" rows={2} value={prizeDescription} onChange={e => setPrizeDescription(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group">
                  <label className="input-label">Draw date <span className="required">*</span></label>
                  <input type="date" className="input" value={prizeDate} onChange={e => setPrizeDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Winners</label>
                  <input type="number" min={1} max={10} className="input" value={prizeWinners} onChange={e => setPrizeWinners(parseInt(e.target.value) || 1)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group">
                  <label className="input-label">Min. balance to qualify (% of target)</label>
                  <input type="number" min={0} max={100} className="input" value={prizeMinPct} onChange={e => setPrizeMinPct(parseInt(e.target.value) || 0)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Min. entries to go live</label>
                  <input type="number" min={1} className="input" value={prizeMinEntries} onChange={e => setPrizeMinEntries(parseInt(e.target.value) || 1)} />
                  <span className="input-hint">Draw won't go live until this many customers qualify.</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={resetAddPrize} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSavePrize}
                disabled={savingPrize || !prizeCampaignId || !prizeTitle || !prizeDate || (prizeType === 'item' && isRetail && !prizeProductId) || (prizeType === 'discount' && !prizeDiscountPct)}
                className="btn btn-primary" style={{ flex: 1 }}>
                {savingPrize
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                  : <><span className="icon-outlined icon-sm">add</span> Create prize draw</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {[
          { id: 'vouchers', icon: 'confirmation_number', label: 'Vouchers' },
          { id: 'prizes',   icon: 'emoji_events',        label: 'Prizes'   },
        ].map((t, i) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            background: tab === t.id ? 'var(--color-black)' : 'var(--color-white)',
            color: tab === t.id ? 'var(--color-white)' : 'var(--color-grey)',
            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            cursor: 'pointer', transition: 'all var(--transition-base)',
          }}>
            <span className="icon-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VOUCHERS TAB ── */}
      {tab === 'vouchers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="alert alert-info">
            <span className="icon-outlined alert-icon">info</span>
            <div className="alert-content">
              Your <strong style={{ textTransform: 'capitalize' }}>{subPkg}</strong> plan includes{' '}
              {limits.maxVouchers === null ? 'unlimited vouchers' : `up to ${limits.maxVouchers} vouchers`}.{' '}
              {campaignVouchers.length} applied across your campaigns.
            </div>
          </div>

          {allVouchers.length === 0 ? (
            <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
              <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>confirmation_number</span>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                No vouchers in the marketplace yet
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Vouchers are added by Partna and made available to all clients. Check back soon.
              </div>
            </div>
          ) : (
            <>
              {/* Voucher carousel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <button
                  onClick={() => setCurrentVoucherIdx(i => Math.max(0, i - 1))}
                  disabled={currentVoucherIdx === 0}
                  style={{
                    width: 40, height: 40, flexShrink: 0,
                    background: currentVoucherIdx === 0 ? 'var(--color-grey-light)' : 'var(--color-black)',
                    border: 'var(--border)', cursor: currentVoucherIdx === 0 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <span className="icon-outlined" style={{ fontSize: 20, color: currentVoucherIdx === 0 ? 'var(--color-grey)' : 'var(--color-white)' }}>chevron_left</span>
                </button>

                {currentVoucher && (() => {
                  const unlocked = isVoucherUnlocked(currentVoucher)
                  const appliedCampaigns = getVoucherCampaigns(currentVoucher.id)
                  const merchant = currentVoucher.merchants

                  return (
                    <div style={{
                      flex: 1,
                      background: 'var(--color-white)',
                      border: unlocked ? '3px solid var(--color-black)' : 'var(--border)',
                      boxShadow: unlocked ? 'var(--shadow-md)' : 'none',
                      opacity: unlocked ? 1 : 0.6,
                      filter: unlocked ? 'none' : 'grayscale(0.5)',
                    }}>
                      {/* Status bar */}
                      <div style={{
                        height: 4,
                        background: unlocked ? 'var(--color-primary)' : 'var(--color-grey-light)',
                      }} />

                      <div style={{ padding: 'var(--space-5)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{
                              width: 56, height: 56, flexShrink: 0,
                              background: 'var(--color-bg)', border: 'var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            }}>
                              {merchant?.logo_url
                                ? <img src={merchant.logo_url} alt={merchant.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                                : <span className="icon-outlined" style={{ fontSize: 24, color: 'var(--color-grey)' }}>store</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                                {merchant?.name || ''}
                              </div>
                              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', marginTop: 3 }}>
                                {currentVoucher.title}
                              </div>
                            </div>
                          </div>
                          {unlocked && (
                            <button onClick={() => setShowApplyModal(currentVoucher)} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                              <span className="icon-outlined icon-xs">add</span>
                              Apply
                            </button>
                          )}
                        </div>

                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--space-4)' }}>
                          {currentVoucher.description}
                        </p>

                        <div style={{ marginBottom: appliedCampaigns.length > 0 ? 'var(--space-4)' : 0 }}>
                          {unlocked
                            ? <span className="badge badge-success no-dot">Available on your plan</span>
                            : <span className="badge badge-default no-dot"><span className="icon-outlined icon-xs">lock</span> Upgrade plan to unlock</span>
                          }
                        </div>

                        {appliedCampaigns.length > 0 && (
                          <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ background: 'var(--color-black)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)' }}>
                              Applied to
                            </div>
                            {appliedCampaigns.map(({ cv, campaign }) => (
                              <div key={cv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderTop: '1.5px solid var(--color-grey-light)' }}>
                                <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{campaign.name}</span>
                                <button onClick={() => setShowRemoveModal({ cv, voucher: currentVoucher, campaign })} className="btn btn-sm btn-danger">Remove</button>
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
                  style={{
                    width: 40, height: 40, flexShrink: 0,
                    background: currentVoucherIdx === allVouchers.length - 1 ? 'var(--color-grey-light)' : 'var(--color-black)',
                    border: 'var(--border)', cursor: currentVoucherIdx === allVouchers.length - 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <span className="icon-outlined" style={{ fontSize: 20, color: currentVoucherIdx === allVouchers.length - 1 ? 'var(--color-grey)' : 'var(--color-white)' }}>chevron_right</span>
                </button>
              </div>

              {/* Dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', alignItems: 'center' }}>
                {allVouchers.map((_, i) => (
                  <button key={i} onClick={() => setCurrentVoucherIdx(i)} style={{
                    width: i === currentVoucherIdx ? 20 : 6, height: 6,
                    background: i === currentVoucherIdx ? 'var(--color-black)' : 'var(--color-grey-mid)',
                    border: 'none', cursor: 'pointer', transition: 'all var(--transition-base)',
                  }} />
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                {currentVoucherIdx + 1} of {allVouchers.length} vouchers
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PRIZES TAB ── */}
      {tab === 'prizes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {!limits.prizes ? (
            <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
              <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>emoji_events</span>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                Prizes not available on Starter plan
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                Upgrade to Growth or Enterprise to unlock prize draws for your campaigns.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 4 }}>Prize draws</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    Draws go live automatically when enough customers qualify. You can pause or unpause manually.
                  </div>
                </div>
                <button onClick={() => setShowAddPrize(true)} className="btn btn-primary" style={{ flexShrink: 0 }}>
                  <span className="icon-outlined icon-sm">add</span>
                  Add prize draw
                </button>
              </div>

              {prizes.length === 0 ? (
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
                  <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>card_giftcard</span>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>No prize draws yet</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    Add a prize draw to incentivise saving across your campaigns.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  {prizes.map(prize => {
                    const status = prize.status || 'draft'
                    const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.draft
                    const qualifying = qualifyingCounts[prize.id] || 0
                    const qualifies  = qualifying >= prize.min_qualifying_users

                    return (
                      <div key={prize.id} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                        {/* Type accent bar */}
                        <div style={{ height: 3, background: prize.prize_type === 'item' ? 'var(--color-primary)' : 'var(--color-yellow)' }} />
                        <div style={{ padding: 'var(--space-4)' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              <div style={{
                                width: 44, height: 44, flexShrink: 0,
                                background: 'var(--color-black)', border: 'var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <span className="icon-outlined" style={{ fontSize: 22, color: prize.prize_type === 'item' ? 'var(--color-primary)' : 'var(--color-yellow)' }}>
                                  {prize.prize_type === 'item' ? 'card_giftcard' : 'discount'}
                                </span>
                              </div>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                                  {prize.prize_type === 'item' ? 'Item prize' : 'Discount prize'}
                                </div>
                                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{prize.title}</div>
                                {prize.prize_type === 'discount' && prize.discount_percentage && (
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: '#8A6700' }}>
                                    {prize.discount_percentage}% off at payment
                                  </div>
                                )}
                                {prize.prize_type === 'item' && prize.products?.name && (
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>
                                    {prize.products.name}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`badge no-dot ${cfg.badge}`} style={{ flexShrink: 0 }}>{cfg.label}</span>
                          </div>

                          {/* Details */}
                          <div style={{ border: 'var(--border)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                            {[
                              { label: 'Campaign',           value: prize.campaigns?.name || '—' },
                              { label: 'Winners',            value: prize.number_of_winners },
                              { label: 'Draw date',          value: new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
                              { label: 'Min. balance',       value: prize.min_balance_percentage + '% of target' },
                              { label: 'Qualifying entries', value: `${qualifying} / ${prize.min_qualifying_users} needed`, accent: qualifies ? '#2D8B45' : '#8A6700' },
                              { label: 'Draws run',          value: prizeDraws.filter(d => d.prize_id === prize.id).length },
                            ].map((row, i, arr) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: row.accent || 'var(--color-black)' }}>{row.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Status actions */}
                          {status === 'draft' && (
                            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', textAlign: 'center' }}>
                              Waiting for {prize.min_qualifying_users - qualifying} more qualifying customer{prize.min_qualifying_users - qualifying !== 1 ? 's' : ''} to go live
                            </div>
                          )}

                          {status === 'live' && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <button onClick={() => { setShowRunDraw(prize); setDrawResult(null) }} className="btn btn-primary" style={{ flex: 1 }}>
                                <span className="icon-outlined icon-sm">casino</span>
                                Run draw
                              </button>
                              <button onClick={() => handleTogglePause(prize)} disabled={togglingPrizeId === prize.id} className="btn btn-sm btn-warning" style={{ flexShrink: 0 }}>
                                <span className="icon-outlined icon-xs">pause</span>
                              </button>
                            </div>
                          )}

                          {status === 'paused' && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <div style={{ flex: 1, padding: 'var(--space-2) var(--space-3)', background: 'var(--color-yellow)', border: 'var(--border)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textAlign: 'center' }}>
                                Draw paused
                              </div>
                              <button onClick={() => handleTogglePause(prize)} disabled={togglingPrizeId === prize.id} className="btn btn-sm btn-success" style={{ flexShrink: 0 }}>
                                <span className="icon-outlined icon-xs">play_arrow</span>
                              </button>
                            </div>
                          )}

                          {status === 'completed' && (
                            <div className="badge badge-success no-dot" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) var(--space-3)', width: '100%' }}>
                              <span className="icon-outlined icon-xs">check_circle</span>
                              Draw completed
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Past draws table */}
              {prizeDraws.length > 0 && (
                <div className="table-wrapper">
                  <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: 'var(--border)', background: 'var(--color-white)' }}>
                    <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)' }}>Past prize draws</span>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Prize</th>
                        <th>Draw date</th>
                        <th>Winning code</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prizeDraws.map(draw => (
                        <tr key={draw.id}>
                          <td style={{ fontWeight: 'var(--weight-semibold)' }}>{draw.prizes?.title || '—'}</td>
                          <td style={{ color: 'var(--color-grey)' }}>
                            {new Date(draw.drawn_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', background: 'var(--color-black)', color: 'var(--color-primary)', padding: '2px var(--space-2)' }}>
                              {draw.winning_code}
                            </span>
                          </td>
                          <td>
                            <span className={`badge no-dot ${draw.status === 'fulfilled' ? 'badge-success' : 'badge-warning'}`}>
                              {draw.status === 'fulfilled' ? 'Fulfilled' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}