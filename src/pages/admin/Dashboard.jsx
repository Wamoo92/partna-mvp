import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
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
  if (type === 'deposit')    return 'Deposit'
  if (type === 'withdrawal') return 'Withdrawal'
  if (type === 'payment')    return 'Fee payment'
  return type
}
function txAmountColor(type) { return type === 'deposit' ? '#2D8B45' : '#C0392B' }

function buildPath(data, key, max, width, height) {
  if (data.length === 0) return ''
  const step = width / (data.length - 1 || 1)
  return data.map((d, i) => {
    const x = i * step
    const y = height - (d[key] / max) * height
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
}

const CHART_FILTERS = [
  { label: '7d',  days: 7   },
  { label: '30d', days: 30  },
  { label: '1yr', days: 365 },
]

// ── Audit log action config ────────────────────────────────────────────────
function auditIcon(action) {
  if (action?.includes('deposit'))    return 'south'
  if (action?.includes('withdrawal')) return 'north'
  if (action?.includes('kyc'))        return 'verified_user'
  if (action?.includes('wallet'))     return 'account_balance_wallet'
  if (action?.includes('customer'))   return 'person'
  if (action?.includes('transaction')) return 'receipt_long'
  return 'history'
}

function auditAccent(action) {
  if (action?.includes('deposit'))    return 'var(--color-green)'
  if (action?.includes('withdrawal')) return 'var(--color-yellow)'
  if (action?.includes('kyc'))        return 'var(--color-primary)'
  if (action?.includes('delete'))     return 'var(--color-red)'
  return 'var(--color-grey-light)'
}

function auditLabel(action) {
  if (!action) return '—'
  return action
    .split('.')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' — ')
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
      {accent && <div style={{ height: 3, background: accent, marginBottom: 'var(--space-3)' }} />}
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
        letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
        color: 'var(--color-grey)', marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)',
        letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30",
        color: 'var(--color-black)', lineHeight: 1, marginBottom: sub ? 'var(--space-1)' : 0,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{sub}</div>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState({ totalBusinesses: 0, totalCustomers: 0, totalAUM: 0, totalVolume: 0, totalRevenue: 0, pendingKYB: 0 })
  const [recentTxns, setRecentTxns]     = useState([])
  const [chartData, setChartData]       = useState([])
  const [chartFilter, setChartFilter]   = useState(7)
  const [chartType, setChartType]       = useState('bar')
  const [allTxns, setAllTxns]           = useState([])

  // Audit log state
  const [auditLogs, setAuditLogs]       = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditFilter, setAuditFilter]   = useState('all')
  const [auditSearch, setAuditSearch]   = useState('')

  useEffect(() => { loadData(); loadAuditLogs() }, [])
  useEffect(() => { if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter) }, [chartFilter, allTxns])

  async function loadData() {
    setLoading(true)
    try {
      const { count: bizCount  } = await supabase.from('businesses').select('*', { count: 'exact', head: true })
      const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true })
      const { data: wallets    } = await supabase.from('wallets').select('balance')
      const totalAUM = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0

      const { data: allTxnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, business_id)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
      const txns = allTxnData || []
      const totalVolume = txns.reduce((s, t) => s + Number(t.amount), 0)

      const { data: fees } = await supabase.from('transaction_fees').select('total_fees')
      const totalRevenue = fees?.reduce((s, f) => s + Number(f.total_fees), 0) || 0

      const { count: kybCount } = await supabase
        .from('businesses').select('*', { count: 'exact', head: true }).eq('kyb_status', 'pending')

      setAllTxns(txns)
      setRecentTxns(txns.slice(0, 10))
      buildChartData(txns, chartFilter)
      setStats({ totalBusinesses: bizCount || 0, totalCustomers: custCount || 0, totalAUM, totalVolume, totalRevenue, pendingKYB: kybCount || 0 })
    } catch (e) {
      console.error('Dashboard load error:', e)
    }
    setLoading(false)
  }

  async function loadAuditLogs() {
    setAuditLoading(true)
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      setAuditLogs(data || [])
    } catch (e) {
      console.error('Audit log load error:', e)
    }
    setAuditLoading(false)
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
        const d = new Date(txn.created_at); if (d < cutoff) return
        const key = d.toLocaleDateString('en-UG', { month: 'short' })
        if (monthMap[key]) {
          if (txn.type === 'deposit')    monthMap[key].deposits    += Number(txn.amount)
          if (txn.type === 'withdrawal') monthMap[key].withdrawals += Number(txn.amount)
        }
      })
      setChartData(Object.values(monthMap)); return
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
      const d = new Date(txn.created_at); if (d < cutoff) return
      const point = points.find(p => p.date === d.toDateString())
      if (point) {
        if (txn.type === 'deposit')    point.deposits    += Number(txn.amount)
        if (txn.type === 'withdrawal') point.withdrawals += Number(txn.amount)
      }
    })
    setChartData(points)
  }

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditFilter !== 'all' && !log.action?.includes(auditFilter)) return false
    if (auditSearch) {
      const s = auditSearch.toLowerCase()
      if (
        !log.action?.toLowerCase().includes(s) &&
        !log.resource_type?.toLowerCase().includes(s) &&
        !log.resource_id?.toLowerCase().includes(s) &&
        !log.actor_type?.toLowerCase().includes(s)
      ) return false
    }
    return true
  })

  const chartMax = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData  = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── KYB alert ── */}
      {stats.pendingKYB > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--color-yellow)',
          border: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="icon-outlined" style={{ fontSize: 22, flexShrink: 0 }}>verified_user</span>
            <div>
              <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                {stats.pendingKYB} business{stats.pendingKYB > 1 ? 'es' : ''} awaiting KYB review
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.55)' }}>
                Review and approve or reject KYB submissions
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/admin/kyb')} className="btn btn-sm btn-black">
            <span className="icon-outlined icon-xs">arrow_forward</span>
            Review now
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
        <StatCard label="Total businesses"   value={stats.totalBusinesses}        sub="Registered on platform"      accent="var(--color-primary)" onClick={() => navigate('/admin/businesses')} />
        <StatCard label="Total customers"    value={stats.totalCustomers}          sub="Across all businesses"       accent="var(--color-yellow)"  onClick={() => navigate('/admin/customers')} />
        <StatCard label="Total AUM"          value={formatUGX(stats.totalAUM)}    sub="All wallet balances"         accent="var(--color-green)"   />
        <StatCard label="Transaction volume" value={formatUGX(stats.totalVolume)} sub="All completed transactions"  accent="var(--color-primary)" onClick={() => navigate('/admin/transactions')} />
        <StatCard label="Partna revenue"     value={formatUGX(stats.totalRevenue)} sub="Fees collected"             accent="var(--color-yellow)"  onClick={() => navigate('/admin/revenue')} />
        <StatCard label="Pending KYB"        value={stats.pendingKYB}             sub="Awaiting review"
          accent={stats.pendingKYB > 0 ? 'var(--color-red)' : 'var(--color-grey-light)'}
          onClick={() => navigate('/admin/kyb')} />
      </div>

      {/* ── Chart + recent activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>

        {/* Chart */}
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-tight)' }}>
              Platform deposits & withdrawals
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {[{ color: 'var(--color-green)', label: 'Deposits' }, { color: '#C0392B', label: 'Withdrawals' }].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <div style={{ width: 10, height: 10, background: color, border: '1.5px solid var(--color-black)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                {[{ id: 'bar', icon: 'bar_chart' }, { id: 'line', icon: 'show_chart' }].map((t, i) => (
                  <button key={t.id} onClick={() => setChartType(t.id)} style={{
                    padding: '4px var(--space-2)', background: chartType === t.id ? 'var(--color-black)' : 'var(--color-white)',
                    border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none', cursor: 'pointer',
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 16, color: chartType === t.id ? 'var(--color-white)' : 'var(--color-grey)' }}>{t.icon}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                {CHART_FILTERS.map((f, i) => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)} style={{
                    padding: '4px var(--space-3)', background: chartFilter === f.days ? 'var(--color-black)' : 'var(--color-white)',
                    border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none', cursor: 'pointer',
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
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + pct * 140, height: 1, background: 'var(--color-grey-light)' }} />
              ))}
              {chartData.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 140 }}>
                    <div style={{ flex: 1, height: `${(day.deposits / chartMax) * 100}%`, background: 'var(--color-green)', border: day.deposits > 0 ? '1px solid var(--color-black)' : 'none', minHeight: day.deposits > 0 ? 2 : 0 }} />
                    <div style={{ flex: 1, height: `${(day.withdrawals / chartMax) * 100}%`, background: '#C0392B', border: day.withdrawals > 0 ? '1px solid var(--color-black)' : 'none', minHeight: day.withdrawals > 0 ? 2 : 0 }} />
                  </div>
                  {(chartFilter === 7 || i % Math.ceil(chartData.length / 10) === 0) && (
                    <div style={{ fontSize: 9, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', marginTop: 3 }}>{day.label}</div>
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
            <button onClick={() => navigate('/admin/transactions')} style={{ background: 'none', border: 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              See all
            </button>
          </div>
          {recentTxns.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              No activity yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTxns.slice(0, 8).map((txn, i) => (
                <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: i < 7 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                  <div style={{ width: 28, height: 28, background: txAccent(txn.type), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>{txIcon(txn.type)}</span>
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

      {/* ── Quick links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        {[
          { label: 'Manage businesses', sub: 'View, approve, suspend',   path: '/admin/businesses',   icon: 'business',            accent: 'var(--color-primary)' },
          { label: 'Review KYB',        sub: 'Pending submissions',       path: '/admin/kyb',          icon: 'verified_user',       accent: stats.pendingKYB > 0 ? 'var(--color-yellow)' : 'var(--color-grey-light)', alert: stats.pendingKYB > 0 },
          { label: 'All transactions',  sub: 'Full platform ledger',      path: '/admin/transactions', icon: 'swap_vert',           accent: 'var(--color-primary)' },
          { label: 'Voucher library',   sub: 'Create & manage vouchers',  path: '/admin/vouchers',     icon: 'confirmation_number', accent: 'var(--color-green)' },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'var(--color-white)',
              border: item.alert ? '2px solid var(--color-yellow)' : 'var(--border)',
              boxShadow: item.alert ? 'var(--shadow-sm)' : 'none',
              padding: 'var(--space-4)',
              textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
              transition: 'box-shadow var(--transition-base), transform var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = item.alert ? 'var(--shadow-sm)' : 'none'; e.currentTarget.style.transform = 'translate(0,0)' }}
          >
            <div style={{ height: 3, background: item.accent }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <div style={{ width: 36, height: 36, background: 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-white)' }}>{item.icon}</span>
              </div>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{item.sub}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── AUDIT LOG ── */}
      <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: 'var(--border)',
          background: 'var(--color-black)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 32, height: 32, background: 'var(--color-primary)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="icon-outlined" style={{ fontSize: 16, color: 'var(--color-black)' }}>security</span>
            </div>
            <div>
              <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: 'var(--color-white)', letterSpacing: 'var(--tracking-tight)' }}>
                Audit Log
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                {filteredAuditLogs.length} of {auditLogs.length} events
              </div>
            </div>
          </div>
          <button onClick={loadAuditLogs} style={{ background: 'none', border: '1.5px solid rgba(255,255,255,0.2)', padding: '4px var(--space-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span className="icon-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>refresh</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.6)' }}>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: 'var(--border)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search actions, resources..."
            value={auditSearch}
            onChange={e => setAuditSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200,
              padding: 'var(--space-2) var(--space-3)',
              border: 'var(--border)', background: 'var(--color-bg)',
              fontSize: 'var(--text-xs)', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
            {[
              { id: 'all',         label: 'All' },
              { id: 'transaction', label: 'Transactions' },
              { id: 'wallet',      label: 'Wallets' },
              { id: 'kyc',         label: 'KYC' },
              { id: 'customer',    label: 'Customers' },
            ].map((f, i) => (
              <button key={f.id} onClick={() => setAuditFilter(f.id)} style={{
                padding: 'var(--space-2) var(--space-3)',
                background: auditFilter === f.id ? 'var(--color-black)' : 'var(--color-white)',
                border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                color: auditFilter === f.id ? 'var(--color-white)' : 'var(--color-grey)',
                letterSpacing: 'var(--tracking-wide)',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        {auditLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
            <div className="spinner spinner-lg spinner-purple" />
          </div>
        ) : filteredAuditLogs.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-grey)', fontSize: 'var(--text-sm)' }}>
            No audit events found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: 'var(--border)' }}>
                  {['Time', 'Action', 'Resource', 'Actor', 'Status', 'Details'].map(h => (
                    <th key={h} style={{
                      padding: 'var(--space-2) var(--space-4)',
                      textAlign: 'left', fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-black)',
                      letterSpacing: 'var(--tracking-widest)',
                      textTransform: 'uppercase',
                      color: 'var(--color-grey)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.slice(0, 50).map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < filteredAuditLogs.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>

                    {/* Time */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontFamily: 'monospace' }}>
                        {formatDateTime(log.created_at)}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: 24, height: 24, background: auditAccent(log.action), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="icon-outlined" style={{ fontSize: 12, color: 'var(--color-black)' }}>{auditIcon(log.action)}</span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {log.action}
                        </span>
                      </div>
                    </td>

                    {/* Resource */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-black)' }}>
                        {log.resource_type || '—'}
                      </div>
                      {log.resource_id && (
                        <div style={{ fontSize: 10, color: 'var(--color-grey)', fontFamily: 'monospace', marginTop: 2 }}>
                          {log.resource_id.slice(0, 8)}…
                        </div>
                      )}
                    </td>

                    {/* Actor */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px var(--space-2)',
                        background: log.actor_type === 'system' ? 'var(--color-grey-light)' : 'var(--color-primary)',
                        color: log.actor_type === 'system' ? 'var(--color-grey)' : 'var(--color-white)',
                        fontSize: 10, fontWeight: 'var(--weight-black)',
                        letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
                      }}>
                        {log.actor_type || 'system'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px var(--space-2)',
                        background: log.status === 'success' ? 'var(--color-green)' : log.status === 'blocked' ? 'var(--color-yellow)' : 'var(--color-red)',
                        border: 'var(--border)',
                        fontSize: 10, fontWeight: 'var(--weight-black)',
                        letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
                        color: 'var(--color-black)',
                      }}>
                        {log.status || 'success'}
                      </span>
                    </td>

                    {/* Details — show key metadata fields */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: 200 }}>
                      {log.metadata && (
                        <div style={{ fontSize: 10, color: 'var(--color-grey)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.metadata.new?.amount
                            ? `UGX ${Number(log.metadata.new.amount).toLocaleString()}`
                            : log.metadata.amount
                            ? `UGX ${Number(log.metadata.amount).toLocaleString()}`
                            : log.metadata.new?.status || log.metadata.status || '—'
                          }
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAuditLogs.length > 50 && (
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', textAlign: 'center' }}>
                Showing 50 of {filteredAuditLogs.length} events. Use filters to narrow results.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}