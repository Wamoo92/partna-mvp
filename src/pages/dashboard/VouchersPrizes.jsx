import { useState, useEffect } from 'react'
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

export default function VouchersPrizes({ admin, business }) {
  const [tab, setTab] = useState('vouchers')
  const [loading, setLoading] = useState(true)

  // Vouchers
  const [allVouchers, setAllVouchers] = useState([])
  const [campaignVouchers, setCampaignVouchers] = useState([])
  const [voucherClaims, setVoucherClaims] = useState({})
  const [campaigns, setCampaigns] = useState([])

  // Prizes
  const [prizes, setPrizes] = useState([])
  const [prizeDraws, setPrizeDraws] = useState([])
  const [prizePotWallets, setPrizePotWallets] = useState([])
  const [customers, setCustomers] = useState([])

  // Prize draw modal
  const [showRunDraw, setShowRunDraw] = useState(null)
  const [drawLoading, setDrawLoading] = useState(false)
  const [drawResult, setDrawResult] = useState(null)

  // Fund prize pot modal
  const [showFundPot, setShowFundPot] = useState(null)
  const [fundAmount, setFundAmount] = useState('')

  useEffect(() => {
    if (business) loadAll()
  }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      // Campaigns
      const { data: campaignData } = await supabase
        .from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campaignData || [])

      const campaignIds = campaignData?.map(c => c.id) || []

      // All available vouchers + their merchants
      const { data: voucherData } = await supabase
        .from('vouchers').select('*, merchants(id, name, category)')
        .in('campaign_id', campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000'])
      setAllVouchers(voucherData || [])

      // Voucher claims count per voucher
      if (voucherData && voucherData.length > 0) {
        const vIds = voucherData.map(v => v.id)
        const { data: claimsData } = await supabase
          .from('voucher_claims').select('voucher_id').in('voucher_id', vIds)
        const claimsMap = {}
        claimsData?.forEach(c => {
          claimsMap[c.voucher_id] = (claimsMap[c.voucher_id] || 0) + 1
        })
        setVoucherClaims(claimsMap)
      }

      // Prizes
      const { data: prizeData } = await supabase
        .from('prizes').select('*, campaigns(name)')
        .in('campaign_id', campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })
      setPrizes(prizeData || [])

      // Prize draws (past winners)
      const prizeIds = prizeData?.map(p => p.id) || []
      if (prizeIds.length > 0) {
        const { data: drawData } = await supabase
          .from('prize_draws').select('*, prizes(title)')
          .in('prize_id', prizeIds)
          .order('drawn_at', { ascending: false })
        setPrizeDraws(drawData || [])
      }

      // Prize pot wallets
      const { data: potData } = await supabase
        .from('prize_pot_wallets').select('*').eq('business_id', business.id)
      setPrizePotWallets(potData || [])

      // Customers (for draw)
      const { data: customerData } = await supabase
        .from('customers').select('id, first_name, last_name, draw_code')
        .eq('business_id', business.id)
      setCustomers(customerData || [])

    } catch (e) {
      console.error('VouchersPrizes load error:', e)
    }
    setLoading(false)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatAmountInput(val) {
    const digits = val.replace(/\D/g, '')
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function getPrizePot(campaignId) {
    return prizePotWallets.find(p => p.campaign_id === campaignId)
  }

  async function handleFundPot() {
    if (!showFundPot || !fundAmount) return
    const amount = parseInt(fundAmount.replace(/,/g, ''), 10)
    if (isNaN(amount) || amount < 1000) return

    try {
      const existing = getPrizePot(showFundPot.campaign_id)
      if (existing) {
        await supabase.from('prize_pot_wallets')
          .update({ balance: Number(existing.balance) + amount })
          .eq('id', existing.id)
      } else {
        await supabase.from('prize_pot_wallets').insert({
          business_id: business.id,
          campaign_id: showFundPot.campaign_id,
          balance: amount,
        })
      }
      setShowFundPot(null)
      setFundAmount('')
      await loadAll()
    } catch (e) {
      console.error('Fund pot error:', e)
    }
  }

  async function handleRunDraw(prize) {
    setDrawLoading(true)
    setDrawResult(null)
    try {
      // Get qualifying customers
      const { data: wallets } = await supabase
        .from('wallets').select('customer_id, balance')
        .in('customer_id', customers.map(c => c.id))

      const campaignData = campaigns.find(c => c.id === prize.campaign_id)
      const minBalance = campaignData
        ? Number(campaignData.target_amount) * (Number(prize.min_balance_percentage) / 100)
        : 0

      const qualifying = wallets?.filter(w => Number(w.balance) >= minBalance) || []

      if (qualifying.length === 0) {
        setDrawResult({ error: 'No customers qualify for this draw yet.' })
        setDrawLoading(false)
        return
      }

      // Pick random winner(s)
      const winners = []
      const pool = [...qualifying]
      for (let i = 0; i < Math.min(prize.number_of_winners, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length)
        winners.push(pool.splice(idx, 1)[0])
      }

      // Record draws
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

        // If cash prize — transfer to winner wallet
        if (prize.prize_type === 'cash' && prize.prize_value) {
          const { data: wData } = await supabase
            .from('wallets').select('*').eq('customer_id', winner.customer_id).single()
          if (wData) {
            await supabase.from('wallets')
              .update({ balance: Number(wData.balance) + Number(prize.prize_value) })
              .eq('id', wData.id)
            await supabase.from('transactions').insert({
              customer_id: winner.customer_id,
              wallet_id: wData.id,
              type: 'deposit',
              amount: prize.prize_value,
              status: 'completed',
              notes: `Prize: ${prize.title}`,
            })
            // Deduct from prize pot
            const pot = getPrizePot(prize.campaign_id)
            if (pot) {
              await supabase.from('prize_pot_wallets')
                .update({ balance: Math.max(0, Number(pot.balance) - Number(prize.prize_value)) })
                .eq('id', pot.id)
            }
          }
        }
      }

      const winnerDetails = winners.map(w => {
        const c = customers.find(cu => cu.id === w.customer_id)
        return { name: c ? `${c.first_name} ${c.last_name}` : 'Unknown', code: c?.draw_code || '—' }
      })

      setDrawResult({ winners: winnerDetails, total: qualifying.length })
      await loadAll()
    } catch (e) {
      console.error('Draw error:', e)
      setDrawResult({ error: 'Something went wrong running the draw.' })
    }
    setDrawLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Tabs */}
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
          {allVouchers.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
              <div className="text-4xl mb-3">🎫</div>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No vouchers yet</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Vouchers are managed by Partna and assigned to your campaigns.
                Contact your account manager to add vouchers.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {allVouchers.map(voucher => {
                const merchant = voucher.merchants
                const logo = getMerchantLogo(merchant?.name)
                const claims = voucherClaims[voucher.id] || 0
                const campaign = campaigns.find(c => c.id === voucher.campaign_id)
                const minBal = campaign
                  ? Number(campaign.target_amount) * (Number(voucher.min_balance_percentage) / 100)
                  : 0

                return (
                  <div key={voucher.id} className="rounded-2xl p-5" style={{ background: '#fff' }}>
                    <div className="flex items-start gap-3 mb-3">
                      {logo ? (
                        <img src={logo} alt={merchant?.name}
                          className="w-12 h-12 object-contain rounded-xl flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                          style={{ background: 'rgba(27,79,114,0.08)' }}>🎫</div>
                      )}
                      <div>
                        <div className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {merchant?.name}
                        </div>
                        <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>
                          {voucher.title}
                        </div>
                      </div>
                      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${voucher.is_active ? '' : ''}`}
                        style={{
                          background: voucher.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                          color: voucher.is_active ? '#16A34A' : 'rgba(0,0,0,0.4)',
                        }}>
                        {voucher.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      {voucher.description}
                    </div>

                    {[
                      { label: 'Campaign', value: campaign?.name || '—' },
                      { label: 'Min. balance to unlock', value: formatUGX(minBal) },
                      { label: 'Times claimed', value: claims + ' customer' + (claims !== 1 ? 's' : '') },
                    ].map((row, i, arr) => (
                      <div key={i} className="flex justify-between items-center py-1.5"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                        <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PRIZES TAB ── */}
      {tab === 'prizes' && (
        <div className="flex flex-col gap-6">

          {/* Prize pot wallets */}
          {campaigns.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>💰 Prize Pot</div>
              <div className="grid grid-cols-3 gap-4">
                {campaigns.map(c => {
                  const pot = getPrizePot(c.id)
                  const balance = pot ? Number(pot.balance) : 0
                  const hasActiveCashPrize = prizes.some(p =>
                    p.campaign_id === c.id && p.prize_type === 'cash' && p.is_active
                  )
                  return (
                    <div key={c.id} className="rounded-xl p-4" style={{ background: '#f0f2f5' }}>
                      <div className="text-xs font-semibold mb-1 truncate" style={{ color: PARTNA_PRIMARY }}>
                        {c.name}
                      </div>
                      <div className="text-lg font-bold mb-2" style={{ color: balance > 0 ? '#16A34A' : 'rgba(0,0,0,0.3)' }}>
                        {formatUGX(balance)}
                      </div>
                      <button
                        onClick={() => setShowFundPot({ campaign_id: c.id, campaign_name: c.name })}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                        + Add funds
                      </button>
                      {hasActiveCashPrize && balance === 0 && (
                        <div className="text-xs mt-2 text-center" style={{ color: '#DC2626' }}>
                          ⚠ Fund before draw can run
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active prizes */}
          {prizes.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
              <div className="text-4xl mb-3">🏆</div>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No prizes yet</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Add prizes when creating or editing a campaign
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {prizes.map(prize => {
                const pot = getPrizePot(prize.campaign_id)
                const potBalance = pot ? Number(pot.balance) : 0
                const canRunDraw = prize.prize_type !== 'cash' || potBalance >= Number(prize.prize_value || 0)
                const drawPassed = new Date(prize.draw_date) < new Date()
                const pastDraws = prizeDraws.filter(d => d.prize_id === prize.id)

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
                        style={{
                          background: prize.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                          color: prize.is_active ? '#16A34A' : 'rgba(0,0,0,0.4)',
                        }}>
                        {prize.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {[
                      { label: 'Campaign', value: prize.campaigns?.name || '—' },
                      { label: 'Winners', value: prize.number_of_winners },
                      { label: 'Draw date', value: new Date(prize.draw_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
                      { label: 'Min. balance %', value: prize.min_balance_percentage + '%' },
                      { label: 'Draws run', value: pastDraws.length },
                    ].map((row, i, arr) => (
                      <div key={i} className="flex justify-between items-center py-1.5"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                        <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                      </div>
                    ))}

                    {/* Draw actions */}
                    <div className="flex gap-2 mt-3">
                      {canRunDraw ? (
                        <button
                          onClick={() => { setShowRunDraw(prize); setDrawResult(null) }}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                          🎲 Run draw
                        </button>
                      ) : (
                        <div className="flex-1 py-2 rounded-xl text-xs font-semibold text-center"
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

          {/* Past draws table */}
          {prizeDraws.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Past Prize Draws</div>
              </div>
              <div className="grid px-5 py-3 text-xs font-bold"
                style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr', color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafafa' }}>
                <span>Prize</span>
                <span>Draw date</span>
                <span>Winning code</span>
                <span>Status</span>
              </div>
              {prizeDraws.map((draw, i) => (
                <div key={draw.id} className="grid items-center px-5 py-3"
                  style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr', borderBottom: i < prizeDraws.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    {draw.prizes?.title || '—'}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {new Date(draw.drawn_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: PARTNA_GOLD }}>
                    {draw.winning_code}
                  </span>
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
        </div>
      )}

      {/* Run draw modal */}
      {showRunDraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>
                Run Prize Draw
              </div>
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
                    {drawResult.total} qualifying customers · {drawResult.winners.length} winner{drawResult.winners.length !== 1 ? 's' : ''} selected
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
                  {drawLoading ? 'Running draw...' : '🎲 Confirm & run draw'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fund prize pot modal */}
      {showFundPot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Fund Prize Pot</div>
              <button onClick={() => { setShowFundPot(null); setFundAmount('') }}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Adding funds to prize pot for: <strong>{showFundPot.campaign_name}</strong>
            </div>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Amount (UGX)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                <input type="text" inputMode="numeric" placeholder="0"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                  className="w-full pl-14 pr-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Demo: funds recorded without actual payment processing
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowFundPot(null); setFundAmount('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                Cancel
              </button>
              <button onClick={handleFundPot}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                Add funds
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}