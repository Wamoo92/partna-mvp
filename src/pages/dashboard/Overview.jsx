import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const UGANDA_BANKS = [
  'ABSA Uganda',
  'Bank Of Africa (Uganda)',
  'Bank of Baroda',
  'Cairo Bank Uganda',
  'Centenary Rural Development Bank LTD (UG)',
  'DFCU Uganda',
  'Diamond Trust Bank Uganda Limited',
  'Ecobank Uganda Limited',
  'Equity Bank Uganda',
  'Exim bank',
  'Finance Trust',
  'Guaranty Trust Bank Uganda (GT Bank)',
  'Housing Finance Bank',
  'I & M Bank Uganda (Orient)',
  'KCB Bank Uganda Limited',
  'NCBA Bank Uganda Limited',
  'Opportunity Bank',
  'Post Bank Uganda',
  'Stanbic Bank Uganda',
  'Standard Chartered Bank Uganda Limited',
  'Tropical Bank Uganda',
  'United Bank for Africa Uganda Limited (UBA)',
]

const CHART_FILTERS = [
  { label: '7d',   days: 7   },
  { label: '30d',  days: 30  },
  { label: '1yr',  days: 365 },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatUGXFull(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function txAccent(type) {
  switch (type) {
    case 'deposit':    return 'var(--color-green)'
    case 'withdrawal': return 'var(--color-yellow)'
    case 'payment':    return 'var(--color-primary)'
    default:           return 'var(--color-grey-light)'
  }
}

function txIcon(type) {
  switch (type) {
    case 'deposit':    return 'south'
    case 'withdrawal': return 'north'
    case 'payment':    return 'north'
    default:           return 'swap_vert'
  }
}

function txLabel(type) {
  switch (type) {
    case 'deposit':    return 'Deposit'
    case 'withdrawal': return 'Withdrawal'
    case 'payment':    return 'Fee payment'
    default:           return type
  }
}

function txAmountColor(type) {
  return type === 'deposit' ? '#2D8B45' : '#C0392B'
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-white)',
        border: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'box-shadow var(--transition-base), transform var(--transition-fast)' : 'none',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(0,0)' }}}
    >
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-black)',
        letterSpacing: 'var(--tracking-widest)',
        textTransform: 'uppercase',
        color: 'var(--color-grey)',
        marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      {accent && (
        <div style={{ width: 32, height: 3, background: accent, marginBottom: 'var(--space-2)' }} />
      )}
      <div style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-black)',
        letterSpacing: 'var(--tracking-tight)',
        fontVariationSettings: "'wdth' 105, 'opsz' 30",
        color: 'var(--color-black)',
        lineHeight: 1,
        marginBottom: 'var(--space-1)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 'var(--space-1)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── SVG line path ──────────────────────────────────────────────────────────
