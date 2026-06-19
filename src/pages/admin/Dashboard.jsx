import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
function txLabel(type) {
  if (type === 'deposit')    return 'Deposit'
  if (type === 'withdrawal') return 'Withdrawal'
  if (type === 'payment')    return 'Fee payment'
  return type
}
function txAmountColor(type) { return type === 'deposit' ? '#59886D' : '#CC3939' }
function txIconBg(type) {
  if (type === 'deposit')    return { bg: '#E4F8EC', color: '#59886D' }
  if (type === 'withdrawal') return { bg: '#F8F0E4', color: '#EF8354' }
  return { bg: '#F8E4E4', color: '#CC3939' }
}
function auditLabel(action) {
  if (!action) return '—'
  return action.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' — ')
}
function auditIconBg(action) {
  if (action?.includes('deposit'))     return { bg: '#E4F8EC', color: '#59886D' }
  if (action?.includes('withdrawal'))  return { bg: '#F8F0E4', color: '#EF8354' }
  if (action?.includes('kyc'))         return { bg: 'rgba(133,160,197,0.15)', color: '#85A0C5' }
  if (action?.includes('delete'))      return { bg: '#F8E4E4', color: '#CC3939' }
  return { bg: '#E4E5DD', color: '#959687' }
}
function buildPath(data, key, max, width, height) {
  if (data.length === 0) return ''
  const step = width / (data.length - 1 || 1)
  return data.map((d, i) => {
    const x = i * step
    const y = height - (d[key] / max) * height
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
}
const CHART_FILTERS = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '1yr', days: 365 }]

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accentColor, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12,
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'background 0.15s' : 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = C.accent }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = C.white }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />}
      </div>
      <p style={{ fontSize: 26, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{sub}</p>}
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
  const [auditLogs, setAuditLogs]       = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditFilter, setAuditFilter]   = useState('all')
  const [auditSearch, setAuditSearch]   = useState('')

  useEffect(() => { loadData(); loadAuditLogs() }, [])
  useEffect(() => { if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter) }, [chartFilter, allTxns])

  // ── All data logic — unchanged ─────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    try {
      const { count: bizCount  } = await supabase.from('businesses').select('*', { count: 'exact', head: true })
      const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true })
      const { data: wallets    } = await supabase.from('wallets').select('balance')
      const totalAUM = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
      const { data: allTxnData } = await supabase.from('transactions').select('*, customers(first_name, last_name, business_id)').eq('status', 'completed').order('created_at', { ascending: false })
      const txns = allTxnData || []
      const totalVolume = txns.reduce((s, t) => s + Number(t.amount), 0)
      const { data: fees } = await supabase.from('transaction_fees').select('total_fees')
      const totalRevenue = fees?.reduce((s, f) => s + Number(f.total_fees), 0) || 0
      const { count: kybCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('kyb_status', 'pending')
      setAllTxns(txns); setRecentTxns(txns.slice(0, 10)); buildChartData(txns, chartFilter)
      setStats({ totalBusinesses: bizCount || 0, totalCustomers: custCount || 0, totalAUM, totalVolume, totalRevenue, pendingKYB: kybCount || 0 })
    } catch (e) { console.error('Dashboard load error:', e) }
    setLoading(false)
  }

  async function loadAuditLogs() {
    setAuditLoading(true)
    try {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
      setAuditLogs(data || [])
    } catch (e) { console.error('Audit log load error:', e) }
    setAuditLoading(false)
  }

  function buildChartData(txns, days) {
    if (days === 365) {
      const monthMap = {}
      for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const key = d.toLocaleDateString('en-UG', { month: 'short' }); if (!monthMap[key]) monthMap[key] = { label: key, deposits: 0, withdrawals: 0 } }
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
      txns.forEach(txn => { const d = new Date(txn.created_at); if (d < cutoff) return; const key = d.toLocaleDateString('en-UG', { month: 'short' }); if (monthMap[key]) { if (txn.type === 'deposit') monthMap[key].deposits += Number(txn.amount); if (txn.type === 'withdrawal') monthMap[key].withdrawals += Number(txn.amount) } })
      setChartData(Object.values(monthMap)); return
    }
    const points = []
    for (let i = days - 1; i >= 0; i--) { const date = new Date(); date.setDate(date.getDate() - i); date.setHours(0,0,0,0); const label = days === 7 ? date.toLocaleDateString('en-UG', { weekday: 'short' }) : date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' }); points.push({ label, date: date.toDateString(), deposits: 0, withdrawals: 0 }) }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    txns.forEach(txn => { const d = new Date(txn.created_at); if (d < cutoff) return; const point = points.find(p => p.date === d.toDateString()); if (point) { if (txn.type === 'deposit') point.deposits += Number(txn.amount); if (txn.type === 'withdrawal') point.withdrawals += Number(txn.amount) } })
    setChartData(points)
  }

  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditFilter !== 'all' && !log.action?.includes(auditFilter)) return false
    if (auditSearch) { const s = auditSearch.toLowerCase(); if (!log.action?.toLowerCase().includes(s) && !log.resource_type?.toLowerCase().includes(s) && !log.resource_id?.toLowerCase().includes(s) && !log.actor_type?.toLowerCase().includes(s)) return false }
    return true
  })

  const chartMax = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData  = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const inputStyle = { padding: '8px 12px', border: `1px solid ${C.grayLine}`, borderRadius: 8, background: C.bg, fontSize: 13, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', color: C.black }
  const filterBtn = (active) => ({ padding: '6px 12px', background: active ? C.black : C.white, border: `1px solid ${active ? C.black : C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: active ? C.white : C.secondary, fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 0.12s' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── KYB alert ── */}
      {stats.pendingKYB > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.orange, margin: '0 0 2px' }}>
                {stats.pendingKYB} business{stats.pendingKYB > 1 ? 'es' : ''} awaiting KYB review
              </p>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.8 }}>Review and approve or reject KYB submissions</p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/kyb')} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.orange, border: `1px solid ${C.orange}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
            Review now
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Total businesses"   value={stats.totalBusinesses}         sub="Registered on platform"     accentColor={C.blue}   onClick={() => navigate('/admin/businesses')} />
        <StatCard label="Total customers"    value={stats.totalCustomers}           sub="Across all businesses"      accentColor={C.orange} onClick={() => navigate('/admin/customers')} />
        <StatCard label="Total AUM"          value={formatUGX(stats.totalAUM)}     sub="All wallet balances"        accentColor={C.green} />
        <StatCard label="Transaction volume" value={formatUGX(stats.totalVolume)}  sub="All completed transactions" accentColor={C.blue}   onClick={() => navigate('/admin/transactions')} />
        <StatCard label="Partna revenue"     value={formatUGX(stats.totalRevenue)} sub="Fees collected"             accentColor={C.orange} onClick={() => navigate('/admin/revenue')} />
        <StatCard label="Pending KYB"        value={stats.pendingKYB}              sub="Awaiting review"            accentColor={stats.pendingKYB > 0 ? C.red : C.grayMid} onClick={() => navigate('/admin/kyb')} />
      </div>

      {/* ── Chart + recent activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        {/* Chart */}
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>Platform deposits & withdrawals</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {[{ color: C.green, label: 'Deposits' }, { color: C.red, label: 'Withdrawals' }].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Chart type */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ id: 'bar', label: 'Bar' }, { id: 'line', label: 'Line' }].map(t => (
                  <button key={t.id} onClick={() => setChartType(t.id)} style={filterBtn(chartType === t.id)}>{t.label}</button>
                ))}
              </div>
              {/* Time filter */}
              <div style={{ display: 'flex', gap: 4 }}>
                {CHART_FILTERS.map(f => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)} style={filterBtn(chartFilter === f.days)}>{f.label}</button>
                ))}
              </div>
            </div>
          </div>

          {!hasData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 14, fontWeight: 500, color: C.secondary }}>
              No transaction data yet
            </div>
          ) : chartType === 'bar' ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, paddingBottom: 20, position: 'relative' }}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + pct * 140, height: 1, background: C.grayLight }} />
              ))}
              {chartData.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 140 }}>
                    <div style={{ flex: 1, height: `${(day.deposits / chartMax) * 100}%`, background: C.green, borderRadius: '2px 2px 0 0', minHeight: day.deposits > 0 ? 2 : 0 }} />
                    <div style={{ flex: 1, height: `${(day.withdrawals / chartMax) * 100}%`, background: C.red, borderRadius: '2px 2px 0 0', minHeight: day.withdrawals > 0 ? 2 : 0 }} />
                  </div>
                  {(chartFilter === 7 || i % Math.ceil(chartData.length / 10) === 0) && (
                    <div style={{ fontSize: 9, color: C.grayMid, fontWeight: 500, marginTop: 3 }}>{day.label}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: 160 }}>
              <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none" style={{ display: 'block' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <line key={i} x1="0" y1={140 * pct} x2="600" y2={140 * pct} stroke={C.grayLight} strokeWidth="1" />
                ))}
                <path d={buildPath(chartData, 'deposits', chartMax, 600, 130)} fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={buildPath(chartData, 'withdrawals', chartMax, 600, 130)} fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => { const x = (i / (chartData.length - 1 || 1)) * 600; return d.deposits > 0 ? <circle key={`dep-${i}`} cx={x} cy={130 - (d.deposits / chartMax) * 130} r="3" fill={C.green} /> : null })}
                {chartData.map((d, i) => { const x = (i / (chartData.length - 1 || 1)) * 600; return d.withdrawals > 0 ? <circle key={`wdr-${i}`} cx={x} cy={130 - (d.withdrawals / chartMax) * 130} r="3" fill={C.red} /> : null })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {chartData.filter((_, i) => chartFilter === 7 || i % Math.ceil(chartData.length / 7) === 0).map((d, i) => (
                  <span key={i} style={{ fontSize: 9, color: C.grayMid, fontWeight: 500 }}>{d.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>Recent activity</span>
            <button onClick={() => navigate('/admin/transactions')} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>
              See all
            </button>
          </div>
          {recentTxns.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 13, fontWeight: 500, color: C.secondary }}>No activity yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTxns.slice(0, 8).map((txn, i) => {
                const { bg, color } = txIconBg(txn.type)
                return (
                  <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 7 ? `1px solid ${C.grayLine}` : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {txn.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {txn.customers?.first_name} {txn.customers?.last_name}
                      </p>
                      <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{txLabel(txn.type)}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: txAmountColor(txn.type), flexShrink: 0 }}>
                      {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Manage businesses', sub: 'View, approve, suspend',  path: '/admin/businesses',   accentColor: C.blue   },
          { label: 'Review KYB',        sub: 'Pending submissions',      path: '/admin/kyb',          accentColor: stats.pendingKYB > 0 ? C.orange : C.grayMid, alert: stats.pendingKYB > 0 },
          { label: 'All transactions',  sub: 'Full platform ledger',     path: '/admin/transactions', accentColor: C.green  },
          { label: 'Merchant directory', sub: 'Manage cashback merchants', path: '/admin/rewards', accentColor: C.blue },
        ].map(item => (
          <button
            key={item.path} onClick={() => navigate(item.path)}
            style={{ background: C.white, border: `1px solid ${item.alert ? C.orange : C.stroke}`, borderRadius: 12, padding: '16px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'background 0.15s', fontFamily: 'Inter, system-ui, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.background = C.accent}
            onMouseLeave={e => e.currentTarget.style.background = C.white}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.accentColor }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 3px' }}>{item.label}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Audit log ── */}
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.stroke}` }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: '0 0 2px' }}>Audit Log</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{filteredAuditLogs.length} of {auditLogs.length} events</p>
          </div>
          <button onClick={loadAuditLogs} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.secondary, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="Search actions, resources…"
            value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            onFocus={e => e.target.style.borderColor = C.black}
            onBlur={e => e.target.style.borderColor = C.grayLine}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all',         label: 'All' },
              { id: 'transaction', label: 'Transactions' },
              { id: 'wallet',      label: 'Wallets' },
              { id: 'kyc',         label: 'KYC' },
              { id: 'customer',    label: 'Customers' },
            ].map(f => (
              <button key={f.id} onClick={() => setAuditFilter(f.id)} style={filterBtn(auditFilter === f.id)}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        {auditLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : filteredAuditLogs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.secondary }}>No audit events found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                  {['Time', 'Action', 'Resource', 'Actor', 'Status', 'Details'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.slice(0, 50).map((log, i) => {
                  const { bg, color } = auditIconBg(log.action)
                  return (
                    <tr key={log.id} style={{ borderBottom: i < filteredAuditLogs.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary, fontFamily: 'monospace' }}>{formatDateTime(log.created_at)}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap', color: C.black }}>{log.action}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{log.resource_type || '—'}</p>
                        {log.resource_id && <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0, fontFamily: 'monospace' }}>{log.resource_id.slice(0, 8)}…</p>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: log.actor_type === 'system' ? C.secondary : C.white, background: log.actor_type === 'system' ? C.labelBg : C.black, borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {log.actor_type || 'system'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.white, background: log.status === 'success' ? C.green : log.status === 'blocked' ? C.orange : C.red, borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {log.status || 'success'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', maxWidth: 200 }}>
                        {log.metadata && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {log.metadata.new?.amount ? `UGX ${Number(log.metadata.new.amount).toLocaleString()}` : log.metadata.amount ? `UGX ${Number(log.metadata.amount).toLocaleString()}` : log.metadata.new?.status || log.metadata.status || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredAuditLogs.length > 50 && (
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary, textAlign: 'center' }}>
                Showing 50 of {filteredAuditLogs.length} events. Use filters to narrow results.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}