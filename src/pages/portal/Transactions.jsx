import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const CAMPAIGN_ID = 'b1b2c3d4-0000-0000-0000-000000000001'
const PAGE_SIZE = 10

export default function Transactions({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [allTransactions, setAllTransactions] = useState([])
  const [wallet, setWallet] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (customer) loadData()
  }, [customer])

  async function loadData() {
    setLoading(true)
    try {
      const r1 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r1.data && r1.data.length > 0) setWallet(r1.data[0])

      const r2 = await supabase.from('campaigns').select('*').eq('id', CAMPAIGN_ID)
      if (r2.data && r2.data.length > 0) setCampaign(r2.data[0])

      const r3 = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
      setAllTransactions(r3.data || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const filtered = allTransactions.filter(txn => {
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

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  function clearFilters() {
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setVisibleCount(PAGE_SIZE)
  }

  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function formatGroupDate(dateStr) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function txLabel(type) {
    switch (type) {
      case 'deposit': return 'Deposit'
      case 'payment': return 'Fee Payment'
      case 'withdrawal': return 'Withdrawal'
      default: return type
    }
  }

  function txIcon(type) {
    switch (type) {
      case 'deposit': return '↓'
      case 'payment': return '↑'
      case 'withdrawal': return '↑'
      default: return '·'
    }
  }

  function txColor(type) { return type === 'deposit' ? '#16A34A' : '#DC2626' }
  function txSign(type) { return type === 'deposit' ? '+' : '-' }

  function groupByDate(txns) {
    const groups = {}
    txns.forEach(txn => {
      const key = new Date(txn.created_at).toDateString()
      if (!groups[key]) groups[key] = []
      groups[key].push(txn)
    })
    return Object.entries(groups).map(([key, items]) => ({
      label: formatGroupDate(items[0].created_at),
      items,
    }))
  }

  const groups = groupByDate(visible)
  const balance = wallet ? Number(wallet.balance) : 0

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={() => navigate('/portal/home')} className="text-white text-xl">&#8592;</button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Transaction History</div>
        </div>
      </header>

      <div className="px-5 pt-5 pb-10" style={{ background: brand.primaryColor }}>
        <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Current balance</div>
        <div className="text-white text-3xl font-bold mb-0.5">{formatUGX(balance)}</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          saved toward {campaign?.name || 'Term 3 Fees 2026'}
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 px-4 py-5 flex flex-col gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        <div className="flex items-center justify-between">
          <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>
            Transactions
            {filtersActive && (
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
                Filtered
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {filtersActive && (
              <button onClick={clearFilters}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                Clear
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{
                background: showFilters ? brand.primaryColor : '#fff',
                color: showFilters ? '#fff' : brand.primaryColor,
                border: `1.5px solid ${brand.primaryColor}`
              }}>
              {showFilters ? 'Hide filters' : 'Filter'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#fff' }}>
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: 'rgba(0,0,0,0.4)' }}>Transaction type</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'deposit', label: 'Deposits' },
                  { value: 'payment', label: 'Payments' },
                  { value: 'withdrawal', label: 'Withdrawals' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTypeFilter(opt.value); setVisibleCount(PAGE_SIZE) }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: typeFilter === opt.value ? brand.primaryColor : '#f0f2f5',
                      color: typeFilter === opt.value ? '#fff' : 'rgba(0,0,0,0.5)',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: 'rgba(0,0,0,0.4)' }}>Date range</div>
              <div className="flex gap-2 items-center">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>From</label>
                  <input type="date" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setVisibleCount(PAGE_SIZE) }}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', color: '#333', border: 'none' }} />
                </div>
                <div className="text-xs mt-4" style={{ color: 'rgba(0,0,0,0.3)' }}>—</div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>To</label>
                  <input type="date" value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setVisibleCount(PAGE_SIZE) }}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', color: '#333', border: 'none' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-3xl mb-3">📋</div>
            <div className="text-sm font-semibold mb-1" style={{ color: brand.primaryColor }}>
              No transactions found
            </div>
            <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {filtersActive ? 'Try adjusting your filters' : 'Add money to get started'}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group, gi) => (
              <div key={gi}>
                <div className="text-xs font-bold mb-2 px-1" style={{ color: 'rgba(0,0,0,0.35)' }}>
                  {group.label}
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                  {group.items.map((txn, i) => (
                    <div key={txn.id} className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: i < group.items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                          {txIcon(txn.type)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: '#333' }}>
                            {txLabel(txn.type)}
                          </div>
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                            {formatTime(txn.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold" style={{ color: txColor(txn.type) }}>
                        {txSign(txn.type)}{formatUGX(txn.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="w-full py-3 rounded-2xl text-xs font-semibold"
                style={{ background: '#fff', color: brand.primaryColor, border: `1.5px solid rgba(27,79,114,0.15)` }}>
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            )}

            <div className="text-center text-xs pb-2" style={{ color: 'rgba(0,0,0,0.3)' }}>
              Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} transactions
            </div>
          </div>
        )}

      </div>

      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1">
            <span className="text-lg leading-none"
              style={{ color: item.path === '/portal/transactions' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs"
              style={{ color: item.path === '/portal/transactions' ? brand.primaryColor : 'rgba(0,0,0,0.3)', fontWeight: item.path === '/portal/transactions' ? 600 : 400 }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}