import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBusiness, setFilterBusiness] = useState('')
  const [filterKYC, setFilterKYC] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // Fetch all customers with wallet balance and business name
      const { data: custData } = await supabase
        .from('customers')
        .select('*, wallets(balance), businesses(name, primary_color, logo_url)')
        .order('created_at', { ascending: false })

      setCustomers(custData || [])

      // Unique businesses for filter dropdown
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id, name')
        .order('name')
      setBusinesses(bizData || [])

    } catch (e) {
      console.error('Customers load error:', e)
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

  const filtered = customers
    .filter(c => {
      if (search) {
        const s = search.toLowerCase()
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
        if (!fullName.includes(s) && !c.phone?.includes(s) && !c.email?.toLowerCase().includes(s)) return false
      }
      if (filterBusiness && c.business_id !== filterBusiness) return false
      if (filterKYC && c.kyc_status !== filterKYC) return false
      return true
    })
    .sort((a, b) => {
      let av, bv
      if (sortBy === 'balance') {
        av = Number(a.wallets?.[0]?.balance || 0)
        bv = Number(b.wallets?.[0]?.balance || 0)
      } else if (sortBy === 'business') {
        av = a.businesses?.name || ''
        bv = b.businesses?.name || ''
      } else if (sortBy === 'name') {
        av = `${a.first_name} ${a.last_name}`
        bv = `${b.first_name} ${b.last_name}`
      } else {
        av = a[sortBy]
        bv = b[sortBy]
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Customers</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {filtered.length} of {customers.length} customers across all businesses
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, phone or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
        />
        <select value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterKYC} onChange={e => setFilterKYC(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs outline-none"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}>
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
        </select>
        {(search || filterBusiness || filterKYC) && (
          <button onClick={() => { setSearch(''); setFilterBusiness(''); setFilterKYC('') }}
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
                  { label: 'Customer', col: 'name' },
                  { label: 'Phone', col: 'phone' },
                  { label: 'Business', col: 'business' },
                  { label: 'Balance', col: 'balance' },
                  { label: 'KYC', col: 'kyc_status' },
                  { label: 'Enrolled', col: 'created_at' },
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'rgba(0,0,0,0.3)' }}>
                    No customers found
                  </td>
                </tr>
              ) : filtered.map((c, i) => {
                const balance = Number(c.wallets?.[0]?.balance || 0)
                const biz = c.businesses
                return (
                  <tr key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(27,79,114,0.1)', color: ADMIN_PRIMARY }}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <div>
                          <div className="text-xs font-bold" style={{ color: ADMIN_PRIMARY }}>
                            {c.first_name} {c.last_name}
                          </div>
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: '#333' }}>{c.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {biz?.logo_url && !biz.logo_url.startsWith('/') ? (
                          <img src={biz.logo_url} alt={biz.name}
                            className="w-5 h-5 rounded object-contain flex-shrink-0"
                            style={{ background: '#f0f2f5' }} />
                        ) : (
                          <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: biz?.primary_color || ADMIN_PRIMARY, color: '#fff' }}>
                            {biz?.name?.[0]}
                          </div>
                        )}
                        <span className="text-xs font-semibold" style={{ color: '#333' }}>
                          {biz?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                        {formatUGX(balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{
                          background: c.kyc_status === 'verified' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                          color: c.kyc_status === 'verified' ? '#16A34A' : '#D97706',
                        }}>
                        {c.kyc_status === 'verified' ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        {formatDate(c.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/customers/${c.id}`)}
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