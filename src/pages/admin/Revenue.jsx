import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

export default function Revenue() {
  const [loading, setLoading] = useState(true)
  const [fees, setFees] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [filterBusiness, setFilterBusiness] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState('fees')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // Transaction fees
      const { data: feeData } = await supabase
        .from('transaction_fees')
        .select('*, transactions(reference, type, created_at, customers(first_name, last_name, business_id, businesses(name)))')
        .order('created_at', { ascending: false })
      setFees(feeData || [])

      // Business subscriptions
      const { data: subData } = await supabase
        .from('business_subscriptions')
        .select('*, businesses(name, admin_email)')
        .order('started_at', { ascending: false })
      setSubscriptions(subData || [])

      // Businesses for filter
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id, name')
        .order('name')
      setBusinesses(bizData || [])

    } catch (e) {
      console.error('Revenue load error:', e)
    }
    setLoading(false)
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatUSD(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function getThisMonth() {
    const now = new Date()
    return fees.filter(f => {
      const d = new Date(f.created_at || f.transactions?.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }

  function getLastMonth() {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return fees.filter(f => {
      const d = new Date(f.created_at || f.transactions?.created_at)
      return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear()
    })
  }

  // Filtered fees
  const filteredFees = fees.filter(f => {
    if (filterBusiness && f.transactions?.customers?.business_id !== filterBusiness) return false
    const d = new Date(f.created_at || f.transactions?.created_at)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalFeesAllTime = fees.reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesThisMonth = getThisMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)
  const totalFeesLastMonth = getLastMonth().reduce((s, f) => s + Number(f.total_fees || 0), 0)

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active')
  const mrr = activeSubscriptions.reduce((s, sub) => {
    const prices = { starter: 49, growth: 149, enterprise: 399 }
    const pkg = sub.businesses?.subscription_package || 'growth'
    const monthly = prices[pkg] || 149
    return s + (sub.billing_cycle === 'annual' ? monthly : monthly)
  }, 0)

  function exportFeeCSV() {
    const rows = [
      ['Reference', 'Customer', 'Business', 'Type', 'Gross Amount', 'Fee', 'Net Amount', 'Date'],
      ...filteredFees.map(f => [
        f.transactions?.reference || f.transaction_id,
        `${f.transactions?.customers?.first_name} ${f.transactions?.customers?.last_name}`,
        f.transactions?.customers?.businesses?.name || '',
        f.transactions?.type || '',
        f.gross_amount,
        f.total_fees,
        f.net_amount,
        new Date(f.created_at || f.transactions?.created_at).toISOString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partna-fees-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  const TABS = ['fees', 'subscriptions']

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Revenue & Financials</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
          Partna's financial overview — fees and subscription revenue
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total fees (all time)', value: formatUGX(totalFeesAllTime), color: ADMIN_PRIMARY, icon: '💰' },
          { label: 'Fees this month', value: formatUGX(totalFeesThisMonth), color: '#16A34A', icon: '📈' },
          { label: 'Fees last month', value: formatUGX(totalFeesLastMonth), color: ADMIN_GOLD, icon: '📅' },
          { label: 'Monthly recurring revenue', value: formatUSD(mrr), color: '#16A34A', icon: '🔄',
            sub: `${activeSubscriptions.length} active subscriptions` },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            {stat.sub && <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#fff', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-6 py-2 rounded-lg text-xs font-semibold capitalize"
            style={{
              background: activeTab === tab ? ADMIN_PRIMARY : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(0,0,0,0.4)',
            }}>
            {tab === 'fees' ? 'Transaction Fees' : 'Subscriptions'}
          </button>
        ))}
      </div>

      {/* ── FEES TAB ── */}
      {activeTab === 'fees' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-xs outline-none"
              style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-xs outline-none"
              style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-xs outline-none"
              style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
            {(filterBusiness || dateFrom || dateTo) && (
              <button onClick={() => { setFilterBusiness(''); setDateFrom(''); setDateTo('') }}
                className="text-xs font-semibold px-3 py-2.5 rounded-xl"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                Clear
              </button>
            )}
            <div className="flex-1" />
            <button onClick={exportFeeCSV}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl"
              style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
              ↓ Export CSV
            </button>
          </div>

          {/* Filtered summary */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)' }}>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Showing <span className="font-semibold" style={{ color: ADMIN_PRIMARY }}>{filteredFees.length}</span> fee records
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Total fees: <span className="font-semibold" style={{ color: '#16A34A' }}>
                {formatUGX(filteredFees.reduce((s, f) => s + Number(f.total_fees || 0), 0))}
              </span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Total gross: <span className="font-semibold" style={{ color: ADMIN_PRIMARY }}>
                {formatUGX(filteredFees.reduce((s, f) => s + Number(f.gross_amount || 0), 0))}
              </span>
            </div>
          </div>

          {/* Fee table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Reference', 'Customer', 'Business', 'Type', 'Gross Amount', 'Fee', 'Net Amount', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ background: '#f8f9fa' }}>
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm"
                        style={{ color: 'rgba(0,0,0,0.3)' }}>
                        No fee records found
                      </td>
                    </tr>
                  ) : filteredFees.map((f, i) => (
                    <tr key={f.id}
                      style={{ borderBottom: i < filteredFees.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          {f.transactions?.reference || f.transaction_id?.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                          {f.transactions?.customers?.first_name} {f.transactions?.customers?.last_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: '#333' }}>
                          {f.transactions?.customers?.businesses?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize" style={{ color: 'rgba(0,0,0,0.6)' }}>
                          {f.transactions?.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#333' }}>
                          {formatUGX(f.gross_amount || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold" style={{ color: ADMIN_GOLD }}>
                          {formatUGX(f.total_fees || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                          {formatUGX(f.net_amount || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {formatDate(f.created_at || f.transactions?.created_at)}
                        </span>
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
        <div className="flex flex-col gap-4">

          {/* MRR summary */}
          <div className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)' }}>
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>Monthly Recurring Revenue (MRR)</div>
              <div className="text-2xl font-bold" style={{ color: ADMIN_PRIMARY }}>{formatUSD(mrr)}</div>
            </div>
            <div className="h-10 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>Active subscriptions</div>
              <div className="text-2xl font-bold" style={{ color: '#16A34A' }}>{activeSubscriptions.length}</div>
            </div>
            <div className="h-10 w-px mx-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>Annual run rate</div>
              <div className="text-2xl font-bold" style={{ color: ADMIN_GOLD }}>{formatUSD(mrr * 12)}</div>
            </div>
          </div>

          {/* Subscriptions table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Business', 'Plan', 'Billing', 'Monthly value', 'Started', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ background: '#f8f9fa' }}>
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm"
                        style={{ color: 'rgba(0,0,0,0.3)' }}>
                        No subscriptions found
                      </td>
                    </tr>
                  ) : subscriptions.map((sub, i) => {
                    const prices = { starter: 49, growth: 149, enterprise: 399 }
                    const monthlyVal = prices[sub.package_id] || 149
                    return (
                      <tr key={sub.id}
                        style={{ borderBottom: i < subscriptions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                            {sub.businesses?.name || '—'}
                          </div>
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                            {sub.businesses?.admin_email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold capitalize" style={{ color: ADMIN_PRIMARY }}>
                            {sub.package_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize" style={{ color: 'rgba(0,0,0,0.6)' }}>
                            {sub.billing_cycle || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                            {formatUSD(monthlyVal)}/mo
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                            {formatDate(sub.started_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
                            style={{
                              background: sub.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                              color: sub.status === 'active' ? '#16A34A' : 'rgba(0,0,0,0.4)',
                            }}>
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
        </div>
      )}

    </div>
  )
}