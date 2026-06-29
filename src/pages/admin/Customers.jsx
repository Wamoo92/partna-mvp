import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { formatUGX } from '../../lib/constants'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
}

const selectStyle = {
  padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.black,
  background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8,
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer',
}

export default function Customers() {
  useEffect(() => { document.title = 'Customers - Partna' }, [])

  const navigate = useNavigate()

  const [customers, setCustomers]         = useState([])
  const [businesses, setBusinesses]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterBusiness, setFilterBusiness] = useState('')
  const [filterKYC, setFilterKYC]         = useState('')
  const [sortBy, setSortBy]               = useState('created_at')
  const [sortDir, setSortDir]             = useState('desc')

  useEffect(() => { loadAll() }, [])

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('*, wallets(balance), businesses(name, primary_color, logo_url)').order('created_at', { ascending: false })
      setCustomers(custData || [])
      const { data: bizData } = await supabase.from('businesses').select('id, name').order('name')
      setBusinesses(bizData || [])
    } catch (e) { console.error('Customers load error:', e) }
    setLoading(false)
  }

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const hasFilters = search || filterBusiness || filterKYC

  const filtered = customers
    .filter(c => {
      if (search) { const s = search.toLowerCase(); const name = `${c.first_name} ${c.last_name}`.toLowerCase(); if (!name.includes(s) && !c.phone?.includes(s) && !c.email?.toLowerCase().includes(s)) return false }
      if (filterBusiness && c.business_id !== filterBusiness) return false
      if (filterKYC      && c.kyc_status  !== filterKYC)      return false
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortBy === 'balance')  { av = Number(a.wallets?.[0]?.balance || 0); bv = Number(b.wallets?.[0]?.balance || 0) }
      else if (sortBy === 'business') { av = a.businesses?.name || ''; bv = b.businesses?.name || '' }
      else if (sortBy === 'name')     { av = `${a.first_name} ${a.last_name}`; bv = `${b.first_name} ${b.last_name}` }
      else { av = a[sortBy]; bv = b[sortBy] }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })

  // ─────────────────────────────────────────────────────────────────────────

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
    { label: 'Customer', col: 'name'       },
    { label: 'Phone',    col: 'phone'      },
    { label: 'Business', col: 'business'   },
    { label: 'Balance',  col: 'balance'    },
    { label: 'KYC',      col: 'kyc_status' },
    { label: 'Enrolled', col: 'created_at' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" placeholder="Search by name, phone or email…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, width: '100%', paddingLeft: 34 }}
            onFocus={e => e.target.style.borderColor = C.black}
            onBlur={e => e.target.style.borderColor = C.grayLine}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>

        <select style={selectStyle} value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select style={selectStyle} value={filterKYC} onChange={e => setFilterKYC(e.target.value)}>
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
        </select>

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterBusiness(''); setFilterKYC('') }}
            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
            Clear
          </button>
        )}

        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
          {filtered.length} of {customers.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                {COLS.map(({ label, col }) => (
                  <th key={col} onClick={() => handleSort(col)}
                    style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>
                    No customers found
                  </td>
                </tr>
              ) : filtered.map((c, i) => {
                const balance = Number(c.wallets?.[0]?.balance || 0)
                const biz     = c.businesses
                return (
                  <tr key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accent}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : C.bg}
                  >
                    {/* Customer */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: C.black, flexShrink: 0 }}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{c.first_name} {c.last_name}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{c.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                      {c.phone || '—'}
                    </td>

                    {/* Business */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {biz?.logo_url && !biz.logo_url.startsWith('/') ? (
                          <img src={biz.logo_url} alt={biz.name} style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 4, background: C.bg, flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 20, height: 20, borderRadius: 5, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 9, color: '#F6F7EE', flexShrink: 0 }}>
                            {biz?.name?.[0]}
                          </div>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{biz?.name || '—'}</span>
                      </div>
                    </td>

                    {/* Balance */}
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>
                      {formatUGX(balance)}
                    </td>

                    {/* KYC */}
                    <td style={{ padding: '12px 16px' }}>
                      {c.kyc_status === 'verified'
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,  borderRadius: 6, padding: '3px 8px' }}>Verified</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 6, padding: '3px 8px' }}>Pending</span>
                      }
                    </td>

                    {/* Enrolled */}
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                      {formatDate(c.created_at)}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => navigate(`/admin/customers/${c.id}`)}
                        style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = C.white}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}