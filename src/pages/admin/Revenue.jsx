import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
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

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
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

const selectStyle = { padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' }

export default function Revenue() {
  useEffect(() => { document.title = 'Revenue - Partna' }, [])

  const [loading, setLoading]               = useState(true)
  const [fees, setFees]                     = useState([])
  const [subscriptions, setSubscriptions]   = useState([])
  const [businesses, setBusinesses]         = useState([])
  const [filterBusiness, setFilterBusiness] = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [activeTab, setActiveTab]           = useState('fees')

  useEffect(() => { loadAll() }, [])

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    try {
      const { data: feeData } = await supabase.from('transaction_fees').select('*, transactions(reference, type, created_at, customers(first_name, last_name, business_id, businesses(name)))').order('created_at', { ascending: false })
      setFees(feeData || [])
      const { data: subData } = await supabase.from('business_subscriptions').select('*, businesses(name, admin_email)').order('started_at', { ascending: false })
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

  const totalFeesAllTime    = fees.reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesThisMonth  = getThisMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesLastMonth  = getLastMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)
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

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const TABS = [{ id: 'fees', label: 'Transaction fees' }, { id: 'subscriptions', label: 'Subscriptions' }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total fees (all time)',      value: formatUGX(totalFeesAllTime),   accentColor: C.blue   },
          { label: 'Fees this month',            value: formatUGX(totalFeesThisMonth), accentColor: C.green  },
          { label: 'Fees last month',            value: formatUGX(totalFeesLastMonth), accentColor: C.orange },
          { label: 'Monthly recurring revenue', value: formatUSD(mrr),                accentColor: C.blue, sub: `${activeSubscriptions.length} active subscriptions` },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
              {s.accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.accentColor }} />}
            </div>
            <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 4px', lineHeight: 1 }}>{s.value}</p>
            {s.sub && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: activeTab === t.id ? C.black : 'transparent', color: activeTab === t.id ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FEES TAB ── */}
      {activeTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select style={selectStyle} value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" style={selectStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span style={{ color: C.grayMid }}>—</span>
            <input type="date" style={selectStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {hasFilters && (
              <button onClick={() => { setFilterBusiness(''); setDateFrom(''); setDateTo('') }}
                style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Clear
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={exportFeeCSV} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              ↓ Export CSV
            </button>
          </div>

          {/* Filtered summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '11px 16px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8 }}>
            {[
              { label: 'Records shown', value: filteredFees.length, color: C.black },
              { label: 'Total fees',    value: formatUGX(filteredFees.reduce((s, f) => s + Number(f.total_fees || 0), 0)),   color: C.green },
              { label: 'Total gross',   value: formatUGX(filteredFees.reduce((s, f) => s + Number(f.gross_amount || 0), 0)), color: C.black },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{item.label}:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Fee table */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                    {['Reference', 'Customer', 'Business', 'Type', 'Gross amount', 'Fee', 'Net amount', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No fee records found</td></tr>
                  ) : filteredFees.map((f, i) => (
                    <tr key={f.id} style={{ borderBottom: i < filteredFees.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>
                          {f.transactions?.reference || f.transaction_id?.slice(0, 8)}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.black, whiteSpace: 'nowrap' }}>
                        {f.transactions?.customers?.first_name} {f.transactions?.customers?.last_name}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
                        {f.transactions?.customers?.businesses?.name || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, textTransform: 'capitalize' }}>
                        {f.transactions?.type || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.black, whiteSpace: 'nowrap' }}>
                        {formatUGX(f.gross_amount || 0)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                          {formatUGX(f.total_fees || 0)}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>
                        {formatUGX(f.net_amount || 0)}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                        {formatDate(f.created_at || f.transactions?.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTIONS TAB ── */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* MRR summary card */}
          <div style={{ background: C.black, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '24px 28px', display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {[
              { label: 'Monthly recurring revenue', value: formatUSD(mrr),            color: C.green  },
              { label: 'Active subscriptions',       value: activeSubscriptions.length, color: C.white },
              { label: 'Annual run rate',            value: formatUSD(mrr * 12),       color: C.orange },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, paddingLeft: i > 0 ? 28 : 0, marginLeft: i > 0 ? 28 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <p style={{ fontSize: 26, fontWeight: 600, color: item.color, margin: 0, letterSpacing: '-1px', lineHeight: 1 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Subscriptions table */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                    {['Business', 'Plan', 'Billing', 'Monthly value', 'Started', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No subscriptions found</td></tr>
                  ) : subscriptions.map((sub, i) => {
                    const prices = { starter: 49, growth: 149, enterprise: 399 }
                    const monthlyVal = prices[sub.package_id] || 149
                    return (
                      <tr key={sub.id} style={{ borderBottom: i < subscriptions.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{sub.businesses?.name || '—'}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{sub.businesses?.admin_email}</p>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.white, background: C.black, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>
                            {sub.package_id || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, textTransform: 'capitalize' }}>
                          {sub.billing_cycle || '—'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>
                          {formatUSD(monthlyVal)}/mo
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                          {formatDate(sub.started_at)}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {sub.status === 'active'
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,  borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>{sub.status || 'active'}</span>
                            : <span style={{ fontSize: 11, fontWeight: 600, color: C.grayMid, background: C.grayLight, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>{sub.status || 'inactive'}</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}