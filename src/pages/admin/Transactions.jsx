import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBusiness, setFilterBusiness] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [markingId, setMarkingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, phone, business_id, businesses(name))')
        .order('created_at', { ascending: false })

      setTransactions(txnData || [])

      const { data: bizData } = await supabase
        .from('businesses')
        .select('id, name')
        .order('name')
      setBusinesses(bizData || [])

    } catch (e) {
      console.error('Transactions load error:', e)
    }
    setLoading(false)
  }

  async function handleMarkCompleted(txnId) {
    setMarkingId(txnId)
    try {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', txnId)
      setTransactions(prev =>
        prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t)
      )
      setConfirmId(null)
    } catch (e) {
      console.error('Mark completed error:', e)
    }
    setMarkingId(null)
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDateTime(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-UG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  function txColor(type) {
    if (type === 'deposit') return '#16A34A'
    if (type === 'withdrawal') return '#DC2626'
    return '#D97706'
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ color: 'rgba(0,0,0,0.2)' }}>↕</span>
    return <span style={{ color: ADMIN_PRIMARY }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function exportCSV() {
    const rows = [
      ['Reference', 'Customer', 'Business', 'Type', 'Amount', 'Status', 'Date'],
      ...filtered.map(t => [
        t.reference || t.id,
        `${t.customers?.first_name} ${t.customers?.last_name}`,
        t.customers?.businesses?.name || '',
        t.type,
        t.amount,
        t.status,
        new Date(t.created_at).toISOString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partna-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = transactions
    .filter(t => {
      if (search) {
        const s = search.toLowerCase()
        const name = `${t.customers?.first_name} ${t.customers?.last_name}`.toLowerCase()
        if (!name.includes(s) && !t.reference?.toLowerCase().includes(s)) return false
      }
      if (filterBusiness && t.customers?.business_id !== filterBusiness) return false
      if (filterType && t.type !== filterType) return false
      if (filterStatus && t.status !== filterStatus) return false
      if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (sortBy === 'amount') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  // Summary stats for filtered set
  const totalDeposits = filtered.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
  const totalWithdrawals = filtered.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
  const pendingWithdrawals = filtered.filter(t => t.type === 'withdrawal' && t.status === 'pending')

  const hasFilters = search || filterBusiness || filterType || filterStatus || dateFrom || dateTo

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Transactions</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {filtered.length} of {transactions.length} transactions
          </div>
        </div>
        <button onClick={exportCSV}
          className="text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Shown transactions', value: filtered.length, color: ADMIN_PRIMARY },
          { label: 'Total deposits', value: formatUGX(totalDeposits), color: '#16A34A' },
          { label: 'Total withdrawals', value: formatUGX(totalWithdrawals), color: '#DC2626' },
          { label: 'Pending withdrawals', value: pendingWithdrawals.length, color: '#D97706' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-4" style={{ background: '#fff' }}>
            <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
            <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pending withdrawals alert */}
      {pendingWithdrawals.length > 0 && !filterStatus && (
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
            ⏳ {pendingWithdrawals.length} pending withdrawal{pendingWithdrawals.length > 1 ? 's' : ''} require processing
          </div>
          <button onClick={() => setFilterStatus('pending')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#D97706', color: '#fff' }}>
            Show pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
        />
        <select value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="payment">Payment</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
        {hasFilters && (
          <button onClick={() => {
            setSearch(''); setFilterBusiness(''); setFilterType('')
            setFilterStatus(''); setDateFrom(''); setDateTo('')
          }}
            className="text-xs font-semibold px-3 py-2.5 rounded-xl"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Confirm modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: '#fff' }}>
            <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
              Mark withdrawal as completed?
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              This confirms the mobile money disbursement has been processed. The customer will receive a receipt.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                Cancel
              </button>
              <button
                onClick={() => handleMarkCompleted(confirmId)}
                disabled={markingId === confirmId}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#16A34A', color: '#fff' }}>
                {markingId === confirmId ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[
                  { label: 'Reference', col: 'reference' },
                  { label: 'Customer', col: 'customer' },
                  { label: 'Business', col: 'business' },
                  { label: 'Type', col: 'type' },
                  { label: 'Amount', col: 'amount' },
                  { label: 'Status', col: 'status' },
                  { label: 'Date', col: 'created_at' },
                ].map(col => (
                  <th key={col.col}
                    onClick={() => handleSort(col.col)}
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    style={{ background: '#f8f9fa' }}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{col.label}</span>
                      <SortIcon col={col.col} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3" style={{ background: '#f8f9fa' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'rgba(0,0,0,0.3)' }}>
                    No transactions found
                  </td>
                </tr>
              ) : filtered.map((t, i) => (
                <tr key={t.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      {t.reference || t.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                      {t.customers?.first_name} {t.customers?.last_name}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      {t.customers?.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: '#333' }}>
                      {t.customers?.businesses?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold capitalize"
                      style={{ color: txColor(t.type) }}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold" style={{ color: txColor(t.type) }}>
                      {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
                      style={{
                        background: t.status === 'completed'
                          ? 'rgba(22,163,74,0.1)'
                          : t.status === 'pending'
                          ? 'rgba(217,119,6,0.1)'
                          : 'rgba(220,38,38,0.1)',
                        color: t.status === 'completed'
                          ? '#16A34A'
                          : t.status === 'pending'
                          ? '#D97706'
                          : '#DC2626',
                      }}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      {formatDateTime(t.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.type === 'withdrawal' && t.status === 'pending' && (
                      <button
                        onClick={() => setConfirmId(t.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                        style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                        Mark completed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}