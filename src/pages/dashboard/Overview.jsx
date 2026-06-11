import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const UGANDA_BANKS = [
  'ABSA Uganda',
  'Bank of Africa (Uganda)',
  'Bank of Baroda',
  'Cairo Bank Uganda',
  'Centenary Rural Development Bank (UG)',
  'DFCU Uganda',
  'Diamond Trust Bank Uganda',
  'Ecobank Uganda',
  'Equity Bank Uganda',
  'Exim Bank',
  'Finance Trust Bank',
  'Guaranty Trust Bank Uganda (GT Bank)',
  'Housing Finance Bank',
  'I & M Bank Uganda (Orient)',
  'KCB Bank Uganda',
  'NCBA Bank Uganda',
  'Opportunity Bank Uganda',
  'Post Bank Uganda',
  'Stanbic Bank Uganda',
  'Standard Chartered Bank Uganda',
  'Tropical Bank Uganda',
  'United Bank for Africa Uganda (UBA)',
]

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div className="rounded-2xl p-5 cursor-default"
      style={{ background: '#fff', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}>
      <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{label}</div>
      <div className="text-2xl font-bold mb-0.5" style={{ color: color || PARTNA_PRIMARY }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{sub}</div>}
    </div>
  )
}

const CHART_FILTERS = [
  { label: 'Past 7 days', days: 7 },
  { label: 'Past month', days: 30 },
  { label: 'Past year', days: 365 },
]

