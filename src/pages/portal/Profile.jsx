import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function Profile({ customer, signOut }) {
  const brand = useBrand()
  const navigate = useNavigate()

  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  // PIN change
  const [showPinForm, setShowPinForm] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)
  const [changingPin, setChangingPin] = useState(false)

  // Leave campaign modal
  const [showLeave, setShowLeave] = useState(null) // enrollment object
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState(false)
  const [leaveFee, setLeaveFee] = useState(null) // { refund, fee, gross }

  // Delete account modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState(null) // { totalGross, totalFee, totalRefund }

  useEffect(() => {
    if (customer) loadData()
  }, [customer])

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

  // ── Fee calculation helpers ──
  // Savings balance: 10% fee to Partna
  // Partial payments in escrow: 7% to business + 3% to Partna (10% total)
  function calcRefund(balance) {
    const gross = Number(balance)
    const fee = Math.round(gross * 0.10)
    return { gross, fee, refund: Math.max(0, gross - fee) }
  }

  function openLeaveModal(enrollment) {
    const { gross, fee, refund } = calcRefund(enrollment.wallets?.balance || 0)
    setLeaveFee({ gross, fee, refund })
    setShowLeave(enrollment)
    setLeaveSuccess(false)
  }

  function openDeleteModal() {
    let totalGross = 0
    let totalFee = 0
    for (const e of enrollments) {
      const bal = Number(e.wallets?.balance || 0)
      totalGross += bal
      totalFee += Math.round(bal * 0.10)
    }
    setDeleteSummary({
      totalGross,
      totalFee,
      totalRefund: Math.max(0, totalGross - totalFee),
    })
    setShowDelete(true)
    setDeleteSuccess(false)
  }

  async function handleLeaveCampaign() {
    if (!showLeave) return
    setLeaveLoading(true)
    try {
      const wallet = showLeave.wallets
      const balance = Number(wallet?.balance || 0)
      const { fee, refund } = calcRefund(balance)

      // Mark enrollment as left
      await supabase
        .from('customer_campaigns')
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('id', showLeave.id)

      // Zero the wallet
      if (wallet) {
        await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
      }

      // Record refund transaction
      if (balance > 0) {
        await supabase.from('transactions').insert({
          customer_id: customer.id,
          wallet_id: wallet?.id || null,
          campaign_id: showLeave.campaign_id,
          type: 'withdrawal',
          amount: balance,
          status: 'pending',
          notes: `Campaign left — refund pending. Fee deducted: UGX ${fee.toLocaleString()}. Net refund: UGX ${refund.toLocaleString()}`,
        })

        // Record Partna fee
        await supabase.from('transaction_fees').insert({
          customer_id: customer.id,
          fee_type: 'leave_campaign',
          charged_to: 'user',
          partna_fee: fee,
          carrier_fee: 0,
          tax: 0,
          total_fees: fee,
          net_amount: refund,
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
        const wallet = enrollment.wallets
        const balance = Number(wallet?.balance || 0)
        const { fee, refund } = calcRefund(balance)

        // Mark enrollment as left
        await supabase
          .from('customer_campaigns')
          .update({ status: 'left', left_at: new Date().toISOString() })
          .eq('id', enrollment.id)

        // Zero the wallet
        if (wallet) {
          await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
        }

        // Record refund transaction per campaign
        if (balance > 0) {
          await supabase.from('transactions').insert({
            customer_id: customer.id,
            wallet_id: wallet?.id || null,
            campaign_id: enrollment.campaign_id,
            type: 'withdrawal',
            amount: balance,
            status: 'pending',
            notes: `Account deleted — refund pending. Fee: UGX ${fee.toLocaleString()}. Net: UGX ${refund.toLocaleString()}`,
          })

          await supabase.from('transaction_fees').insert({
            customer_id: customer.id,
            fee_type: 'delete_account',
            charged_to: 'user',
            partna_fee: fee,
            carrier_fee: 0,
            tax: 0,
            total_fees: fee,
            net_amount: refund,
          })
        }
      }

      // Deactivate the customer record
      await supabase
        .from('customers')
        .update({ registration_status: 'deleted' })
        .eq('id', customer.id)

      // Sign out the auth user
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
    if (!newPin || newPin.length !== 4) { setPinError('New PIN must be 4 digits.'); return }
    if (newPin !== confirmPin) { setPinError('New PINs do not match.'); return }
    if (newPin === currentPin) { setPinError('New PIN must be different from current PIN.'); return }

    setChangingPin(true)
    try {
      const cleanPhone = customer.phone.replace(/\s+/g, '')
      const oldPassword = `pin-${currentPin}-${cleanPhone}`
      const newPassword = `pin-${newPin}-${cleanPhone}`
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer.email, password: oldPassword,
      })
      if (signInError) { setPinError('Current PIN is incorrect.'); setChangingPin(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { setPinError('Could not update PIN. Please try again.'); setChangingPin(false); return }
      setPinSuccess(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setTimeout(() => { setShowPinForm(false); setPinSuccess(false) }, 2000)
    } catch (e) {
      setPinError('Something went wrong. Please try again.')
    }
    setChangingPin(false)
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

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  const kycVerified = customer?.kyc_status === 'verified'
  const hasPaymentSource = !!(customer?.payment_network && customer?.payment_number)
  const totalBalance = enrollments.reduce((s, e) => s + Number(e.wallets?.balance || 0), 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* ── LEAVE CAMPAIGN MODAL ── */}
      {showLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="px-6 py-5" style={{ background: leaveSuccess ? '#16A34A' : '#DC2626' }}>
              <div className="flex items-center justify-between">
                <div className="text-white text-base font-bold">
                  {leaveSuccess ? '✓ Campaign left' : 'Leave campaign'}
                </div>
                {!leaveSuccess && (
                  <button onClick={() => setShowLeave(null)}
                    className="text-white text-xl opacity-70">✕</button>
                )}
              </div>
              {!leaveSuccess && (
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {showLeave.campaigns?.name}
                </div>
              )}
            </div>
            <div className="p-6 flex flex-col gap-4">
              {leaveSuccess ? (
                <>
                  <div className="text-center py-2">
                    <div className="text-sm font-semibold mb-2" style={{ color: '#16A34A' }}>
                      You have left {showLeave.campaigns?.name}
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      Your refund of {formatUGX(leaveFee?.refund || 0)} will be sent to your registered
                      mobile money number within 5 working days.
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowLeave(null); setLeaveSuccess(false) }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: brand.primaryColor, color: '#fff' }}>
                    Done
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    You are leaving <strong>{showLeave.campaigns?.name}</strong>. Your savings
                    balance will be refunded minus a 10% early exit fee. You will remain registered
                    and can join another campaign.
                  </div>

                  {/* Refund breakdown */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    {[
                      { label: 'Current balance', value: formatUGX(leaveFee?.gross || 0), color: brand.primaryColor },
                      { label: 'Early exit fee (10%)', value: `− ${formatUGX(leaveFee?.fee || 0)}`, color: '#DC2626' },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>{row.label}</span>
                        <span className="text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3" style={{ background: '#fff' }}>
                      <span className="text-xs font-bold" style={{ color: brand.primaryColor }}>
                        You receive
                      </span>
                      <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                        {formatUGX(leaveFee?.refund || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(217,119,6,0.08)', color: '#92400e', border: '1px solid rgba(217,119,6,0.2)' }}>
                    ⚠ Refund will arrive within <strong>5 working days</strong> to your registered mobile money number.
                    This cannot be undone.
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setShowLeave(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleLeaveCampaign}
                      disabled={leaveLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: leaveLoading ? 'rgba(220,38,38,0.3)' : '#DC2626', color: '#fff' }}>
                      {leaveLoading ? 'Processing...' : 'Leave campaign'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
            <div className="px-6 py-5" style={{ background: deleteSuccess ? '#16A34A' : '#7C3AED' }}>
              <div className="flex items-center justify-between">
                <div className="text-white text-base font-bold">
                  {deleteSuccess ? '✓ Account deleted' : 'Delete account'}
                </div>
                {!deleteSuccess && (
                  <button onClick={() => setShowDelete(false)}
                    className="text-white text-xl opacity-70">✕</button>
                )}
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {deleteSuccess ? (
                <>
                  <div className="text-center py-2">
                    <div className="text-sm font-semibold mb-2" style={{ color: '#16A34A' }}>
                      Your account has been deleted
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      {deleteSummary?.totalRefund > 0
                        ? `Your refund of ${formatUGX(deleteSummary.totalRefund)} will be sent to your registered mobile money number within 5 working days.`
                        : 'No balance to refund. You have been signed out.'}
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowDelete(false); navigate('/portal') }}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: brand.primaryColor, color: '#fff' }}>
                    Done
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    Deleting your account will unenrol you from <strong>all {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''}</strong> and
                    permanently deactivate your account. All balances will be refunded minus a 10% fee per campaign.
                  </div>

                  {/* Per-campaign breakdown */}
                  {enrollments.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="px-4 py-2" style={{ background: '#f8f9fa', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          REFUND BREAKDOWN
                        </span>
                      </div>
                      {enrollments.map((e, i) => {
                        const bal = Number(e.wallets?.balance || 0)
                        const { fee, refund } = calcRefund(bal)
                        return (
                          <div key={e.id} className="px-4 py-3"
                            style={{ borderBottom: i < enrollments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                                {e.campaigns?.name}
                              </span>
                              <span className="text-xs font-bold" style={{ color: '#16A34A' }}>
                                {formatUGX(refund)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                Balance: {formatUGX(bal)} − fee: {formatUGX(fee)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex justify-between items-center px-4 py-3"
                        style={{ background: '#f0f2f5', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <span className="text-xs font-bold" style={{ color: brand.primaryColor }}>
                          Total refund
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                          {formatUGX(deleteSummary?.totalRefund || 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(124,58,237,0.06)', color: '#5B21B6', border: '1px solid rgba(124,58,237,0.2)' }}>
                    ⚠ This action is <strong>permanent and cannot be undone.</strong> Your account and all data will be deactivated.
                    Refund within 5 working days.
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setShowDelete(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: deleteLoading ? 'rgba(124,58,237,0.3)' : '#7C3AED', color: '#fff' }}>
                      {deleteLoading ? 'Processing...' : 'Delete my account'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={() => navigate('/portal/home')} className="text-white text-xl">&#8592;</button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Profile</div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center pt-6 pb-10 px-5" style={{ background: brand.primaryColor }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3"
          style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
          {customer?.first_name?.[0]}{customer?.last_name?.[0]}
        </div>
        <div className="text-white text-base font-bold">
          {customer?.first_name} {customer?.other_names ? customer.other_names + ' ' : ''}{customer?.last_name}
        </div>
        <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{customer?.phone}</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer?.email}</div>
        <div className="mt-3 px-4 py-1.5 rounded-full text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.15)', color: brand.secondaryColor }}>
          {enrollments.length} campaign{enrollments.length !== 1 ? 's' : ''} · {formatUGX(totalBalance)} total saved
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 flex flex-col gap-4 px-5 py-5"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* Account details */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Account Details
            </div>
          </div>
          {[
            { label: 'First name', value: customer?.first_name },
            { label: 'Last name', value: customer?.last_name },
            customer?.other_names ? { label: 'Other names', value: customer.other_names } : null,
            { label: 'Phone', value: customer?.phone },
            { label: 'Email', value: customer?.email },
            { label: 'National ID (NIN)', value: maskNin(customer?.nin) },
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{item.label}</div>
              <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{item.value}</div>
            </div>
          ))}
          <button
            onClick={() => !kycVerified && navigate('/portal/kyc')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ cursor: kycVerified ? 'default' : 'pointer' }}>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>KYC status</div>
            <div className="flex items-center gap-1">
              {kycVerified ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>✓ Verified</span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>⚠ Pending — tap to verify</span>
              )}
            </div>
          </button>
        </div>

        {/* Payment source */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Payment Source
            </div>
          </div>
          {hasPaymentSource ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={customer.payment_network === 'mtn' ? '/mtn-logo.svg' : '/airtel-logo.svg'}
                  alt={customer.payment_network} className="w-8 h-8 object-contain rounded-lg" />
                <div>
                  <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                    {customer.payment_network === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {maskNumber(customer.payment_number)}
                  </div>
                </div>
              </div>
              <button onClick={() => navigate('/portal/payment-source')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(27,79,114,0.08)', color: brand.primaryColor }}>
                Edit
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/portal/payment-source')}
              className="w-full flex items-center justify-between px-4 py-3">
              <div className="text-xs font-semibold" style={{ color: '#D97706' }}>⚠ No payment source added</div>
              <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
            </button>
          )}
        </div>

        {/* Campaigns summary — one card per enrollment */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              My Campaigns
            </div>
          </div>
          {enrollments.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              You are not enrolled in any campaigns.
            </div>
          ) : enrollments.map((e, idx) => {
            const campaign = e.campaigns
            const balance = Number(e.wallets?.balance || 0)
            const target = Number(campaign?.target_amount || 0)
            const pct = target > 0 ? Math.min((balance / target) * 100, 100) : 0
            const remaining = Math.max(target - balance, 0)
            return (
              <div key={e.id} style={{ borderBottom: idx < enrollments.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold" style={{ color: brand.primaryColor }}>
                      {campaign?.name || '—'}
                    </div>
                    <div className="text-xs font-mono font-semibold"
                      style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                      {e.draw_code}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    <span>{pct.toFixed(0)}% saved</span>
                    <span>{formatUGX(balance)} of {formatUGX(target)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full mb-3" style={{ background: 'rgba(0,0,0,0.08)' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#16A34A' : pct >= 75 ? '#22C55E' : pct >= 50 ? brand.secondaryColor : '#F59E0B',
                      }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      {formatUGX(remaining)} remaining · {
                        campaign?.target_date
                          ? new Date(campaign.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'
                      }
                    </div>
                    <button
                      onClick={() => openLeaveModal(e)}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => navigate('/portal/select-campaign')}
              className="w-full py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(27,79,114,0.06)', color: brand.primaryColor, border: '1px solid rgba(27,79,114,0.15)' }}>
              + Add another campaign
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Actions
            </div>
          </div>
          <button onClick={() => navigate('/portal/card')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>View my card</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
          </button>
          <button onClick={() => navigate('/portal/rewards')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>View rewards</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
          </button>
          <button
            onClick={() => { setShowPinForm(!showPinForm); setPinError(''); setPinSuccess(false) }}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: showPinForm ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Change PIN</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>{showPinForm ? '↑' : '↓'}</span>
          </button>
          {showPinForm && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              {pinSuccess && (
                <div className="text-xs px-3 py-2 rounded-xl text-center font-semibold"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  PIN changed successfully!
                </div>
              )}
              {pinError && (
                <div className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {pinError}
                </div>
              )}
              {[
                { label: 'Current PIN', value: currentPin, setter: setCurrentPin },
                { label: 'New PIN', value: newPin, setter: setNewPin },
                { label: 'Confirm new PIN', value: confirmPin, setter: setConfirmPin },
              ].map((field, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{field.label}</label>
                  <input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                    value={field.value}
                    onChange={e => field.setter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center tracking-widest"
                    style={{ background: '#f0f2f5', color: '#333', fontSize: '18px' }} />
                </div>
              ))}
              <button onClick={handleChangePin} disabled={changingPin}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{ background: changingPin ? 'rgba(27,79,114,0.3)' : brand.primaryColor, color: '#fff' }}>
                {changingPin ? 'Updating...' : 'Update PIN'}
              </button>
            </div>
          )}
        </div>

        <button onClick={() => { signOut(); navigate('/portal') }}
          className="w-full py-3 rounded-2xl text-sm font-bold"
          style={{ background: '#FEE2E2', color: '#DC2626' }}>
          Log out
        </button>

        {/* Delete account — separated visually at the bottom */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.15)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(124,58,237,0.6)' }}>
              Danger Zone
            </div>
          </div>
          <button
            onClick={openDeleteModal}
            className="w-full flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-xs font-bold" style={{ color: '#7C3AED' }}>Delete my account</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Permanently deactivate your account and refund all balances
              </div>
            </div>
            <span style={{ color: 'rgba(124,58,237,0.4)' }}>→</span>
          </button>
        </div>

        <div className="h-4" />
      </div>

      {/* Bottom nav */}
      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1">
            <span className="text-lg leading-none"
              style={{ color: item.path === '/portal/profile' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs"
              style={{
                color: item.path === '/portal/profile' ? brand.primaryColor : 'rgba(0,0,0,0.3)',
                fontWeight: item.path === '/portal/profile' ? 600 : 400,
              }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}