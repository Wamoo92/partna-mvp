import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

export default function Transactions() {
  const [tab, setTab] = useState('customer') // 'customer' | 'business'

  // ── Customer transactions state ──
  const [transactions, setTransactions] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loadingCustomer, setLoadingCustomer] = useState(true)
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

  // ── Business withdrawals state ──
  const [bizWithdrawals, setBizWithdrawals] = useState([])
  const [loadingBiz, setLoadingBiz] = useState(true)
  const [bizSearch, setBizSearch] = useState('')
  const [bizFilterBusiness, setBizFilterBusiness] = useState('')
  const [bizFilterStatus, setBizFilterStatus] = useState('')
  const [bizDateFrom, setBizDateFrom] = useState('')
  const [bizDateTo, setBizDateTo] = useState('')
  const [bizMarkingId, setBizMarkingId] = useState(null)
  const [bizConfirmId, setBizConfirmId] = useState(null)

  useEffect(() => {
    loadCustomer()
    loadBusiness()
  }, [])

  // ── Customer transactions ──
  async function loadCustomer() {
    setLoadingCustomer(true)
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, phone, business_id, businesses(name))')
        .order('created_at', { ascending: false })
      setTransactions(txnData || [])

      const { data: bizData } = await supabase
        .from('businesses').select('id, name').order('name')
      setBusinesses(bizData || [])
    } catch (e) {
      console.error('Customer transactions load error:', e)
    }
    setLoadingCustomer(false)
  }

  async function handleMarkCompleted(txnId) {
    setMarkingId(txnId)
    try {
      await supabase.from('transactions').update({ status: 'completed' }).eq('id', txnId)
      setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t))
      setConfirmId(null)
    } catch (e) {
      console.error('Mark completed error:', e)
    }
    setMarkingId(null)
  }

  // ── Business withdrawals ──
  async function loadBusiness() {
    setLoadingBiz(true)
    try {
      const { data } = await supabase
        .from('business_transactions')
        .select('*, businesses(id, name)')
        .eq('type', 'withdrawal')
        .order('created_at', { ascending: false })
      setBizWithdrawals(data || [])
    } catch (e) {
      console.error('Business withdrawals load error:', e)
    }
    setLoadingBiz(false)
  }

  async function handleBizMarkCompleted(txnId) {
    setBizMarkingId(txnId)
    try {
      await supabase.from('business_transactions')
        .update({ status: 'completed' })
        .eq('id', txnId)
      setBizWithdrawals(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t))
      setBizConfirmId(null)
    } catch (e) {
      console.error('Biz mark completed error:', e)
    }
    setBizMarkingId(null)
  }

  // ── Shared formatting ──
  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatUGXFull(n) {
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

  function statusStyle(status) {
    if (status === 'completed') return { bg: 'rgba(22,163,74,0.1)', color: '#16A34A' }
    if (status === 'pending') return { bg: 'rgba(217,119,6,0.1)', color: '#D97706' }
    return { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' }
  }

  // ── Customer sort ──
  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ color: 'rgba(0,0,0,0.2)' }}>↕</span>
    return <span style={{ color: ADMIN_PRIMARY }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Customer CSV export ──
  function exportCustomerCSV() {
    const rows = [
      ['Reference', 'Customer', 'Business', 'Type', 'Amount', 'Status', 'Date'],
      ...filteredCustomer.map(t => [
        t.reference || t.id,
        `${t.customers?.first_name} ${t.customers?.last_name}`,
        t.customers?.businesses?.name || '',
        t.type, t.amount, t.status,
        new Date(t.created_at).toISOString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partna-customer-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Business withdrawals CSV export ──
  function exportBizCSV() {
    const rows = [
      ['Business', 'Method', 'Amount', 'Status', 'Notes', 'Date'],
      ...filteredBiz.map(t => [
        t.businesses?.name || '',
        t.notes?.includes('MoMo') || t.notes?.includes('MTN') || t.notes?.includes('Airtel')
          ? 'Mobile Money' : 'Bank Transfer',
        t.amount, t.status, t.notes || '',
        new Date(t.created_at).toISOString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtered customer transactions ──
  const filteredCustomer = transactions
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

  // ── Filtered business withdrawals ──
  const filteredBiz = bizWithdrawals.filter(t => {
    if (bizSearch) {
      const s = bizSearch.toLowerCase()
      const biz = t.businesses?.name?.toLowerCase() || ''
      if (!biz.includes(s) && !t.notes?.toLowerCase().includes(s)) return false
    }
    if (bizFilterBusiness && t.business_id !== bizFilterBusiness) return false
    if (bizFilterStatus && t.status !== bizFilterStatus) return false
    if (bizDateFrom && new Date(t.created_at) < new Date(bizDateFrom)) return false
    if (bizDateTo && new Date(t.created_at) > new Date(bizDateTo + 'T23:59:59')) return false
    return true
  })

  // Derived stats
  const totalDeposits = filteredCustomer.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
  const totalWithdrawals = filteredCustomer.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
  const pendingCustWithdrawals = filteredCustomer.filter(t => t.type === 'withdrawal' && t.status === 'pending')
  const pendingBizWithdrawals = bizWithdrawals.filter(t => t.status === 'pending')

  const hasCustomerFilters = search || filterBusiness || filterType || filterStatus || dateFrom || dateTo
  const hasBizFilters = bizSearch || bizFilterBusiness || bizFilterStatus || bizDateFrom || bizDateTo

  // ── Parse withdrawal method from notes ──
  function parseWithdrawalMethod(notes) {
    if (!notes) return { method: '—', detail: '' }
    if (notes.includes('MTN')) return { method: 'MTN MoMo', detail: notes }
    if (notes.includes('Airtel')) return { method: 'Airtel Money', detail: notes }
    if (notes.includes('Bank:')) return { method: 'Bank Transfer', detail: notes }
    return { method: 'Mobile Money', detail: notes }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── TABS ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: 'customer', label: '👤 Customer Transactions' },
            {
              id: 'business',
              label: `🏢 Business Withdrawals${pendingBizWithdrawals.length > 0 ? ` (${pendingBizWithdrawals.length} pending)` : ''}`,
            },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: tab === t.id ? ADMIN_PRIMARY : '#fff',
                color: tab === t.id ? '#fff' : ADMIN_PRIMARY,
                border: `1.5px solid ${tab === t.id ? ADMIN_PRIMARY : 'rgba(27,79,114,0.2)'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={tab === 'customer' ? exportCustomerCSV : exportBizCSV}
          className="text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
          ↓ Export CSV
        </button>
      </div>

      {/* ══════════════════════════════════════════
          CUSTOMER TRANSACTIONS TAB
      ══════════════════════════════════════════ */}
      {tab === 'customer' && (
        <>
          {loadingCustomer ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 rounded-full animate-spin"
                style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Shown transactions', value: filteredCustomer.length, color: ADMIN_PRIMARY },
                  { label: 'Total deposits', value: formatUGX(totalDeposits), color: '#16A34A' },
                  { label: 'Total withdrawals', value: formatUGX(totalWithdrawals), color: '#DC2626' },
                  { label: 'Pending withdrawals', value: pendingCustWithdrawals.length, color: '#D97706' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
                    <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Pending alert */}
              {pendingCustWithdrawals.length > 0 && !filterStatus && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
                    ⏳ {pendingCustWithdrawals.length} pending customer withdrawal{pendingCustWithdrawals.length > 1 ? 's' : ''} require processing
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
                <input type="text" placeholder="Search by name or reference..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
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
                {hasCustomerFilters && (
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
                      This confirms the mobile money disbursement has been processed.
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmId(null)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                        style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                        Cancel
                      </button>
                      <button onClick={() => handleMarkCompleted(confirmId)}
                        disabled={markingId === confirmId}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                        style={{ background: '#16A34A', color: '#fff' }}>
                        {markingId === confirmId ? 'Saving...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer transactions table */}
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
                          <th key={col.col} onClick={() => handleSort(col.col)}
                            className="px-4 py-3 text-left cursor-pointer select-none"
                            style={{ background: '#f8f9fa' }}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                                {col.label}
                              </span>
                              <SortIcon col={col.col} />
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3" style={{ background: '#f8f9fa' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomer.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-sm"
                            style={{ color: 'rgba(0,0,0,0.3)' }}>
                            No transactions found
                          </td>
                        </tr>
                      ) : filteredCustomer.map((t, i) => (
                        <tr key={t.id}
                          style={{ borderBottom: i < filteredCustomer.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
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
                                background: statusStyle(t.status).bg,
                                color: statusStyle(t.status).color,
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
                              <button onClick={() => setConfirmId(t.id)}
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
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          BUSINESS WITHDRAWALS TAB
      ══════════════════════════════════════════ */}
      {tab === 'business' && (
        <>
          {loadingBiz ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 rounded-full animate-spin"
                style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total requests', value: bizWithdrawals.length, color: ADMIN_PRIMARY },
                  {
                    label: 'Total requested',
                    value: formatUGX(bizWithdrawals.reduce((s, t) => s + Number(t.amount), 0)),
                    color: '#DC2626',
                  },
                  {
                    label: 'Total completed',
                    value: formatUGX(bizWithdrawals.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)),
                    color: '#16A34A',
                  },
                  { label: 'Pending', value: pendingBizWithdrawals.length, color: '#D97706' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
                    <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Pending alert */}
              {pendingBizWithdrawals.length > 0 && !bizFilterStatus && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
                    ⏳ {pendingBizWithdrawals.length} business withdrawal{pendingBizWithdrawals.length > 1 ? 's' : ''} pending processing
                  </div>
                  <button onClick={() => setBizFilterStatus('pending')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#D97706', color: '#fff' }}>
                    Show pending
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <input type="text" placeholder="Search by business or notes..."
                  value={bizSearch} onChange={e => setBizSearch(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                <select value={bizFilterBusiness} onChange={e => setBizFilterBusiness(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
                  <option value="">All businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={bizFilterStatus} onChange={e => setBizFilterStatus(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
                <input type="date" value={bizDateFrom} onChange={e => setBizDateFrom(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                <input type="date" value={bizDateTo} onChange={e => setBizDateTo(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                {hasBizFilters && (
                  <button onClick={() => {
                    setBizSearch(''); setBizFilterBusiness('')
                    setBizFilterStatus(''); setBizDateFrom(''); setBizDateTo('')
                  }}
                    className="text-xs font-semibold px-3 py-2.5 rounded-xl"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    Clear filters
                  </button>
                )}
              </div>

              {/* Confirm modal */}
              {bizConfirmId && (() => {
                const w = bizWithdrawals.find(t => t.id === bizConfirmId)
                const { method, detail } = parseWithdrawalMethod(w?.notes)
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
                      style={{ background: '#fff' }}>
                      <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
                        Mark withdrawal as processed?
                      </div>
                      <div className="rounded-xl p-4 flex flex-col gap-2"
                        style={{ background: '#f0f2f5' }}>
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Business</span>
                          <span className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                            {w?.businesses?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Amount</span>
                          <span className="text-xs font-bold" style={{ color: '#DC2626' }}>
                            {formatUGXFull(w?.amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Method</span>
                          <span className="text-xs font-semibold" style={{ color: '#333' }}>{method}</span>
                        </div>
                        <div className="text-xs mt-1 leading-relaxed"
                          style={{ color: 'rgba(0,0,0,0.45)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '8px' }}>
                          {detail}
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        Confirm that payment has been sent to the business via {method}.
                        This action cannot be undone.
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setBizConfirmId(null)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                          Cancel
                        </button>
                        <button onClick={() => handleBizMarkCompleted(bizConfirmId)}
                          disabled={bizMarkingId === bizConfirmId}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: '#16A34A', color: '#fff' }}>
                          {bizMarkingId === bizConfirmId ? 'Saving...' : '✓ Mark processed'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Business withdrawals table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
                        {['Business', 'Amount', 'Method', 'Details', 'Status', 'Requested'].map(h => (
                          <th key={h} className="px-4 py-3 text-left">
                            <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{h}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3" style={{ background: '#f8f9fa' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBiz.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm"
                            style={{ color: 'rgba(0,0,0,0.3)' }}>
                            No withdrawal requests found
                          </td>
                        </tr>
                      ) : filteredBiz.map((t, i) => {
                        const { method, detail } = parseWithdrawalMethod(t.notes)
                        const ss = statusStyle(t.status)
                        return (
                          <tr key={t.id}
                            style={{ borderBottom: i < filteredBiz.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <td className="px-4 py-3">
                              <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                                {t.businesses?.name || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold" style={{ color: '#DC2626' }}>
                                {formatUGXFull(t.amount)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full"
                                style={{
                                  background: method.includes('Bank')
                                    ? 'rgba(27,79,114,0.08)'
                                    : 'rgba(212,175,55,0.12)',
                                  color: method.includes('Bank') ? ADMIN_PRIMARY : '#92400e',
                                }}>
                                {method.includes('Bank') ? '🏦' : '📱'} {method}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <div className="text-xs leading-relaxed truncate"
                                style={{ color: 'rgba(0,0,0,0.45)' }}>
                                {detail}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize"
                                style={{ background: ss.bg, color: ss.color }}>
                                {t.status === 'completed' ? '✓ Processed' : '⏳ Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                {formatDateTime(t.created_at)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {t.status === 'pending' && (
                                <button onClick={() => setBizConfirmId(t.id)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                                  Mark processed
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}