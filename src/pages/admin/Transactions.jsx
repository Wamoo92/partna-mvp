import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── OpenFloat export ───────────────────────────────────────────────────────

function downloadOpenFloatFile(rows, filename) {
  const header = ['Account Type', 'Account Name', 'Account Number', 'Till or Paybill Number', 'Till or Paybill Business Name', 'Notification Phone Number', 'Amount', 'Remark']
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 28 }, { wch: 15 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts')
  XLSX.writeFile(wb, filename)
}

// ── SMS helper (non-blocking) ──────────────────────────────────────────────
async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error('SMS send error (non-critical):', e)
  }
}

// ── Get verified actor ID from Supabase auth session ──────────────────────
// Used for audit logging — tied to cryptographically signed session token,
// not UI state, ensuring auditability for regulatory purposes
async function getActorId() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id || null
}

// ── Write to audit log ─────────────────────────────────────────────────────
async function writeAuditLog({ actorId, action, resourceId, metadata }) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id:      actorId,
      actor_type:    'admin',
      action,
      resource_type: 'transaction',
      resource_id:   resourceId,
      metadata,
      status:        'success',
    })
  } catch (e) {
    // Non-critical — log error but never block the main operation
    console.error('Audit log write error:', e)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatUGXFull(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function txAccent(type) {
  if (type === 'deposit')    return 'var(--color-green)'
  if (type === 'withdrawal') return 'var(--color-red)'
  return 'var(--color-yellow)'
}

function txAmountColor(type) { return type === 'deposit' ? '#2D8B45' : '#C0392B' }

function statusBadgeClass(status) {
  if (status === 'completed') return 'badge-success'
  if (status === 'pending')   return 'badge-warning'
  if (status === 'reversed')  return 'badge-danger'
  return 'badge-danger'
}

function parseWithdrawalMethod(t) {
  if (t.withdrawal_method) {
    if (t.withdrawal_method === 'MTN')         return 'MTN MoMo'
    if (t.withdrawal_method === 'AirtelMoney') return 'Airtel Money'
    return t.withdrawal_method
  }
  const notes = t.notes || ''
  if (notes.includes('MTN'))    return 'MTN MoMo'
  if (notes.includes('Airtel')) return 'Airtel Money'
  if (notes.includes('Bank:'))  return 'Bank Transfer'
  return '—'
}

export default function Transactions() {
  const [tab, setTab] = useState('customer')

  // Customer transactions
  const [transactions, setTransactions]       = useState([])
  const [businesses, setBusinesses]           = useState([])
  const [loadingCustomer, setLoadingCustomer] = useState(true)
  const [search, setSearch]                   = useState('')
  const [filterBusiness, setFilterBusiness]   = useState('')
  const [filterType, setFilterType]           = useState('')
  const [filterStatus, setFilterStatus]       = useState('')
  const [dateFrom, setDateFrom]               = useState('')
  const [dateTo, setDateTo]                   = useState('')
  const [sortBy, setSortBy]                   = useState('created_at')
  const [sortDir, setSortDir]                 = useState('desc')
  const [markingId, setMarkingId]             = useState(null)
  const [confirmId, setConfirmId]             = useState(null)
  const [selectedCust, setSelectedCust]       = useState(new Set())

  // Business withdrawals
  const [bizWithdrawals, setBizWithdrawals]       = useState([])
  const [loadingBiz, setLoadingBiz]               = useState(true)
  const [bizSearch, setBizSearch]                 = useState('')
  const [bizFilterBusiness, setBizFilterBusiness] = useState('')
  const [bizFilterStatus, setBizFilterStatus]     = useState('')
  const [bizDateFrom, setBizDateFrom]             = useState('')
  const [bizDateTo, setBizDateTo]                 = useState('')
  const [bizMarkingId, setBizMarkingId]           = useState(null)
  const [bizConfirmId, setBizConfirmId]           = useState(null)
  const [selectedBiz, setSelectedBiz]             = useState(new Set())

  // ── Fee payment corrections state ─────────────────────────────────────
  const [feePayments, setFeePayments]             = useState([])
  const [loadingFee, setLoadingFee]               = useState(true)
  const [feeSearch, setFeeSearch]                 = useState('')
  const [feeFilterBusiness, setFeeFilterBusiness] = useState('')
  const [feeDateFrom, setFeeDateFrom]             = useState('')
  const [feeDateTo, setFeeDateTo]                 = useState('')

  // Reversal modal
  const [showReverseModal, setShowReverseModal]   = useState(null) // transaction object
  const [reverseReason, setReverseReason]         = useState('')
  const [reversing, setReversing]                 = useState(false)
  const [reverseError, setReverseError]           = useState('')

  // Reassignment modal
  const [showReassignModal, setShowReassignModal] = useState(null) // transaction object
  const [reassignStudentId, setReassignStudentId] = useState('')
  const [reassignStudent, setReassignStudent]     = useState(null)  // found student object
  const [reassignLookingUp, setReassignLookingUp] = useState(false)
  const [reassignLookupError, setReassignLookupError] = useState('')
  const [reassignReason, setReassignReason]       = useState('')
  const [reassigning, setReassigning]             = useState(false)
  const [reassignError, setReassignError]         = useState('')

  useEffect(() => { loadCustomer(); loadBusiness() }, [])
  useEffect(() => { if (tab === 'corrections') loadFeePayments() }, [tab])

  // ── Load functions ─────────────────────────────────────────────────────

  async function loadCustomer() {
    setLoadingCustomer(true)
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*, customers(first_name, last_name, other_names, phone, business_id, businesses(name))')
        .order('created_at', { ascending: false })
      setTransactions(txnData || [])
      const { data: bizData } = await supabase.from('businesses').select('id, name').order('name')
      setBusinesses(bizData || [])
    } catch (e) { console.error('Customer transactions load error:', e) }
    setLoadingCustomer(false)
  }

  async function loadBusiness() {
    setLoadingBiz(true)
    try {
      const { data } = await supabase.from('business_transactions')
        .select('*, businesses(id, name)').eq('type', 'withdrawal').order('created_at', { ascending: false })
      setBizWithdrawals(data || [])
    } catch (e) { console.error('Business withdrawals load error:', e) }
    setLoadingBiz(false)
  }

  async function loadFeePayments() {
    setLoadingFee(true)
    try {
      const { data } = await supabase
        .from('transactions')
        .select(`
          *,
          customers(first_name, last_name, phone, business_id, businesses(id, name)),
          students(first_name, last_name, partna_student_id, school_student_id, year_group),
          campaigns(name, fee_type, academic_year, term_or_semester)
        `)
        .in('type', ['fee_payment', 'late_fee_payment', 'payment'])
        .not('student_id', 'is', null)
        .order('created_at', { ascending: false })
      setFeePayments(data || [])
    } catch (e) { console.error('Fee payments load error:', e) }
    setLoadingFee(false)
  }

  // ── Existing handlers ──────────────────────────────────────────────────

  async function handleMarkCompleted(txnId) {
    setMarkingId(txnId)
    try {
      await supabase.from('transactions').update({ status: 'completed' }).eq('id', txnId)
      const txn = transactions.find(t => t.id === txnId)
      setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t))
      setConfirmId(null)
      if (txn?.customers?.phone && txn?.customer_id) {
        sendSMS(txn.customer_id, txn.customers.phone, 'withdrawal_completed', {
          amount:    formatUGXFull(txn.amount),
          reference: txn.reference || txnId.slice(0, 8),
        })
      }
    } catch (e) { console.error('Mark completed error:', e) }
    setMarkingId(null)
  }

  async function handleBizMarkCompleted(txnId) {
    setBizMarkingId(txnId)
    try {
      await supabase.from('business_transactions').update({ status: 'completed' }).eq('id', txnId)
      setBizWithdrawals(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t))
      setBizConfirmId(null)
    } catch (e) { console.error('Biz mark completed error:', e) }
    setBizMarkingId(null)
  }

  // ── Fee payment reversal ───────────────────────────────────────────────

  async function handleReverse() {
    if (!reverseReason.trim()) { setReverseError('Please enter a reason for the reversal.'); return }
    if (!showReverseModal) return

    setReversing(true)
    setReverseError('')

    try {
      const txn = showReverseModal
      const actorId = await getActorId()

      // 1. Get the parent's current wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('id', txn.wallet_id)
        .maybeSingle()

      if (!wallet) {
        setReverseError('Could not find the parent wallet. Please try again.')
        setReversing(false)
        return
      }

      // 2. Get the school's business wallet
      const businessId = txn.customers?.business_id
      const { data: bizWallet } = await supabase
        .from('business_wallets')
        .select('id, balance')
        .eq('business_id', businessId)
        .maybeSingle()

      if (!bizWallet) {
        setReverseError('Could not find the school wallet. Please try again.')
        setReversing(false)
        return
      }

      const amount    = Number(txn.gross_amount || txn.amount || 0)
      const netPaid   = Number(txn.net_to_school || amount)

      // 3. Credit parent wallet back
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({ balance: Number(wallet.balance) + amount })
        .eq('id', wallet.id)

      if (walletErr) {
        setReverseError('Could not credit parent wallet. Reversal aborted.')
        setReversing(false)
        return
      }

      // 4. Debit school wallet (net amount that was credited)
      const newBizBalance = Math.max(0, Number(bizWallet.balance) - netPaid)
      const { error: bizErr } = await supabase
        .from('business_wallets')
        .update({ balance: newBizBalance })
        .eq('id', bizWallet.id)

      if (bizErr) {
        // Rollback parent wallet credit
        await supabase.from('wallets').update({ balance: Number(wallet.balance) }).eq('id', wallet.id)
        setReverseError('Could not debit school wallet. Reversal rolled back.')
        setReversing(false)
        return
      }

      // 5. Mark transaction as reversed
      await supabase.from('transactions')
        .update({ status: 'reversed', notes: (txn.notes || '') + ` | REVERSED: ${reverseReason}` })
        .eq('id', txn.id)

      // 6. Write audit log
      await writeAuditLog({
        actorId,
        action:     'fee_payment_reversed',
        resourceId: txn.id,
        metadata: {
          reason:          reverseReason,
          amount:          formatUGXFull(amount),
          net_to_school:   formatUGXFull(netPaid),
          student_name:    txn.students ? `${txn.students.first_name} ${txn.students.last_name}` : '—',
          parent_name:     txn.customers ? `${txn.customers.first_name} ${txn.customers.last_name}` : '—',
          campaign:        txn.campaigns?.name || '—',
          before_status:   txn.status,
          after_status:    'reversed',
          parent_wallet_credited: formatUGXFull(amount),
          school_wallet_debited:  formatUGXFull(netPaid),
        },
      })

      // 7. Update local state
      setFeePayments(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'reversed' } : t))
      setShowReverseModal(null)
      setReverseReason('')

    } catch (e) {
      console.error('Reversal error:', e)
      setReverseError('Something went wrong. Please try again.')
    }
    setReversing(false)
  }

  // ── Student ID lookup for reassignment ─────────────────────────────────
  // Exact match only — same privacy approach as the customer portal

  async function handleReassignLookup() {
    const val = reassignStudentId.trim().toUpperCase()
    if (!val) { setReassignLookupError('Please enter a Student ID.'); return }

    setReassignLookingUp(true)
    setReassignLookupError('')
    setReassignStudent(null)

    try {
      const businessId = showReassignModal?.customers?.business_id
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, partna_student_id, school_student_id, year_group')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .or(`partna_student_id.eq.${val},school_student_id.eq.${val}`)
        .maybeSingle()

      if (!data) {
        setReassignLookupError('No student found with that ID. Please check and try again.')
      } else if (data.id === showReassignModal?.student_id) {
        setReassignLookupError('This is already the student linked to this payment.')
      } else {
        setReassignStudent(data)
      }
    } catch (e) {
      console.error('Reassign lookup error:', e)
      setReassignLookupError('Something went wrong. Please try again.')
    }
    setReassignLookingUp(false)
  }

  // ── Fee payment reassignment ───────────────────────────────────────────

  async function handleReassign() {
    if (!reassignStudent)        { setReassignError('Please find a student first.'); return }
    if (!reassignReason.trim())  { setReassignError('Please enter a reason for the reassignment.'); return }
    if (!showReassignModal) return

    setReassigning(true)
    setReassignError('')

    try {
      const txn     = showReassignModal
      const actorId = await getActorId()

      const fromStudentName = txn.students
        ? `${txn.students.first_name} ${txn.students.last_name}`
        : '—'
      const toStudentName = `${reassignStudent.first_name} ${reassignStudent.last_name}`

      // Update the student_id on the transaction
      const { error: txnErr } = await supabase
        .from('transactions')
        .update({
          student_id: reassignStudent.id,
          notes: (txn.notes || '') + ` | REASSIGNED from ${fromStudentName} to ${toStudentName}: ${reassignReason}`,
        })
        .eq('id', txn.id)

      if (txnErr) {
        setReassignError('Could not update transaction. Please try again.')
        setReassigning(false)
        return
      }

      // Write audit log
      await writeAuditLog({
        actorId,
        action:     'fee_payment_reassigned',
        resourceId: txn.id,
        metadata: {
          reason:              reassignReason,
          amount:              formatUGXFull(txn.gross_amount || txn.amount),
          from_student_id:     txn.student_id,
          from_student_name:   fromStudentName,
          from_partna_id:      txn.students?.partna_student_id || '—',
          to_student_id:       reassignStudent.id,
          to_student_name:     toStudentName,
          to_partna_id:        reassignStudent.partna_student_id,
          campaign:            txn.campaigns?.name || '—',
          parent_name:         txn.customers ? `${txn.customers.first_name} ${txn.customers.last_name}` : '—',
        },
      })

      // Update local state
      setFeePayments(prev => prev.map(t =>
        t.id === txn.id ? { ...t, student_id: reassignStudent.id, students: reassignStudent } : t
      ))
      setShowReassignModal(null)
      setReassignStudentId('')
      setReassignStudent(null)
      setReassignReason('')

    } catch (e) {
      console.error('Reassignment error:', e)
      setReassignError('Something went wrong. Please try again.')
    }
    setReassigning(false)
  }

  // ── Selection helpers ──────────────────────────────────────────────────

  function toggleCust(id) { setSelectedCust(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllCust() {
    const ws = filteredCustomer.filter(t => t.type === 'withdrawal')
    setSelectedCust(selectedCust.size === ws.length ? new Set() : new Set(ws.map(t => t.id)))
  }
  function toggleBiz(id) { setSelectedBiz(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllBiz() {
    setSelectedBiz(selectedBiz.size === filteredBiz.length ? new Set() : new Set(filteredBiz.map(t => t.id)))
  }

  // ── Export helpers ─────────────────────────────────────────────────────

  function exportCustOpenFloat() {
    const rows = filteredCustomer.filter(t => t.type === 'withdrawal' && selectedCust.has(t.id)).map(t => {
      const fullName = [t.customers?.first_name, t.customers?.other_names, t.customers?.last_name].filter(Boolean).join(' ')
      return [t.withdrawal_network || t.network || '', fullName, t.withdrawal_phone || '', '', '', '', t.amount, t.reference || t.id.slice(0, 8)]
    })
    downloadOpenFloatFile(rows, `partna-customer-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportBizOpenFloat() {
    const rows = filteredBiz.filter(t => selectedBiz.has(t.id)).map(t => [
      t.withdrawal_method || '', t.withdrawal_account_name || '', t.withdrawal_account_number || '',
      '', '', t.withdrawal_notify_phone || '', t.amount, t.businesses?.name || '',
    ])
    downloadOpenFloatFile(rows, `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportCustomerCSV() {
    const rows = [['Reference', 'Customer', 'Business', 'Type', 'Amount', 'Status', 'Date'],
      ...filteredCustomer.map(t => [t.reference || t.id, `${t.customers?.first_name} ${t.customers?.last_name}`, t.customers?.businesses?.name || '', t.type, t.amount, t.status, new Date(t.created_at).toISOString()])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `partna-customer-transactions-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }

  function exportBizCSV() {
    const rows = [['Business', 'Method', 'Account Name', 'Account Number', 'Notify Phone', 'Amount', 'Status', 'Date'],
      ...filteredBiz.map(t => [t.businesses?.name || '', t.withdrawal_method || '', t.withdrawal_account_name || '', t.withdrawal_account_number || '', t.withdrawal_notify_phone || '', t.amount, t.status, new Date(t.created_at).toISOString()])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }

  // ── Filtered data ──────────────────────────────────────────────────────

  const filteredCustomer = transactions.filter(t => {
    if (search) { const s = search.toLowerCase(); const name = `${t.customers?.first_name} ${t.customers?.last_name}`.toLowerCase(); if (!name.includes(s) && !t.reference?.toLowerCase().includes(s)) return false }
    if (filterBusiness && t.customers?.business_id !== filterBusiness) return false
    if (filterType   && t.type   !== filterType)   return false
    if (filterStatus && t.status !== filterStatus) return false
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
    if (dateTo   && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  }).sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy]
    if (sortBy === 'amount') { av = Number(av); bv = Number(bv) }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const filteredBiz = bizWithdrawals.filter(t => {
    if (bizSearch) { const s = bizSearch.toLowerCase(); if (!t.businesses?.name?.toLowerCase().includes(s) && !t.notes?.toLowerCase().includes(s)) return false }
    if (bizFilterBusiness && t.business_id !== bizFilterBusiness) return false
    if (bizFilterStatus   && t.status      !== bizFilterStatus)   return false
    if (bizDateFrom && new Date(t.created_at) < new Date(bizDateFrom)) return false
    if (bizDateTo   && new Date(t.created_at) > new Date(bizDateTo + 'T23:59:59')) return false
    return true
  })

  const filteredFee = feePayments.filter(t => {
    if (feeFilterBusiness && t.customers?.business_id !== feeFilterBusiness) return false
    if (feeDateFrom && new Date(t.created_at) < new Date(feeDateFrom)) return false
    if (feeDateTo   && new Date(t.created_at) > new Date(feeDateTo + 'T23:59:59')) return false
    if (feeSearch) {
      const s = search.toLowerCase() || feeSearch.toLowerCase()
      const studentName = t.students ? `${t.students.first_name} ${t.students.last_name}`.toLowerCase() : ''
      const parentName  = t.customers ? `${t.customers.first_name} ${t.customers.last_name}`.toLowerCase() : ''
      const ref         = (t.reference || '').toLowerCase()
      const ptn         = (t.students?.partna_student_id || '').toLowerCase()
      if (!studentName.includes(feeSearch.toLowerCase()) && !parentName.includes(feeSearch.toLowerCase()) && !ref.includes(feeSearch.toLowerCase()) && !ptn.includes(feeSearch.toLowerCase())) return false
    }
    return true
  })

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-grey-mid)' }}>unfold_more</span>
    return <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
  }

  const totalDeposits    = filteredCustomer.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
  const totalWithdrawals = filteredCustomer.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
  const pendingCustW     = filteredCustomer.filter(t => t.type === 'withdrawal' && t.status === 'pending')
  const pendingBizW      = bizWithdrawals.filter(t => t.status === 'pending')
  const custWithdrawals  = filteredCustomer.filter(t => t.type === 'withdrawal')
  const allCustSelected  = custWithdrawals.length > 0 && selectedCust.size === custWithdrawals.length
  const allBizSelected   = filteredBiz.length > 0 && selectedBiz.size === filteredBiz.length
  const hasCustomerFilters = search || filterBusiness || filterType || filterStatus || dateFrom || dateTo
  const hasBizFilters      = bizSearch || bizFilterBusiness || bizFilterStatus || bizDateFrom || bizDateTo
  const hasFeeFilters      = feeSearch || feeFilterBusiness || feeDateFrom || feeDateTo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Reversal modal ── */}
      {showReverseModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#C0392B' }}>
              <span className="modal-title">Reverse fee payment</span>
              <button onClick={() => { setShowReverseModal(null); setReverseReason(''); setReverseError('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* Payment summary */}
              <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                {[
                  { label: 'Reference',    value: showReverseModal.reference || showReverseModal.id.slice(0, 8), mono: true },
                  { label: 'Student',      value: showReverseModal.students ? `${showReverseModal.students.first_name} ${showReverseModal.students.last_name}` : '—' },
                  { label: 'Parent',       value: showReverseModal.customers ? `${showReverseModal.customers.first_name} ${showReverseModal.customers.last_name}` : '—' },
                  { label: 'Campaign',     value: showReverseModal.campaigns?.name || '—' },
                  { label: 'Gross paid',   value: formatUGXFull(showReverseModal.gross_amount || showReverseModal.amount), color: '#2D8B45' },
                  { label: 'Net to school', value: formatUGXFull(showReverseModal.net_to_school || showReverseModal.amount), color: '#C0392B' },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: row.color || 'var(--color-black)', fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">warning</span>
                <div className="alert-content">
                  This will credit the full amount back to the parent's wallet and debit the school's Partna wallet.
                  The transaction will be marked as reversed. This action is permanent and audit logged.
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Reason for reversal <span className="required">*</span></label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="e.g. Payment made for wrong student — parent requested correction"
                  value={reverseReason}
                  onChange={e => { setReverseReason(e.target.value); setReverseError('') }}
                />
              </div>

              {reverseError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{reverseError}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowReverseModal(null); setReverseReason(''); setReverseError('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleReverse} disabled={reversing || !reverseReason.trim()} className="btn btn-danger" style={{ flex: 1 }}>
                {reversing
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Reversing…</>
                  : <><span className="icon-outlined icon-sm">undo</span> Confirm reversal</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reassignment modal ── */}
      {showReassignModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: 'var(--color-black)' }}>
              <span className="modal-title">Reassign fee payment</span>
              <button onClick={() => { setShowReassignModal(null); setReassignStudentId(''); setReassignStudent(null); setReassignReason(''); setReassignError(''); setReassignLookupError('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* Current student */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                  Currently assigned to
                </div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg)', border: 'var(--border)' }}>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                    {showReassignModal.students ? `${showReassignModal.students.first_name} ${showReassignModal.students.last_name}` : 'Unknown student'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                    {showReassignModal.students?.partna_student_id} · {showReassignModal.students?.year_group || '—'}
                  </div>
                </div>
              </div>

              {/* Student ID lookup */}
              <div className="input-group">
                <label className="input-label">New student — enter Student ID number</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <span className="icon-outlined input-icon-left">badge</span>
                    <input
                      type="text"
                      className={`input ${reassignLookupError ? 'input-error' : ''}`}
                      placeholder="PTN-ST-00001 or school ID"
                      value={reassignStudentId}
                      onChange={e => { setReassignStudentId(e.target.value.toUpperCase()); setReassignLookupError(''); setReassignStudent(null) }}
                      onKeyDown={e => e.key === 'Enter' && handleReassignLookup()}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    onClick={handleReassignLookup}
                    disabled={reassignLookingUp || !reassignStudentId.trim()}
                    className="btn btn-primary"
                    style={{ flexShrink: 0 }}
                  >
                    {reassignLookingUp
                      ? <div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} />
                      : <><span className="icon-outlined icon-sm">search</span> Find</>
                    }
                  </button>
                </div>
                {reassignLookupError && <span className="input-hint error">{reassignLookupError}</span>}
                <span className="input-hint">Exact match only — enter the full Partna Student ID or school student ID.</span>
              </div>

              {/* Found student confirmation */}
              {reassignStudent && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#EAF3DE', border: '2px solid #2D8B45', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span className="icon-outlined" style={{ fontSize: 20, color: '#2D8B45', flexShrink: 0 }}>check_circle</span>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-black)' }}>
                      {reassignStudent.first_name} {reassignStudent.last_name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                      {reassignStudent.partna_student_id} · {reassignStudent.year_group || '—'}
                    </div>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Reason for reassignment <span className="required">*</span></label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="e.g. Payment was linked to wrong sibling — correct student is above"
                  value={reassignReason}
                  onChange={e => { setReassignReason(e.target.value); setReassignError('') }}
                />
              </div>

              {reassignError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{reassignError}</div>
                </div>
              )}

              <div className="alert alert-warning">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  This updates which student this payment is attributed to. No money is moved — wallet balances are unchanged.
                  This action is permanent and audit logged.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowReassignModal(null); setReassignStudentId(''); setReassignStudent(null); setReassignReason(''); setReassignError(''); setReassignLookupError('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleReassign} disabled={reassigning || !reassignStudent || !reassignReason.trim()} className="btn btn-black" style={{ flex: 1 }}>
                {reassigning
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-white)' }} /> Reassigning…</>
                  : <><span className="icon-outlined icon-sm">swap_horiz</span> Confirm reassignment</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm customer withdrawal modal ── */}
      {confirmId && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#2D8B45' }}>
              <span className="modal-title">Mark withdrawal as completed?</span>
              <button onClick={() => setConfirmId(null)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                This confirms the mobile money disbursement has been processed. The customer will receive an SMS notification. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleMarkCompleted(confirmId)} disabled={markingId === confirmId} className="btn btn-success" style={{ flex: 1 }}>
                {markingId === confirmId
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                  : <><span className="icon-outlined icon-sm">check</span> Confirm</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm business withdrawal modal ── */}
      {bizConfirmId && (() => {
        const w = bizWithdrawals.find(t => t.id === bizConfirmId)
        const method = parseWithdrawalMethod(w)
        return (
          <div className="modal-backdrop">
            <div className="modal modal-sm">
              <div className="modal-header" style={{ background: '#2D8B45' }}>
                <span className="modal-title">Mark withdrawal as processed?</span>
                <button onClick={() => setBizConfirmId(null)} className="modal-close">
                  <span className="icon-outlined icon-sm">close</span>
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  {[
                    { label: 'Business',       value: w?.businesses?.name },
                    { label: 'Amount',         value: formatUGXFull(w?.amount), color: '#C0392B' },
                    { label: 'Method',         value: method },
                    { label: 'Account name',   value: w?.withdrawal_account_name   || '—' },
                    { label: 'Account number', value: w?.withdrawal_account_number || '—' },
                    ...(w?.withdrawal_notify_phone ? [{ label: 'Notify phone', value: w.withdrawal_notify_phone }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: row.color || 'var(--color-black)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                  Confirm that payment has been sent. This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button onClick={() => setBizConfirmId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => handleBizMarkCompleted(bizConfirmId)} disabled={bizMarkingId === bizConfirmId} className="btn btn-success" style={{ flex: 1 }}>
                  {bizMarkingId === bizConfirmId
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                    : <><span className="icon-outlined icon-sm">check</span> Mark processed</>
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Tabs + export ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
          {[
            { id: 'customer',    label: 'Customer transactions' },
            { id: 'business',    label: `Business withdrawals${pendingBizW.length > 0 ? ` (${pendingBizW.length} pending)` : ''}` },
            { id: 'corrections', label: 'Fee payment corrections' },
          ].map((t, i) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: 'var(--space-3) var(--space-5)',
              background: tab === t.id ? 'var(--color-black)' : 'var(--color-white)',
              color: tab === t.id ? 'var(--color-white)' : 'var(--color-grey)',
              border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'corrections' && (
          <button onClick={tab === 'customer' ? exportCustomerCSV : exportBizCSV} className="btn btn-secondary btn-sm">
            <span className="icon-outlined icon-xs">download</span>
            Export CSV
          </button>
        )}
      </div>

      {/* ══════════════ CUSTOMER TAB ══════════════ */}
      {tab === 'customer' && (
        <>
          {loadingCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
              <div className="spinner spinner-lg spinner-purple" />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Shown transactions', value: filteredCustomer.length,      accent: 'var(--color-primary)' },
                  { label: 'Total deposits',      value: formatUGX(totalDeposits),    accent: 'var(--color-green)'   },
                  { label: 'Total withdrawals',   value: formatUGX(totalWithdrawals), accent: 'var(--color-red)'     },
                  { label: 'Pending withdrawals', value: pendingCustW.length,         accent: pendingCustW.length > 0 ? 'var(--color-yellow)' : 'var(--color-grey-light)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
                    <div style={{ height: 3, background: s.accent, marginBottom: 'var(--space-2)' }} />
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-1)' }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {pendingCustW.length > 0 && !filterStatus && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', background: 'var(--color-yellow)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="icon-outlined" style={{ fontSize: 20 }}>schedule</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                      {pendingCustW.length} pending customer withdrawal{pendingCustW.length > 1 ? 's' : ''} require processing
                    </span>
                  </div>
                  <button onClick={() => { setFilterStatus('pending'); setFilterType('withdrawal') }} className="btn btn-sm btn-black">Show pending</button>
                </div>
              )}

              {selectedCust.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', background: 'var(--color-black)', border: 'var(--border)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>
                    {selectedCust.size} withdrawal{selectedCust.size > 1 ? 's' : ''} selected
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button onClick={() => setSelectedCust(new Set())} className="btn btn-sm btn-secondary">Clear</button>
                    <button onClick={exportCustOpenFloat} className="btn btn-sm btn-primary">
                      <span className="icon-outlined icon-xs">download</span>
                      Download OpenFloat file
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                  <span className="icon-outlined search-icon">search</span>
                  <input type="text" className="input search-input" placeholder="Search by name or reference…" value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button className="search-clear" onClick={() => setSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
                </div>
                <select className="input" value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
                  <option value="">All businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
                  <option value="">All types</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="payment">Payment</option>
                </select>
                <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
                <span style={{ alignSelf: 'center', color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
                <input type="date" className="input input-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
                {hasCustomerFilters && (
                  <button onClick={() => { setSearch(''); setFilterBusiness(''); setFilterType(''); setFilterStatus(''); setDateFrom(''); setDateTo('') }} className="btn btn-sm btn-danger">
                    <span className="icon-outlined icon-xs">close</span> Clear
                  </button>
                )}
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input type="checkbox" checked={allCustSelected} onChange={toggleAllCust} style={{ cursor: 'pointer' }} />
                      </th>
                      {[
                        { label: 'Reference', col: 'reference'  },
                        { label: 'Customer',  col: 'customer'   },
                        { label: 'Business',  col: 'business'   },
                        { label: 'Type',      col: 'type'       },
                        { label: 'Amount',    col: 'amount'     },
                        { label: 'Status',    col: 'status'     },
                        { label: 'Date',      col: 'created_at' },
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
                    {filteredCustomer.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                          No transactions found
                        </td>
                      </tr>
                    ) : filteredCustomer.map(t => {
                      const isWithdrawal = t.type === 'withdrawal'
                      const isSelected   = selectedCust.has(t.id)
                      return (
                        <tr key={t.id} style={{ background: isSelected ? 'rgba(174,122,255,0.05)' : undefined, borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent' }}>
                          <td>
                            {isWithdrawal && (
                              <input type="checkbox" checked={isSelected} onChange={() => toggleCust(t.id)} style={{ cursor: 'pointer' }} />
                            )}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                              {t.reference || t.id.slice(0, 8)}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                              {t.customers?.first_name} {t.customers?.last_name}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{t.customers?.phone}</div>
                          </td>
                          <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                            {t.customers?.businesses?.name || '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <div style={{ width: 20, height: 20, background: txAccent(t.type), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="icon-outlined" style={{ fontSize: 11, color: 'var(--color-black)' }}>{t.type === 'deposit' ? 'south' : 'north'}</span>
                              </div>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', textTransform: 'capitalize' }}>{t.type}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(t.type) }}>
                            {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                          </td>
                          <td>
                            <span className={`badge no-dot ${statusBadgeClass(t.status)}`} style={{ textTransform: 'capitalize' }}>{t.status}</span>
                          </td>
                          <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                            {formatDateTime(t.created_at)}
                          </td>
                          <td>
                            {t.type === 'withdrawal' && t.status === 'pending' && (
                              <button onClick={() => setConfirmId(t.id)} className="btn btn-sm btn-success" style={{ whiteSpace: 'nowrap' }}>
                                <span className="icon-outlined icon-xs">check</span>
                                Mark completed
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ BUSINESS TAB ══════════════ */}
      {tab === 'business' && (
        <>
          {loadingBiz ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
              <div className="spinner spinner-lg spinner-purple" />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Total requests',  value: bizWithdrawals.length, accent: 'var(--color-primary)' },
                  { label: 'Total requested', value: formatUGX(bizWithdrawals.reduce((s, t) => s + Number(t.amount), 0)), accent: 'var(--color-red)' },
                  { label: 'Total completed', value: formatUGX(bizWithdrawals.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)), accent: 'var(--color-green)' },
                  { label: 'Pending',         value: pendingBizW.length, accent: pendingBizW.length > 0 ? 'var(--color-yellow)' : 'var(--color-grey-light)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
                    <div style={{ height: 3, background: s.accent, marginBottom: 'var(--space-2)' }} />
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-1)' }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {pendingBizW.length > 0 && !bizFilterStatus && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', background: 'var(--color-yellow)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="icon-outlined" style={{ fontSize: 20 }}>schedule</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                      {pendingBizW.length} business withdrawal{pendingBizW.length > 1 ? 's' : ''} pending processing
                    </span>
                  </div>
                  <button onClick={() => setBizFilterStatus('pending')} className="btn btn-sm btn-black">Show pending</button>
                </div>
              )}

              {selectedBiz.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', background: 'var(--color-black)', border: 'var(--border)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>
                    {selectedBiz.size} withdrawal{selectedBiz.size > 1 ? 's' : ''} selected
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button onClick={() => setSelectedBiz(new Set())} className="btn btn-sm btn-secondary">Clear</button>
                    <button onClick={exportBizOpenFloat} className="btn btn-sm btn-primary">
                      <span className="icon-outlined icon-xs">download</span>
                      Download OpenFloat file
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                  <span className="icon-outlined search-icon">search</span>
                  <input type="text" className="input search-input" placeholder="Search by business or notes…" value={bizSearch} onChange={e => setBizSearch(e.target.value)} />
                  {bizSearch && <button className="search-clear" onClick={() => setBizSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
                </div>
                <select className="input" value={bizFilterBusiness} onChange={e => setBizFilterBusiness(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
                  <option value="">All businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select className="input" value={bizFilterStatus} onChange={e => setBizFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
                <input type="date" className="input input-sm" value={bizDateFrom} onChange={e => setBizDateFrom(e.target.value)} style={{ width: 140 }} />
                <span style={{ alignSelf: 'center', color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
                <input type="date" className="input input-sm" value={bizDateTo} onChange={e => setBizDateTo(e.target.value)} style={{ width: 140 }} />
                {hasBizFilters && (
                  <button onClick={() => { setBizSearch(''); setBizFilterBusiness(''); setBizFilterStatus(''); setBizDateFrom(''); setBizDateTo('') }} className="btn btn-sm btn-danger">
                    <span className="icon-outlined icon-xs">close</span> Clear
                  </button>
                )}
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input type="checkbox" checked={allBizSelected} onChange={toggleAllBiz} style={{ cursor: 'pointer' }} />
                      </th>
                      <th>Business</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Account details</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBiz.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                          No withdrawal requests found
                        </td>
                      </tr>
                    ) : filteredBiz.map(t => {
                      const method     = parseWithdrawalMethod(t)
                      const isSelected = selectedBiz.has(t.id)
                      const isMobile   = method === 'MTN MoMo' || method === 'Airtel Money'
                      return (
                        <tr key={t.id} style={{ background: isSelected ? 'rgba(174,122,255,0.05)' : undefined, borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent' }}>
                          <td>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleBiz(t.id)} style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {t.businesses?.name || '—'}
                          </td>
                          <td style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: '#C0392B' }}>
                            {formatUGXFull(t.amount)}
                          </td>
                          <td>
                            <span className={`badge no-dot ${isMobile ? 'badge-warning' : 'badge-default'}`}>{method}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                              {t.withdrawal_account_name || '—'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                              {t.withdrawal_account_number || ''}
                            </div>
                          </td>
                          <td>
                            <span className={`badge no-dot ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                              {t.status === 'completed' ? 'Processed' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                            {formatDateTime(t.created_at)}
                          </td>
                          <td>
                            {t.status === 'pending' && (
                              <button onClick={() => setBizConfirmId(t.id)} className="btn btn-sm btn-success" style={{ whiteSpace: 'nowrap' }}>
                                <span className="icon-outlined icon-xs">check</span>
                                Mark processed
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ FEE PAYMENT CORRECTIONS TAB ══════════════ */}
      {tab === 'corrections' && (
        <>
          {/* Info banner */}
          <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--color-white)', border: 'var(--border)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>info</span>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
              <strong style={{ color: 'var(--color-black)' }}>Reverse</strong> a payment to return funds to the parent's wallet and debit the school's wallet.
              Use when a payment was made in error or a parent requests a refund.{' '}
              <strong style={{ color: 'var(--color-black)' }}>Reassign</strong> a payment to link it to the correct student without moving any money.
              Use when a payment was linked to the wrong child. All actions are permanently audit logged.
            </div>
          </div>

          {loadingFee ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
              <div className="spinner spinner-lg spinner-purple" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Total fee payments', value: feePayments.length, accent: 'var(--color-primary)' },
                  { label: 'Completed',           value: feePayments.filter(t => t.status === 'completed').length, accent: 'var(--color-green)' },
                  { label: 'Reversed',            value: feePayments.filter(t => t.status === 'reversed').length, accent: 'var(--color-red)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
                    <div style={{ height: 3, background: s.accent, marginBottom: 'var(--space-2)' }} />
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-1)' }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                  <span className="icon-outlined search-icon">search</span>
                  <input type="text" className="input search-input" placeholder="Search by student name, parent, Partna ID or reference…" value={feeSearch} onChange={e => setFeeSearch(e.target.value)} />
                  {feeSearch && <button className="search-clear" onClick={() => setFeeSearch('')}><span className="icon-outlined" style={{ fontSize: 16 }}>close</span></button>}
                </div>
                <select className="input" value={feeFilterBusiness} onChange={e => setFeeFilterBusiness(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
                  <option value="">All schools</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="date" className="input input-sm" value={feeDateFrom} onChange={e => setFeeDateFrom(e.target.value)} style={{ width: 140 }} />
                <span style={{ alignSelf: 'center', color: 'var(--color-grey-mid)', fontSize: 'var(--text-lg)' }}>—</span>
                <input type="date" className="input input-sm" value={feeDateTo} onChange={e => setFeeDateTo(e.target.value)} style={{ width: 140 }} />
                {hasFeeFilters && (
                  <button onClick={() => { setFeeSearch(''); setFeeFilterBusiness(''); setFeeDateFrom(''); setFeeDateTo('') }} className="btn btn-sm btn-danger">
                    <span className="icon-outlined icon-xs">close</span> Clear
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Student</th>
                      <th>Parent</th>
                      <th>School</th>
                      <th>Campaign</th>
                      <th>Date</th>
                      <th>Gross</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFee.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-12)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                          No fee payments found
                        </td>
                      </tr>
                    ) : filteredFee.map(t => (
                      <tr key={t.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                            {t.reference || t.id.slice(0, 8)}
                          </span>
                        </td>
                        <td>
                          {t.students ? (
                            <div>
                              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                                {t.students.first_name} {t.students.last_name}
                              </div>
                              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-primary)', marginTop: 1 }}>
                                {t.students.partna_student_id}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>No student</span>
                          )}
                        </td>
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
                        <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                          {t.customers?.businesses?.name || '—'}
                        </td>
                        <td>
                          <div style={{ fontSize: 'var(--text-sm)' }}>{t.campaigns?.name || '—'}</div>
                          {t.campaigns?.term_or_semester && (
                            <div style={{ fontSize: 10, color: 'var(--color-grey)' }}>{t.campaigns.term_or_semester}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(t.created_at)}
                        </td>
                        <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45', whiteSpace: 'nowrap' }}>
                          {formatUGXFull(t.gross_amount || t.amount)}
                        </td>
                        <td>
                          <span className={`badge no-dot ${t.status === 'completed' ? 'badge-success' : t.status === 'reversed' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          {t.status !== 'reversed' && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => { setShowReassignModal(t); setReassignStudentId(''); setReassignStudent(null); setReassignReason(''); setReassignError(''); setReassignLookupError('') }}
                                className="btn btn-sm btn-secondary"
                              >
                                <span className="icon-outlined icon-xs">swap_horiz</span>
                                Reassign
                              </button>
                              <button
                                onClick={() => { setShowReverseModal(t); setReverseReason(''); setReverseError('') }}
                                className="btn btn-sm btn-danger"
                              >
                                <span className="icon-outlined icon-xs">undo</span>
                                Reverse
                              </button>
                            </div>
                          )}
                          {t.status === 'reversed' && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>Reversed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                  Showing {filteredFee.length} of {feePayments.length} fee payments
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}