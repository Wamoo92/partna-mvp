import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatUGXShort(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function txLabel(type) {
  switch (type) {
    case 'deposit':    return 'Deposit'
    case 'payment':    return 'Fee payment'
    case 'withdrawal': return 'Withdrawal'
    default:           return type
  }
}

function txAccent(type) {
  switch (type) {
    case 'deposit':    return 'var(--color-green)'
    case 'payment':    return 'var(--color-primary)'
    case 'withdrawal': return 'var(--color-yellow)'
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

function txAmountColor(type) {
  return type === 'deposit' ? '#2D8B45' : '#C0392B'
}

export default function Payments({ admin, business }) {
  const [transactions, setTransactions] = useState([])
  const [customers, setCustomers]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [totals, setTotals]             = useState({ deposits: 0, payments: 0, withdrawals: 0 })

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers').select('id, first_name, last_name, phone, email')
        .eq('business_id', business.id)

      const customerMap = {}
      customerData?.forEach(c => { customerMap[c.id] = c })
      setCustomers(customerMap)

      const customerIds = customerData?.map(c => c.id) || []
      if (customerIds.length === 0) { setTransactions([]); setLoading(false); return }

      const { data: txnData } = await supabase
        .from('transactions').select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      setTransactions(txnData || [])

      const deps = txnData?.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0) || 0
      const pays = txnData?.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0) || 0
      const wdrs = txnData?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0) || 0
      setTotals({ deposits: deps, payments: pays, withdrawals: wdrs })
    } catch (e) {
      console.error('Payments load error:', e)
    }
    setLoading(false)
  }

  const filtered = transactions.filter(txn => {
    const c = customers[txn.customer_id]
    const name = c ? `${c.first_name} ${c.last_name} ${c.phone} ${c.email}` : ''
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) { const from = new Date(dateFrom); from.setHours(0,0,0,0); if (new Date(txn.created_at) < from) return false }
    if (dateTo)   { const to   = new Date(dateTo);   to.setHours(23,59,59,999); if (new Date(txn.created_at) > to)   return false }
    return true
  })

  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== '' || search !== ''

  function clearFilters() {
    setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo('')
  }

  function exportCSV() {
    const headers = ['Date', 'Customer', 'Phone', 'Type', 'Amount', 'Status']
    const rows = filtered.map(txn => {
      const c = customers[txn.customer_id]
      return [
        formatDateTime(txn.created_at),
        c ? `${c.first_name} ${c.last_name}` : 'Unknown',
        c?.phone || '',
        txLabel(txn.type),
        Number(txn.amount).toFixed(2),
        txn.status,
      ]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `partna-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── Totals row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        {[
          { label: 'Total deposits',     value: formatUGXShort(totals.deposits),                    accent: 'var(--color-green)'   },
          { label: 'Total fee payments', value: formatUGXShort(totals.payments),                    accent: 'var(--color-primary)' },
          { label: 'Total withdrawals',  value: formatUGXShort(totals.withdrawals),                 accent: 'var(--color-red)'     },
          { label: 'Net savings (AUM)',  value: formatUGXShort(totals.deposits - totals.withdrawals), accent: 'var(--color-yellow)' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'var(--color-white)',
            border: 'var(--border)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ height: 3, background: stat.accent, marginBottom: 'var(--space-3)' }} />
            <div style={{
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
              color: 'var(--color-grey)', marginBottom: 'var(--space-2)',
            }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30",
              color: 'var(--color-black)', lineHeight: 1,
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: 'var(--color-white)',
        border: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <span className="icon-outlined search-icon">search</span>
          <input
            type="text"
            className="input search-input"
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <span className="icon-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          className="input"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">All types</option>
          <option value="deposit">Deposits</option>
          <option value="payment">Fee payments</option>
          <option value="withdrawal">Withdrawals</option>
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
          <span style={{ color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
          <input type="date" className="input input-sm" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 140 }} />
        </div>

        {filtersActive && (
          <button onClick={clearFilters} className="btn btn-sm btn-danger">
            <span className="icon-outlined icon-xs">close</span>
            Clear
          </button>
        )}

        {/* Count badge */}
        <div style={{
          padding: '4px var(--space-3)',
          background: 'var(--color-bg)',
          border: 'var(--border)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-wide)',
          color: 'var(--color-grey)',
          whiteSpace: 'nowrap',
        }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Export */}
        <button onClick={exportCSV} className="btn btn-sm btn-black">
          <span className="icon-outlined icon-xs">download</span>
          Export CSV
        </button>
      </div>

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date & time</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
                  <div className="spinner spinner-lg spinner-purple" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
                  <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
                    payments
                  </span>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    {transactions.length === 0
                      ? 'Transactions will appear here once customers start depositing.'
                      : 'Try adjusting your filters.'}
                  </div>
                  {filtersActive && (
                    <button onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ margin: 'var(--space-4) auto 0' }}>
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(txn => {
                const c = customers[txn.customer_id]
                return (
                  <tr key={txn.id}>
                    {/* Customer */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: 32, height: 32,
                          background: 'var(--color-black)',
                          border: 'var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'var(--weight-black)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-primary)',
                          flexShrink: 0,
                          letterSpacing: 'var(--tracking-tight)',
                        }}>
                          {c?.first_name?.[0]}{c?.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {c ? `${c.first_name} ${c.last_name}` : 'Unknown'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                            {c?.phone}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                        {formatDateTime(txn.created_at)}
                      </span>
                    </td>

                    {/* Type */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{
                          width: 24, height: 24,
                          background: txAccent(txn.type),
                          border: 'var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span className="icon-outlined" style={{ fontSize: 13, color: 'var(--color-black)' }}>
                            {txIcon(txn.type)}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
                          {txLabel(txn.type)}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td>
                      <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(txn.type) }}>
                        {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge no-dot ${txn.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {txn.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}