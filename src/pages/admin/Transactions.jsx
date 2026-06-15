import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

// ── OpenFloat payment file generator ──
// Produces an .xlsx matching the Accounts sheet structure exactly
function downloadOpenFloatFile(rows, filename) {
  const header = [
    'Account Type',
    'Account Name',
    'Account Number',
    'Till or Paybill Number',
    'Till or Paybill Business Name',
    'Notification Phone Number',
    'Amount',
    'Remark',
  ]
  const data = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 40 }, // Account Type
    { wch: 30 }, // Account Name
    { wch: 20 }, // Account Number
    { wch: 25 }, // Till or Paybill Number
    { wch: 30 }, // Till or Paybill Business Name
    { wch: 28 }, // Notification Phone Number
    { wch: 15 }, // Amount
    { wch: 20 }, // Remark
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts')
  XLSX.writeFile(wb, filename)
}

export default function Transactions() {
  const [tab, setTab] = useState('customer')

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
  const [selectedCust, setSelectedCust] = useState(new Set()) // selected customer txn IDs

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
  const [selectedBiz, setSelectedBiz] = useState(new Set()) // selected biz txn IDs

  useEffect(() => {
    loadCustomer()
    loadBusiness()
  }, [])

  async function loadCustomer() {
    setLoadingCustomer(true)
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, other_names, phone, business_id, businesses(name))')
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

  // ── Selection helpers ──
  function toggleCust(id) {
    setSelectedCust(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllCust() {
    const withdrawals = filteredCustomer.filter(t => t.type === 'withdrawal')
    if (selectedCust.size === withdrawals.length) {
      setSelectedCust(new Set())
    } else {
      setSelectedCust(new Set(withdrawals.map(t => t.id)))
    }
  }

  function toggleBiz(id) {
    setSelectedBiz(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllBiz() {
    if (selectedBiz.size === filteredBiz.length) {
      setSelectedBiz(new Set())
    } else {
      setSelectedBiz(new Set(filteredBiz.map(t => t.id)))
    }
  }

  // ── OpenFloat export — customer withdrawals ──
  function exportCustOpenFloat() {
    const toExport = filteredCustomer.filter(t =>
      t.type === 'withdrawal' && selectedCust.has(t.id)
    )
    const rows = toExport.map(t => {
      const fullName = [
        t.customers?.first_name,
        t.customers?.other_names,
        t.customers?.last_name,
      ].filter(Boolean).join(' ')

      return [
        t.withdrawal_network || t.network || '',   // Account Type — MTN / AirtelMoney
        fullName,                                   // Account Name
        t.withdrawal_phone || '',                   // Account Number (mobile number)
        '',                                         // Till or Paybill Number — blank
        '',                                         // Till or Paybill Business Name — blank
        '',                                         // Notification Phone — blank for customers
        t.amount,                                   // Amount
        t.reference || t.id.slice(0, 8),           // Remark
      ]
    })
    downloadOpenFloatFile(rows, `partna-customer-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── OpenFloat export — business withdrawals ──
  function exportBizOpenFloat() {
    const toExport = filteredBiz.filter(t => selectedBiz.has(t.id))
    const rows = toExport.map(t => [
      t.withdrawal_method || '',                  // Account Type — MTN/AirtelMoney/bank name
      t.withdrawal_account_name || '',            // Account Name
      t.withdrawal_account_number || '',          // Account Number
      '',                                         // Till or Paybill Number — blank
      '',                                         // Till or Paybill Business Name — blank
      t.withdrawal_notify_phone || '',            // Notification Phone Number
      t.amount,                                   // Amount
      t.businesses?.name || '',                   // Remark
    ])
    downloadOpenFloatFile(rows, `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Legacy CSV exports (kept for general ledger use) ──
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
    const a = document.createElement('a'); a.href = url
    a.download = `partna-customer-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function exportBizCSV() {
    const rows = [
      ['Business', 'Method', 'Account Name', 'Account Number', 'Notify Phone', 'Amount', 'Status', 'Date'],
      ...filteredBiz.map(t => [
        t.businesses?.name || '',
        t.withdrawal_method || '',
        t.withdrawal_account_name || '',
        t.withdrawal_account_number || '',
        t.withdrawal_notify_phone || '',
        t.amount, t.status,
        new Date(t.created_at).toISOString(),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Filtering ──
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
  const custWithdrawals = filteredCustomer.filter(t => t.type === 'withdrawal')
  const allCustWithdrawalsSelected = custWithdrawals.length > 0 && selectedCust.size === custWithdrawals.length
  const allBizSelected = filteredBiz.length > 0 && selectedBiz.size === filteredBiz.length

  const hasCustomerFilters = search || filterBusiness || filterType || filterStatus || dateFrom || dateTo
  const hasBizFilters = bizSearch || bizFilterBusiness || bizFilterStatus || bizDateFrom || bizDateTo

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

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ color: 'rgba(0,0,0,0.2)' }}>↕</span>
    return <span style={{ color: ADMIN_PRIMARY }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function parseWithdrawalMethod(t) {
    // Prefer structured columns, fall back to notes parsing
    if (t.withdrawal_method) {
      if (t.withdrawal_method === 'MTN') return 'MTN MoMo'
      if (t.withdrawal_method === 'AirtelMoney') return 'Airtel Money'
      return t.withdrawal_method // bank name
    }
    const notes = t.notes || ''
    if (notes.includes('MTN')) return 'MTN MoMo'
    if (notes.includes('Airtel')) return 'Airtel Money'
    if (notes.includes('Bank:')) return 'Bank Transfer'
    return '—'
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── TABS ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: 'customer', label: 'Customer Transactions' },
            {
              id: 'business',
              label: `Business Withdrawals${pendingBizWithdrawals.length > 0 ? ` (${pendingBizWithdrawals.length} pending)` : ''}`,
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
          className="text-xs font-semibold px-4 py-2.5 rounded-xl"
          style={{ background: '#f0f2f5', color: ADMIN_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
          Export CSV
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

              {pendingCustWithdrawals.length > 0 && !filterStatus && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
                    {pendingCustWithdrawals.length} pending customer withdrawal{pendingCustWithdrawals.length > 1 ? 's' : ''} require processing
                  </div>
                  <button onClick={() => { setFilterStatus('pending'); setFilterType('withdrawal') }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#D97706', color: '#fff' }}>
                    Show pending
                  </button>
                </div>
              )}

              {/* OpenFloat download bar — appears when withdrawals are selected */}
              {selectedCust.size > 0 && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(27,79,114,0.06)', border: `1.5px solid ${ADMIN_PRIMARY}` }}>
                  <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    {selectedCust.size} withdrawal{selectedCust.size > 1 ? 's' : ''} selected
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedCust(new Set())}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                      Clear
                    </button>
                    <button onClick={exportCustOpenFloat}
                      className="text-xs font-bold px-4 py-1.5 rounded-lg"
                      style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                      Download OpenFloat file
                    </button>
                  </div>
                </div>
              )}

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

              {confirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
                  style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>
                    <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
                      Mark withdrawal as completed?
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      This confirms the mobile money disbursement has been processed.
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmId(null)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                        style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>Cancel</button>
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

              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
                        {/* Checkbox header — only shown for withdrawal rows */}
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox"
                            checked={allCustWithdrawalsSelected}
                            onChange={toggleAllCust}
                            title="Select all withdrawals"
                            className="cursor-pointer" />
                        </th>
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
                            className="px-4 py-3 text-left cursor-pointer select-none">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                                {col.label}
                              </span>
                              <SortIcon col={col.col} />
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomer.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-sm"
                            style={{ color: 'rgba(0,0,0,0.3)' }}>
                            No transactions found
                          </td>
                        </tr>
                      ) : filteredCustomer.map((t, i) => {
                        const isWithdrawal = t.type === 'withdrawal'
                        const isSelected = selectedCust.has(t.id)
                        return (
                          <tr key={t.id}
                            style={{
                              borderBottom: i < filteredCustomer.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                              background: isSelected ? 'rgba(27,79,114,0.04)' : 'transparent',
                            }}>
                            <td className="px-4 py-3">
                              {isWithdrawal && (
                                <input type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCust(t.id)}
                                  className="cursor-pointer" />
                              )}
                            </td>
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
                                style={{ background: statusStyle(t.status).bg, color: statusStyle(t.status).color }}>
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
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total requests', value: bizWithdrawals.length, color: ADMIN_PRIMARY },
                  { label: 'Total requested', value: formatUGX(bizWithdrawals.reduce((s, t) => s + Number(t.amount), 0)), color: '#DC2626' },
                  { label: 'Total completed', value: formatUGX(bizWithdrawals.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)), color: '#16A34A' },
                  { label: 'Pending', value: pendingBizWithdrawals.length, color: '#D97706' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
                    <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {pendingBizWithdrawals.length > 0 && !bizFilterStatus && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
                    {pendingBizWithdrawals.length} business withdrawal{pendingBizWithdrawals.length > 1 ? 's' : ''} pending processing
                  </div>
                  <button onClick={() => setBizFilterStatus('pending')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#D97706', color: '#fff' }}>
                    Show pending
                  </button>
                </div>
              )}

              {/* OpenFloat download bar */}
              {selectedBiz.size > 0 && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                  style={{ background: 'rgba(27,79,114,0.06)', border: `1.5px solid ${ADMIN_PRIMARY}` }}>
                  <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    {selectedBiz.size} withdrawal{selectedBiz.size > 1 ? 's' : ''} selected
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedBiz(new Set())}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                      Clear
                    </button>
                    <button onClick={exportBizOpenFloat}
                      className="text-xs font-bold px-4 py-1.5 rounded-lg"
                      style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                      Download OpenFloat file
                    </button>
                  </div>
                </div>
              )}

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

              {bizConfirmId && (() => {
                const w = bizWithdrawals.find(t => t.id === bizConfirmId)
                const method = parseWithdrawalMethod(w)
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>
                      <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
                        Mark withdrawal as processed?
                      </div>
                      <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#f0f2f5' }}>
                        {[
                          { label: 'Business', value: w?.businesses?.name },
                          { label: 'Amount', value: formatUGXFull(w?.amount), color: '#DC2626' },
                          { label: 'Method', value: method },
                          { label: 'Account name', value: w?.withdrawal_account_name || '—' },
                          { label: 'Account number', value: w?.withdrawal_account_number || '—' },
                          ...(w?.withdrawal_notify_phone ? [{ label: 'Notify', value: w.withdrawal_notify_phone }] : []),
                        ].map((row, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                            <span className="text-xs font-semibold" style={{ color: row.color || ADMIN_PRIMARY }}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        Confirm that payment has been sent. This action cannot be undone.
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setBizConfirmId(null)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>Cancel</button>
                        <button onClick={() => handleBizMarkCompleted(bizConfirmId)}
                          disabled={bizMarkingId === bizConfirmId}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: '#16A34A', color: '#fff' }}>
                          {bizMarkingId === bizConfirmId ? 'Saving...' : 'Mark processed'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox"
                            checked={allBizSelected}
                            onChange={toggleAllBiz}
                            title="Select all"
                            className="cursor-pointer" />
                        </th>
                        {['Business', 'Amount', 'Method', 'Account details', 'Status', 'Requested'].map(h => (
                          <th key={h} className="px-4 py-3 text-left">
                            <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{h}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBiz.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-sm"
                            style={{ color: 'rgba(0,0,0,0.3)' }}>
                            No withdrawal requests found
                          </td>
                        </tr>
                      ) : filteredBiz.map((t, i) => {
                        const method = parseWithdrawalMethod(t)
                        const ss = statusStyle(t.status)
                        const isSelected = selectedBiz.has(t.id)
                        const isMobile = method === 'MTN MoMo' || method === 'Airtel Money'
                        return (
                          <tr key={t.id}
                            style={{
                              borderBottom: i < filteredBiz.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                              background: isSelected ? 'rgba(27,79,114,0.04)' : 'transparent',
                            }}>
                            <td className="px-4 py-3">
                              <input type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBiz(t.id)}
                                className="cursor-pointer" />
                            </td>
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
                                  background: isMobile ? 'rgba(212,175,55,0.12)' : 'rgba(27,79,114,0.08)',
                                  color: isMobile ? '#92400e' : ADMIN_PRIMARY,
                                }}>
                                {method}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-semibold" style={{ color: '#333' }}>
                                {t.withdrawal_account_name || '—'}
                              </div>
                              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                {t.withdrawal_account_number || ''}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full"
                                style={{ background: ss.bg, color: ss.color }}>
                                {t.status === 'completed' ? 'Processed' : 'Pending'}
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