import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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

// ── Shared info row ────────────────────────────────────────────────────────
function InfoRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-3) var(--space-4)',
      borderBottom: last ? 'none' : '1.5px solid var(--color-grey-light)',
      background: 'var(--color-white)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-black)' }}>
        {value}
      </span>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-black)',
        letterSpacing: 'var(--tracking-widest)',
        textTransform: 'uppercase',
        color: 'var(--color-grey)',
        marginBottom: 'var(--space-2)',
        paddingLeft: 'var(--space-1)',
      }}>
        {title}
      </div>
      <div style={{ border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', background: 'var(--color-white)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Action row (arrow link) ────────────────────────────────────────────────
function ActionRow({ label, sublabel, onClick, danger, last, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4)',
        background: 'none',
        border: 'none',
        borderBottom: last ? 'none' : '1.5px solid var(--color-grey-light)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color var(--transition-fast)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {icon && (
          <div style={{
            width: 32, height: 32,
            background: danger ? 'var(--color-red)' : 'var(--color-grey-light)',
            border: 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span className="icon-outlined" style={{ fontSize: 16, color: 'var(--color-black)' }}>{icon}</span>
          </div>
        )}
        <div>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: danger ? '#C0392B' : 'var(--color-black)',
          }}>
            {label}
          </div>
          {sublabel && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
              {sublabel}
            </div>
          )}
        </div>
      </div>
      <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey-mid)' }}>
        arrow_forward
      </span>
    </button>
  )
}

