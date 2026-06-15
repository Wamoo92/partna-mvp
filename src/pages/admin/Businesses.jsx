import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const KYB_BADGE = {
  verified: 'badge-success',
  pending:  'badge-warning',
  rejected: 'badge-danger',
  skipped:  'badge-default',
}

const STATUS_BADGE = {
  active:      'badge-success',
  suspended:   'badge-danger',
  deactivated: 'badge-default',
}

export default function Businesses() {
  const navigate = useNavigate()

  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterSector, setFilterSector]   = useState('')
  const [filterKYB, setFilterKYB]         = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [sortBy, setSortBy]   = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

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

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-grey-mid)' }}>unfold_more</span>
    return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
  }

  const sectors = [...new Set(businesses.map(b => b.sector).filter(Boolean))]
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
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <span className="icon-outlined search-icon">search</span>
          <input type="text" className="input search-input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
        </div>
        <select className="input" value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">All sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={filterKYB} onChange={e => setFilterKYB(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
          <option value="">All KYB</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="skipped">Skipped</option>
        </select>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterSector(''); setFilterKYB(''); setFilterStatus('') }} className="btn btn-sm btn-danger">
            <span className="icon-outlined icon-xs">close</span> Clear
          </button>
        )}
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
          {filtered.length} of {businesses.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {[
                { label: 'Business',    col: 'name'                 },
                { label: 'Sector',      col: 'sector'               },
                { label: 'Plan',        col: 'subscription_package' },
                { label: 'KYB',         col: 'kyb_status'           },
                { label: 'Customers',   col: 'customerCount'        },
                { label: 'AUM',         col: 'aum'                  },
                { label: 'Status',      col: 'status'               },
                { label: 'Registered',  col: 'created_at'           },
              ].map(col => (
                <th key={col.col} onClick={() => handleSort(col.col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    <SortIcon col={col.col} />
                  </div>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                  No businesses found
                </td>
              </tr>
            ) : filtered.map(biz => (
              <tr key={biz.id}>
                {/* Business */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                      <img src={biz.logo_url} alt={biz.name} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, background: 'var(--color-bg)', padding: 2 }} />
                    ) : (
                      <div style={{
                        width: 32, height: 32, flexShrink: 0,
                        background: 'var(--color-black)',
                        border: 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                        color: 'var(--color-primary)',
                      }}>
                        {biz.name?.[0]}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{biz.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{biz.admin_email}</div>
                    </div>
                  </div>
                </td>
                {/* Sector */}
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{biz.sector || '—'}</td>
                {/* Plan */}
                <td>
                  {biz.subscription_package ? (
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                      background: 'var(--color-black)', color: 'var(--color-primary)',
                      padding: '2px var(--space-2)', textTransform: 'capitalize',
                    }}>
                      {biz.subscription_package}
                    </span>
                  ) : (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>—</span>
                  )}
                </td>
                {/* KYB */}
                <td>
                  <span className={`badge no-dot ${KYB_BADGE[biz.kyb_status] || 'badge-default'}`} style={{ textTransform: 'capitalize' }}>
                    {biz.kyb_status || 'unknown'}
                  </span>
                </td>
                {/* Customers */}
                <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                  {biz.customerCount}
                </td>
                {/* AUM */}
                <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                  {formatUGX(biz.aum)}
                </td>
                {/* Status */}
                <td>
                  <span className={`badge no-dot ${STATUS_BADGE[biz.status] || 'badge-default'}`} style={{ textTransform: 'capitalize' }}>
                    {biz.status || 'active'}
                  </span>
                </td>
                {/* Registered */}
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                  {formatDate(biz.created_at)}
                </td>
                {/* Action */}
                <td>
                  <button onClick={() => navigate(`/admin/businesses/${biz.id}`)} className="btn btn-sm btn-secondary">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}