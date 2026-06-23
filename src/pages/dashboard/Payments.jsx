import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatUGX(n) { return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 }) }
function formatUGXShort(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function txLabel(type) {
  const map = { deposit: 'Deposit', payment: 'Fee payment', fee_payment: 'Fee payment', late_fee_payment: 'Late fee payment', withdrawal: 'Withdrawal' }
  return map[type] || type
}
function txAmountColor(type) { return type === 'deposit' ? '#59886D' : '#CC3939' }
const FEE_TYPE_LABELS = { tuition: 'Tuition', functional: 'Functional', building_fund: 'Building fund', exam: 'Exam fees', pta: 'PTA', other: 'Other' }

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
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

const selectStyle = { padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' }
const inputStyle  = { ...selectStyle, cursor: 'text' }

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, accentColor }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

// ── Shared table wrapper ───────────────────────────────────────────────────
function TableCard({ children, footer }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
      </div>
      {footer && <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>{footer}</div>}
    </div>
  )
}

function Th({ children, style }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: C.bg, borderBottom: `1px solid ${C.grayLine}`, ...style }}>{children}</th>
}

function Td({ children, style }) {
  return <td style={{ padding: '11px 14px', verticalAlign: 'middle', ...style }}>{children}</td>
}

function Badge({ status }) {
  const cfg = status === 'completed' ? { bg: C.bgGreen, color: C.green, label: 'Completed' } : { bg: C.bgOrange, color: C.orange, label: 'Pending' }
  return <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px' }}>{cfg.label}</span>
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
      {value && <button onClick={() => onChange('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0, fontSize: 16 }}>✕</button>}
    </div>
  )
}

function ClearBtn({ onClick }) {
  return <button onClick={onClick} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Clear</button>
}

function CountPill({ count, label }) {
  return <div style={{ padding: '5px 10px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 7, fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{count} {label}{count !== 1 ? 's' : ''}</div>
}

function ExportBtn({ onClick, label }) {
  return <button onClick={onClick} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>↓ {label}</button>
}

function EmptyState({ icon, title, sub, onClear }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>{sub}</p>
      {onClear && <button onClick={onClear} style={{ marginTop: 4, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Clear filters</button>}
    </div>
  )
}

const receiptSVG = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>

// ══════════════════════════════════════════════════════════════════════════
// EDUCATION FEE PAYMENTS VIEW
// ══════════════════════════════════════════════════════════════════════════
function EducationPayments({ business }) {
  const [payments, setPayments]           = useState([])
  const [campaigns, setCampaigns]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterFeeType, setFilterFeeType] = useState('')
  const [filterCampaign, setFilterCampaign] = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select(`*, customers(first_name, last_name, phone), students(first_name, last_name, partna_student_id, school_student_id, year_group), campaigns(id, name, fee_type, academic_year, term_or_semester)`)
        .eq('campaigns.business_id', business.id)
        .in('type', ['fee_payment', 'late_fee_payment', 'payment'])
        .order('created_at', { ascending: false })
      const { data: campData } = await supabase
        .from('campaigns').select('id, name, fee_type, academic_year, term_or_semester')
        .eq('business_id', business.id).eq('campaign_type', 'education_fees').order('created_at', { ascending: false })
      setPayments(txnData?.filter(t => t.campaigns) || [])
      setCampaigns(campData || [])
    } catch (e) { console.error('Education payments load error:', e) }
    setLoading(false)
  }

  const totalGross = payments.reduce((s, t) => s + Number(t.gross_amount || t.amount || 0), 0)
  const totalMDR   = payments.reduce((s, t) => s + Number(t.mdr_amount || 0), 0)
  const totalNet   = payments.reduce((s, t) => s + Number(t.net_to_school || (t.amount - (t.mdr_amount || 0)) || 0), 0)

  const filtered = payments.filter(t => {
    if (filterFeeType && t.campaigns?.fee_type !== filterFeeType) return false
    if (filterCampaign && t.campaign_id !== filterCampaign) return false
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); if (new Date(t.created_at) < f) return false }
    if (dateTo)   { const f = new Date(dateTo); f.setHours(23,59,59,999); if (new Date(t.created_at) > f) return false }
    if (search) {
      const q = search.toLowerCase()
      const sn  = t.students  ? `${t.students.first_name} ${t.students.last_name}`.toLowerCase()  : ''
      const pn  = t.customers ? `${t.customers.first_name} ${t.customers.last_name}`.toLowerCase() : ''
      const sid = (t.students?.partna_student_id || '').toLowerCase()
      const ssid = (t.students?.school_student_id || '').toLowerCase()
      const ref  = (t.reference || '').toLowerCase()
      if (!sn.includes(q) && !pn.includes(q) && !sid.includes(q) && !ssid.includes(q) && !ref.includes(q)) return false
    }
    return true
  })

  const filtersActive = search || filterFeeType || filterCampaign || dateFrom || dateTo
  function clearFilters() { setSearch(''); setFilterFeeType(''); setFilterCampaign(''); setDateFrom(''); setDateTo('') }

  function exportReconciliationCSV() {
    const headers = ['Date','Reference','Student name','Partna Student ID','School Student ID','Year group','Parent name','Parent phone','Campaign','Fee type','Academic year','Term','Gross amount','MDR deducted','Net to school','Status']
    const rows = filtered.map(t => [formatDate(t.created_at), t.reference || t.id.slice(0, 8), t.students ? `${t.students.first_name} ${t.students.last_name}` : '—', t.students?.partna_student_id || '—', t.students?.school_student_id || '—', t.students?.year_group || '—', t.customers ? `${t.customers.first_name} ${t.customers.last_name}` : '—', t.customers?.phone || '—', t.campaigns?.name || '—', FEE_TYPE_LABELS[t.campaigns?.fee_type] || t.fee_type || '—', t.campaigns?.academic_year || '—', t.campaigns?.term_or_semester || '—', Number(t.gross_amount || t.amount || 0).toFixed(0), Number(t.mdr_amount || 0).toFixed(0), Number(t.net_to_school || (t.amount - (t.mdr_amount || 0)) || 0).toFixed(0), t.status])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `partna-fee-payments-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total payments"      value={payments.length}            accentColor={C.blue}   />
        <StatCard label="Gross collected"     value={formatUGXShort(totalGross)} accentColor={C.green}  />
        <StatCard label="MDR deducted"        value={formatUGXShort(totalMDR)}   accentColor={C.orange} />
        <StatCard label="Net to your account" value={formatUGXShort(totalNet)}   accentColor={C.black}  />
      </div>

      <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
        The <strong style={{ color: C.black }}>Net to your account</strong> column shows what is credited to your Partna wallet after the Partna service fee (MDR) is deducted. Download the reconciliation report to match payments against your student ledger.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by student name, ID, parent, or reference…" />
        <select style={selectStyle} value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={selectStyle} value={filterFeeType} onChange={e => setFilterFeeType(e.target.value)}>
          <option value="">All fee types</option>
          {Object.entries(FEE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" style={selectStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: C.grayMid }}>—</span>
        <input type="date" style={selectStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {filtersActive && <ClearBtn onClick={clearFilters} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <CountPill count={filtered.length} label="payment" />
          <ExportBtn onClick={exportReconciliationCSV} label="Reconciliation report" />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={receiptSVG} title={payments.length === 0 ? 'No fee payments yet' : 'No payments match your filters'} sub={payments.length === 0 ? 'Fee payments will appear here once parents start paying through Partna.' : 'Try adjusting your filters.'} onClear={filtersActive ? clearFilters : null} />
      ) : (
        <TableCard footer={`Showing ${filtered.length} of ${payments.length} payments`}>
          <thead>
            <tr>
              <Th>Student</Th><Th>Parent</Th><Th>Campaign</Th><Th>Date</Th><Th>Reference</Th>
              <Th>Gross</Th><Th>MDR</Th><Th>Net to you</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const gross = Number(t.gross_amount || t.amount || 0)
              const mdr   = Number(t.mdr_amount || 0)
              const net   = Number(t.net_to_school || (gross - mdr) || 0)
              const isLate = t.type === 'late_fee_payment'
              const rowBg = i % 2 === 0 ? C.white : C.bg
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.grayLine}`, background: rowBg }}>
                  <Td>
                    {t.students ? (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.students.first_name} {t.students.last_name}</p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 600, color: C.green }}>{t.students.partna_student_id}</span>
                          {t.students.school_student_id && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.secondary }}>· {t.students.school_student_id}</span>}
                        </div>
                        {t.students.year_group && <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: '1px 0 0' }}>{t.students.year_group}</p>}
                      </div>
                    ) : <span style={{ fontSize: 12, color: C.secondary, fontStyle: 'italic' }}>No student linked</span>}
                  </Td>
                  <Td>
                    {t.customers ? (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.customers.first_name} {t.customers.last_name}</p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{t.customers.phone}</p>
                      </div>
                    ) : <span style={{ fontSize: 12, color: C.secondary }}>—</span>}
                  </Td>
                  <Td>
                    {t.campaigns ? (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.black, margin: '0 0 2px' }}>{t.campaigns.name}</p>
                        <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0 }}>
                          {FEE_TYPE_LABELS[t.campaigns.fee_type] || t.campaigns.fee_type}
                          {t.campaigns.term_or_semester ? ` · ${t.campaigns.term_or_semester}` : ''}
                          {isLate && <span style={{ color: C.orange, fontWeight: 600 }}> · Late</span>}
                        </p>
                      </div>
                    ) : <span style={{ fontSize: 12, color: C.secondary }}>—</span>}
                  </Td>
                  <Td style={{ fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(t.created_at)}</Td>
                  <Td><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>{t.reference || t.id.slice(0, 8)}</span></Td>
                  <Td style={{ fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>+{formatUGX(gross)}</Td>
                  <Td style={{ fontSize: 13, fontWeight: 500, color: C.red, whiteSpace: 'nowrap' }}>{mdr > 0 ? `−${formatUGX(mdr)}` : '—'}</Td>
                  <Td style={{ fontSize: 13, fontWeight: 600, color: C.black, whiteSpace: 'nowrap' }}>{formatUGX(net)}</Td>
                  <Td><Badge status={t.status} /></Td>
                </tr>
              )
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// GENERAL PAYMENTS VIEW
// ══════════════════════════════════════════════════════════════════════════
function GeneralPayments({ business }) {
  const [transactions, setTransactions]   = useState([])
  const [customers, setCustomers]         = useState({})
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('all')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [totals, setTotals]               = useState({ deposits: 0, payments: 0, withdrawals: 0 })

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase.from('customers').select('id, first_name, last_name, phone, email').eq('business_id', business.id)
      const customerMap = {}; customerData?.forEach(c => { customerMap[c.id] = c }); setCustomers(customerMap)
      const customerIds = customerData?.map(c => c.id) || []
      if (customerIds.length === 0) { setTransactions([]); setLoading(false); return }
      const { data: txnData } = await supabase.from('transactions').select('*').in('customer_id', customerIds).order('created_at', { ascending: false })
      setTransactions(txnData || [])
      const deps = txnData?.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0) || 0
      const pays = txnData?.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0) || 0
      const wdrs = txnData?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0) || 0
      setTotals({ deposits: deps, payments: pays, withdrawals: wdrs })
    } catch (e) { console.error('Payments load error:', e) }
    setLoading(false)
  }

  const filtered = transactions.filter(txn => {
    const c = customers[txn.customer_id]
    const name = c ? `${c.first_name} ${c.last_name} ${c.phone} ${c.email}` : ''
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); if (new Date(txn.created_at) < f) return false }
    if (dateTo)   { const f = new Date(dateTo);   f.setHours(23,59,59,999); if (new Date(txn.created_at) > f) return false }
    return true
  })

  const filtersActive = typeFilter !== 'all' || dateFrom || dateTo || search
  function clearFilters() { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo('') }

  function exportCSV() {
    const headers = ['Date', 'Customer', 'Phone', 'Type', 'Amount', 'Status']
    const rows = filtered.map(txn => { const c = customers[txn.customer_id]; return [formatDateTime(txn.created_at), c ? `${c.first_name} ${c.last_name}` : 'Unknown', c?.phone || '', txLabel(txn.type), Number(txn.amount).toFixed(2), txn.status] })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `partna-payments-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  function txIconBg(type) {
    if (type === 'deposit')    return { bg: C.bgGreen,  color: C.green  }
    if (type === 'withdrawal') return { bg: C.bgRed,    color: C.red    }
    return { bg: C.bgOrange, color: C.orange }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total deposits"     value={formatUGXShort(totals.deposits)}                       accentColor={C.green}  />
        <StatCard label="Total fee payments" value={formatUGXShort(totals.payments)}                       accentColor={C.blue}   />
        <StatCard label="Total withdrawals"  value={formatUGXShort(totals.withdrawals)}                    accentColor={C.red}    />
        <StatCard label="Net savings (AUM)"  value={formatUGXShort(totals.deposits - totals.withdrawals)}  accentColor={C.orange} />
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or email…" />
        <select style={selectStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="deposit">Deposits</option>
          <option value="payment">Fee payments</option>
          <option value="withdrawal">Withdrawals</option>
        </select>
        <input type="date" style={selectStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: C.grayMid }}>—</span>
        <input type="date" style={selectStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {filtersActive && <ClearBtn onClick={clearFilters} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <CountPill count={filtered.length} label="transaction" />
          <ExportBtn onClick={exportCSV} label="Export CSV" />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={receiptSVG} title={transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'} sub={transactions.length === 0 ? 'Transactions will appear here once customers start depositing.' : 'Try adjusting your filters.'} onClear={filtersActive ? clearFilters : null} />
      ) : (
        <TableCard>
          <thead>
            <tr><Th>Customer</Th><Th>Date & time</Th><Th>Type</Th><Th>Amount</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {filtered.map((txn, i) => {
              const c = customers[txn.customer_id]
              const { bg, color } = txIconBg(txn.type)
              return (
                <tr key={txn.id} style={{ borderBottom: `1px solid ${C.grayLine}`, background: i % 2 === 0 ? C.white : C.bg }}>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: C.black, flexShrink: 0 }}>
                        {c?.first_name?.[0]}{c?.last_name?.[0]}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{c ? `${c.first_name} ${c.last_name}` : 'Unknown'}</p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{c?.phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td style={{ fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDateTime(txn.created_at)}</Td>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {txn.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                        </svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{txLabel(txn.type)}</span>
                    </div>
                  </Td>
                  <Td style={{ fontSize: 13, fontWeight: 600, color: txAmountColor(txn.type), whiteSpace: 'nowrap' }}>{txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}</Td>
                  <Td><Badge status={txn.status} /></Td>
                </tr>
              )
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════
export default function Payments({
 admin, business }) {
  useEffect(() => { document.title = 'Payments - Partna' }, [])

  if (business?.sector === 'Education') return <EducationPayments business={business} />
  return <GeneralPayments business={business} />
}