// ── Leave campaign modal ───────────────────────────────────────────────────
function LeaveModal({ enrollment, leaveFee, leaveLoading, leaveSuccess, onConfirm, onClose }) {
  if (!enrollment) return null
  return (
    <div className="modal-backdrop">
      <div className="modal modal-sm">
        <div className="modal-header" style={{ background: leaveSuccess ? '#2D8B45' : '#C0392B' }}>
          <span className="modal-title">
            {leaveSuccess ? 'Campaign left' : 'Leave campaign'}
          </span>
          {!leaveSuccess && (
            <button onClick={onClose} className="modal-close">
              <span className="icon-outlined icon-sm">close</span>
            </button>
          )}
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {leaveSuccess ? (
            <>
              <div style={{
                width: 56, height: 56,
                background: 'var(--color-green)',
                border: 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>
                <span className="icon-outlined" style={{ fontSize: 28 }}>check</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                  You have left {enrollment.campaigns?.name}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                  Your refund of <strong>{formatUGX(leaveFee?.refund || 0)}</strong> will be sent to your
                  registered mobile money number within 5 working days.
                </div>
              </div>
              <button onClick={onClose} className="btn btn-black btn-full btn-lg">Done</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                You are leaving <strong style={{ color: 'var(--color-black)' }}>{enrollment.campaigns?.name}</strong>.
                Your savings balance will be refunded minus a 10% early exit fee.
                You will remain registered and can join another campaign.
              </p>

              <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                {[
                  { label: 'Current balance',      value: formatUGX(leaveFee?.gross || 0) },
                  { label: 'Early exit fee (10%)', value: '− ' + formatUGX(leaveFee?.fee || 0), color: '#C0392B' },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1.5px solid var(--color-grey-light)',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: row.color || 'var(--color-black)' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-black)',
                }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>
                    You receive
                  </span>
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', color: 'var(--color-green)' }}>
                    {formatUGX(leaveFee?.refund || 0)}
                  </span>
                </div>
              </div>

              <div className="alert alert-warning">
                <span className="icon-outlined alert-icon">schedule</span>
                <div className="alert-content">
                  Refund within <strong>5 working days</strong> to your registered mobile money number.
                  This cannot be undone.
                </div>
              </div>

              <div className="modal-footer" style={{ padding: 0, border: 'none', gap: 'var(--space-3)' }}>
                <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button
                  onClick={onConfirm}
                  disabled={leaveLoading}
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                >
                  {leaveLoading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                    : 'Leave campaign'
                  }
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
    <div className="modal-backdrop">
      <div className="modal modal-sm">
        <div className="modal-header" style={{ background: deleteSuccess ? '#2D8B45' : 'var(--color-black)' }}>
          <span className="modal-title">{deleteSuccess ? 'Account deleted' : 'Delete account'}</span>
          {!deleteSuccess && (
            <button onClick={onClose} className="modal-close">
              <span className="icon-outlined icon-sm">close</span>
            </button>
          )}
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {deleteSuccess ? (
            <>
              <div style={{
                width: 56, height: 56,
                background: 'var(--color-green)',
                border: 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>
                <span className="icon-outlined" style={{ fontSize: 28 }}>check</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                  Your account has been deleted
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                  {deleteSummary?.totalRefund > 0
                    ? `Your refund of ${formatUGX(deleteSummary.totalRefund)} will be sent to your registered mobile money number within 5 working days.`
                    : 'No balance to refund. You have been signed out.'}
                </div>
              </div>
              <button onClick={onClose} className="btn btn-black btn-full btn-lg">Done</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Deleting your account will unenrol you from{' '}
                <strong style={{ color: 'var(--color-black)' }}>
                  all {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''}
                </strong>{' '}
                and permanently deactivate your account. All balances will be refunded minus a 10% fee per campaign.
              </p>

              {enrollments.length > 0 && (
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'var(--color-black)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-black)',
                    letterSpacing: 'var(--tracking-widest)',
                    textTransform: 'uppercase',
                    color: 'var(--color-white)',
                  }}>
                    Refund breakdown
                  </div>
                  {enrollments.map((e, i) => {
                    const bal = Number(e.wallets?.balance || 0)
                    const { fee, refund } = calcRefund(bal)
                    return (
                      <div key={e.id} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderBottom: i < enrollments.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                        background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                            {e.campaigns?.name}
                          </span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: '#2D8B45' }}>
                            {formatUGX(refund)}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                          Balance {formatUGX(bal)} − fee {formatUGX(fee)}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-black)',
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>
                      Total refund
                    </span>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', color: 'var(--color-green)' }}>
                      {formatUGX(deleteSummary?.totalRefund || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">warning</span>
                <div className="alert-content">
                  This action is <strong>permanent and cannot be undone.</strong> Your account and all
                  data will be deactivated. Refund within 5 working days.
                </div>
              </div>

              <div className="modal-footer" style={{ padding: 0, border: 'none', gap: 'var(--space-3)' }}>
                <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button
                  onClick={onConfirm}
                  disabled={deleteLoading}
                  className="btn btn-black"
                  style={{ flex: 1 }}
                >
                  {deleteLoading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-white)' }} /> Processing…</>
                    : 'Delete account'
                  }
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
export default function Profile({ customer, signOut }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)

  // PIN change
  const [showPinForm, setShowPinForm]   = useState(false)
  const [currentPin, setCurrentPin]     = useState('')
  const [newPin, setNewPin]             = useState('')
  const [confirmPin, setConfirmPin]     = useState('')
  const [pinError, setPinError]         = useState('')
  const [pinSuccess, setPinSuccess]     = useState(false)
  const [changingPin, setChangingPin]   = useState(false)

  // Leave campaign modal
  const [showLeave, setShowLeave]       = useState(null)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState(false)
  const [leaveFee, setLeaveFee]         = useState(null)

  // Delete account modal
  const [showDelete, setShowDelete]       = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState(null)

  useEffect(() => { if (customer) loadData() }, [customer])

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })
      setEnrollments(data || [])
    } catch (e) {
      console.error('Profile load error:', e)
    }
    setLoading(false)
  }

  function calcRefund(balance) {
    const gross = Number(balance)
    const fee   = Math.round(gross * 0.10)
    return { gross, fee, refund: Math.max(0, gross - fee) }
  }

  function openLeaveModal(enrollment) {
    const { gross, fee, refund } = calcRefund(enrollment.wallets?.balance || 0)
    setLeaveFee({ gross, fee, refund })
    setShowLeave(enrollment)
    setLeaveSuccess(false)
  }

  function openDeleteModal() {
    let totalGross = 0, totalFee = 0
    for (const e of enrollments) {
      const bal = Number(e.wallets?.balance || 0)
      totalGross += bal
      totalFee   += Math.round(bal * 0.10)
    }
    setDeleteSummary({ totalGross, totalFee, totalRefund: Math.max(0, totalGross - totalFee) })
    setShowDelete(true)
    setDeleteSuccess(false)
  }

  async function handleLeaveCampaign() {
    if (!showLeave) return
    setLeaveLoading(true)
    try {
      const wallet  = showLeave.wallets
      const balance = Number(wallet?.balance || 0)
      const { fee, refund } = calcRefund(balance)

      await supabase.from('customer_campaigns')
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('id', showLeave.id)

      if (wallet) await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)

      if (balance > 0) {
        await supabase.from('transactions').insert({
          customer_id: customer.id,
          wallet_id:   wallet?.id || null,
          campaign_id: showLeave.campaign_id,
          type:        'withdrawal',
          amount:      balance,
          status:      'pending',
          notes: `Campaign left — refund pending. Fee deducted: UGX ${fee.toLocaleString()}. Net refund: UGX ${refund.toLocaleString()}`,
        })
        await supabase.from('transaction_fees').insert({
          customer_id: customer.id,
          fee_type:    'leave_campaign',
          charged_to:  'user',
          partna_fee:  fee,
          carrier_fee: 0, tax: 0,
          total_fees:  fee,
          net_amount:  refund,
        })
      }

      setLeaveSuccess(true)
      await loadData()
    } catch (e) {
      console.error('Leave campaign error:', e)
    }
    setLeaveLoading(false)
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    try {
      for (const enrollment of enrollments) {
        const wallet  = enrollment.wallets
        const balance = Number(wallet?.balance || 0)
        const { fee, refund } = calcRefund(balance)

        await supabase.from('customer_campaigns')
          .update({ status: 'left', left_at: new Date().toISOString() })
          .eq('id', enrollment.id)

        if (wallet) await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)

        if (balance > 0) {
          await supabase.from('transactions').insert({
            customer_id: customer.id,
            wallet_id:   wallet?.id || null,
            campaign_id: enrollment.campaign_id,
            type:        'withdrawal',
            amount:      balance,
            status:      'pending',
            notes: `Account deleted — refund pending. Fee: UGX ${fee.toLocaleString()}. Net: UGX ${refund.toLocaleString()}`,
          })
          await supabase.from('transaction_fees').insert({
            customer_id: customer.id,
            fee_type:    'delete_account',
            charged_to:  'user',
            partna_fee:  fee,
            carrier_fee: 0, tax: 0,
            total_fees:  fee,
            net_amount:  refund,
          })
        }
      }

      await supabase.from('customers').update({ registration_status: 'deleted' }).eq('id', customer.id)

      // ── Send account_deleted SMS before signing out ────────────────
      if (customer?.phone) {
        await sendSMS(customer.id, customer.phone, 'account_deleted', {})
      }

      await supabase.auth.signOut()
      setDeleteSuccess(true)
    } catch (e) {
      console.error('Delete account error:', e)
    }
    setDeleteLoading(false)
  }

  async function handleChangePin() {
    setPinError('')
    setPinSuccess(false)
    if (!currentPin || currentPin.length !== 4) { setPinError('Enter your current 4-digit PIN.'); return }
    if (!newPin || newPin.length !== 4)          { setPinError('New PIN must be 4 digits.'); return }
    if (newPin !== confirmPin)                    { setPinError('New PINs do not match.'); return }
    if (newPin === currentPin)                    { setPinError('New PIN must be different from current PIN.'); return }

    setChangingPin(true)
    try {
      const cleanPhone  = customer.phone.replace(/\s+/g, '')
      const oldPassword = `pin-${currentPin}-${cleanPhone}`
      const newPassword = `pin-${newPin}-${cleanPhone}`
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: customer.email, password: oldPassword })
      if (signInError) { setPinError('Current PIN is incorrect.'); setChangingPin(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { setPinError('Could not update PIN. Please try again.'); setChangingPin(false); return }

      // ── Send pin_changed SMS ───────────────────────────────────────
      if (customer?.phone) {
        sendSMS(customer.id, customer.phone, 'pin_changed', {})
      }

      setPinSuccess(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setTimeout(() => { setShowPinForm(false); setPinSuccess(false) }, 2000)
    } catch (e) {
      setPinError('Something went wrong. Please try again.')
    }
    setChangingPin(false)
  }

  const kycVerified      = customer?.kyc_status === 'verified'
  const hasPaymentSource = !!(customer?.payment_network && customer?.payment_number)
  const totalBalance     = enrollments.reduce((s, e) => s + Number(e.wallets?.balance || 0), 0)

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Modals ── */}
      {showLeave && (
        <LeaveModal
          enrollment={showLeave}
          leaveFee={leaveFee}
          leaveLoading={leaveLoading}
          leaveSuccess={leaveSuccess}
          onConfirm={handleLeaveCampaign}
          onClose={() => { setShowLeave(null); setLeaveSuccess(false) }}
        />
      )}

      {showDelete && (
        <DeleteModal
          enrollments={enrollments}
          deleteSummary={deleteSummary}
          deleteLoading={deleteLoading}
          deleteSuccess={deleteSuccess}
          onConfirm={handleDeleteAccount}
          calcRefund={calcRefund}
          onClose={() => {
            setShowDelete(false)
            if (deleteSuccess) navigate('/portal')
          }}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        position: 'sticky', top: 0,
        zIndex: 'var(--z-sticky)',
      }}>
        <button
          onClick={() => navigate('/portal/home')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent',
            color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          Profile
        </div>
      </header>

      {/* ── Hero ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-8) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72,
          background: 'var(--color-primary)',
          border: '3px solid var(--color-white)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-black)',
          color: 'var(--color-black)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 100, 'opsz' 24",
        }}>
          {customer?.first_name?.[0]}{customer?.last_name?.[0]}
        </div>

        <div>
          <div style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 105, 'opsz' 24",
          }}>
            {customer?.first_name} {customer?.other_names ? customer.other_names + ' ' : ''}{customer?.last_name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            {customer?.phone}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
            {customer?.email}
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '6px var(--space-4)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.06)',
          marginTop: 'var(--space-1)',
        }}>
          <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-primary)' }}>savings</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.7)', letterSpacing: 'var(--tracking-wide)' }}>
            {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''} · {formatUGX(totalBalance)} saved
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}>

        {/* Account details */}
        <Section title="Account details">
          {[
            { label: 'First name',        value: customer?.first_name },
            { label: 'Last name',         value: customer?.last_name },
            ...(customer?.other_names ? [{ label: 'Other names', value: customer.other_names }] : []),
            { label: 'Phone',             value: customer?.phone },
            { label: 'Email',             value: customer?.email },
            { label: 'National ID (NIN)', value: maskNin(customer?.nin) },
          ].map((item, i, arr) => (
            <InfoRow key={i} label={item.label} value={item.value} last={i === arr.length - 1} />
          ))}

          <button
            onClick={() => !kycVerified && navigate('/portal/kyc')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              background: 'none', border: 'none', borderTop: '1.5px solid var(--color-grey-light)',
              cursor: kycVerified ? 'default' : 'pointer',
            }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>KYC status</span>
            {kycVerified
              ? <span className="badge badge-success">Verified</span>
              : <span className="badge badge-warning">Pending — tap to verify</span>
            }
          </button>
        </Section>

        {/* Payment source */}
        <Section title="Payment source">
          {hasPaymentSource ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <img
                  src={customer.payment_network === 'mtn' ? '/mtn-logo.svg' : '/airtel-logo.svg'}
                  alt={customer.payment_network}
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
                />
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                    {customer.payment_network === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                    {maskNumber(customer.payment_number)}
                  </div>
                </div>
              </div>
              <button onClick={() => navigate('/portal/payment-source')} className="btn btn-sm btn-secondary">
                Edit
              </button>
            </div>
          ) : (
            <ActionRow
              label="No payment source added"
              sublabel="Tap to add a mobile money number"
              icon="warning"
              danger
              last
              onClick={() => navigate('/portal/payment-source')}
            />
          )}
        </Section>

        {/* My campaigns */}
        <Section title="My campaigns">
          {enrollments.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              You are not enrolled in any campaigns.
            </div>
          ) : (
            enrollments.map((e, idx) => {
              const camp      = e.campaigns
              const bal       = Number(e.wallets?.balance || 0)
              const target    = Number(camp?.target_amount || 0)
              const pct       = target > 0 ? Math.min((bal / target) * 100, 100) : 0
              const remaining = Math.max(target - bal, 0)
              return (
                <div key={e.id} style={{
                  padding: 'var(--space-4)',
                  borderBottom: idx < enrollments.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                      {camp?.name || '—'}
                    </div>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-bold)',
                      color: 'var(--color-primary)',
                      background: 'var(--color-bg)',
                      border: 'var(--border)',
                      padding: '2px var(--space-2)',
                    }}>
                      {e.draw_code}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                      {pct.toFixed(0)}% saved
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                      {formatUGX(bal)} of {formatUGX(target)}
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="progress-bar-fill" style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? '#2D8B45' : pct >= 75 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                      {formatUGX(remaining)} remaining
                      {camp?.target_date && ' · ' + new Date(camp.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <button onClick={() => openLeaveModal(e)} className="btn btn-sm btn-danger">
                      Leave
                    </button>
                  </div>
                </div>
              )
            })
          )}

          <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1.5px solid var(--color-grey-light)' }}>
            <button
              onClick={() => navigate('/portal/select-campaign')}
              className="btn btn-secondary btn-full btn-sm"
            >
              <span className="icon-outlined icon-xs">add</span>
              Add another campaign
            </button>
          </div>
        </Section>

        {/* Account actions */}
        <Section title="Account">
          <ActionRow label="View my card"   icon="credit_card"   onClick={() => navigate('/portal/card')} />
          <ActionRow label="View card"   icon="credit_card"   onClick={() => navigate('/portal/card')} />
          <ActionRow
            label="Change PIN"
            icon="lock"
            onClick={() => { setShowPinForm(f => !f); setPinError(''); setPinSuccess(false) }}
            last={!showPinForm}
          />

          {showPinForm && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1.5px solid var(--color-grey-light)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {pinSuccess && (
                <div className="alert alert-success">
                  <span className="icon-outlined alert-icon">check_circle</span>
                  <div className="alert-content">PIN changed successfully!</div>
                </div>
              )}
              {pinError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{pinError}</div>
                </div>
              )}
              {[
                { label: 'Current PIN',     value: currentPin, setter: setCurrentPin },
                { label: 'New PIN',         value: newPin,     setter: setNewPin },
                { label: 'Confirm new PIN', value: confirmPin, setter: setConfirmPin },
              ].map((field, i) => (
                <div className="input-group" key={i}>
                  <label className="input-label">{field.label}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={field.value}
                    onChange={e => field.setter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="input"
                    style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)' }}
                  />
                </div>
              ))}
              <button onClick={handleChangePin} disabled={changingPin} className="btn btn-primary btn-full">
                {changingPin
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Updating…</>
                  : <><span className="icon-outlined icon-sm">lock_reset</span> Update PIN</>
                }
              </button>
            </div>
          )}
        </Section>

        {/* Log out */}
        <button
          onClick={() => { signOut(); navigate('/portal') }}
          className="btn btn-danger btn-full btn-lg"
        >
          <span className="icon-outlined icon-sm">logout</span>
          Log out
        </button>

        {/* Danger zone */}
        <Section title="Danger zone">
          <ActionRow
            label="Delete my account"
            sublabel="Permanently deactivate your account and refund all balances"
            icon="delete_forever"
            danger
            last
            onClick={openDeleteModal}
          />
        </Section>

        <div style={{ height: 'var(--space-4)' }} />
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'var(--color-white)',
        borderTop: 'var(--border-thick)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: 'var(--space-2) var(--space-4)',
        zIndex: 'var(--z-sticky)',
      }}>
        {[
          { label: 'Home',    icon: 'home',          path: '/portal/home'         },
          { label: 'Card',    icon: 'credit_card',  path: '/portal/card'          },
          { label: 'History', icon: 'receipt_long',  path: '/portal/transactions' },
          { label: 'Profile', icon: 'person',        path: '/portal/profile'      },
        ].map(({ label, icon, path }) => {
          const active = path === '/portal/profile'
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 'var(--space-1) var(--space-3)',
                position: 'relative',
              }}>
              {active && (
                <div style={{
                  position: 'absolute', top: -8, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 3,
                  background: 'var(--color-primary)',
                }} />
              )}
              <span className="icon-outlined" style={{ fontSize: 22, color: active ? 'var(--color-black)' : 'var(--color-grey)' }}>
                {icon}
              </span>
              <span style={{
                fontWeight: active ? 'var(--weight-black)' : 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                fontSize: 9,
                color: active ? 'var(--color-black)' : 'var(--color-grey)',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}