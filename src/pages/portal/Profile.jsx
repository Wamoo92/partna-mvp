import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function maskNin(nin) {
  if (!nin) return 'Not provided'
  return '•'.repeat(Math.max(0, nin.length - 4)) + nin.slice(-4)
}
function maskNumber(number) {
  if (!number) return '—'
  const clean = number.replace(/\s+/g, '')
  return clean.slice(0, 4) + ' •••• ' + clean.slice(-3)
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

// ── Shared sub-components ──────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
    </p>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

function InfoRow({ label, value, last, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: last ? 'none' : `1px solid ${C.grayLine}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{label}</span>
      {children || <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{value}</span>}
    </div>
  )
}

function ActionRow({ label, sublabel, onClick, danger, last }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: last ? 'none' : `1px solid ${C.grayLine}`,
        cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.bg}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: danger ? C.red : C.black, margin: '0 0 2px' }}>{label}</p>
        {sublabel && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{sublabel}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Leave campaign modal ───────────────────────────────────────────────────
function LeaveModal({ enrollment, leaveFee, leaveLoading, leaveSuccess, onConfirm, onClose }) {
  if (!enrollment) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0 }}>{leaveSuccess ? 'Campaign left' : 'Leave campaign'}</p>
          {!leaveSuccess && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.grayMid }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {leaveSuccess ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>You have left {enrollment.campaigns?.name}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                  Your refund of <strong style={{ color: C.black }}>{formatUGX(leaveFee?.refund || 0)}</strong> will be sent to your registered mobile money number within 5 working days.
                </p>
              </div>
              <button onClick={onClose} style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Done</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                You are leaving <strong style={{ color: C.black }}>{enrollment.campaigns?.name}</strong>. Your savings balance will be refunded minus a 10% early exit fee.
              </p>
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                {[
                  { label: 'Current balance',      value: formatUGX(leaveFee?.gross || 0) },
                  { label: 'Early exit fee (10%)', value: '− ' + formatUGX(leaveFee?.fee || 0), color: C.red },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${C.grayLine}`, background: i % 2 === 0 ? C.white : C.bg }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.black }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>You receive</span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: C.green, letterSpacing: '-0.5px' }}>{formatUGX(leaveFee?.refund || 0)}</span>
                </div>
              </div>
              <div style={{ background: C.bgOrange, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
                Refund within <strong>5 working days</strong> to your registered mobile money number. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
                <button onClick={onConfirm} disabled={leaveLoading} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 10, cursor: leaveLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: leaveLoading ? 0.75 : 1 }}>
                  {leaveLoading ? <><div className="spinner spinner-sm spinner-light" /> Processing…</> : 'Leave campaign'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Delete account modal ───────────────────────────────────────────────────
function DeleteModal({ enrollments, deleteSummary, deleteLoading, deleteSuccess, onConfirm, onClose, calcRefund }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0 }}>{deleteSuccess ? 'Account deleted' : 'Delete account'}</p>
          {!deleteSuccess && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.grayMid }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {deleteSuccess ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Your account has been deleted</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                  {deleteSummary?.totalRefund > 0
                    ? `Your refund of ${formatUGX(deleteSummary.totalRefund)} will be sent to your registered mobile money number within 5 working days.`
                    : 'No balance to refund. You have been signed out.'}
                </p>
              </div>
              <button onClick={onClose} style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Done</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                Deleting your account will unenrol you from <strong style={{ color: C.black }}>all {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''}</strong> and permanently deactivate your account. All balances will be refunded minus a 10% fee per campaign.
              </p>
              {enrollments.length > 0 && (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: C.black }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Refund breakdown</p>
                  </div>
                  {enrollments.map((e, i) => {
                    const bal = Number(e.wallets?.balance || 0)
                    const { fee, refund } = calcRefund(bal)
                    return (
                      <div key={e.id} style={{ padding: '10px 14px', borderBottom: i < enrollments.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{e.campaigns?.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{formatUGX(refund)}</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>Balance {formatUGX(bal)} − fee {formatUGX(fee)}</p>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.black }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>Total refund</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: C.green, letterSpacing: '-0.5px' }}>{formatUGX(deleteSummary?.totalRefund || 0)}</span>
                  </div>
                </div>
              )}
              <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
                This action is <strong>permanent and cannot be undone.</strong> Your account and all data will be deactivated. Refund within 5 working days.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
                <button onClick={onConfirm} disabled={deleteLoading} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: deleteLoading ? 0.75 : 1 }}>
                  {deleteLoading ? <><div className="spinner spinner-sm spinner-light" /> Processing…</> : 'Delete account'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Profile({
 customer, signOut }) {
  useEffect(() => { document.title = 'Profile - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()

  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)

  const [showPinForm, setShowPinForm]   = useState(false)
  const [currentPin, setCurrentPin]     = useState('')
  const [newPin, setNewPin]             = useState('')
  const [confirmPin, setConfirmPin]     = useState('')
  const [pinError, setPinError]         = useState('')
  const [pinSuccess, setPinSuccess]     = useState(false)
  const [changingPin, setChangingPin]   = useState(false)

  const [showLeave, setShowLeave]       = useState(null)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState(false)
  const [leaveFee, setLeaveFee]         = useState(null)

  const [showDelete, setShowDelete]       = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState(null)

  useEffect(() => { if (customer) loadData() }, [customer])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await supabase.from('customer_campaigns').select('*, campaigns(*), wallets(*)').eq('customer_id', customer.id).eq('status', 'active').order('enrolled_at', { ascending: true })
      setEnrollments(data || [])
    } catch (e) { console.error('Profile load error:', e) }
    setLoading(false)
  }

  function calcRefund(balance) {
    const gross = Number(balance)
    const fee   = Math.round(gross * 0.10)
    return { gross, fee, refund: Math.max(0, gross - fee) }
  }

  function openLeaveModal(enrollment) {
    const { gross, fee, refund } = calcRefund(enrollment.wallets?.balance || 0)
    setLeaveFee({ gross, fee, refund }); setShowLeave(enrollment); setLeaveSuccess(false)
  }

  function openDeleteModal() {
    let totalGross = 0, totalFee = 0
    for (const e of enrollments) { const bal = Number(e.wallets?.balance || 0); totalGross += bal; totalFee += Math.round(bal * 0.10) }
    setDeleteSummary({ totalGross, totalFee, totalRefund: Math.max(0, totalGross - totalFee) }); setShowDelete(true); setDeleteSuccess(false)
  }

  async function handleLeaveCampaign() {
    if (!showLeave) return
    setLeaveLoading(true)
    try {
      const wallet = showLeave.wallets; const balance = Number(wallet?.balance || 0); const { fee, refund } = calcRefund(balance)
      await supabase.from('customer_campaigns').update({ status: 'left', left_at: new Date().toISOString() }).eq('id', showLeave.id)
      if (wallet) await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
      if (balance > 0) {
        await supabase.from('transactions').insert({ customer_id: customer.id, wallet_id: wallet?.id || null, campaign_id: showLeave.campaign_id, type: 'withdrawal', amount: balance, status: 'pending', notes: `Campaign left — refund pending. Fee deducted: UGX ${fee.toLocaleString()}. Net refund: UGX ${refund.toLocaleString()}` })
        await supabase.from('transaction_fees').insert({ customer_id: customer.id, fee_type: 'leave_campaign', charged_to: 'user', partna_fee: fee, carrier_fee: 0, tax: 0, total_fees: fee, net_amount: refund })
      }
      setLeaveSuccess(true); await loadData()
    } catch (e) { console.error('Leave campaign error:', e) }
    setLeaveLoading(false)
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    try {
      for (const enrollment of enrollments) {
        const wallet = enrollment.wallets; const balance = Number(wallet?.balance || 0); const { fee, refund } = calcRefund(balance)
        await supabase.from('customer_campaigns').update({ status: 'left', left_at: new Date().toISOString() }).eq('id', enrollment.id)
        if (wallet) await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
        if (balance > 0) {
          await supabase.from('transactions').insert({ customer_id: customer.id, wallet_id: wallet?.id || null, campaign_id: enrollment.campaign_id, type: 'withdrawal', amount: balance, status: 'pending', notes: `Account deleted — refund pending. Fee: UGX ${fee.toLocaleString()}. Net: UGX ${refund.toLocaleString()}` })
          await supabase.from('transaction_fees').insert({ customer_id: customer.id, fee_type: 'delete_account', charged_to: 'user', partna_fee: fee, carrier_fee: 0, tax: 0, total_fees: fee, net_amount: refund })
        }
      }
      await supabase.from('customers').update({ registration_status: 'deleted' }).eq('id', customer.id)
      if (customer?.phone) await sendSMS(customer.id, customer.phone, 'account_deleted', {})
      await supabase.auth.signOut(); setDeleteSuccess(true)
    } catch (e) { console.error('Delete account error:', e) }
    setDeleteLoading(false)
  }

  async function handleChangePin() {
    setPinError(''); setPinSuccess(false)
    if (!currentPin || currentPin.length !== 4) { setPinError('Enter your current 4-digit PIN.'); return }
    if (!newPin || newPin.length !== 4)          { setPinError('New PIN must be 4 digits.'); return }
    if (newPin !== confirmPin)                    { setPinError('New PINs do not match.'); return }
    if (newPin === currentPin)                    { setPinError('New PIN must be different from current PIN.'); return }
    setChangingPin(true)
    try {
      const cleanPhone = customer.phone.replace(/\s+/g, '')
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: customer.email, password: `pin-${currentPin}-${cleanPhone}` })
      if (signInError) { setPinError('Current PIN is incorrect.'); setChangingPin(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: `pin-${newPin}-${cleanPhone}` })
      if (updateError) { setPinError('Could not update PIN. Please try again.'); setChangingPin(false); return }
      if (customer?.phone) sendSMS(customer.id, customer.phone, 'pin_changed', {})
      setPinSuccess(true); setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setTimeout(() => { setShowPinForm(false); setPinSuccess(false) }, 2000)
    } catch (e) { setPinError('Something went wrong. Please try again.') }
    setChangingPin(false)
  }

  const kycVerified      = customer?.kyc_status === 'verified'
  const hasPaymentSource = !!(customer?.payment_network && customer?.payment_number)
  const totalBalance     = enrollments.reduce((s, e) => s + Number(e.wallets?.balance || 0), 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const inputStyle = { display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', letterSpacing: '0.5em', fontSize: 22, fontWeight: 600 }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Modals ── */}
      {showLeave && <LeaveModal enrollment={showLeave} leaveFee={leaveFee} leaveLoading={leaveLoading} leaveSuccess={leaveSuccess} onConfirm={handleLeaveCampaign} onClose={() => { setShowLeave(null); setLeaveSuccess(false) }} />}
      {showDelete && <DeleteModal enrollments={enrollments} deleteSummary={deleteSummary} deleteLoading={deleteLoading} deleteSuccess={deleteSuccess} onConfirm={handleDeleteAccount} calcRefund={calcRefund} onClose={() => { setShowDelete(false); if (deleteSuccess) navigate('/portal') }} />}

      {/* ── Topbar ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/portal/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 24, width: 'auto' }} />
            : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>Profile</span>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: C.black, padding: '28px 20px 32px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        {/* Avatar */}
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.labelBg, border: `2px solid rgba(255,255,255,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, color: C.black }}>
          {customer?.first_name?.[0]}{customer?.last_name?.[0]}
        </div>
        <div>
          <p style={{ fontSize: 20, fontWeight: 600, color: C.white, letterSpacing: '-0.5px', margin: '0 0 4px' }}>
            {customer?.first_name} {customer?.other_names ? customer.other_names + ' ' : ''}{customer?.last_name}
          </p>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>{customer?.phone}</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.30)', margin: 0 }}>{customer?.email}</p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, marginTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
            {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''} · {formatUGX(totalBalance)} saved
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Account details */}
        <div>
          <SectionLabel>Account details</SectionLabel>
          <Card>
            {[
              { label: 'First name',        value: customer?.first_name },
              { label: 'Last name',         value: customer?.last_name  },
              ...(customer?.other_names ? [{ label: 'Other names', value: customer.other_names }] : []),
              { label: 'Phone',             value: customer?.phone      },
              { label: 'Email',             value: customer?.email      },
              { label: 'National ID (NIN)', value: maskNin(customer?.nin) },
            ].map((item, i, arr) => (
              <InfoRow key={i} label={item.label} value={item.value} last={i === arr.length - 1} />
            ))}
            {/* KYC row */}
            <button
              onClick={() => !kycVerified && navigate('/portal/kyc')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', borderTop: `1px solid ${C.grayLine}`, cursor: kycVerified ? 'default' : 'pointer' }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>KYC status</span>
              {kycVerified
                ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '3px 10px' }}>Verified</span>
                : <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 6, padding: '3px 10px' }}>Pending — tap to verify</span>
              }
            </button>
          </Card>
        </div>

        {/* Payment source */}
        <div>
          <SectionLabel>Payment source</SectionLabel>
          <Card>
            {hasPaymentSource ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={customer.payment_network === 'mtn' ? '/mtn-logo.svg' : '/airtel-logo.svg'} alt={customer.payment_network} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{customer.payment_network === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{maskNumber(customer.payment_number)}</p>
                  </div>
                </div>
                <button onClick={() => navigate('/portal/payment-source')} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Edit</button>
              </div>
            ) : (
              <ActionRow label="No payment source added" sublabel="Tap to add a mobile money number" onClick={() => navigate('/portal/payment-source')} danger last />
            )}
          </Card>
        </div>

        {/* My campaigns */}
        <div>
          <SectionLabel>My campaigns</SectionLabel>
          <Card>
            {enrollments.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>You are not enrolled in any campaigns.</p>
              </div>
            ) : enrollments.map((e, idx) => {
              const camp      = e.campaigns
              const bal       = Number(e.wallets?.balance || 0)
              const target    = Number(camp?.target_amount || 0)
              const pct       = target > 0 ? Math.min((bal / target) * 100, 100) : 0
              const remaining = Math.max(target - bal, 0)
              return (
                <div key={e.id} style={{ padding: '16px', borderBottom: idx < enrollments.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>{camp?.name || '—'}</p>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '2px 8px' }}>{e.draw_code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{pct.toFixed(0)}% saved</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{formatUGX(bal)} of {formatUGX(target)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: C.grayLight, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct >= 75 ? C.green : pct >= 50 ? C.orange : C.blue, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>
                      {formatUGX(remaining)} remaining{camp?.target_date ? ' · ' + new Date(camp.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                    <button onClick={() => openLeaveModal(e)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Leave</button>
                  </div>
                </div>
              )
            })}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.grayLine}` }}>
              <button onClick={() => navigate('/portal/select-campaign')} style={{ width: '100%', padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }}>
                + Add another campaign
              </button>
            </div>
          </Card>
        </div>

        {/* Account actions */}
        <div>
          <SectionLabel>Account</SectionLabel>
          <Card>
            <ActionRow label="View my card"  onClick={() => navigate('/portal/card')} />
            <ActionRow label="Change PIN"    onClick={() => { setShowPinForm(f => !f); setPinError(''); setPinSuccess(false) }} last={!showPinForm} />
            {showPinForm && (
              <div style={{ padding: 16, borderTop: `1px solid ${C.grayLine}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pinSuccess && <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>PIN changed successfully!</div>}
                {pinError   && <div style={{ background: C.bgRed,   borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red   }}>{pinError}</div>}
                {[
                  { label: 'Current PIN',     value: currentPin, setter: setCurrentPin },
                  { label: 'New PIN',         value: newPin,     setter: setNewPin     },
                  { label: 'Confirm new PIN', value: confirmPin, setter: setConfirmPin },
                ].map((field, i) => (
                  <div key={i}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>{field.label}</label>
                    <input
                      type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                      value={field.value} onChange={e => field.setter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.black}
                      onBlur={e => e.target.style.borderColor = C.grayLine}
                    />
                  </div>
                ))}
                <button
                  onClick={handleChangePin} disabled={changingPin}
                  style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: changingPin ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif', opacity: changingPin ? 0.75 : 1 }}
                >
                  {changingPin ? <><div className="spinner spinner-sm spinner-light" /> Updating…</> : 'Update PIN'}
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Log out */}
        <button
          onClick={() => { signOut(); navigate('/portal') }}
          style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Log out
        </button>

        {/* Danger zone */}
        <div>
          <SectionLabel>Danger zone</SectionLabel>
          <Card>
            <ActionRow label="Delete my account" sublabel="Permanently deactivate your account and refund all balances" onClick={openDeleteModal} danger last />
          </Card>
        </div>

      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`, zIndex: 100 }}>
        {[
          { label: 'Home',    path: '/portal/home'         },
          { label: 'Card',    path: '/portal/card'         },
          { label: 'History', path: '/portal/transactions' },
          { label: 'Profile', path: '/portal/profile'      },
        ].map(({ label, path }) => {
          const active = path === '/portal/profile'
          return (
            <button key={path} onClick={() => navigate(path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.black : C.grayMid} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                {label === 'Home'    && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
                {label === 'Card'    && <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>}
                {label === 'History' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>}
                {label === 'Profile' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>}
              </svg>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? C.black : C.grayMid }}>{label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}