import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'
import LoadError from '../../components/LoadError'

const PAGE_SIZE = 10

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatGroupDate(dateStr) {
  const date = new Date(dateStr)
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
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
function txAmountColor(type) {
  return type === 'deposit' || type === 'cashback' ? '#59886D' : '#CC3939'
}
function txSign(type) {
  return type === 'deposit' || type === 'cashback' ? '+' : '-'
}
function txIconBg(type) {
  switch (type) {
    case 'deposit':          return { bg: '#E4F8EC', color: '#59886D' }
    case 'cashback':         return { bg: 'rgba(197,133,179,0.15)', color: '#C585B3' }
    case 'late_fee_payment': return { bg: '#F8F0E4', color: '#EF8354' }
    case 'withdrawal':       return { bg: '#F8F0E4', color: '#EF8354' }
    default:                 return { bg: '#F8E4E4', color: '#CC3939' }
  }
}
function groupByDate(txns) {
  const groups = {}
  txns.forEach(txn => {
    const key = new Date(txn.created_at).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(txn)
  })
  return Object.entries(groups).map(([, items]) => ({ label: formatGroupDate(items[0].created_at), items }))
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
}

export default function Transactions({
 customer }) {
  useEffect(() => { document.title = 'Transactions - Partna' }, [])

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
  const [loadError, setLoadError]               = useState(false)
  const [visibleCount, setVisibleCount]         = useState(PAGE_SIZE)
  const [typeFilter, setTypeFilter]             = useState('all')
  const [dateFrom, setDateFrom]                 = useState('')
  const [dateTo, setDateTo]                     = useState('')
  const [showFilters, setShowFilters]           = useState(false)

  useEffect(() => { if (customer) loadData() }, [customer, enrollmentId])

  // ── Business logic — unchanged ────────────────────────────────────────

  async function loadData() {
    setLoading(true); setLoadError(false)
    try {
      const { data: enrollData } = await supabase.from('customer_campaigns').select('*, campaigns(*), wallets(*)').eq('customer_id', customer.id).eq('status', 'active').order('enrolled_at', { ascending: true })
      setEnrollments(enrollData || [])
      let active = null
      if (enrollmentId && enrollData) { active = enrollData.find(e => e.id === enrollmentId) || enrollData[0] } else { active = enrollData?.[0] || null }
      setActiveEnrollment(active); setCampaign(active?.campaigns || null); setWallet(active?.wallets || null)
      if (active) {
        const { data: txnData } = await supabase.from('transactions').select('*').eq('customer_id', customer.id).eq('campaign_id', active.campaign_id).order('created_at', { ascending: false })
        setAllTransactions(txnData || [])
      }
    } catch (e) { console.error('Transactions load error:', e); setLoadError(true) }
    setLoading(false)
  }

  async function switchEnrollment(enrollment) {
    setActiveEnrollment(enrollment); setCampaign(enrollment.campaigns); setWallet(enrollment.wallets)
    setVisibleCount(PAGE_SIZE); setTypeFilter('all'); setDateFrom(''); setDateTo('')
    const { data: txnData } = await supabase.from('transactions').select('*').eq('customer_id', customer.id).eq('campaign_id', enrollment.campaign_id).order('created_at', { ascending: false })
    setAllTransactions(txnData || [])
  }

  const filtered = allTransactions.filter(txn => {
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) { const from = new Date(dateFrom); from.setHours(0,0,0,0); if (new Date(txn.created_at) < from) return false }
    if (dateTo)   { const to   = new Date(dateTo);   to.setHours(23,59,59,999); if (new Date(txn.created_at) > to) return false }
    return true
  })

  const visible       = filtered.slice(0, visibleCount)
  const hasMore       = filtered.length > visibleCount
  const groups        = groupByDate(visible)
  const balance       = wallet ? Number(wallet.balance) : 0
  const hasMultiple   = enrollments.length > 1
  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  function clearFilters() { setTypeFilter('all'); setDateFrom(''); setDateTo(''); setVisibleCount(PAGE_SIZE) }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (loadError) return <LoadError onRetry={loadData} />

  const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/portal/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 24, width: 'auto' }} />
            : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>Transaction history</span>
      </header>

      {/* ── Balance hero ── */}
      <div style={{ background: C.black, padding: '24px 20px 28px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current balance</p>
        <p style={{ fontSize: 34, fontWeight: 600, color: C.white, letterSpacing: '-1px', lineHeight: 1, margin: '0 0 4px' }}>{formatUGX(balance)}</p>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Saved toward {campaign?.name || '—'}</p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Campaign switcher */}
        {hasMultiple && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campaign</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {enrollments.map(e => {
                const active = activeEnrollment?.id === e.id
                return (
                  <button key={e.id} onClick={() => switchEnrollment(e)} style={{ flexShrink: 0, padding: '7px 14px', background: active ? C.black : C.white, color: active ? C.white : C.black, border: `1px solid ${active ? C.black : C.grayLine}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {e.campaigns?.name || '—'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filter bar header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-0.5px' }}>Transactions</span>
            {filtersActive && <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange || '#F8F0E4', borderRadius: 6, padding: '2px 8px' }}>Filtered</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {filtersActive && (
              <button onClick={clearFilters} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Clear
              </button>
            )}
            <button onClick={() => setShowFilters(f => !f)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: showFilters ? C.white : C.black, background: showFilters ? C.black : C.white, border: `1px solid ${showFilters ? C.black : C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Filter
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Type chips */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { value: 'all',         label: 'All'          },
                  { value: 'deposit',     label: 'Deposits'     },
                  { value: 'payment',     label: 'Payments'     },
                  { value: 'fee_payment', label: 'Fee payments' },
                  { value: 'withdrawal',  label: 'Withdrawals'  },
                  { value: 'cashback',    label: 'Cashback'     },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setTypeFilter(opt.value); setVisibleCount(PAGE_SIZE) }} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: typeFilter === opt.value ? C.black : C.white, color: typeFilter === opt.value ? C.white : C.black, border: `1px solid ${typeFilter === opt.value ? C.black : C.grayLine}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.grayLine}` }} />
            {/* Date range */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date range</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 4 }}>From</label>
                  <input type="date" style={inputStyle} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setVisibleCount(PAGE_SIZE) }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <span style={{ color: C.grayMid, fontSize: 16, paddingBottom: 6 }}>—</span>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 4 }}>To</label>
                  <input type="date" style={inputStyle} value={dateTo} onChange={e => { setDateTo(e.target.value); setVisibleCount(PAGE_SIZE) }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>No transactions found</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
              {filtersActive ? 'Try adjusting your filters to see more transactions.' : 'Add money to this campaign to get started.'}
            </p>
            {filtersActive && (
              <button onClick={clearFilters} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', marginTop: 4, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map((group, gi) => (
              <div key={gi}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {group.label}
                </p>
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                  {group.items.map((txn, i) => {
                    const { bg, color } = txIconBg(txn.type)
                    return (
                      <div key={txn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.grayLine}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Icon */}
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              {txn.type === 'deposit' && <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>}
                              {(txn.type === 'payment' || txn.type === 'fee_payment') && <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                              {(txn.type === 'withdrawal' || txn.type === 'late_fee_payment') && <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>}
                              {txn.type === 'cashback' && <><path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /></>}
                              {!['deposit','payment','fee_payment','withdrawal','late_fee_payment','cashback'].includes(txn.type) && <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
                            </svg>
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{txLabel(txn.type)}</p>
                            {txn.notes && <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 1px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.notes}</p>}
                            <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: 0 }}>{formatTime(txn.created_at)}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: txAmountColor(txn.type), margin: '0 0 3px' }}>
                            {txSign(txn.type)}{formatUGX(txn.amount)}
                          </p>
                          {txn.status === 'pending' && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: '#F8F0E4', borderRadius: 6, padding: '2px 8px' }}>Pending</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'}
                onMouseLeave={e => e.currentTarget.style.background = C.white}
              >
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0 }}>
              Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
            </p>
          </div>
        )}

      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`, zIndex: 100 }}>
        {[
          { label: 'Home',    path: '/portal/home'         },
          { label: 'Card',    path: '/portal/card'         },
          { label: 'History', path: '/portal/transactions' },
          { label: 'Profile', path: '/portal/profile'      },
        ].map(({ label, path }) => {
          const active = path === '/portal/transactions'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.black : C.grayMid} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                {label === 'Home'    && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                {label === 'Card'    && <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>}
                {label === 'History' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>}
                {label === 'Profile' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>}
              </svg>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? C.black : C.grayMid }}>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}