function buildPath(data, key, max, width, height) {
  if (data.length === 0) return ''
  const step = width / (data.length - 1 || 1)
  return data.map((d, i) => {
    const x = i * step
    const y = height - (d[key] / max) * height
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Overview({ admin, business }) {
  const navigate = useNavigate()
  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState({ totalSavings: 0, activeCustomers: 0, totalPayments: 0 })
  const [businessWallet, setBusinessWallet] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [campaigns, setCampaigns]       = useState([])
  const [chartData, setChartData]       = useState([])
  const [chartFilter, setChartFilter]   = useState(7)
  const [chartType, setChartType]       = useState('bar')
  const [allTxns, setAllTxns]           = useState([])

  // Withdrawal modal
  const [showWithdraw, setShowWithdraw]     = useState(false)
  const [withdrawTab, setWithdrawTab]       = useState('mobilemoney')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError]   = useState('')

  const [mmNetwork, setMmNetwork]                 = useState('MTN')
  const [mmRecipientName, setMmRecipientName]     = useState('')
  const [mmPhone, setMmPhone]                     = useState('')
  const [mmNotifyPhone, setMmNotifyPhone]         = useState('')
  const [bankName, setBankName]                   = useState('')
  const [bankAccountName, setBankAccountName]     = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankNotifyPhone, setBankNotifyPhone]     = useState('')

  useEffect(() => { if (business) loadData() }, [business])
  useEffect(() => { if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter) }, [chartFilter, allTxns])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customers } = await supabase
        .from('customers').select('id, first_name, last_name, created_at, registration_status')
        .eq('business_id', business.id)
      const customerIds = customers?.map(c => c.id) || []

      let totalSavings = 0
      if (customerIds.length > 0) {
        const { data: wallets } = await supabase.from('wallets').select('balance').in('customer_id', customerIds)
        totalSavings = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
      }

      const { data: campaignData } = await supabase.from('campaigns').select('*').eq('business_id', business.id)
      setCampaigns(campaignData || [])

      let totalPayments = 0
      let txns = []
      if (customerIds.length > 0) {
        const { data: payments } = await supabase.from('transactions').select('amount').in('customer_id', customerIds).eq('type', 'payment')
        totalPayments = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
        const { data: allTxnData } = await supabase
          .from('transactions').select('*, customers(first_name, last_name)')
          .in('customer_id', customerIds).order('created_at', { ascending: false })
        txns = allTxnData || []
      }

      const { data: bizWallet } = await supabase.from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      setBusinessWallet(bizWallet)
      setAllTxns(txns)
      setRecentActivity(txns.slice(0, 10))
      buildChartData(txns, chartFilter)
      setStats({ totalSavings, activeCustomers: customers?.length || 0, totalPayments })
    } catch (e) {
      console.error('Overview load error:', e)
    }
    setLoading(false)
  }

  function buildChartData(txns, days) {
    if (days === 365) {
      const monthMap = {}
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i)
        const key = d.toLocaleDateString('en-UG', { month: 'short' })
        if (!monthMap[key]) monthMap[key] = { label: key, deposits: 0, withdrawals: 0 }
      }
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
      txns.forEach(txn => {
        const d = new Date(txn.created_at)
        if (d < cutoff) return
        const key = d.toLocaleDateString('en-UG', { month: 'short' })
        if (monthMap[key]) {
          if (txn.type === 'deposit')    monthMap[key].deposits    += Number(txn.amount)
          if (txn.type === 'withdrawal') monthMap[key].withdrawals += Number(txn.amount)
        }
      })
      setChartData(Object.values(monthMap))
      return
    }

    const points = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i); date.setHours(0, 0, 0, 0)
      const label = days === 7
        ? date.toLocaleDateString('en-UG', { weekday: 'short' })
        : date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
      points.push({ label, date: date.toDateString(), deposits: 0, withdrawals: 0 })
    }

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    txns.forEach(txn => {
      const d = new Date(txn.created_at)
      if (d < cutoff) return
      const point = points.find(p => p.date === d.toDateString())
      if (point) {
        if (txn.type === 'deposit')    point.deposits    += Number(txn.amount)
        if (txn.type === 'withdrawal') point.withdrawals += Number(txn.amount)
      }
    })
    setChartData(points)
  }

  function resetWithdrawForm() {
    setWithdrawAmount(''); setWithdrawError(''); setWithdrawSuccess(false)
    setMmNetwork('MTN'); setMmRecipientName(''); setMmPhone(''); setMmNotifyPhone('')
    setBankName(''); setBankAccountName(''); setBankAccountNumber(''); setBankNotifyPhone('')
  }

  async function handleWithdraw() {
    setWithdrawError('')
    const amount  = parseInt(withdrawAmount.replace(/,/g, ''), 10)
    const balance = businessWallet ? Number(businessWallet.balance) : 0

    if (!amount || amount < 1000)  { setWithdrawError('Minimum withdrawal is UGX 1,000.'); return }
    if (amount > balance)          { setWithdrawError('Amount exceeds your available balance.'); return }

    if (withdrawTab === 'mobilemoney') {
      if (!mmRecipientName.trim()) { setWithdrawError("Recipient's name is required."); return }
      if (!mmPhone.trim())         { setWithdrawError('Recipient phone number is required.'); return }
    } else {
      if (!bankName)               { setWithdrawError('Please select a bank.'); return }
      if (!bankAccountName.trim()) { setWithdrawError('Account name is required.'); return }
      if (!bankAccountNumber.trim()) { setWithdrawError('Account number is required.'); return }
    }

    setWithdrawLoading(true)
    try {
      const isMM = withdrawTab === 'mobilemoney'
      const openFloatMethod = isMM ? (mmNetwork === 'MTN' ? 'MTN' : 'AirtelMoney') : bankName
      const structuredData = {
        withdrawal_method:         openFloatMethod,
        withdrawal_account_name:   isMM ? mmRecipientName.trim()   : bankAccountName.trim(),
        withdrawal_account_number: isMM ? mmPhone.trim()           : bankAccountNumber.trim(),
        withdrawal_notify_phone:   isMM ? (mmNotifyPhone.trim() || null) : (bankNotifyPhone.trim() || null),
      }
      const notes = isMM
        ? `${mmNetwork === 'MTN' ? 'MTN MoMo' : 'Airtel Money'} · ${mmRecipientName} · ${mmPhone}${mmNotifyPhone ? ` · Notify: ${mmNotifyPhone}` : ''}`
        : `Bank: ${bankName} · ${bankAccountName} · ${bankAccountNumber}${bankNotifyPhone ? ` · Notify: ${bankNotifyPhone}` : ''}`

      await supabase.from('business_transactions').insert({ business_id: business.id, type: 'withdrawal', amount, status: 'pending', notes, ...structuredData })
      await supabase.from('business_wallets').update({ balance: balance - amount }).eq('business_id', business.id)
      setBusinessWallet(prev => ({ ...prev, balance: balance - amount }))
      setWithdrawSuccess(true)
      await loadData()
    } catch (e) {
      console.error('Withdrawal error:', e)
      setWithdrawError('Something went wrong. Please try again.')
    }
    setWithdrawLoading(false)
  }

  const chartMax   = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData    = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)
  const bizBalance = businessWallet ? Number(businessWallet.balance) : 0
  const isEducation = business?.sector === 'Education' || business?.sector === 'education'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── WITHDRAWAL MODAL ── */}
      {showWithdraw && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">Withdraw funds</span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                  Available: {formatUGXFull(bizBalance)}
                </div>
              </div>
              <button onClick={() => { setShowWithdraw(false); resetWithdrawForm() }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '72vh', overflowY: 'auto' }}>
              {withdrawSuccess ? (
                <>
                  <div style={{
                    background: 'var(--color-green)',
                    border: 'var(--border)',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: 56, height: 56,
                      background: 'var(--color-black)',
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto var(--space-3)',
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>check</span>
                    </div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                      Withdrawal request submitted
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)', lineHeight: 'var(--leading-normal)' }}>
                      Your withdrawal of <strong>{formatUGXFull(parseInt(withdrawAmount.replace(/,/g, ''), 10))}</strong> has been submitted.
                      Funds will be transferred within 1–2 business days.
                    </div>
                  </div>
                  <button onClick={() => { setShowWithdraw(false); resetWithdrawForm() }} className="btn btn-black btn-full btn-lg">
                    Done
                  </button>
                </>
              ) : (
                <>
                  {/* Method tabs */}
                  <div className="tab-list" style={{ borderBottom: 'var(--border)' }}>
                    {[
                      { id: 'mobilemoney', label: 'Mobile Money' },
                      { id: 'bank',        label: 'Bank Transfer' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setWithdrawTab(tab.id); setWithdrawError('') }}
                        className={`tab-item ${withdrawTab === tab.id ? 'active' : ''}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div className="input-group">
                    <label className="input-label">Amount (UGX)</label>
                    <div className="input-wrapper">
                      <span style={{
                        position: 'absolute', left: 'var(--space-4)',
                        fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1,
                      }}>UGX</span>
                      <input
                        type="text" inputMode="numeric" placeholder="0"
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(formatAmountInput(e.target.value))}
                        className="input input-lg"
                        style={{ paddingLeft: 56, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)' }}
                      />
                    </div>
                    <span className="input-hint">Minimum UGX 1,000 · Available: {formatUGXFull(bizBalance)}</span>
                  </div>

                  {/* ── Mobile money ── */}
                  {withdrawTab === 'mobilemoney' && (
                    <>
                      <div>
                        <label className="input-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Account type</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          {['MTN', 'Airtel'].map(net => (
                            <button key={net} onClick={() => setMmNetwork(net)}
                              style={{
                                flex: 1, padding: 'var(--space-3)',
                                background: mmNetwork === net ? 'var(--color-black)' : 'var(--color-white)',
                                border: 'var(--border)',
                                color: mmNetwork === net ? 'var(--color-white)' : 'var(--color-black)',
                                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                                cursor: 'pointer', transition: 'all var(--transition-base)',
                              }}>
                              {net === 'MTN' ? 'MTN MoMo' : 'Airtel Money'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {[
                        { label: "Recipient's name", req: true,  value: mmRecipientName,  set: setMmRecipientName,  placeholder: 'Full name on mobile money account', type: 'text' },
                        { label: "Recipient's phone",req: true,  value: mmPhone,           set: setMmPhone,           placeholder: '+256 7XX XXX XXX',                  type: 'tel'  },
                        { label: 'Notification phone',           value: mmNotifyPhone,     set: setMmNotifyPhone,    placeholder: '+256 7XX XXX XXX (optional)',          type: 'tel'  },
                      ].map(f => (
                        <div className="input-group" key={f.label}>
                          <label className="input-label">{f.label}{f.req && <span className="required"> *</span>}</label>
                          <div className="input-wrapper">
                            <span className="icon-outlined input-icon-left">{f.type === 'tel' ? 'phone' : 'person'}</span>
                            <input type={f.type} className="input" placeholder={f.placeholder} value={f.value} onChange={e => f.set(e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* ── Bank transfer ── */}
                  {withdrawTab === 'bank' && (
                    <>
                      <div className="input-group">
                        <label className="input-label">Bank <span className="required">*</span></label>
                        <select className="input" value={bankName} onChange={e => setBankName(e.target.value)}>
                          <option value="">Select bank</option>
                          {UGANDA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      {[
                        { label: 'Account name',   req: true, value: bankAccountName,   set: setBankAccountName,   placeholder: 'Name on bank account', icon: 'person'  },
                        { label: 'Account number', req: true, value: bankAccountNumber, set: setBankAccountNumber, placeholder: 'Bank account number',   icon: 'tag'     },
                        { label: 'Notification phone',         value: bankNotifyPhone,  set: setBankNotifyPhone,  placeholder: '+256 7XX XXX XXX (optional)', icon: 'phone' },
                      ].map(f => (
                        <div className="input-group" key={f.label}>
                          <label className="input-label">{f.label}{f.req && <span className="required"> *</span>}</label>
                          <div className="input-wrapper">
                            <span className="icon-outlined input-icon-left">{f.icon}</span>
                            <input type="text" className="input" placeholder={f.placeholder} value={f.value} onChange={e => f.set(e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {withdrawError && (
                    <div className="alert alert-danger">
                      <span className="icon-outlined alert-icon">error_outline</span>
                      <div className="alert-content">{withdrawError}</div>
                    </div>
                  )}

                  <div className="alert alert-info">
                    <span className="icon-outlined alert-icon">schedule</span>
                    <div className="alert-content">
                      Withdrawals are processed within 1–2 business days by the Partna team.
                    </div>
                  </div>

                  <button onClick={handleWithdraw} disabled={withdrawLoading} className="btn btn-primary btn-full btn-lg">
                    {withdrawLoading
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Submitting…</>
                      : <><span className="icon-outlined icon-sm">south</span> Request {withdrawAmount ? 'UGX ' + withdrawAmount : 'withdrawal'}</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)' }}>
        <StatCard
          label="Total savings (AUM)"
          value={formatUGX(stats.totalSavings)}
          sub="Across all customers"
          accent="var(--color-primary)"
        />
        <StatCard
          label="Active customers"
          value={stats.activeCustomers}
          sub="Registered accounts"
          accent="var(--color-yellow)"
        />
        <StatCard
          label={isEducation ? 'Total fees received' : 'Total payments'}
          value={formatUGX(stats.totalPayments)}
          sub={isEducation ? 'From all students' : 'Completed payments'}
          accent="var(--color-green)"
        />
        <StatCard
          label="Active campaigns"
          value={campaigns.length}
          sub={campaigns[0]?.name || 'No campaigns yet'}
          accent="var(--color-red)"
          onClick={() => navigate('/dashboard/campaigns')}
        />

        {/* Business wallet card */}
        <div style={{
          background: 'var(--color-black)',
          border: 'var(--border)',
          boxShadow: 'var(--shadow-md)',
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-2)',
            }}>
              Business wallet
            </div>
            <div style={{
              fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30",
              color: bizBalance > 0 ? 'var(--color-green)' : 'rgba(255,255,255,0.25)',
              lineHeight: 1, marginBottom: 'var(--space-1)',
            }}>
              {formatUGX(bizBalance)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.35)', marginBottom: 'var(--space-4)' }}>
              Available to withdraw
            </div>
          </div>
          <button
            onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError('') }}
            disabled={bizBalance === 0}
            className="btn btn-primary btn-full btn-sm"
          >
            <span className="icon-outlined icon-xs">south</span>
            Withdraw
          </button>
        </div>
      </div>

      {/* ── CHART + ACTIVITY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>

        {/* Chart */}
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-tight)' }}>
              Deposits & Withdrawals
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {[
                  { color: 'var(--color-green)',  label: 'Deposits'     },
                  { color: '#C0392B',              label: 'Withdrawals'  },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <div style={{ width: 10, height: 10, background: color, border: '1.5px solid var(--color-black)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Chart type toggle */}
              <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                {[{ id: 'bar', icon: 'bar_chart' }, { id: 'line', icon: 'show_chart' }].map(t => (
                  <button key={t.id} onClick={() => setChartType(t.id)} style={{
                    padding: '4px var(--space-2)',
                    background: chartType === t.id ? 'var(--color-black)' : 'var(--color-white)',
                    border: 'none',
                    cursor: 'pointer',
                    borderLeft: t.id === 'line' ? '1.5px solid var(--color-grey-light)' : 'none',
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 16, color: chartType === t.id ? 'var(--color-white)' : 'var(--color-grey)' }}>
                      {t.icon}
                    </span>
                  </button>
                ))}
              </div>

              {/* Time filter */}
              <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                {CHART_FILTERS.map((f, i) => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)} style={{
                    padding: '4px var(--space-3)',
                    background: chartFilter === f.days ? 'var(--color-black)' : 'var(--color-white)',
                    border: 'none',
                    borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
                    color: chartFilter === f.days ? 'var(--color-white)' : 'var(--color-grey)',
                    letterSpacing: 'var(--tracking-wide)',
                  }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!hasData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <span className="icon-outlined" style={{ fontSize: 36, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-2)' }}>bar_chart</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>No transaction data yet</div>
              </div>
            </div>
          ) : chartType === 'bar' ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, paddingBottom: 20, position: 'relative' }}>
              {/* Y-axis gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <div key={i} style={{
                  position: 'absolute', left: 0, right: 0,
                  bottom: 20 + pct * 140,
                  height: 1, background: 'var(--color-grey-light)',
                }} />
              ))}
              {chartData.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 140 }}>
                    <div style={{
                      flex: 1,
                      height: `${(day.deposits / chartMax) * 100}%`,
                      background: 'var(--color-green)',
                      border: day.deposits > 0 ? '1px solid var(--color-black)' : 'none',
                      minHeight: day.deposits > 0 ? 2 : 0,
                      transition: 'height var(--transition-slow)',
                    }} />
                    <div style={{
                      flex: 1,
                      height: `${(day.withdrawals / chartMax) * 100}%`,
                      background: '#C0392B',
                      border: day.withdrawals > 0 ? '1px solid var(--color-black)' : 'none',
                      minHeight: day.withdrawals > 0 ? 2 : 0,
                      transition: 'height var(--transition-slow)',
                    }} />
                  </div>
                  {(chartFilter === 7 || i % Math.ceil(chartData.length / 10) === 0) && (
                    <div style={{ fontSize: 9, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', marginTop: 3 }}>
                      {day.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: 160 }}>
              <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none" style={{ display: 'block' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <line key={i} x1="0" y1={140 * pct} x2="600" y2={140 * pct} stroke="var(--color-grey-light)" strokeWidth="1" />
                ))}
                <path d={buildPath(chartData, 'deposits', chartMax, 600, 130)} fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={buildPath(chartData, 'withdrawals', chartMax, 600, 130)} fill="none" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  return d.deposits > 0 ? <circle key={`dep-${i}`} cx={x} cy={130 - (d.deposits / chartMax) * 130} r="3.5" fill="var(--color-green)" stroke="var(--color-black)" strokeWidth="1.5" /> : null
                })}
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  return d.withdrawals > 0 ? <circle key={`wdr-${i}`} cx={x} cy={130 - (d.withdrawals / chartMax) * 130} r="3.5" fill="#C0392B" stroke="var(--color-black)" strokeWidth="1.5" /> : null
                })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {chartData.filter((_, i) => chartFilter === 7 || i % Math.ceil(chartData.length / 7) === 0).map((d, i) => (
                  <span key={i} style={{ fontSize: 9, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>{d.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-tight)' }}>
              Recent activity
            </span>
            <button
              onClick={() => navigate('/dashboard/payments')}
              style={{ background: 'none', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              See all
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', textAlign: 'center' }}>No activity yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentActivity.slice(0, 8).map((txn, i) => (
                <div key={txn.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-2) 0',
                  borderBottom: i < Math.min(recentActivity.length, 8) - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                }}>
                  <div style={{
                    width: 28, height: 28,
                    background: txAccent(txn.type),
                    border: 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>
                      {txIcon(txn.type)}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txn.customers?.first_name} {txn.customers?.last_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                      {txLabel(txn.type)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: txAmountColor(txn.type), flexShrink: 0 }}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CAMPAIGNS SUMMARY ── */}
      {campaigns.length > 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-tight)' }}>
              Active campaigns
            </span>
            <button
              onClick={() => navigate('/dashboard/campaigns')}
              style={{ background: 'none', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Manage campaigns
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {campaigns.slice(0, 3).map(c => {
              const progress  = Math.min((stats.totalSavings / Number(c.target_amount)) * 100, 100)
              const daysLeft  = Math.max(Math.ceil((new Date(c.target_date).getTime() - Date.now()) / 86400000), 0)
              return (
                <div key={c.id} style={{
                  background: 'var(--color-bg)',
                  border: 'var(--border)',
                  padding: 'var(--space-4)',
                }}>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-3)' }}>
                    Target: {formatUGXFull(c.target_amount)}
                  </div>
                  <div className="progress-bar-track" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="progress-bar-fill" style={{
                      width: `${progress}%`,
                      background: progress >= 75 ? 'var(--color-green)' : progress >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-grey)' }}>
                      {progress.toFixed(0)}% saved
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-grey)' }}>
                      {daysLeft} days left
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-10)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>campaign</span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            No campaigns yet
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-5)' }}>
            Create your first campaign to start enrolling customers.
          </div>
          <button onClick={() => navigate('/dashboard/campaigns')} className="btn btn-primary btn-lg">
            <span className="icon-outlined icon-sm">add</span>
            Create campaign
          </button>
        </div>
      )}
    </div>
  )
}