export default function Overview({ admin, business }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSavings: 0, activeCustomers: 0, totalPayments: 0 })
  const [businessWallet, setBusinessWallet] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [chartData, setChartData] = useState([])
  const [chartFilter, setChartFilter] = useState(7)
  const [chartType, setChartType] = useState('bar')
  const [allTxns, setAllTxns] = useState([])

  // Withdrawal modal
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawTab, setWithdrawTab] = useState('mobilemoney') // 'mobilemoney' | 'bank'
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

  // Mobile money form
  const [mmNetwork, setMmNetwork] = useState('MTN')
  const [mmRecipientName, setMmRecipientName] = useState('')
  const [mmPhone, setMmPhone] = useState('')
  const [mmNotifyPhone, setMmNotifyPhone] = useState('')

  // Bank form
  const [bankName, setBankName] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankNotifyPhone, setBankNotifyPhone] = useState('')

  useEffect(() => {
    if (business) loadData()
  }, [business])

  useEffect(() => {
    if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter)
  }, [chartFilter, allTxns])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customers } = await supabase
        .from('customers').select('id, first_name, last_name, created_at, registration_status')
        .eq('business_id', business.id)
      const customerIds = customers?.map(c => c.id) || []

      let totalSavings = 0
      if (customerIds.length > 0) {
        const { data: wallets } = await supabase
          .from('wallets').select('balance').in('customer_id', customerIds)
        totalSavings = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
      }

      const { data: campaignData } = await supabase
        .from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campaignData || [])

      let totalPayments = 0
      let txns = []
      if (customerIds.length > 0) {
        const { data: payments } = await supabase
          .from('transactions').select('amount').in('customer_id', customerIds).eq('type', 'payment')
        totalPayments = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0

        const { data: allTxnData } = await supabase
          .from('transactions').select('*, customers(first_name, last_name)')
          .in('customer_id', customerIds).order('created_at', { ascending: false })
        txns = allTxnData || []
      }

      // Business wallet balance
      const { data: bizWallet } = await supabase
        .from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      setBusinessWallet(bizWallet)

      setAllTxns(txns)
      setRecentActivity(txns.slice(0, 10))
      buildChartData(txns, chartFilter)

      setStats({
        totalSavings,
        activeCustomers: customers?.length || 0,
        totalPayments,
      })
    } catch (e) {
      console.error('Overview load error:', e)
    }
    setLoading(false)
  }

  function buildChartData(txns, days) {
    const points = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      let label = ''
      if (days === 7) label = date.toLocaleDateString('en-UG', { weekday: 'short' })
      else if (days === 30) label = date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
      else label = date.toLocaleDateString('en-UG', { month: 'short' })
      points.push({ label, date: date.toDateString(), deposits: 0, withdrawals: 0 })
    }

    if (days === 365) {
      const monthMap = {}
      points.forEach(p => { if (!monthMap[p.label]) monthMap[p.label] = { label: p.label, deposits: 0, withdrawals: 0 } })
      txns.forEach(txn => {
        const d = new Date(txn.created_at)
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
        if (d < cutoff) return
        const key = d.toLocaleDateString('en-UG', { month: 'short' })
        if (monthMap[key]) {
          if (txn.type === 'deposit') monthMap[key].deposits += Number(txn.amount)
          else if (txn.type === 'withdrawal') monthMap[key].withdrawals += Number(txn.amount)
        }
      })
      setChartData(Object.values(monthMap))
      return
    }

    txns.forEach(txn => {
      const d = new Date(txn.created_at)
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
      if (d < cutoff) return
      const point = points.find(p => p.date === d.toDateString())
      if (point) {
        if (txn.type === 'deposit') point.deposits += Number(txn.amount)
        else if (txn.type === 'withdrawal') point.withdrawals += Number(txn.amount)
      }
    })
    setChartData(points)
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatUGXFull(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatAmountInput(val) {
    const digits = val.replace(/\D/g, '')
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function txColor(type) { return type === 'deposit' ? '#16A34A' : '#DC2626' }
  function txIcon(type) { return type === 'deposit' ? '↓' : '↑' }
  function txLabel(type) {
    switch (type) {
      case 'deposit': return 'Deposit'
      case 'withdrawal': return 'Withdrawal'
      case 'payment': return 'Fee payment'
      default: return type
    }
  }

  function resetWithdrawForm() {
    setWithdrawAmount('')
    setWithdrawError('')
    setWithdrawSuccess(false)
    setMmNetwork('MTN')
    setMmRecipientName('')
    setMmPhone('')
    setMmNotifyPhone('')
    setBankName('')
    setBankAccountName('')
    setBankAccountNumber('')
    setBankNotifyPhone('')
  }

  async function handleWithdraw() {
    setWithdrawError('')
    const amount = parseInt(withdrawAmount.replace(/,/g, ''), 10)
    const balance = businessWallet ? Number(businessWallet.balance) : 0

    if (!amount || amount < 1000) {
      setWithdrawError('Minimum withdrawal is UGX 1,000.')
      return
    }
    if (amount > balance) {
      setWithdrawError('Amount exceeds your available balance.')
      return
    }

    if (withdrawTab === 'mobilemoney') {
      if (!mmRecipientName.trim()) { setWithdrawError("Recipient's name is required."); return }
      if (!mmPhone.trim()) { setWithdrawError('Recipient phone number is required.'); return }
    } else {
      if (!bankName) { setWithdrawError('Please select a bank.'); return }
      if (!bankAccountName.trim()) { setWithdrawError('Account name is required.'); return }
      if (!bankAccountNumber.trim()) { setWithdrawError('Account number is required.'); return }
    }

    setWithdrawLoading(true)
    try {
      const notes = withdrawTab === 'mobilemoney'
        ? `${mmNetwork} MoMo · ${mmRecipientName} · ${mmPhone}${mmNotifyPhone ? ` · Notify: ${mmNotifyPhone}` : ''}`
        : `Bank: ${bankName} · ${bankAccountName} · ${bankAccountNumber}${bankNotifyPhone ? ` · Notify: ${bankNotifyPhone}` : ''}`

      // Record as pending business transaction — admin processes manually
      await supabase.from('business_transactions').insert({
        business_id: business.id,
        type: 'withdrawal',
        amount,
        status: 'pending',
        notes,
      })

      // Deduct from business wallet immediately to prevent double withdrawal
      await supabase.from('business_wallets')
        .update({ balance: balance - amount })
        .eq('business_id', business.id)

      setBusinessWallet(prev => ({ ...prev, balance: balance - amount }))
      setWithdrawSuccess(true)
      await loadData()
    } catch (e) {
      console.error('Withdrawal error:', e)
      setWithdrawError('Something went wrong. Please try again.')
    }
    setWithdrawLoading(false)
  }

  const chartMax = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)
  const bizBalance = businessWallet ? Number(businessWallet.balance) : 0
  const isEducation = business?.sector === 'Education' || business?.sector === 'education'

  function buildPath(data, key, max, width, height) {
    if (data.length === 0) return ''
    const step = width / (data.length - 1 || 1)
    return data.map((d, i) => {
      const x = i * step
      const y = height - (d[key] / max) * height
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
    }).join(' ')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* ── WITHDRAWAL MODAL ── */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="px-6 py-5 flex items-center justify-between"
              style={{ background: PARTNA_PRIMARY }}>
              <div>
                <div className="text-white text-base font-bold">Withdraw funds</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Available: {formatUGXFull(bizBalance)}
                </div>
              </div>
              <button
                onClick={() => { setShowWithdraw(false); resetWithdrawForm() }}
                className="text-white text-xl opacity-70">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {withdrawSuccess ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="text-4xl">✅</div>
                  <div className="text-center">
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
                      Withdrawal request submitted
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      Your withdrawal of {formatUGXFull(parseInt(withdrawAmount.replace(/,/g, ''), 10))} has been submitted.
                      Funds will be transferred within 1–2 business days.
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowWithdraw(false); resetWithdrawForm() }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Method tabs */}
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f0f2f5' }}>
                    {[
                      { id: 'mobilemoney', label: '📱 Mobile Money' },
                      { id: 'bank', label: '🏦 Bank Transfer' },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => { setWithdrawTab(tab.id); setWithdrawError('') }}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold"
                        style={{
                          background: withdrawTab === tab.id ? '#fff' : 'transparent',
                          color: withdrawTab === tab.id ? PARTNA_PRIMARY : 'rgba(0,0,0,0.4)',
                          boxShadow: withdrawTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Amount (UGX)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                      <input type="text" inputMode="numeric" placeholder="0" value={withdrawAmount}
                        onChange={e => setWithdrawAmount(formatAmountInput(e.target.value))}
                        className="w-full pl-14 pr-4 py-3 rounded-xl text-lg font-bold outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }} />
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                      Minimum UGX 1,000 · Available: {formatUGXFull(bizBalance)}
                    </div>
                  </div>

                  {/* ── MOBILE MONEY FIELDS ── */}
                  {withdrawTab === 'mobilemoney' && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                          Account type
                        </label>
                        <div className="flex gap-3">
                          {['MTN', 'Airtel'].map(net => (
                            <button key={net} onClick={() => setMmNetwork(net)}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                              style={{
                                background: mmNetwork === net ? PARTNA_PRIMARY : '#f0f2f5',
                                color: mmNetwork === net ? '#fff' : 'rgba(0,0,0,0.5)',
                              }}>
                              {net === 'MTN' ? '📲 MTN MoMo' : '📲 Airtel Money'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {[
                        { label: "Recipient's name *", value: mmRecipientName, set: setMmRecipientName, placeholder: 'Full name on mobile money account' },
                        { label: "Recipient's phone number *", value: mmPhone, set: setMmPhone, placeholder: '+256 7XX XXX XXX', type: 'tel' },
                        { label: 'Notification phone number (optional)', value: mmNotifyPhone, set: setMmNotifyPhone, placeholder: '+256 7XX XXX XXX', type: 'tel' },
                      ].map(f => (
                        <div key={f.label} className="flex flex-col gap-1">
                          <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{f.label}</label>
                          <input type={f.type || 'text'} value={f.value} onChange={e => f.set(e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                            style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                        </div>
                      ))}
                    </>
                  )}

                  {/* ── BANK TRANSFER FIELDS ── */}
                  {withdrawTab === 'bank' && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Bank *</label>
                        <select value={bankName} onChange={e => setBankName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                          style={{ background: '#f0f2f5', border: 'none', color: bankName ? '#333' : 'rgba(0,0,0,0.4)' }}>
                          <option value="">Select bank</option>
                          {UGANDA_BANKS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      {[
                        { label: 'Account name *', value: bankAccountName, set: setBankAccountName, placeholder: 'Name on bank account' },
                        { label: 'Account number *', value: bankAccountNumber, set: setBankAccountNumber, placeholder: 'Bank account number' },
                        { label: 'Notification phone number (optional)', value: bankNotifyPhone, set: setBankNotifyPhone, placeholder: '+256 7XX XXX XXX', type: 'tel' },
                      ].map(f => (
                        <div key={f.label} className="flex flex-col gap-1">
                          <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{f.label}</label>
                          <input type={f.type || 'text'} value={f.value} onChange={e => f.set(e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                            style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                        </div>
                      ))}
                    </>
                  )}

                  {withdrawError && (
                    <div className="text-xs px-4 py-3 rounded-xl"
                      style={{ background: '#FEE2E2', color: '#991B1B' }}>
                      {withdrawError}
                    </div>
                  )}

                  <div className="px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(27,79,114,0.05)', color: 'rgba(0,0,0,0.5)' }}>
                    ℹ️ Withdrawals are processed within 1–2 business days by the Partna team.
                  </div>

                  <button onClick={handleWithdraw} disabled={withdrawLoading}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{
                      background: withdrawLoading ? 'rgba(27,79,114,0.4)' : PARTNA_PRIMARY,
                      color: '#fff',
                    }}>
                    {withdrawLoading ? 'Submitting...' : `Request withdrawal of ${withdrawAmount ? 'UGX ' + withdrawAmount : '...'}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Savings (AUM)" value={formatUGX(stats.totalSavings)} sub="Across all customers" />
        <StatCard label="Active Customers" value={stats.activeCustomers} sub="Registered accounts" />
        <StatCard
          label={isEducation ? 'Total Fees Received' : 'Total Payments Received'}
          value={formatUGX(stats.totalPayments)}
          sub={isEducation ? 'From all students' : 'Completed payments'}
          color="#16A34A"
        />
        <StatCard label="Active Campaigns" value={campaigns.length}
          sub={campaigns[0]?.name || 'No active campaign'} color={PARTNA_GOLD} />
        {/* Business wallet card */}
        <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: '#fff' }}>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
              Business Wallet
            </div>
            <div className="text-2xl font-bold mb-0.5"
              style={{ color: bizBalance > 0 ? '#16A34A' : 'rgba(0,0,0,0.3)' }}>
              {formatUGX(bizBalance)}
            </div>
            <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Available to withdraw
            </div>
          </div>
          <button
            onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError('') }}
            disabled={bizBalance === 0}
            className="w-full py-2 rounded-xl text-xs font-bold"
            style={{
              background: bizBalance > 0 ? PARTNA_PRIMARY : 'rgba(0,0,0,0.06)',
              color: bizBalance > 0 ? '#fff' : 'rgba(0,0,0,0.3)',
            }}>
            Withdraw
          </button>
        </div>
      </div>

      {/* ── CHART + RECENT ACTIVITY ── */}
      <div className="grid grid-cols-3 gap-4">

        <div className="col-span-2 rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>
              Deposits & Withdrawals
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 mr-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: '#16A34A' }} />
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Deposits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: '#DC2626' }} />
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Withdrawals</span>
                </div>
              </div>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(27,79,114,0.15)' }}>
                <button onClick={() => setChartType('bar')} className="px-2 py-1.5 text-xs font-semibold"
                  style={{ background: chartType === 'bar' ? PARTNA_PRIMARY : '#fff', color: chartType === 'bar' ? '#fff' : 'rgba(0,0,0,0.4)' }}>
                  ▦ Bar
                </button>
                <button onClick={() => setChartType('line')} className="px-2 py-1.5 text-xs font-semibold"
                  style={{ background: chartType === 'line' ? PARTNA_PRIMARY : '#fff', color: chartType === 'line' ? '#fff' : 'rgba(0,0,0,0.4)', borderLeft: '1px solid rgba(27,79,114,0.15)' }}>
                  ↗ Line
                </button>
              </div>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(27,79,114,0.15)' }}>
                {CHART_FILTERS.map((f, i) => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)}
                    className="px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: chartFilter === f.days ? PARTNA_PRIMARY : '#fff',
                      color: chartFilter === f.days ? '#fff' : 'rgba(0,0,0,0.4)',
                      borderLeft: i > 0 ? '1px solid rgba(27,79,114,0.15)' : 'none',
                    }}>
                    {f.label.replace('Past ', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!hasData ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>No transaction data yet</div>
            </div>
          ) : chartType === 'bar' ? (
            <div className="flex items-end gap-1 h-40">
              {chartData.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                    <div className="flex-1 rounded-t-sm transition-all"
                      style={{ height: `${(day.deposits / chartMax) * 100}%`, background: '#16A34A', minHeight: day.deposits > 0 ? '2px' : '0' }} />
                    <div className="flex-1 rounded-t-sm transition-all"
                      style={{ height: `${(day.withdrawals / chartMax) * 100}%`, background: '#DC2626', minHeight: day.withdrawals > 0 ? '2px' : '0' }} />
                  </div>
                  {(chartFilter === 7 || i % Math.ceil(chartData.length / 10) === 0) && (
                    <div className="text-center" style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px' }}>{day.label}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: '160px', position: 'relative' }}>
              <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none" style={{ display: 'block' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <line key={i} x1="0" y1={140 * pct} x2="600" y2={140 * pct} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                ))}
                <path d={buildPath(chartData, 'deposits', chartMax, 600, 130)} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={buildPath(chartData, 'withdrawals', chartMax, 600, 130)} fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  return d.deposits > 0 ? <circle key={`dep-${i}`} cx={x} cy={130 - (d.deposits / chartMax) * 130} r="3" fill="#16A34A" /> : null
                })}
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  return d.withdrawals > 0 ? <circle key={`wdr-${i}`} cx={x} cy={130 - (d.withdrawals / chartMax) * 130} r="3" fill="#DC2626" /> : null
                })}
              </svg>
              <div className="flex justify-between mt-1">
                {chartData.filter((_, i) => chartFilter === 7 || i % Math.ceil(chartData.length / 7) === 0).map((d, i) => (
                  <span key={i} style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px' }}>{d.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Recent Activity</div>
            <button onClick={() => navigate('/dashboard/payments')}
              className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>See all</button>
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>No activity yet</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentActivity.slice(0, 8).map((txn, i) => (
                <div key={txn.id} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: i < Math.min(recentActivity.length, 8) - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                    {txIcon(txn.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: '#333' }}>
                      {txn.customers?.first_name} {txn.customers?.last_name}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                      {txLabel(txn.type)}
                    </div>
                  </div>
                  <div className="text-xs font-bold flex-shrink-0" style={{ color: txColor(txn.type) }}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CAMPAIGNS SUMMARY ── */}
      {campaigns.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Active Campaigns</div>
            <button onClick={() => navigate('/dashboard/campaigns')}
              className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>Manage campaigns</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {campaigns.slice(0, 3).map(c => {
              const progress = Math.min((stats.totalSavings / Number(c.target_amount)) * 100, 100)
              const daysLeft = Math.max(Math.ceil((new Date(c.target_date).getTime() - Date.now()) / 86400000), 0)
              return (
                <div key={c.id} className="rounded-xl p-4" style={{ background: '#f0f2f5' }}>
                  <div className="text-xs font-bold mb-1 truncate" style={{ color: PARTNA_PRIMARY }}>{c.name}</div>
                  <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Target: {formatUGXFull(c.target_amount)}
                  </div>
                  <div className="w-full h-1.5 rounded-full mb-1" style={{ background: 'rgba(27,79,114,0.15)' }}>
                    <div className="h-1.5 rounded-full"
                      style={{ width: `${progress}%`, background: progress >= 75 ? '#16A34A' : PARTNA_GOLD }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    <span>{progress.toFixed(0)}% saved</span>
                    <span>{daysLeft} days left</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
          <div className="text-3xl mb-3">🎯</div>
          <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No campaigns yet</div>
          <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
            Create your first campaign to start enrolling customers
          </div>
          <button onClick={() => navigate('/dashboard/campaigns')}
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
            Create campaign
          </button>
        </div>
      )}

    </div>
  )
}