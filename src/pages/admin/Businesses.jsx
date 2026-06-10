import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const KYB_COLORS = {
  verified: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Verified' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Rejected' },
  skipped: { bg: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)', label: 'Skipped' },
}

const STATUS_COLORS = {
  active: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Active' },
  suspended: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Suspended' },
  deactivated: { bg: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)', label: 'Deactivated' },
}

export default function Businesses() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterKYB, setFilterKYB] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadBusinesses()
  }, [])

  async function loadBusinesses() {
    setLoading(true)
    try {
      // Fetch all businesses
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false })

      if (!bizData) { setLoading(false); return }

      // For each business fetch customer count and AUM
      const enriched = await Promise.all(bizData.map(async (biz) => {
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', biz.id)

        const { data: customerIds } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', biz.id)

        let aum = 0
        if (customerIds && customerIds.length > 0) {
          const ids = customerIds.map(c => c.id)
          const { data: wallets } = await supabase
            .from('wallets')
            .select('balance')
            .in('customer_id', ids)
          aum = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
        }

        return {
          ...biz,
          customerCount: customerCount || 0,
          aum,
          status: biz.status || 'active',
        }
      }))

      setBusinesses(enriched)
    } catch (e) {
      console.error('Businesses load error:', e)
    }
    setLoading(false)
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ color: 'rgba(0,0,0,0.2)' }}>↕</span>
    return <span style={{ color: ADMIN_PRIMARY }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Filter + search + sort
  const filtered = businesses
    .filter(b => {
      if (search) {
        const s = search.toLowerCase()
        if (!b.name?.toLowerCase().includes(s) && !b.admin_email?.toLowerCase().includes(s)) return false
      }
      if (filterSector && b.sector !== filterSector) return false
      if (filterKYB && b.kyb_status !== filterKYB) return false
      if (filterStatus && b.status !== filterStatus) return false
      return true
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (sortBy === 'aum' || sortBy === 'customerCount') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const sectors = [...new Set(businesses.map(b => b.sector).filter(Boolean))]

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Businesses</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {filtered.length} of {businesses.length} businesses
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
        />
        <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterKYB} onChange={e => setFilterKYB(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All KYB</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="skipped">Skipped</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        {(search || filterSector || filterKYB || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterSector(''); setFilterKYB(''); setFilterStatus('') }}
            className="text-xs font-semibold px-3 py-2.5 rounded-xl"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[
                  { label: 'Business', col: 'name' },
                  { label: 'Sector', col: 'sector' },
                  { label: 'Plan', col: 'subscription_package' },
                  { label: 'KYB', col: 'kyb_status' },
                  { label: 'Customers', col: 'customerCount' },
                  { label: 'AUM', col: 'aum' },
                  { label: 'Status', col: 'status' },
                  { label: 'Registered', col: 'created_at' },
                ].map(col => (
                  <th key={col.col}
                    onClick={() => handleSort(col.col)}
                    className="px-4 py-3 text-left cursor-pointer select-none"
                    style={{ background: '#f8f9fa' }}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{col.label}</span>
                      <SortIcon col={col.col} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3" style={{ background: '#f8f9fa' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'rgba(0,0,0,0.3)' }}>
                    No businesses found
                  </td>
                </tr>
              ) : filtered.map((biz, i) => {
                const kyb = KYB_COLORS[biz.kyb_status] || KYB_COLORS.skipped
                const status = STATUS_COLORS[biz.status] || STATUS_COLORS.active
                return (
                  <tr key={biz.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                          <img src={biz.logo_url} alt={biz.name}
                            className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                            style={{ background: '#f0f2f5' }} />
                        ) : (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: biz.primary_color || ADMIN_PRIMARY, color: '#fff' }}>
                            {biz.name?.[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold" style={{ color: ADMIN_PRIMARY }}>{biz.name}</div>
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{biz.admin_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{biz.sector || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold capitalize" style={{ color: ADMIN_PRIMARY }}>
                        {biz.subscription_package || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: kyb.bg, color: kyb.color }}>
                        {kyb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: '#333' }}>
                        {biz.customerCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                        {formatUGX(biz.aum)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        {formatDate(biz.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/businesses/${biz.id}`)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
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
    </div>
  )
}