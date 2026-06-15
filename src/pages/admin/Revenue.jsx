import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatUSD(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Revenue() {
  const [loading, setLoading]             = useState(true)
  const [fees, setFees]                   = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [businesses, setBusinesses]       = useState([])
  const [filterBusiness, setFilterBusiness] = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [activeTab, setActiveTab]         = useState('fees')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: feeData } = await supabase
        .from('transaction_fees')
        .select('*, transactions(reference, type, created_at, customers(first_name, last_name, business_id, businesses(name)))')
        .order('created_at', { ascending: false })
      setFees(feeData || [])

      const { data: subData } = await supabase
        .from('business_subscriptions')
        .select('*, businesses(name, admin_email)')
        .order('started_at', { ascending: false })
      setSubscriptions(subData || [])

      const { data: bizData } = await supabase.from('businesses').select('id, name').order('name')
      setBusinesses(bizData || [])
    } catch (e) { console.error('Revenue load error:', e) }
    setLoading(false)
  }

  function getThisMonth() {
    const now = new Date()
    return fees.filter(f => { const d = new Date(f.created_at || f.transactions?.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  }

  function getLastMonth() {
    const now = new Date(); const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return fees.filter(f => { const d = new Date(f.created_at || f.transactions?.created_at); return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear() })
  }

  const filteredFees = fees.filter(f => {
    if (filterBusiness && f.transactions?.customers?.business_id !== filterBusiness) return false
    const d = new Date(f.created_at || f.transactions?.created_at)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalFeesAllTime   = fees.reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesThisMonth = getThisMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesLastMonth = getLastMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active')
  const mrr = activeSubscriptions.reduce((s, sub) => {
    const prices = { starter: 49, growth: 149, enterprise: 399 }
    return s + (prices[sub.package_id] || 149)
  }, 0)

  const hasFilters = filterBusiness || dateFrom || dateTo

  function exportFeeCSV() {
    const rows = [['Reference', 'Customer', 'Business', 'Type', 'Gross Amount', 'Fee', 'Net Amount', 'Date'],
      ...filteredFees.map(f => [f.transactions?.reference || f.transaction_id, `${f.transactions?.customers?.first_name} ${f.transactions?.customers?.last_name}`, f.transactions?.customers?.businesses?.name || '', f.transactions?.type || '', f.gross_amount, f.total_fees, f.net_amount, new Date(f.created_at || f.transactions?.created_at).toISOString()])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `partna-fees-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        {[
          { label: 'Total fees (all time)',        value: formatUGX(totalFeesAllTime),   accent: 'var(--color-primary)' },
          { label: 'Fees this month',              value: formatUGX(totalFeesThisMonth), accent: 'var(--color-green)'   },
          { label: 'Fees last month',              value: formatUGX(totalFeesLastMonth), accent: 'var(--color-yellow)'  },
          { label: 'Monthly recurring revenue',   value: formatUSD(mrr),                accent: 'var(--color-primary)', sub: `${activeSubscriptions.length} active subscriptions` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
            <div style={{ height: 3, background: s.accent, marginBottom: 'var(--space-3)' }} />
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>{s.label}</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30", lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 'var(--space-1)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {[
          { id: 'fees',          label: 'Transaction fees' },
          { id: 'subscriptions', label: 'Subscriptions'    },
        ].map((t, i) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: 'var(--space-3) var(--space-5)',
            background: activeTab === t.id ? 'var(--color-black)' : 'var(--color-white)',
            color: activeTab === t.id ? 'var(--color-white)' : 'var(--color-grey)',
            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            cursor: 'pointer', transition: 'all var(--transition-fast)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FEES TAB ── */}
      {activeTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <select className="input" value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
            <span style={{ color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
            <input type="date" className="input input-sm" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 140 }} />
            {hasFilters && (
              <button onClick={() => { setFilterBusiness(''); setDateFrom(''); setDateTo('') }} className="btn btn-sm btn-danger">
                <span className="icon-outlined icon-xs">close</span> Clear
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={exportFeeCSV} className="btn btn-sm btn-black">
              <span className="icon-outlined icon-xs">download</span>
              Export CSV
            </button>
          </div>

          {/* Filtered summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-bg)',
            border: 'var(--border)',
          }}>
            {[
              { label: 'Records shown', value: filteredFees.length,                                                                         plain: true },
              { label: 'Total fees',    value: formatUGX(filteredFees.reduce((s, f) => s + Number(f.total_fees  || 0), 0)),                  color: '#2D8B45' },
              { label: 'Total gross',   value: formatUGX(filteredFees.reduce((s, f) => s + Number(f.gross_amount || 0), 0)),                 color: 'var(--color-black)' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>{item.label}:</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: item.plain ? 'var(--color-black)' : item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Fee table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  {['Reference', 'Customer', 'Business', 'Type', 'Gross amount', 'Fee', 'Net amount', 'Date'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFees.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      No fee records found
                    </td>
                  </tr>
                ) : filteredFees.map(f => (
                  <tr key={f.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                        {f.transactions?.reference || f.transaction_id?.slice(0, 8)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                      {f.transactions?.customers?.first_name} {f.transactions?.customers?.last_name}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      {f.transactions?.customers?.businesses?.name || '—'}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', textTransform: 'capitalize' }}>
                      {f.transactions?.type || '—'}
                    </td>
                    <td style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                      {formatUGX(f.gross_amount || 0)}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                        background: 'var(--color-yellow)', border: 'var(--border)',
                        padding: '2px var(--space-2)',
                      }}>
                        {formatUGX(f.total_fees || 0)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                      {formatUGX(f.net_amount || 0)}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      {formatDate(f.created_at || f.transactions?.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTIONS TAB ── */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* MRR summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
            background: 'var(--color-black)',
            border: 'var(--border)',
            boxShadow: 'var(--shadow-md)',
            padding: 'var(--space-6)',
          }}>
            {[
              { label: 'Monthly recurring revenue', value: formatUSD(mrr),        color: 'var(--color-green)'   },
              { label: 'Active subscriptions',       value: activeSubscriptions.length, color: 'var(--color-white)' },
              { label: 'Annual run rate',            value: formatUSD(mrr * 12),   color: 'var(--color-yellow)'  },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, paddingLeft: i > 0 ? 'var(--space-6)' : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-2)' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', color: item.color, lineHeight: 1 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Subscriptions table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  {['Business', 'Plan', 'Billing', 'Monthly value', 'Started', 'Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      No subscriptions found
                    </td>
                  </tr>
                ) : subscriptions.map(sub => {
                  const prices = { starter: 49, growth: 149, enterprise: 399 }
                  const monthlyVal = prices[sub.package_id] || 149
                  return (
                    <tr key={sub.id}>
                      <td>
                        <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                          {sub.businesses?.name || '—'}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                          {sub.businesses?.admin_email}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                          background: 'var(--color-black)', color: 'var(--color-primary)',
                          padding: '2px var(--space-2)', textTransform: 'capitalize',
                        }}>
                          {sub.package_id || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', textTransform: 'capitalize' }}>
                        {sub.billing_cycle || '—'}
                      </td>
                      <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                        {formatUSD(monthlyVal)}/mo
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                        {formatDate(sub.started_at)}
                      </td>
                      <td>
                        <span className={`badge no-dot ${sub.status === 'active' ? 'badge-success' : 'badge-default'}`} style={{ textTransform: 'capitalize' }}>
                          {sub.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}