import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatUGXShort(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function txLabel(type) {
  switch (type) {
    case 'deposit':          return 'Deposit'
    case 'payment':          return 'Fee payment'
    case 'fee_payment':      return 'Fee payment'
    case 'late_fee_payment': return 'Late fee payment'
    case 'withdrawal':       return 'Withdrawal'
    default:                 return type
  }
}

function txAccent(type) {
  switch (type) {
    case 'deposit':           return 'var(--color-green)'
    case 'payment':           return 'var(--color-primary)'
    case 'fee_payment':       return 'var(--color-primary)'
    case 'late_fee_payment':  return 'var(--color-yellow)'
    case 'withdrawal':        return 'var(--color-yellow)'
    default:                  return 'var(--color-grey-light)'
  }
}

function txIcon(type) {
  if (type === 'deposit')  return 'south'
  if (type === 'withdrawal') return 'north'
  return 'north'
}

function txAmountColor(type) {
  return type === 'deposit' ? '#2D8B45' : '#C0392B'
}

const FEE_TYPE_LABELS = {
  tuition:       'Tuition',
  functional:    'Functional',
  building_fund: 'Building fund',
  exam:          'Exam fees',
  pta:           'PTA',
  other:         'Other',
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
      <div style={{ height: 3, background: accent, marginBottom: 'var(--space-3)' }} />
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30", color: 'var(--color-black)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// EDUCATION FEE PAYMENTS VIEW
// ══════════════════════════════════════════════════════════════════════════
function EducationPayments({ business }) {
  const [payments, setPayments]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterFeeType, setFilterFeeType] = useState('')
  const [filterCampaign, setFilterCampaign] = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [campaigns, setCampaigns]     = useState([])

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      // Load education fee payment transactions with student and customer info
      // We join via customer_campaigns to get the student linked to the enrollment
      const { data: txnData } = await supabase
        .from('transactions')
        .select(`
          *,
          customers(first_name, last_name, phone),
          students(first_name, last_name, partna_student_id, school_student_id, year_group),
          campaigns(id, name, fee_type, academic_year, term_or_semester)
        `)
        .eq('campaigns.business_id', business.id)
        .in('type', ['fee_payment', 'late_fee_payment', 'payment'])
        .order('created_at', { ascending: false })

      // Also load campaigns for filter dropdown
      const { data: campData } = await supabase
        .from('campaigns')
        .select('id, name, fee_type, academic_year, term_or_semester')
        .eq('business_id', business.id)
        .eq('campaign_type', 'education_fees')
        .order('created_at', { ascending: false })

      setPayments(txnData?.filter(t => t.campaigns) || [])
      setCampaigns(campData || [])
    } catch (e) {
      console.error('Education payments load error:', e)
    }
    setLoading(false)
  }

  // Totals
  const totalGross    = payments.reduce((s, t) => s + Number(t.gross_amount || t.amount || 0), 0)
  const totalMDR      = payments.reduce((s, t) => s + Number(t.mdr_amount || 0), 0)
  const totalNet      = payments.reduce((s, t) => s + Number(t.net_to_school || (t.amount - (t.mdr_amount || 0)) || 0), 0)
  const totalPayments = payments.length

  // Filtered
  const filtered = payments.filter(t => {
    if (filterFeeType && t.fee_type !== filterFeeType && t.campaigns?.fee_type !== filterFeeType) return false
    if (filterCampaign && t.campaign_id !== filterCampaign) return false
    if (dateFrom) { const from = new Date(dateFrom); from.setHours(0,0,0,0); if (new Date(t.created_at) < from) return false }
    if (dateTo)   { const to   = new Date(dateTo);   to.setHours(23,59,59,999); if (new Date(t.created_at) > to) return false }
    if (search) {
      const q = search.toLowerCase()
      const studentName  = t.students  ? `${t.students.first_name} ${t.students.last_name}`.toLowerCase()  : ''
      const parentName   = t.customers ? `${t.customers.first_name} ${t.customers.last_name}`.toLowerCase() : ''
      const studentId    = (t.students?.partna_student_id || '').toLowerCase()
      const schoolId     = (t.students?.school_student_id || '').toLowerCase()
      const ref          = (t.reference || '').toLowerCase()
      if (!studentName.includes(q) && !parentName.includes(q) && !studentId.includes(q) && !schoolId.includes(q) && !ref.includes(q)) return false
    }
    return true
  })

  const filtersActive = search || filterFeeType || filterCampaign || dateFrom || dateTo

  function clearFilters() {
    setSearch(''); setFilterFeeType(''); setFilterCampaign(''); setDateFrom(''); setDateTo('')
  }

  // Export reconciliation CSV
  function exportReconciliationCSV() {
    const headers = [
      'Date', 'Reference', 'Student name', 'Partna Student ID', 'School Student ID',
      'Year group', 'Parent name', 'Parent phone', 'Campaign', 'Fee type',
      'Academic year', 'Term', 'Gross amount', 'MDR deducted', 'Net to school', 'Status'
    ]
    const rows = filtered.map(t => [
      formatDate(t.created_at),
      t.reference || t.id.slice(0, 8),
      t.students  ? `${t.students.first_name} ${t.students.last_name}`   : '—',
      t.students?.partna_student_id || '—',
      t.students?.school_student_id || '—',
      t.students?.year_group || '—',
      t.customers ? `${t.customers.first_name} ${t.customers.last_name}` : '—',
      t.customers?.phone || '—',
      t.campaigns?.name || '—',
      FEE_TYPE_LABELS[t.campaigns?.fee_type] || t.fee_type || '—',
      t.campaigns?.academic_year || '—',
      t.campaigns?.term_or_semester || '—',
      Number(t.gross_amount || t.amount || 0).toFixed(0),
      Number(t.mdr_amount || 0).toFixed(0),
      Number(t.net_to_school || (t.amount - (t.mdr_amount || 0)) || 0).toFixed(0),
      t.status,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `partna-fee-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatCard label="Total payments"    value={totalPayments}            accent="var(--color-primary)" />
        <StatCard label="Gross collected"   value={formatUGXShort(totalGross)} accent="var(--color-green)" />
        <StatCard label="MDR deducted"      value={formatUGXShort(totalMDR)}   accent="var(--color-yellow)" />
        <StatCard label="Net to your account" value={formatUGXShort(totalNet)} accent="var(--color-black)" />
      </div>

      {/* ── Info banner ── */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-white)', border: 'var(--border)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>info</span>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
          The <strong style={{ color: 'var(--color-black)' }}>Net to your account</strong> column shows what is credited to your Partna wallet after the Partna service fee (MDR) is deducted.
          Download the reconciliation report to match payments against your student ledger.
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 220 }}>
          <span className="icon-outlined search-icon">search</span>
          <input type="text" className="input search-input"
            placeholder="Search by student name, ID, parent, or reference…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
        </div>
        <select className="input" value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
          <option value="">All campaigns</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filterFeeType} onChange={e => setFilterFeeType(e.target.value)} style={{ width: 'auto', minWidth: 150 }}>
          <option value="">All fee types</option>
          {Object.entries(FEE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
        <span style={{ color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
        <input type="date" className="input input-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
        {filtersActive && (
          <button onClick={clearFilters} className="btn btn-sm btn-danger">
            <span className="icon-outlined icon-xs">close</span> Clear
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ padding: '4px var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
            {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
          </div>
          <button onClick={exportReconciliationCSV} className="btn btn-sm btn-black">
            <span className="icon-outlined icon-xs">download</span>
            Reconciliation report
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
          <div className="spinner spinner-lg spinner-purple" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>receipt_long</span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {payments.length === 0 ? 'No fee payments yet' : 'No payments match your filters'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
            {payments.length === 0
              ? 'Fee payments will appear here once parents start paying through Partna.'
              : 'Try adjusting your filters.'}
          </div>
          {filtersActive && (
            <button onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ margin: 'var(--space-4) auto 0' }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Campaign</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Gross</th>
                <th>MDR</th>
                <th>Net to you</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const gross  = Number(t.gross_amount || t.amount || 0)
                const mdr    = Number(t.mdr_amount || 0)
                const net    = Number(t.net_to_school || (gross - mdr) || 0)
                const isLate = t.type === 'late_fee_payment'

                return (
                  <tr key={t.id}>
                    {/* Student */}
                    <td>
                      {t.students ? (
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {t.students.first_name} {t.students.last_name}
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}>
                              {t.students.partna_student_id}
                            </span>
                            {t.students.school_student_id && (
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-grey)' }}>
                                · {t.students.school_student_id}
                              </span>
                            )}
                          </div>
                          {t.students.year_group && (
                            <div style={{ fontSize: 10, color: 'var(--color-grey)', marginTop: 1 }}>{t.students.year_group}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>No student linked</span>
                      )}
                    </td>

                    {/* Parent */}
                    <td>
                      {t.customers ? (
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {t.customers.first_name} {t.customers.last_name}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{t.customers.phone}</div>
                        </div>
                      ) : <span style={{ color: 'var(--color-grey)', fontSize: 'var(--text-sm)' }}>—</span>}
                    </td>

                    {/* Campaign */}
                    <td>
                      {t.campaigns ? (
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {t.campaigns.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--color-grey)', marginTop: 2 }}>
                            {FEE_TYPE_LABELS[t.campaigns.fee_type] || t.campaigns.fee_type}
                            {t.campaigns.term_or_semester ? ` · ${t.campaigns.term_or_semester}` : ''}
                            {isLate && (
                              <span style={{ marginLeft: 4, color: '#8A6700', fontWeight: 'var(--weight-bold)' }}>· Late</span>
                            )}
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--color-grey)', fontSize: 'var(--text-sm)' }}>—</span>}
                    </td>

                    {/* Date */}
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
                      {formatDate(t.created_at)}
                    </td>

                    {/* Reference */}
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                        {t.reference || t.id.slice(0, 8)}
                      </span>
                    </td>

                    {/* Gross */}
                    <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45', whiteSpace: 'nowrap' }}>
                      +{formatUGX(gross)}
                    </td>

                    {/* MDR */}
                    <td style={{ fontSize: 'var(--text-sm)', color: '#C0392B', whiteSpace: 'nowrap' }}>
                      {mdr > 0 ? `−${formatUGX(mdr)}` : '—'}
                    </td>

                    {/* Net */}
                    <td style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: 'var(--color-black)', whiteSpace: 'nowrap' }}>
                      {formatUGX(net)}
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge no-dot ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {t.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
            Showing {filtered.length} of {payments.length} payments
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// GENERAL PAYMENTS VIEW (unchanged for non-Education businesses)
// ══════════════════════════════════════════════════════════════════════════
function GeneralPayments({ business }) {
  const [transactions, setTransactions] = useState([])
  const [customers, setCustomers]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [totals, setTotals]             = useState({ deposits: 0, payments: 0, withdrawals: 0 })

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers').select('id, first_name, last_name, phone, email')
        .eq('business_id', business.id)

      const customerMap = {}
      customerData?.forEach(c => { customerMap[c.id] = c })
      setCustomers(customerMap)

      const customerIds = customerData?.map(c => c.id) || []
      if (customerIds.length === 0) { setTransactions([]); setLoading(false); return }

      const { data: txnData } = await supabase
        .from('transactions').select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      setTransactions(txnData || [])

      const deps = txnData?.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0) || 0
      const pays = txnData?.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0) || 0
      const wdrs = txnData?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0) || 0
      setTotals({ deposits: deps, payments: pays, withdrawals: wdrs })
    } catch (e) {
      console.error('Payments load error:', e)
    }
    setLoading(false)
  }

  const filtered = transactions.filter(txn => {
    const c = customers[txn.customer_id]
    const name = c ? `${c.first_name} ${c.last_name} ${c.phone} ${c.email}` : ''
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) { const from = new Date(dateFrom); from.setHours(0,0,0,0); if (new Date(txn.created_at) < from) return false }
    if (dateTo)   { const to   = new Date(dateTo);   to.setHours(23,59,59,999); if (new Date(txn.created_at) > to) return false }
    return true
  })

  const filtersActive = typeFilter !== 'all' || dateFrom !== '' || dateTo !== '' || search !== ''

  function clearFilters() { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo('') }

  function exportCSV() {
    const headers = ['Date', 'Customer', 'Phone', 'Type', 'Amount', 'Status']
    const rows = filtered.map(txn => {
      const c = customers[txn.customer_id]
      return [formatDateTime(txn.created_at), c ? `${c.first_name} ${c.last_name}` : 'Unknown', c?.phone || '', txLabel(txn.type), Number(txn.amount).toFixed(2), txn.status]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `partna-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatCard label="Total deposits"     value={formatUGXShort(totals.deposits)}                      accent="var(--color-green)"   />
        <StatCard label="Total fee payments" value={formatUGXShort(totals.payments)}                      accent="var(--color-primary)" />
        <StatCard label="Total withdrawals"  value={formatUGXShort(totals.withdrawals)}                   accent="var(--color-red)"     />
        <StatCard label="Net savings (AUM)"  value={formatUGXShort(totals.deposits - totals.withdrawals)} accent="var(--color-yellow)"  />
      </div>

      <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <span className="icon-outlined search-icon">search</span>
          <input type="text" className="input search-input" placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
        </div>
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="all">All types</option>
          <option value="deposit">Deposits</option>
          <option value="payment">Fee payments</option>
          <option value="withdrawal">Withdrawals</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
          <span style={{ color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
          <input type="date" className="input input-sm" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 140 }} />
        </div>
        {filtersActive && <button onClick={clearFilters} className="btn btn-sm btn-danger"><span className="icon-outlined icon-xs">close</span> Clear</button>}
        <div style={{ padding: '4px var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>
        <button onClick={exportCSV} className="btn btn-sm btn-black">
          <span className="icon-outlined icon-xs">download</span> Export CSV
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Customer</th><th>Date & time</th><th>Type</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-16)' }}><div className="spinner spinner-lg spinner-purple" style={{ margin: '0 auto' }} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
                  <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>payments</span>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    {transactions.length === 0 ? 'Transactions will appear here once customers start depositing.' : 'Try adjusting your filters.'}
                  </div>
                  {filtersActive && <button onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ margin: 'var(--space-4) auto 0' }}>Clear filters</button>}
                </td>
              </tr>
            ) : filtered.map(txn => {
              const c = customers[txn.customer_id]
              return (
                <tr key={txn.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ width: 32, height: 32, background: 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', flexShrink: 0, letterSpacing: 'var(--tracking-tight)' }}>
                        {c?.first_name?.[0]}{c?.last_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{c ? `${c.first_name} ${c.last_name}` : 'Unknown'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{c?.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{formatDateTime(txn.created_at)}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: 24, height: 24, background: txAccent(txn.type), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="icon-outlined" style={{ fontSize: 13, color: 'var(--color-black)' }}>{txIcon(txn.type)}</span>
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{txLabel(txn.type)}</span>
                    </div>
                  </td>
                  <td><span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(txn.type) }}>{txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}</span></td>
                  <td><span className={`badge no-dot ${txn.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{txn.status === 'completed' ? 'Completed' : 'Pending'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT — renders correct view based on sector
// ══════════════════════════════════════════════════════════════════════════
export default function Payments({ admin, business }) {
  if (business?.sector === 'Education') {
    return <EducationPayments business={business} />
  }
  return <GeneralPayments business={business} />
}