import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../supabase'
import { formatUGX, businessWithdrawalFees } from '../../lib/constants'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── All helpers/logic — unchanged ──────────────────────────────────────────

function downloadOpenFloatFile(rows, filename) {
  const header = ['Account Type', 'Account Name', 'Account Number', 'Till or Paybill Number', 'Till or Paybill Business Name', 'Notification Phone Number', 'Amount', 'Remark']
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 28 }, { wch: 15 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Accounts')
  XLSX.writeFile(wb, filename)
}

async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ event, phone, customerId, vars }) })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

async function getActorId() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id || null
}

async function writeAuditLog({ actorId, action, resourceId, metadata }) {
  try {
    await supabase.from('audit_logs').insert({ actor_id: actorId, actor_type: 'admin', action, resource_type: 'transaction', resource_id: resourceId, metadata, status: 'success' })
  } catch (e) { console.error('Audit log write error:', e) }
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
function txAmountColor(type) { return type === 'deposit' ? '#59886D' : '#CC3939' }
function txIconBg(type) {
  if (type === 'deposit')    return { bg: '#E4F8EC', color: '#59886D' }
  if (type === 'withdrawal') return { bg: '#F8E4E4', color: '#CC3939' }
  return { bg: '#F8F0E4', color: '#EF8354' }
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

// ── Shared UI primitives ───────────────────────────────────────────────────

function Badge({ value, cfg }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{value}</span>
}

function statusCfg(status) {
  if (status === 'completed') return { bg: C.bgGreen,  color: C.green  }
  if (status === 'pending')   return { bg: C.bgOrange, color: C.orange }
  if (status === 'reversed')  return { bg: C.bgRed,    color: C.red    }
  return { bg: C.grayLight, color: C.grayMid }
}

const selectStyle = { padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' }
const inputStyle  = { ...selectStyle, cursor: 'text' }
const btnPrimary  = { padding: '8px 16px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary= { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnDanger   = { ...btnPrimary, background: C.red, borderColor: C.red }
const btnSuccess  = { ...btnPrimary, background: C.green, borderColor: C.green }
const btnGhost    = { padding: '7px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }

function TableWrap({ cols, rows, empty }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
              {cols.map((c, i) => (
                <th key={i} onClick={c.onClick} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: c.onClick ? 'pointer' : 'default', userSelect: c.onClick ? 'none' : undefined, ...c.style }}>
                  {c.onClick ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{c.label} {c.chevron}</span> : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>{empty}</td></tr>
              : rows.map((cells, i) => (
                <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: cells.__selected ? 'rgba(133,160,197,0.06)' : i % 2 === 0 ? C.white : C.bg }}>
                  {cells.filter((_, ci) => ci !== cells.indexOf(cells.__selected)).map((cell, ci) => typeof cell === 'object' && cell?.__selected !== undefined ? null : (
                    <td key={ci} style={{ padding: '11px 14px', verticalAlign: 'middle' }}>{cell}</td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

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

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, footer, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 4, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

function SummaryTable({ rows }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: row.color || C.black, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Transactions() {
  useEffect(() => { document.title = 'Transactions - Partna' }, [])

  const [tab, setTab] = useState('customer')

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

  const [feePayments, setFeePayments]             = useState([])
  const [loadingFee, setLoadingFee]               = useState(true)
  const [feeSearch, setFeeSearch]                 = useState('')
  const [feeFilterBusiness, setFeeFilterBusiness] = useState('')
  const [feeDateFrom, setFeeDateFrom]             = useState('')
  const [feeDateTo, setFeeDateTo]                 = useState('')

  const [showReverseModal, setShowReverseModal]   = useState(null)
  const [reverseReason, setReverseReason]         = useState('')
  const [reversing, setReversing]                 = useState(false)
  const [reverseError, setReverseError]           = useState('')

  const [showReassignModal, setShowReassignModal] = useState(null)
  const [reassignStudentId, setReassignStudentId] = useState('')
  const [reassignStudent, setReassignStudent]     = useState(null)
  const [reassignLookingUp, setReassignLookingUp] = useState(false)
  const [reassignLookupError, setReassignLookupError] = useState('')
  const [reassignReason, setReassignReason]       = useState('')
  const [reassigning, setReassigning]             = useState(false)
  const [reassignError, setReassignError]         = useState('')

  useEffect(() => { loadCustomer(); loadBusiness() }, [])
  useEffect(() => { if (tab === 'corrections') loadFeePayments() }, [tab])

  // ── All data/business logic — unchanged ──────────────────────────────────

  async function loadCustomer() {
    setLoadingCustomer(true)
    try {
      const { data: txnData } = await supabase.from('transactions').select('*, customers(first_name, last_name, other_names, phone, payment_network, payment_number, business_id, businesses(name)), transaction_fees(net_amount)').order('created_at', { ascending: false })
      setTransactions(txnData || [])
      const { data: bizData } = await supabase.from('businesses').select('id, name').order('name')
      setBusinesses(bizData || [])
    } catch (e) { console.error('Customer transactions load error:', e) }
    setLoadingCustomer(false)
  }

  async function loadBusiness() {
    setLoadingBiz(true)
    try {
      const { data } = await supabase.from('business_transactions').select('*, businesses(id, name, admin_email, contact_email), business_transaction_fees(net_amount)').eq('type', 'withdrawal').order('created_at', { ascending: false })
      setBizWithdrawals(data || [])
    } catch (e) { console.error('Business withdrawals load error:', e) }
    setLoadingBiz(false)
  }

  async function loadFeePayments() {
    setLoadingFee(true)
    try {
      const { data } = await supabase.from('transactions').select(`*, customers(first_name, last_name, phone, business_id, businesses(id, name)), students(first_name, last_name, partna_student_id, school_student_id, year_group), campaigns(name, fee_type, academic_year, term_or_semester)`).in('type', ['fee_payment', 'late_fee_payment', 'payment']).not('student_id', 'is', null).order('created_at', { ascending: false })
      setFeePayments(data || [])
    } catch (e) { console.error('Fee payments load error:', e) }
    setLoadingFee(false)
  }

  async function handleMarkCompleted(txnId) {
    setMarkingId(txnId)
    try {
      await supabase.from('transactions').update({ status: 'completed' }).eq('id', txnId)
      const txn = transactions.find(t => t.id === txnId)
      setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t))
      setConfirmId(null)
      if (txn?.customers?.phone && txn?.customer_id) sendSMS(txn.customer_id, txn.customers.phone, 'withdrawal_completed', { amount: formatUGX(txn.amount), reference: txn.reference || txnId.slice(0, 8) })
    } catch (e) { console.error('Mark completed error:', e) }
    setMarkingId(null)
  }

  async function handleBizMarkCompleted(txnId) {
    setBizMarkingId(txnId)
    try {
      const txn = bizWithdrawals.find(t => t.id === txnId)

      await supabase
        .from('business_transactions')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', txnId)

      setBizWithdrawals(prev => prev.map(t =>
        t.id === txnId ? { ...t, status: 'completed' } : t
      ))
      setBizConfirmId(null)

      // Send confirmation email to business admin and contact email
      if (txn) {
        const { data: { session } } = await supabase.auth.getSession()
        const recipients = [txn.businesses?.admin_email, txn.businesses?.contact_email].filter(Boolean)
        const bankName     = txn.withdrawal_method    || 'your bank'
        const accountNum   = txn.withdrawal_account_number || ''
        const last4        = accountNum.length >= 4 ? accountNum.slice(-4) : accountNum
        const accountLabel = last4 ? `${bankName} account ending in ${last4}` : bankName
        const amountStr    = 'UGX ' + Number(txn.amount).toLocaleString('en-UG', { maximumFractionDigits: 0 })

        const emailHtml = `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;">
          <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" />
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; letter-spacing: -0.5px;">Withdrawal processed — funds on the way</h2>
          <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
            Your withdrawal request of <strong style="color: #111;">${amountStr}</strong> from your Partna business wallet has been processed.
            Funds will arrive in your <strong style="color: #111;">${accountLabel}</strong> within 1–2 business days.
          </p>
          <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; padding: 16px 18px; margin: 0 0 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #959687; font-weight: 500; width: 140px;">Amount</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111;">${amountStr}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #959687; font-weight: 500;">Bank</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111;">${bankName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #959687; font-weight: 500;">Account name</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111;">${txn.withdrawal_account_name || '—'}</td>
              </tr>
              ${accountNum ? `<tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Account number</td><td style="padding: 6px 0; font-weight: 600; color: #111; font-family: monospace;">${accountNum}</td></tr>` : ''}
            </table>
          </div>
          <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 20px;">
            If you have any questions about this transfer, contact us at
            <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600; text-decoration: underline;">billing@partna.io</a>.
          </p>
          <p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600; text-decoration: none;">Partna</a></p>
        </div>`

        // Fire and forget — one call per recipient
        for (const email of recipients) {
          fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body:    JSON.stringify({
              to:      email,
              from:    'billing',
              subject: `Withdrawal processed — ${amountStr} on the way`,
              html:    emailHtml,
            }),
          }).catch(e => console.error('Withdrawal email send error (non-critical):', e))
        }
      }
    } catch (e) { console.error('Biz mark completed error:', e) }
    setBizMarkingId(null)
  }

  async function handleReverse() {
    if (!reverseReason.trim()) { setReverseError('Please enter a reason for the reversal.'); return }
    if (!showReverseModal) return
    setReversing(true); setReverseError('')
    try {
      const txn = showReverseModal; const actorId = await getActorId()
      const { data: wallet } = await supabase.from('wallets').select('id, balance').eq('id', txn.wallet_id).maybeSingle()
      if (!wallet) { setReverseError('Could not find the parent wallet. Please try again.'); setReversing(false); return }
      const businessId = txn.customers?.business_id
      const { data: bizWallet } = await supabase.from('business_wallets').select('id, balance').eq('business_id', businessId).maybeSingle()
      if (!bizWallet) { setReverseError('Could not find the school wallet. Please try again.'); setReversing(false); return }
      const amount = Number(txn.gross_amount || txn.amount || 0); const netPaid = Number(txn.net_to_school || amount)
      const { error: walletErr } = await supabase.from('wallets').update({ balance: Number(wallet.balance) + amount }).eq('id', wallet.id)
      if (walletErr) { setReverseError('Could not credit parent wallet. Reversal aborted.'); setReversing(false); return }
      const newBizBalance = Math.max(0, Number(bizWallet.balance) - netPaid)
      const { error: bizErr } = await supabase.from('business_wallets').update({ balance: newBizBalance }).eq('id', bizWallet.id)
      if (bizErr) { await supabase.from('wallets').update({ balance: Number(wallet.balance) }).eq('id', wallet.id); setReverseError('Could not debit school wallet. Reversal rolled back.'); setReversing(false); return }
      await supabase.from('transactions').update({ status: 'reversed', notes: (txn.notes || '') + ` | REVERSED: ${reverseReason}` }).eq('id', txn.id)
      await writeAuditLog({ actorId, action: 'fee_payment_reversed', resourceId: txn.id, metadata: { reason: reverseReason, amount: formatUGX(amount), net_to_school: formatUGX(netPaid), student_name: txn.students ? `${txn.students.first_name} ${txn.students.last_name}` : '—', parent_name: txn.customers ? `${txn.customers.first_name} ${txn.customers.last_name}` : '—', campaign: txn.campaigns?.name || '—', before_status: txn.status, after_status: 'reversed', parent_wallet_credited: formatUGX(amount), school_wallet_debited: formatUGX(netPaid) } })
      setFeePayments(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'reversed' } : t))
      setShowReverseModal(null); setReverseReason('')
    } catch (e) { console.error('Reversal error:', e); setReverseError('Something went wrong. Please try again.') }
    setReversing(false)
  }

  async function handleReassignLookup() {
    const val = reassignStudentId.trim().toUpperCase()
    if (!val) { setReassignLookupError('Please enter a Student ID.'); return }
    setReassignLookingUp(true); setReassignLookupError(''); setReassignStudent(null)
    try {
      const businessId = showReassignModal?.customers?.business_id
      const { data } = await supabase.from('students').select('id, first_name, last_name, partna_student_id, school_student_id, year_group').eq('business_id', businessId).eq('is_active', true).or(`partna_student_id.eq.${val},school_student_id.eq.${val}`).maybeSingle()
      if (!data) { setReassignLookupError('No student found with that ID. Please check and try again.') }
      else if (data.id === showReassignModal?.student_id) { setReassignLookupError('This is already the student linked to this payment.') }
      else { setReassignStudent(data) }
    } catch (e) { console.error('Reassign lookup error:', e); setReassignLookupError('Something went wrong. Please try again.') }
    setReassignLookingUp(false)
  }

  async function handleReassign() {
    if (!reassignStudent)       { setReassignError('Please find a student first.'); return }
    if (!reassignReason.trim()) { setReassignError('Please enter a reason for the reassignment.'); return }
    if (!showReassignModal) return
    setReassigning(true); setReassignError('')
    try {
      const txn = showReassignModal; const actorId = await getActorId()
      const fromStudentName = txn.students ? `${txn.students.first_name} ${txn.students.last_name}` : '—'
      const toStudentName   = `${reassignStudent.first_name} ${reassignStudent.last_name}`
      const { error: txnErr } = await supabase.from('transactions').update({ student_id: reassignStudent.id, notes: (txn.notes || '') + ` | REASSIGNED from ${fromStudentName} to ${toStudentName}: ${reassignReason}` }).eq('id', txn.id)
      if (txnErr) { setReassignError('Could not update transaction. Please try again.'); setReassigning(false); return }
      await writeAuditLog({ actorId, action: 'fee_payment_reassigned', resourceId: txn.id, metadata: { reason: reassignReason, amount: formatUGX(txn.gross_amount || txn.amount), from_student_id: txn.student_id, from_student_name: fromStudentName, from_partna_id: txn.students?.partna_student_id || '—', to_student_id: reassignStudent.id, to_student_name: toStudentName, to_partna_id: reassignStudent.partna_student_id, campaign: txn.campaigns?.name || '—', parent_name: txn.customers ? `${txn.customers.first_name} ${txn.customers.last_name}` : '—' } })
      setFeePayments(prev => prev.map(t => t.id === txn.id ? { ...t, student_id: reassignStudent.id, students: reassignStudent } : t))
      setShowReassignModal(null); setReassignStudentId(''); setReassignStudent(null); setReassignReason('')
    } catch (e) { console.error('Reassignment error:', e); setReassignError('Something went wrong. Please try again.') }
    setReassigning(false)
  }

  function toggleCust(id) { setSelectedCust(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllCust() { const ws = filteredCustomer.filter(t => t.type === 'withdrawal'); setSelectedCust(selectedCust.size === ws.length ? new Set() : new Set(ws.map(t => t.id))) }
  function toggleBiz(id)  { setSelectedBiz(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllBiz() { setSelectedBiz(selectedBiz.size === filteredBiz.length ? new Set() : new Set(filteredBiz.map(t => t.id))) }

  function exportCustOpenFloat() {
    const rows = filteredCustomer
      .filter(t => t.type === 'withdrawal' && selectedCust.has(t.id))
      .map(t => {
        const fullName = [t.customers?.first_name, t.customers?.other_names, t.customers?.last_name].filter(Boolean).join(' ')
        // Fall back to the customer's saved mobile-money details — refund rows
        // (campaign-left) don't carry withdrawal_network/withdrawal_phone.
        const network = t.withdrawal_network || t.network || t.customers?.payment_network || ''
        const accountType = network.toLowerCase().includes('mtn') ? 'MTN' : network.toLowerCase().includes('airtel') ? 'AirtelMoney' : network
        const rawPhone = t.withdrawal_phone || t.customers?.payment_number || t.customers?.phone || ''
        const phone = rawPhone.replace(/^\+/, '').replace(/^0/, '256')
        // OpenFloat must disburse the NET amount the customer actually receives, not
        // the gross. Prefer transaction_fees.net_amount; fall back to the withdrawal
        // formula (gross − UGX 1,800 carrier − 2% Partna) when no fee row is linked.
        const netFromFee = t.transaction_fees?.[0]?.net_amount
        const netAmount = netFromFee != null
          ? Number(netFromFee)
          : Math.max(0, Number(t.amount) - 1800 - Math.round(Number(t.amount) * 0.02))
        return [accountType, fullName, phone, '', '', phone, netAmount, t.reference || t.id.slice(0, 8)]
      })
    downloadOpenFloatFile(rows, `partna-customer-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  function exportBizOpenFloat() {
    const rows = filteredBiz
      .filter(t => selectedBiz.has(t.id))
      .map(t => {
        const phone = (t.withdrawal_notify_phone || '').replace(/^\+/, '').replace(/^0/, '256')
        // OpenFloat must disburse the NET the business receives (gross − 3% − UGX 6,000),
        // not the gross. Prefer the recorded net_amount; recalculate if it's missing.
        const netFromFee = t.business_transaction_fees?.[0]?.net_amount
        const netAmount  = netFromFee != null ? Number(netFromFee) : businessWithdrawalFees(Number(t.amount)).netAmount
        return [
          t.withdrawal_method || '',
          t.withdrawal_account_name || '',
          t.withdrawal_account_number || '',
          '',
          '',
          phone,
          netAmount,
          t.reference || t.id.slice(0, 8),
        ]
      })
    downloadOpenFloatFile(rows, `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  function exportCustomerCSV() {
    const rows = [['Reference', 'Customer', 'Business', 'Type', 'Amount', 'Status', 'Date'], ...filteredCustomer.map(t => [t.reference || t.id, `${t.customers?.first_name} ${t.customers?.last_name}`, t.customers?.businesses?.name || '', t.type, t.amount, t.status, new Date(t.created_at).toISOString()])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `partna-customer-transactions-${new Date().toISOString().slice(0, 10)}.csv` }); a.click()
  }
  function exportBizCSV() {
    const rows = [['Business', 'Method', 'Account Name', 'Account Number', 'Notify Phone', 'Amount', 'Status', 'Date'], ...filteredBiz.map(t => [t.businesses?.name || '', t.withdrawal_method || '', t.withdrawal_account_name || '', t.withdrawal_account_number || '', t.withdrawal_notify_phone || '', t.amount, t.status, new Date(t.created_at).toISOString()])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `partna-business-withdrawals-${new Date().toISOString().slice(0, 10)}.csv` }); a.click()
  }

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
    if (feeSearch) { const s = feeSearch.toLowerCase(); const sn = t.students ? `${t.students.first_name} ${t.students.last_name}`.toLowerCase() : ''; const pn = t.customers ? `${t.customers.first_name} ${t.customers.last_name}`.toLowerCase() : ''; const ref = (t.reference || '').toLowerCase(); const ptn = (t.students?.partna_student_id || '').toLowerCase(); if (!sn.includes(s) && !pn.includes(s) && !ref.includes(s) && !ptn.includes(s)) return false }
    return true
  })

  function handleSort(col) { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc') } }
  function SC({ col }) { if (sortBy !== col) return <span style={{ color: C.grayLight, fontSize: 10 }}>↕</span>; return <span style={{ color: C.black, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span> }

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

  // ─────────────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'customer',    label: 'Customer transactions' },
    { id: 'business',    label: `Business withdrawals${pendingBizW.length > 0 ? ` (${pendingBizW.length} pending)` : ''}` },
    { id: 'corrections', label: 'Fee payment corrections' },
  ]

  const closeReassign = () => { setShowReassignModal(null); setReassignStudentId(''); setReassignStudent(null); setReassignReason(''); setReassignError(''); setReassignLookupError('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Reversal modal ── */}
      {showReverseModal && (
        <Modal title="Reverse fee payment" onClose={() => { setShowReverseModal(null); setReverseReason(''); setReverseError('') }}
          footer={<>
            <button onClick={() => { setShowReverseModal(null); setReverseReason(''); setReverseError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleReverse} disabled={reversing || !reverseReason.trim()} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: reversing || !reverseReason.trim() ? 0.5 : 1 }}>
              {reversing ? <><div className="spinner spinner-sm spinner-light" /> Reversing…</> : 'Confirm reversal'}
            </button>
          </>}>
          <SummaryTable rows={[
            { label: 'Reference',     value: showReverseModal.reference || showReverseModal.id.slice(0, 8), mono: true },
            { label: 'Student',       value: showReverseModal.students ? `${showReverseModal.students.first_name} ${showReverseModal.students.last_name}` : '—' },
            { label: 'Parent',        value: showReverseModal.customers ? `${showReverseModal.customers.first_name} ${showReverseModal.customers.last_name}` : '—' },
            { label: 'Campaign',      value: showReverseModal.campaigns?.name || '—' },
            { label: 'Gross paid',    value: formatUGX(showReverseModal.gross_amount || showReverseModal.amount), color: C.green },
            { label: 'Net to school', value: formatUGX(showReverseModal.net_to_school || showReverseModal.amount), color: C.red },
          ]} />
          <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
            This will credit the full amount back to the parent's wallet and debit the school's Partna wallet. The transaction will be marked as reversed. This action is permanent and audit logged.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>Reason for reversal *</label>
            <textarea rows={3} value={reverseReason} onChange={e => { setReverseReason(e.target.value); setReverseError('') }}
              placeholder="e.g. Payment made for wrong student — parent requested correction"
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
            />
          </div>
          {reverseError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{reverseError}</div>}
        </Modal>
      )}

      {/* ── Reassignment modal ── */}
      {showReassignModal && (
        <Modal title="Reassign fee payment" onClose={closeReassign}
          footer={<>
            <button onClick={closeReassign} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleReassign} disabled={reassigning || !reassignStudent || !reassignReason.trim()} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: reassigning || !reassignStudent || !reassignReason.trim() ? 0.5 : 1 }}>
              {reassigning ? <><div className="spinner spinner-sm spinner-light" /> Reassigning…</> : 'Confirm reassignment'}
            </button>
          </>}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Currently assigned to</p>
            <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>
                {showReassignModal.students ? `${showReassignModal.students.first_name} ${showReassignModal.students.last_name}` : 'Unknown student'}
              </p>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>
                {showReassignModal.students?.partna_student_id} · {showReassignModal.students?.year_group || '—'}
              </p>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>New student — enter Student ID number</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={reassignStudentId} onChange={e => { setReassignStudentId(e.target.value.toUpperCase()); setReassignLookupError(''); setReassignStudent(null) }} onKeyDown={e => e.key === 'Enter' && handleReassignLookup()}
                placeholder="PTN-ST-00001 or school ID"
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', borderColor: reassignLookupError ? C.red : C.grayLine }}
                onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = reassignLookupError ? C.red : C.grayLine}
              />
              <button onClick={handleReassignLookup} disabled={reassignLookingUp || !reassignStudentId.trim()} style={{ ...btnPrimary, opacity: reassignLookingUp || !reassignStudentId.trim() ? 0.5 : 1 }}>
                {reassignLookingUp ? <div className="spinner spinner-sm spinner-light" /> : 'Find'}
              </button>
            </div>
            {reassignLookupError && <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '4px 0 0' }}>{reassignLookupError}</p>}
            <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>Exact match only — enter the full Partna Student ID or school student ID.</p>
          </div>
          {reassignStudent && (
            <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{reassignStudent.first_name} {reassignStudent.last_name}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{reassignStudent.partna_student_id} · {reassignStudent.year_group || '—'}</p>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>Reason for reassignment *</label>
            <textarea rows={3} value={reassignReason} onChange={e => { setReassignReason(e.target.value); setReassignError('') }}
              placeholder="e.g. Payment was linked to wrong sibling — correct student is above"
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
            />
          </div>
          {reassignError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{reassignError}</div>}
          <div style={{ background: C.bgOrange, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
            This updates which student this payment is attributed to. No money is moved — wallet balances are unchanged. This action is permanent and audit logged.
          </div>
        </Modal>
      )}

      {/* ── Confirm customer withdrawal modal ── */}
      {confirmId && (
        <Modal title="Mark withdrawal as completed?" onClose={() => setConfirmId(null)}
          footer={<>
            <button onClick={() => setConfirmId(null)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={() => handleMarkCompleted(confirmId)} disabled={markingId === confirmId} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: markingId === confirmId ? 0.75 : 1 }}>
              {markingId === confirmId ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Confirm'}
            </button>
          </>}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
            This confirms the mobile money disbursement has been processed. The customer will receive an SMS notification. This cannot be undone.
          </p>
        </Modal>
      )}

      {/* ── Confirm business withdrawal modal ── */}
      {bizConfirmId && (() => {
        const w = bizWithdrawals.find(t => t.id === bizConfirmId)
        const method = parseWithdrawalMethod(w)
        return (
          <Modal title="Mark withdrawal as processed?" onClose={() => setBizConfirmId(null)}
            footer={<>
              <button onClick={() => setBizConfirmId(null)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={() => handleBizMarkCompleted(bizConfirmId)} disabled={bizMarkingId === bizConfirmId} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: bizMarkingId === bizConfirmId ? 0.75 : 1 }}>
                {bizMarkingId === bizConfirmId ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Mark processed'}
              </button>
            </>}>
            <SummaryTable rows={[
              { label: 'Business',        value: w?.businesses?.name },
              { label: 'Amount',          value: formatUGX(w?.amount), color: C.red },
              { label: 'Method',          value: method },
              { label: 'Account name',    value: w?.withdrawal_account_name   || '—' },
              { label: 'Account number',  value: w?.withdrawal_account_number || '—' },
              ...(w?.withdrawal_notify_phone ? [{ label: 'Notify phone', value: w.withdrawal_notify_phone }] : []),
            ]} />
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>Confirm that payment has been sent. This action cannot be undone.</p>
          </Modal>
        )
      })()}

      {/* ── Tab bar + export ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: tab === t.id ? C.black : 'transparent', color: tab === t.id ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'corrections' && (
          <button onClick={tab === 'customer' ? exportCustomerCSV : exportBizCSV} style={btnSecondary}>
            ↓ Export CSV
          </button>
        )}
      </div>

      {/* ══════════════ CUSTOMER TAB ══════════════ */}
      {tab === 'customer' && (
        <>
          {loadingCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StatCard label="Shown"               value={filteredCustomer.length}      accentColor={C.blue}   />
                <StatCard label="Total deposits"      value={formatUGX(totalDeposits)}    accentColor={C.green}  />
                <StatCard label="Total withdrawals"   value={formatUGX(totalWithdrawals)} accentColor={C.red}    />
                <StatCard label="Pending withdrawals" value={pendingCustW.length}          accentColor={pendingCustW.length > 0 ? C.orange : C.grayMid} />
              </div>

              {pendingCustW.length > 0 && !filterStatus && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{pendingCustW.length} pending customer withdrawal{pendingCustW.length > 1 ? 's' : ''} require processing</span>
                  </div>
                  <button onClick={() => { setFilterStatus('pending'); setFilterType('withdrawal') }} style={{ ...btnDanger, padding: '6px 12px', fontSize: 12 }}>Show pending</button>
                </div>
              )}

              {selectedCust.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: C.black, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{selectedCust.size} withdrawal{selectedCust.size > 1 ? 's' : ''} selected</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedCust(new Set())} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Clear</button>
                    <button onClick={exportCustOpenFloat} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}>↓ Download OpenFloat file</button>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input type="text" placeholder="Search by name or reference…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0 }}>✕</button>}
                </div>
                <select style={selectStyle} value={filterBusiness} onChange={e => setFilterBusiness(e.target.value)}>
                  <option value="">All businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select style={selectStyle} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="payment">Payment</option>
                </select>
                <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                <input type="date" style={selectStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span style={{ alignSelf: 'center', color: C.grayMid }}>—</span>
                <input type="date" style={selectStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                {hasCustomerFilters && <button onClick={() => { setSearch(''); setFilterBusiness(''); setFilterType(''); setFilterStatus(''); setDateFrom(''); setDateTo('') }} style={btnGhost}>Clear</button>}
              </div>

              {/* Table */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                        <th style={{ padding: '10px 14px', width: 40 }}>
                          <input type="checkbox" checked={allCustSelected} onChange={toggleAllCust} style={{ cursor: 'pointer' }} />
                        </th>
                        {[['Reference', 'reference'], ['Customer', 'customer'], ['Business', 'business'], ['Type', 'type'], ['Amount', 'amount'], ['Status', 'status'], ['Date', 'created_at']].map(([label, col]) => (
                          <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{label} <SC col={col} /></span>
                          </th>
                        ))}
                        <th style={{ padding: '10px 14px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomer.length === 0
                        ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No transactions found</td></tr>
                        : filteredCustomer.map((t, i) => {
                          const { bg, color } = txIconBg(t.type)
                          const isSelected = selectedCust.has(t.id)
                          return (
                            <tr key={t.id} style={{ borderBottom: i < filteredCustomer.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: isSelected ? 'rgba(133,160,197,0.06)' : i % 2 === 0 ? C.white : C.bg }}>
                              <td style={{ padding: '11px 14px' }}>
                                {t.type === 'withdrawal' && <input type="checkbox" checked={isSelected} onChange={() => toggleCust(t.id)} style={{ cursor: 'pointer' }} />}
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>{t.reference || t.id.slice(0, 8)}</span>
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.customers?.first_name} {t.customers?.last_name}</p>
                                <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{t.customers?.phone}</p>
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{t.customers?.businesses?.name || '—'}</td>
                              <td style={{ padding: '11px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      {t.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                                    </svg>
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: C.black, textTransform: 'capitalize' }}>{t.type}</span>
                                </div>
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: txAmountColor(t.type), whiteSpace: 'nowrap' }}>
                                {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                              </td>
                              <td style={{ padding: '11px 14px' }}><Badge value={t.status} cfg={statusCfg(t.status)} /></td>
                              <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDateTime(t.created_at)}</td>
                              <td style={{ padding: '11px 14px' }}>
                                {t.type === 'withdrawal' && t.status === 'pending' && (
                                  <button onClick={() => setConfirmId(t.id)} style={{ ...btnSuccess, padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>✓ Mark completed</button>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ BUSINESS TAB ══════════════ */}
      {tab === 'business' && (
        <>
          {loadingBiz ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StatCard label="Total requests"  value={bizWithdrawals.length} accentColor={C.blue} />
                <StatCard label="Total requested" value={formatUGX(bizWithdrawals.reduce((s, t) => s + Number(t.amount), 0))} accentColor={C.red} />
                <StatCard label="Total completed" value={formatUGX(bizWithdrawals.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0))} accentColor={C.green} />
                <StatCard label="Pending" value={pendingBizW.length} accentColor={pendingBizW.length > 0 ? C.orange : C.grayMid} />
              </div>

              {pendingBizW.length > 0 && !bizFilterStatus && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{pendingBizW.length} business withdrawal{pendingBizW.length > 1 ? 's' : ''} pending processing</span>
                  <button onClick={() => setBizFilterStatus('pending')} style={{ ...btnDanger, padding: '6px 12px', fontSize: 12 }}>Show pending</button>
                </div>
              )}

              {selectedBiz.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: C.black, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{selectedBiz.size} withdrawal{selectedBiz.size > 1 ? 's' : ''} selected</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedBiz(new Set())} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Clear</button>
                    <button onClick={exportBizOpenFloat} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}>↓ Download OpenFloat file</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input type="text" placeholder="Search by business or notes…" value={bizSearch} onChange={e => setBizSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  {bizSearch && <button onClick={() => setBizSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0 }}>✕</button>}
                </div>
                <select style={selectStyle} value={bizFilterBusiness} onChange={e => setBizFilterBusiness(e.target.value)}>
                  <option value="">All businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select style={selectStyle} value={bizFilterStatus} onChange={e => setBizFilterStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
                <input type="date" style={selectStyle} value={bizDateFrom} onChange={e => setBizDateFrom(e.target.value)} />
                <span style={{ alignSelf: 'center', color: C.grayMid }}>—</span>
                <input type="date" style={selectStyle} value={bizDateTo} onChange={e => setBizDateTo(e.target.value)} />
                {hasBizFilters && <button onClick={() => { setBizSearch(''); setBizFilterBusiness(''); setBizFilterStatus(''); setBizDateFrom(''); setBizDateTo('') }} style={btnGhost}>Clear</button>}
              </div>

              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                        <th style={{ padding: '10px 14px', width: 40 }}>
                          <input type="checkbox" checked={allBizSelected} onChange={toggleAllBiz} style={{ cursor: 'pointer' }} />
                        </th>
                        {['Business', 'Amount', 'Method', 'Account details', 'Status', 'Requested', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBiz.length === 0
                        ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No withdrawal requests found</td></tr>
                        : filteredBiz.map((t, i) => {
                          const method = parseWithdrawalMethod(t)
                          const isSelected = selectedBiz.has(t.id)
                          const isMobile = method === 'MTN MoMo' || method === 'Airtel Money'
                          return (
                            <tr key={t.id} style={{ borderBottom: i < filteredBiz.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: isSelected ? 'rgba(133,160,197,0.06)' : i % 2 === 0 ? C.white : C.bg }}>
                              <td style={{ padding: '11px 14px' }}><input type="checkbox" checked={isSelected} onChange={() => toggleBiz(t.id)} style={{ cursor: 'pointer' }} /></td>
                              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.black }}>{t.businesses?.name || '—'}</td>
                              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.red, whiteSpace: 'nowrap' }}>{formatUGX(t.amount)}</td>
                              <td style={{ padding: '11px 14px' }}>
                                <Badge value={method} cfg={isMobile ? { bg: C.bgOrange, color: C.orange } : { bg: C.grayLight, color: C.grayMid }} />
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.withdrawal_account_name || '—'}</p>
                                <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{t.withdrawal_account_number || ''}</p>
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <Badge value={t.status === 'completed' ? 'Processed' : 'Pending'} cfg={statusCfg(t.status === 'completed' ? 'completed' : 'pending')} />
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDateTime(t.created_at)}</td>
                              <td style={{ padding: '11px 14px' }}>
                                {t.status === 'pending' && <button onClick={() => setBizConfirmId(t.id)} style={{ ...btnSuccess, padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>✓ Mark processed</button>}
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ FEE PAYMENT CORRECTIONS TAB ══════════════ */}
      {tab === 'corrections' && (
        <>
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
            <strong style={{ color: C.black }}>Reverse</strong> a payment to return funds to the parent's wallet and debit the school's wallet. Use when a payment was made in error or a parent requests a refund.{' '}
            <strong style={{ color: C.black }}>Reassign</strong> a payment to link it to the correct student without moving any money. Use when a payment was linked to the wrong child. All actions are permanently audit logged.
          </div>

          {loadingFee ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatCard label="Total fee payments" value={feePayments.length}                               accentColor={C.blue}   />
                <StatCard label="Completed"          value={feePayments.filter(t => t.status === 'completed').length} accentColor={C.green}  />
                <StatCard label="Reversed"           value={feePayments.filter(t => t.status === 'reversed').length}  accentColor={C.red}    />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input type="text" placeholder="Search by student name, parent, Partna ID or reference…" value={feeSearch} onChange={e => setFeeSearch(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  {feeSearch && <button onClick={() => setFeeSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 0 }}>✕</button>}
                </div>
                <select style={selectStyle} value={feeFilterBusiness} onChange={e => setFeeFilterBusiness(e.target.value)}>
                  <option value="">All schools</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="date" style={selectStyle} value={feeDateFrom} onChange={e => setFeeDateFrom(e.target.value)} />
                <span style={{ alignSelf: 'center', color: C.grayMid }}>—</span>
                <input type="date" style={selectStyle} value={feeDateTo} onChange={e => setFeeDateTo(e.target.value)} />
                {hasFeeFilters && <button onClick={() => { setFeeSearch(''); setFeeFilterBusiness(''); setFeeDateFrom(''); setFeeDateTo('') }} style={btnGhost}>Clear</button>}
              </div>

              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                        {['Reference', 'Student', 'Parent', 'School', 'Campaign', 'Date', 'Gross', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFee.length === 0
                        ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No fee payments found</td></tr>
                        : filteredFee.map((t, i) => (
                          <tr key={t.id} style={{ borderBottom: i < filteredFee.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>{t.reference || t.id.slice(0, 8)}</span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              {t.students ? (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.students.first_name} {t.students.last_name}</p>
                                  <p style={{ fontSize: 10, fontWeight: 600, color: C.green, margin: 0, fontFamily: 'monospace' }}>{t.students.partna_student_id}</p>
                                </>
                              ) : <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary, fontStyle: 'italic' }}>No student</span>}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              {t.customers ? (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{t.customers.first_name} {t.customers.last_name}</p>
                                  <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{t.customers.phone}</p>
                                </>
                              ) : <span style={{ fontSize: 12, color: C.secondary }}>—</span>}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary }}>{t.customers?.businesses?.name || '—'}</td>
                            <td style={{ padding: '11px 14px' }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: C.black, margin: '0 0 2px' }}>{t.campaigns?.name || '—'}</p>
                              {t.campaigns?.term_or_semester && <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0 }}>{t.campaigns.term_or_semester}</p>}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDateTime(t.created_at)}</td>
                            <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>{formatUGX(t.gross_amount || t.amount)}</td>
                            <td style={{ padding: '11px 14px' }}><Badge value={t.status} cfg={statusCfg(t.status)} /></td>
                            <td style={{ padding: '11px 14px' }}>
                              {t.status !== 'reversed' ? (
                                <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                                  <button onClick={() => { setShowReassignModal(t); setReassignStudentId(''); setReassignStudent(null); setReassignReason(''); setReassignError(''); setReassignLookupError('') }} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 12 }}>↔ Reassign</button>
                                  <button onClick={() => { setShowReverseModal(t); setReverseReason(''); setReverseError('') }} style={{ ...btnDanger, padding: '5px 10px', fontSize: 12 }}>↩ Reverse</button>
                                </div>
                              ) : <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary, fontStyle: 'italic' }}>Reversed</span>}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
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