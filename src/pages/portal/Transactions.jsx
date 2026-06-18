import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const PAGE_SIZE = 10

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-UG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatGroupDate(dateStr) {
  const date      = new Date(dateStr)
  const today     = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString())     return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
}

function txLabel(type) {
  switch (type) {
    case 'deposit':          return 'Deposit'
    case 'payment':          return 'Payment'
    case 'fee_payment':      return 'Fee payment'
    case 'late_fee_payment': return 'Fee payment (late)'
    case 'withdrawal':       return 'Withdrawal'
    case 'cashback':         return 'Cashback reward'
    default:                 return type
  }
}

function txIcon(type) {
  switch (type) {
    case 'deposit':          return 'south'
    case 'withdrawal':       return 'north'
    case 'payment':          return 'north'
    case 'fee_payment':      return 'north'
    case 'late_fee_payment': return 'north'
    case 'cashback':         return 'redeem'
    default:                 return 'swap_vert'
  }
}

function txAccent(type) {
  switch (type) {
    case 'deposit':          return 'var(--color-green)'
    case 'payment':          return 'var(--color-primary)'
    case 'fee_payment':      return 'var(--color-primary)'
    case 'late_fee_payment': return 'var(--color-yellow)'
    case 'withdrawal':       return 'var(--color-yellow)'
    case 'cashback':         return 'var(--color-primary)'
    default:                 return 'var(--color-grey-light)'
  }
}

function txAmountColor(type) {
  return type === 'deposit' || type === 'cashback' ? '#2D8B45' : '#C0392B'
}

function txSign(type) {
  return type === 'deposit' || type === 'cashback' ? '+' : '-'
}

function groupByDate(txns) {
  const groups = {}
  txns.forEach(txn => {
    const key = new Date(txn.created_at).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(txn)
  })
  return Object.entries(groups).map(([, items]) => ({
    label: formatGroupDate(items[0].created_at),
    items,
  }))
}

