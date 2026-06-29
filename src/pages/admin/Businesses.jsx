import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { formatUGX } from '../../lib/constants'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
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

function Badge({ value, type }) {
  const cfg = {
    verified:    { bg: C.bgGreen,   color: C.green   },
    pending:     { bg: C.bgOrange,  color: C.orange  },
    rejected:    { bg: C.bgRed,     color: C.red     },
    skipped:     { bg: C.grayLight, color: C.grayMid },
    active:      { bg: C.bgGreen,   color: C.green   },
    suspended:   { bg: C.bgRed,     color: C.red     },
    deactivated: { bg: C.grayLight, color: C.grayMid },
  }[value] || { bg: C.grayLight, color: C.grayMid }

  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {value || 'unknown'}
    </span>
  )
}

const selectStyle = {
  padding: '8px 12px', fontSize: 13, fontWeight: 500, color: '#111111',
  background: '#FFFFFF', border: '1px solid #D5D9DD', borderRadius: 8,
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer',
}

export default function Businesses() {
  useEffect(() => { document.title = 'Businesses - Partna' }, [])

  const navigate = useNavigate()

  const [businesses, setBusinesses]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterKYB, setFilterKYB]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy]             = useState('created_at')
  const [sortDir, setSortDir]           = useState('desc')

  useEffect(() => { loadBusinesses() }, [])

  async function loadBusinesses() {
    setLoading(true)
    try {
      const { data: bizData } = await supabase.from('businesses').select('*').order('created_at', { ascending: false })
      if (!bizData) { setLoading(false); return }
      const enriched = await Promise.all(bizData.map(async biz => {
        const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', biz.id)
        const { data: customerIds }    = await supabase.from('customers').select('id').eq('business_id', biz.id)
        let aum = 0
        if (customerIds?.length > 0) {
          const { data: wallets } = await supabase.from('wallets').select('balance').in('customer_id', customerIds.map(c => c.id))
          aum = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
        }
        return { ...biz, customerCount: customerCount || 0, aum, status: biz.status || 'active' }
      }))
      setBusinesses(enriched)
    } catch (e) { console.error('Businesses load error:', e) }
    setLoading(false)
  }

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const sectors    = [...new Set(businesses.map(b => b.sector).filter(Boolean))]
  const hasFilters = search || filterSector || filterKYB || filterStatus

  const filtered = businesses
    .filter(b => {
      if (search) { const s = search.toLowerCase(); if (!b.name?.toLowerCase().includes(s) && !b.admin_email?.toLowerCase().includes(s)) return false }
      if (filterSector && b.sector     !== filterSector) return false
      if (filterKYB    && b.kyb_status !== filterKYB)    return false
      if (filterStatus && b.status     !== filterStatus)  return false
      return true
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (sortBy === 'aum' || sortBy === 'customerCount') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  function SortChevron({ col }) {
    if (sortBy !== col) return <span style={{ color: C.grayLight, fontSize: 11 }}>↕</span>
    return <span style={{ color: C.black, fontSize: 11 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const COLS = [
    { label: 'Business',   col: 'name'                 },
    { label: 'Sector',     col: 'sector'               },
    { label: 'Plan',       col: 'subscription_package' },
    { label: 'KYB',        col: 'kyb_status'           },
    { label: 'Customers',  col: 'customerCount'        },
    { label: 'AUM',        col: 'aum'                  },
    { label: 'Status',     col: 'status'               },
    { label: 'Registered', col: 'created_at'           },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Filter bar + onboard button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, width: '100%', paddingLeft: 34 }}
            onFocus={e => e.target.style.borderColor = C.black}
            onBlur={e => e.target.style.borderColor = C.grayLine}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>

        <select style={selectStyle} value={filterSector} onChange={e => setFilterSector(e.target.value)}>
          <option value="">All sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select style={selectStyle} value={filterKYB} onChange={e => setFilterKYB(e.target.value)}>
          <option value="">All KYB</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="skipped">Skipped</option>
        </select>

        <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterSector(''); setFilterKYB(''); setFilterStatus('') }}
            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Clear
          </button>
        )}

        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
          {filtered.length} of {businesses.length}
        </span>

        {/* ── Onboard button ── */}
        <button
          onClick={() => navigate('/admin/onboard')}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            color: C.white, background: C.black,
            border: `1px solid ${C.black}`, borderRadius: 8,
            cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Onboard new business
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                {COLS.map(({ label, col }) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label} <SortChevron col={col} />
                    </span>
                  </th>
                ))}
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>
                    No businesses found
                  </td>
                </tr>
              ) : filtered.map((biz, i) => (
                <tr
                  key={biz.id}
                  style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accent}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : C.bg}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                        <img src={biz.logo_url} alt={biz.name} style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0, borderRadius: 6, background: C.bg }} />
                      ) : (
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: '#F6F7EE', flexShrink: 0 }}>
                          {biz.name?.[0]}
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{biz.name}</p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{biz.admin_email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{biz.sector || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {biz.subscription_package ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.white, background: C.black, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>
                        {biz.subscription_package}
                      </span>
                    ) : <span style={{ fontSize: 13, color: C.grayMid }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}><Badge value={biz.kyb_status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.black }}>{biz.customerCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.green }}>{formatUGX(biz.aum)}</td>
                  <td style={{ padding: '12px 16px' }}><Badge value={biz.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(biz.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => navigate(`/admin/businesses/${biz.id}`)}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                      onMouseLeave={e => e.currentTarget.style.background = C.white}
                    >
                      View →
                    </button>
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