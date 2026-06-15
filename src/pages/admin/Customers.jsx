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

export default function Customers() {
  const navigate = useNavigate()

  const [customers, setCustomers]   = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterBusiness, setFilterBusiness] = useState('')
  const [filterKYC, setFilterKYC]   = useState('')
  const [sortBy, setSortBy]   = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('*, wallets(balance), businesses(name, primary_color, logo_url)')
        .order('created_at', { ascending: false })
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

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-grey-mid)' }}>unfold_more</span>
    return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
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
          <input type="text" className="input search-input" placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
        </div>
        <select className="input" value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input" value={filterKYC} onChange={e => setFilterKYC(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterBusiness(''); setFilterKYC('') }} className="btn btn-sm btn-danger">
            <span className="icon-outlined icon-xs">close</span> Clear
          </button>
        )}
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
          {filtered.length} of {customers.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {[
                { label: 'Customer', col: 'name'       },
                { label: 'Phone',    col: 'phone'      },
                { label: 'Business', col: 'business'   },
                { label: 'Balance',  col: 'balance'    },
                { label: 'KYC',      col: 'kyc_status' },
                { label: 'Enrolled', col: 'created_at' },
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
                <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                  No customers found
                </td>
              </tr>
            ) : filtered.map(c => {
              const balance = Number(c.wallets?.[0]?.balance || 0)
              const biz     = c.businesses
              return (
                <tr key={c.id}>
                  {/* Customer */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: 32, height: 32, flexShrink: 0,
                        background: 'var(--color-black)',
                        border: 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                        color: 'var(--color-primary)',
                        letterSpacing: 'var(--tracking-tight)',
                      }}>
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                          {c.first_name} {c.last_name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{c.phone || '—'}</td>
                  {/* Business */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {biz?.logo_url && !biz.logo_url.startsWith('/') ? (
                        <img src={biz.logo_url} alt={biz.name} style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0, background: 'var(--color-bg)' }} />
                      ) : (
                        <div style={{ width: 20, height: 20, background: 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 9, color: 'var(--color-primary)', flexShrink: 0 }}>
                          {biz?.name?.[0]}
                        </div>
                      )}
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                        {biz?.name || '—'}
                      </span>
                    </div>
                  </td>
                  {/* Balance */}
                  <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                    {formatUGX(balance)}
                  </td>
                  {/* KYC */}
                  <td>
                    <span className={`badge no-dot ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                      {c.kyc_status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  {/* Enrolled */}
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    {formatDate(c.created_at)}
                  </td>
                  {/* Action */}
                  <td>
                    <button onClick={() => navigate(`/admin/customers/${c.id}`)} className="btn btn-sm btn-secondary">
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}