export default function Transactions({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const enrollmentId = location.state?.enrollmentId || null

  const [enrollments, setEnrollments]           = useState([])
  const [activeEnrollment, setActiveEnrollment] = useState(null)
  const [wallet, setWallet]                     = useState(null)
  const [campaign, setCampaign]                 = useState(null)
  const [allTransactions, setAllTransactions]   = useState([])
  const [loading, setLoading]                   = useState(true)
  const [visibleCount, setVisibleCount]         = useState(PAGE_SIZE)

  const [typeFilter, setTypeFilter]   = useState('all')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { if (customer) loadData() }, [customer, enrollmentId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: enrollData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })

      setEnrollments(enrollData || [])

      let active = null
      if (enrollmentId && enrollData) {
        active = enrollData.find(e => e.id === enrollmentId) || enrollData[0]
      } else {
        active = enrollData?.[0] || null
      }

      setActiveEnrollment(active)
      setCampaign(active?.campaigns || null)
      setWallet(active?.wallets || null)

      if (active) {
        const { data: txnData } = await supabase
          .from('transactions')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('campaign_id', active.campaign_id)
          .order('created_at', { ascending: false })
        setAllTransactions(txnData || [])
      }
    } catch (e) {
      console.error('Transactions load error:', e)
    }
    setLoading(false)
  }

  async function switchEnrollment(enrollment) {
    setActiveEnrollment(enrollment)
    setCampaign(enrollment.campaigns)
    setWallet(enrollment.wallets)
    setVisibleCount(PAGE_SIZE)
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')

    const { data: txnData } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('campaign_id', enrollment.campaign_id)
      .order('created_at', { ascending: false })
    setAllTransactions(txnData || [])
  }

  const filtered = allTransactions.filter(txn => {
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
      if (new Date(txn.created_at) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      if (new Date(txn.created_at) > to) return false
    }
    return true
  })

  const visible       = filtered.slice(0, visibleCount)
  const hasMore       = filtered.length > visibleCount
  const groups        = groupByDate(visible)
  const balance       = wallet ? Number(wallet.balance) : 0
  const hasMultiple   = enrollments.length > 1
  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  function clearFilters() {
    setTypeFilter('all'); setDateFrom(''); setDateTo(''); setVisibleCount(PAGE_SIZE)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', position: 'sticky', top: 0, zIndex: 'var(--z-sticky)' }}>
        <button onClick={() => navigate('/portal/home')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '2px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'var(--color-white)', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div>
          <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>Transaction History</div>
          {campaign && (
            <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>{campaign.name}</div>
          )}
        </div>
      </header>

      {/* ── Balance hero ── */}
      <div style={{ background: 'var(--color-black)', borderBottom: '3px solid var(--color-primary)', padding: 'var(--space-6) var(--space-5) var(--space-8)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-1)' }}>Current balance</div>
        <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-black)', color: 'var(--color-white)', lineHeight: 1, letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 112, 'opsz' 48", marginBottom: 'var(--space-1)' }}>{formatUGX(balance)}</div>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.45)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>Saved toward {campaign?.name || '—'}</div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Campaign switcher */}
        {hasMultiple && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>Campaign</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 }}>
              {enrollments.map(e => {
                const active = activeEnrollment?.id === e.id
                return (
                  <button key={e.id} onClick={() => switchEnrollment(e)} style={{ flexShrink: 0, padding: '6px var(--space-4)', background: active ? 'var(--color-black)' : 'var(--color-white)', color: active ? 'var(--color-white)' : 'var(--color-black)', border: active ? '2px solid var(--color-black)' : 'var(--border)', boxShadow: active ? 'var(--shadow-sm)' : 'none', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', cursor: 'pointer', transition: 'all var(--transition-base)' }}>
                    {e.campaigns?.name || '—'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase' }}>Transactions</span>
            {filtersActive && <span className="badge badge-primary no-dot">Filtered</span>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {filtersActive && (
              <button onClick={clearFilters} className="btn btn-sm btn-danger">
                <span className="icon-outlined icon-xs">close</span>
                Clear
              </button>
            )}
            <button onClick={() => setShowFilters(f => !f)} className={showFilters ? 'btn btn-sm btn-black' : 'btn btn-sm btn-secondary'}>
              <span className="icon-outlined icon-xs">tune</span>
              {showFilters ? 'Hide' : 'Filter'}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>Type</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {[
                  { value: 'all',          label: 'All'         },
                  { value: 'deposit',      label: 'Deposits'    },
                  { value: 'payment',      label: 'Payments'    },
                  { value: 'fee_payment',  label: 'Fee payments'},
                  { value: 'withdrawal',   label: 'Withdrawals' },
                  { value: 'cashback',     label: 'Cashback'    },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setTypeFilter(opt.value); setVisibleCount(PAGE_SIZE) }} style={{ padding: '5px var(--space-3)', background: typeFilter === opt.value ? 'var(--color-black)' : 'var(--color-bg)', color: typeFilter === opt.value ? 'var(--color-white)' : 'var(--color-grey)', border: typeFilter === opt.value ? '2px solid var(--color-black)' : 'var(--border)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', cursor: 'pointer', transition: 'all var(--transition-fast)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: '1.5px', background: 'var(--color-grey-light)' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>Date range</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">From</label>
                  <input type="date" className="input input-sm" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setVisibleCount(PAGE_SIZE) }} />
                </div>
                <span style={{ color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)', paddingBottom: 'var(--space-2)' }}>—</span>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">To</label>
                  <input type="date" className="input input-sm" value={dateTo} onChange={e => { setDateTo(e.target.value); setVisibleCount(PAGE_SIZE) }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <span className="icon-outlined empty-state-icon">receipt_long</span>
            <div className="empty-state-title">No transactions found</div>
            <p className="empty-state-body">
              {filtersActive ? 'Try adjusting your filters to see more transactions.' : 'Add money to this campaign to get started.'}
            </p>
            {filtersActive && (
              <button onClick={clearFilters} className="btn btn-secondary">
                <span className="icon-outlined icon-sm">close</span>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {groups.map((group, gi) => (
              <div key={gi}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>
                  {group.label}
                </div>
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  {group.items.map((txn, i) => (
                    <div key={txn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderTop: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ width: 36, height: 36, background: txAccent(txn.type), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-black)' }}>{txIcon(txn.type)}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-black)' }}>{txLabel(txn.type)}</div>
                          {txn.notes && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.notes}</div>
                          )}
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 1 }}>{formatTime(txn.created_at)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(txn.type), fontVariationSettings: "'wdth' 100, 'opsz' 14" }}>
                          {txSign(txn.type)}{formatUGX(txn.amount)}
                        </div>
                        {txn.status === 'pending' && (
                          <span className="badge badge-warning no-dot" style={{ marginTop: 4 }}>Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)} className="btn btn-secondary btn-full">
                <span className="icon-outlined icon-sm">expand_more</span>
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            )}

            <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
              Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-white)', borderTop: 'var(--border-thick)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: 'var(--space-2) var(--space-4)', zIndex: 'var(--z-sticky)' }}>
        {[
          { label: 'Home',    icon: 'home',         path: '/portal/home'         },
          { label: 'Card',    icon: 'credit_card',  path: '/portal/card'         },
          { label: 'History', icon: 'receipt_long', path: '/portal/transactions' },
          { label: 'Profile', icon: 'person',       path: '/portal/profile'      },
        ].map(({ label, icon, path }) => {
          const active = path === '/portal/transactions'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1) var(--space-3)', color: active ? 'var(--color-black)' : 'var(--color-grey)', position: 'relative' }}>
              {active && (
                <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: 'var(--color-primary)' }} />
              )}
              <span className="icon-outlined" style={{ fontSize: 22, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>{icon}</span>
              <span style={{ fontWeight: active ? 'var(--weight-black)' : 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', fontSize: 9 }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}