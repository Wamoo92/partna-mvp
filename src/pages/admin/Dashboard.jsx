import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const CHART_FILTERS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '1 year', days: 365 },
]

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: '#fff' }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.4)' }}>{label}</div>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: color || ADMIN_PRIMARY }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    totalCustomers: 0,
    totalAUM: 0,
    totalVolume: 0,
    totalRevenue: 0,
    pendingKYB: 0,
  })
  const [recentTxns, setRecentTxns] = useState([])
  const [chartData, setChartData] = useState([])
  const [chartFilter, setChartFilter] = useState(7)
  const [chartType, setChartType] = useState('bar')
  const [allTxns, setAllTxns] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter)
  }, [chartFilter, allTxns])

  async function loadData() {
    setLoading(true)
    try {
      // Total businesses
      const { count: bizCount } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })

      // Total customers
      const { count: custCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      // Total AUM — sum of all wallet balances
      const { data: wallets } = await supabase
        .from('wallets')
        .select('balance')
      const totalAUM = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0

      // Total transaction volume — all completed transactions
      const { data: allTxnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, business_id), businesses:customers(business_id(name))')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      const txns = allTxnData || []
      const totalVolume = txns.reduce((s, t) => s + Number(t.amount), 0)

      // Total revenue — sum of all transaction fees
      const { data: fees } = await supabase
        .from('transaction_fees')
        .select('total_fees')
      const totalRevenue = fees?.reduce((s, f) => s + Number(f.total_fees), 0) || 0

      // Pending KYB
      const { count: kybCount } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('kyb_status', 'pending')

      setAllTxns(txns)
      setRecentTxns(txns.slice(0, 10))
      buildChartData(txns, chartFilter)

      setStats({
        totalBusinesses: bizCount || 0,
        totalCustomers: custCount || 0,
        totalAUM,
        totalVolume,
        totalRevenue,
        pendingKYB: kybCount || 0,
      })
    } catch (e) {
      console.error('Dashboard load error:', e)
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
      if (days === 7) {
        label = date.toLocaleDateString('en-UG', { weekday: 'short' })
      } else if (days === 30) {
        label = date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
      } else {
        label = date.toLocaleDateString('en-UG', { month: 'short' })
      }
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
      const dateStr = d.toDateString()
      const point = points.find(p => p.date === dateStr)
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

  function txColor(type) { return type === 'deposit' ? '#16A34A' : type === 'withdrawal' ? '#DC2626' : '#D97706' }
  function txIcon(type) { return type === 'deposit' ? '↓' : type === 'withdrawal' ? '↑' : '→' }
  function txLabel(type) {
    if (type === 'deposit') return 'Deposit'
    if (type === 'withdrawal') return 'Withdrawal'
    if (type === 'payment') return 'Fee payment'
    return type
  }

  const chartMax = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)

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
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* KYB alert banner */}
      {stats.pendingKYB > 0 && (
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">📋</span>
            <div>
              <div className="text-sm font-bold" style={{ color: '#92400e' }}>
                {stats.pendingKYB} business{stats.pendingKYB > 1 ? 'es' : ''} awaiting KYB review
              </div>
              <div className="text-xs" style={{ color: '#b45309' }}>
                Review and approve or reject KYB submissions
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/kyb')}
            className="text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: '#D97706', color: '#fff' }}>
            Review now
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Businesses" value={stats.totalBusinesses} sub="Registered on platform" icon="🏢" />
        <StatCard label="Total Customers" value={stats.totalCustomers} sub="Across all businesses" icon="👤" />
        <StatCard label="Total AUM" value={formatUGX(stats.totalAUM)} sub="All wallet balances" icon="💰" color="#16A34A" />
        <StatCard label="Transaction Volume" value={formatUGX(stats.totalVolume)} sub="All completed transactions" icon="↕" />
        <StatCard label="Partna Revenue" value={formatUGX(stats.totalRevenue)} sub="Fees collected" icon="📈" color={ADMIN_GOLD} />
        <StatCard label="Pending KYB" value={stats.pendingKYB} sub="Awaiting review" icon="📋"
          color={stats.pendingKYB > 0 ? '#D97706' : ADMIN_PRIMARY} />
      </div>

      {/* Chart + Recent activity */}
      <div className="grid grid-cols-3 gap-4">

        {/* Chart */}
        <div className="col-span-2 rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
              Platform Deposits & Withdrawals
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
                <button onClick={() => setChartType('bar')}
                  className="px-2 py-1.5 text-xs font-semibold"
                  style={{ background: chartType === 'bar' ? ADMIN_PRIMARY : '#fff', color: chartType === 'bar' ? '#fff' : 'rgba(0,0,0,0.4)' }}>
                  ▦ Bar
                </button>
                <button onClick={() => setChartType('line')}
                  className="px-2 py-1.5 text-xs font-semibold"
                  style={{ background: chartType === 'line' ? ADMIN_PRIMARY : '#fff', color: chartType === 'line' ? '#fff' : 'rgba(0,0,0,0.4)', borderLeft: '1px solid rgba(27,79,114,0.15)' }}>
                  ↗ Line
                </button>
              </div>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(27,79,114,0.15)' }}>
                {CHART_FILTERS.map((f, i) => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)}
                    className="px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      background: chartFilter === f.days ? ADMIN_PRIMARY : '#fff',
                      color: chartFilter === f.days ? '#fff' : 'rgba(0,0,0,0.4)',
                      borderLeft: i > 0 ? '1px solid rgba(27,79,114,0.15)' : 'none',
                    }}>
                    {f.label}
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
                <path d={buildPath(chartData, 'deposits', chartMax, 600, 130)}
                  fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={buildPath(chartData, 'withdrawals', chartMax, 600, 130)}
                  fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  const y = 130 - (d.deposits / chartMax) * 130
                  return d.deposits > 0 ? <circle key={`dep-${i}`} cx={x} cy={y} r="3" fill="#16A34A" /> : null
                })}
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1 || 1)) * 600
                  const y = 130 - (d.withdrawals / chartMax) * 130
                  return d.withdrawals > 0 ? <circle key={`wdr-${i}`} cx={x} cy={y} r="3" fill="#DC2626" /> : null
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

        {/* Recent activity */}
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>Recent Activity</div>
            <button onClick={() => navigate('/admin/transactions')}
              className="text-xs font-semibold" style={{ color: ADMIN_GOLD }}>See all</button>
          </div>
          {recentTxns.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>No activity yet</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTxns.slice(0, 8).map((txn, i) => (
                <div key={txn.id} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: i < 7 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
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

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Manage Businesses', sub: 'View, approve, suspend', path: '/admin/businesses', icon: '🏢' },
          { label: 'Review KYB', sub: 'Pending submissions', path: '/admin/kyb', icon: '📋', alert: stats.pendingKYB > 0 },
          { label: 'All Transactions', sub: 'Full platform ledger', path: '/admin/transactions', icon: '↕' },
          { label: 'Voucher Library', sub: 'Create & manage vouchers', path: '/admin/vouchers', icon: '🎫' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-2xl p-4 text-left flex items-start gap-3"
            style={{
              background: '#fff',
              border: item.alert ? '1.5px solid #D97706' : '1.5px solid rgba(0,0,0,0.06)',
            }}>
            <span className="text-2xl">{item.icon}</span>
            <div>
              <div className="text-xs font-bold mb-0.5" style={{ color: ADMIN_PRIMARY }}>{item.label}</div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{item.sub}</div>
            </div>
          </button>
        ))}
      </div>

    </div>
  )
}