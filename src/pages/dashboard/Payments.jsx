import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

export default function Payments({ admin, business }) {
  const [transactions, setTransactions] = useState([])
  const [customers, setCustomers] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [totals, setTotals] = useState({ deposits: 0, payments: 0, withdrawals: 0 })

  useEffect(() => {
    if (business) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    try {
      // Get all customers for this business
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, first_name, last_name, phone, email')
        .eq('business_id', business.id)

      const customerMap = {}
      customerData?.forEach(c => { customerMap[c.id] = c })
      setCustomers(customerMap)

      const customerIds = customerData?.map(c => c.id) || []
      if (customerIds.length === 0) {
        setTransactions([])
        setLoading(false)
        return
      }

      // Get all transactions
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      setTransactions(txnData || [])

      // Calculate totals
      const deps = txnData?.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0) || 0
      const pays = txnData?.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0) || 0
      const wdrs = txnData?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0) || 0
      setTotals({ deposits: deps, payments: pays, withdrawals: wdrs })

    } catch (e) {
      console.error('Payments load error:', e)
    }
    setLoading(false)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatUGXShort(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('en-UG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  function txLabel(type) {
    switch (type) {
      case 'deposit': return 'Deposit'
      case 'payment': return 'Fee payment'
      case 'withdrawal': return 'Withdrawal'
      default: return type
    }
  }

  function txColor(type) {
    return type === 'deposit' ? '#16A34A' : '#DC2626'
  }

  function txIcon(type) {
    return type === 'deposit' ? '↓' : '↑'
  }

  // Apply filters
  const filtered = transactions.filter(txn => {
    const customer = customers[txn.customer_id]
    const name = customer ? `${customer.first_name} ${customer.last_name} ${customer.phone} ${customer.email}` : ''
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      if (new Date(txn.created_at) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (new Date(txn.created_at) > to) return false
    }
    return true
  })

  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== '' || search !== ''

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partna-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Totals row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total deposits', value: formatUGXShort(totals.deposits), color: '#16A34A' },
          { label: 'Total fee payments', value: formatUGXShort(totals.payments), color: PARTNA_PRIMARY },
          { label: 'Total withdrawals', value: formatUGXShort(totals.withdrawals), color: '#DC2626' },
          { label: 'Net savings (AUM)', value: formatUGXShort(totals.deposits - totals.withdrawals), color: PARTNA_GOLD },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl p-5" style={{ background: '#fff' }}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{stat.label}</div>
            <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap" style={{ background: '#fff' }}>
        <input
          type="text"
          placeholder="Search by customer name, phone or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 rounded-xl text-sm outline-none"
          style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
        />

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs outline-none font-semibold"
          style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }}>
          <option value="all">All types</option>
          <option value="deposit">Deposits</option>
          <option value="payment">Fee payments</option>
          <option value="withdrawal">Withdrawals</option>
        </select>

        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
        </div>

        {filtersActive && (
          <button onClick={clearFilters}
            className="text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            Clear
          </button>
        )}

        <div className="text-xs font-semibold px-3 py-2 rounded-xl"
          style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>

        <button onClick={exportCSV}
          className="text-xs font-semibold px-4 py-2 rounded-xl"
          style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>

        {/* Table header */}
        <div className="grid px-4 py-3 text-xs font-bold"
          style={{
            gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 0.8fr',
            color: 'rgba(0,0,0,0.35)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: '#fafafa'
          }}>
          <span>Customer</span>
          <span>Date & time</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 rounded-full animate-spin"
              style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-2xl mb-2">💳</div>
            <div className="text-sm font-semibold mb-1" style={{ color: PARTNA_PRIMARY }}>
              {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {transactions.length === 0
                ? 'Transactions will appear here once customers start depositing'
                : 'Try adjusting your filters'}
            </div>
          </div>
        ) : (
          filtered.map((txn, i) => {
            const customer = customers[txn.customer_id]
            return (
              <div key={txn.id}
                className="grid items-center px-4 py-3"
                style={{
                  gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 0.8fr',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>

                {/* Customer */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(27,79,114,0.1)', color: PARTNA_PRIMARY }}>
                    {customer?.first_name?.[0]}{customer?.last_name?.[0]}
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: '#333' }}>
                      {customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown'}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                      {customer?.phone}
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  {formatDateTime(txn.created_at)}
                </div>

                {/* Type */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                      {txIcon(txn.type)}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: txColor(txn.type) }}>
                      {txLabel(txn.type)}
                    </span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-xs font-bold" style={{ color: txColor(txn.type) }}>
                  {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                </div>

                {/* Status */}
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: txn.status === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                      color: txn.status === 'completed' ? '#16A34A' : '#D97706',
                    }}>
                    {txn.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                  </span>
                </div>

              </div>
            )
          })
        )}
      </div>

    </div>
  )
}