import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function nowDisplay() {
  return new Date().toLocaleString('en-UG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Shared summary table ───────────────────────────────────────────────────
function SummaryTable({ rows }) {
  return (
    <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: i < rows.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
          background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
          <span style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: row.color || 'var(--color-black)',
            fontFamily: row.mono ? 'monospace' : 'inherit',
          }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Pay({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const isEducation = brand.sector === 'Education'
  const enrollmentId = location.state?.enrollmentId || null

  const [step, setStep] = useState(1)

  // Education-only
  const [studentId, setStudentId]           = useState('')
  const [studentName, setStudentName]       = useState('')
  const [studentIdError, setStudentIdError] = useState('')
  const [studentIdValid, setStudentIdValid] = useState(false)
  const [studentLookingUp, setStudentLookingUp] = useState(false)

  // Shared
  const [amount, setAmount]                           = useState('')
  const [wallet, setWallet]                           = useState(null)
  const [campaign, setCampaign]                       = useState(null)
  const [enrollment, setEnrollment]                   = useState(null)
  const [loadingEnrollment, setLoadingEnrollment]     = useState(true)
  const [paying, setPaying]                           = useState(false)
  const [error, setError]                             = useState('')
  const [alreadyPaid, setAlreadyPaid]                 = useState(0)
  const [txnReference, setTxnReference]               = useState('')
  const [isFullPayment, setIsFullPayment]             = useState(false)
  const [discount, setDiscount]                       = useState(null)

  const totalSteps  = isEducation ? 3 : 2
  const successStep = isEducation ? 4 : 3
  const amountStep  = isEducation ? 2 : 1
  const confirmStep = isEducation ? 3 : 2

  const stepSubs = isEducation
    ? ['Step 1 of 3 — Student details', 'Step 2 of 3 — Amount', 'Step 3 of 3 — Confirm']
    : ['Step 1 of 2 — Amount', 'Step 2 of 2 — Confirm']

  const stepTitles = isEducation
    ? ['Student details', 'How much to pay?', 'Confirm payment']
    : ['How much to pay?', 'Confirm payment']

  useEffect(() => { if (customer) loadEnrollment() }, [customer, enrollmentId])

  async function loadEnrollment() {
    setLoadingEnrollment(true)
    try {
      let q = supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')

      if (enrollmentId) {
        q = q.eq('id', enrollmentId)
      } else {
        q = q.order('enrolled_at', { ascending: true }).limit(1)
      }

      const { data: enrollData } = await q.maybeSingle()

      if (enrollData) {
        setEnrollment(enrollData)
        setCampaign(enrollData.campaigns)
        setWallet(enrollData.wallets)

        const { data: paidData } = await supabase
          .from('transactions')
          .select('amount')
          .eq('customer_id', customer.id)
          .eq('campaign_id', enrollData.campaign_id)
          .eq('type', 'payment')
        if (paidData) setAlreadyPaid(paidData.reduce((sum, t) => sum + Number(t.amount), 0))

        const { data: discountData } = await supabase
          .from('customer_discounts')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('campaign_id', enrollData.campaign_id)
          .eq('is_used', false)
          .maybeSingle()
        if (discountData) setDiscount(discountData)
      }
    } catch (e) {
      console.error('Load enrollment error:', e)
    }
    setLoadingEnrollment(false)
  }

  const balance      = wallet   ? Number(wallet.balance)          : 0
  const target       = campaign ? Number(campaign.target_amount)  : 0
  const rawRemaining = Math.max(target - alreadyPaid, 0)

  const discountPct    = discount ? Number(discount.discount_percentage) : 0
  const discountAmount = discountPct > 0 ? Math.round(rawRemaining * (discountPct / 100)) : 0
  const remaining      = Math.max(rawRemaining - discountAmount, 0)
  const maxPayable     = Math.min(remaining, balance)
  const parsedAmount   = parseInt(amount.replace(/,/g, ''), 10)

  const isFixedSchedule  = campaign?.allow_partial_payments && Number(campaign?.payment_discount_percentage) > 0
  const fixedPct         = isFixedSchedule ? Number(campaign.payment_discount_percentage) : 0
  const fixedMinimumUGX  = isFixedSchedule ? Math.round(target * (fixedPct / 100)) : 1000
  const effectiveMinimum = Math.min(fixedMinimumUGX, maxPayable)
  const validAmount      = !isNaN(parsedAmount) && parsedAmount >= effectiveMinimum && parsedAmount <= maxPayable

  async function handleStudentIdChange(val) {
    const upper = val.toUpperCase()
    setStudentId(upper)
    setStudentIdError('')
    setStudentIdValid(false)
    setStudentName('')
    if (upper.length < 2) return
    setStudentLookingUp(true)
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, other_names, student_id')
        .eq('business_id', customer.business_id)
        .ilike('student_id', upper)
        .maybeSingle()
      if (data) {
        setStudentName([data.first_name, data.other_names, data.last_name].filter(Boolean).join(' '))
        setStudentIdValid(true)
      }
    } catch (e) {
      console.error('Student lookup error:', e)
    }
    setStudentLookingUp(false)
  }

  function handleStudentIdBlur() {
    if (!studentId || studentIdValid) return
    setStudentIdError('Student ID not found. Please check and try again.')
  }

  async function handlePay() {
    setError('')
    setPaying(true)
    try {
      if (!wallet) { setError('Could not find wallet. Please go back and try again.'); setPaying(false); return }

      const newBalance  = Number(wallet.balance) - parsedAmount
      if (newBalance < 0) { setError('Insufficient balance.'); setPaying(false); return }

      const reference   = generateReference()
      setTxnReference(reference)
      const fullPayment = parsedAmount >= remaining

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id:   wallet.id,
          campaign_id: enrollment?.campaign_id || null,
          type:        'payment',
          amount:      parsedAmount,
          status:      'completed',
          reference,
          notes: isEducation && studentName
            ? 'Student: ' + studentName + ' (' + studentId + ')'
            : discount
            ? `Discount prize applied: ${discountPct}% (${formatUGX(discountAmount)} saved)`
            : null,
        })
        .select()

      if (txnError) { setError('Could not record transaction. Please try again.'); setPaying(false); return }

      const txnId = txnData?.[0]?.id
      if (txnId) {
        const partnaFee = Math.round(parsedAmount * 0.01)
        await supabase.from('transaction_fees').insert({
          transaction_id: txnId,
          customer_id:    customer.id,
          fee_type:       'payment',
          charged_to:     'business',
          partna_fee:     partnaFee,
          carrier_fee:    0,
          tax:            0,
          total_fees:     partnaFee,
          net_amount:     parsedAmount - partnaFee,
        })
      }

      await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)

      if (isEducation) {
        const { data: bizWallet } = await supabase
          .from('business_wallets').select('*').eq('business_id', customer.business_id).maybeSingle()
        if (bizWallet) {
          await supabase.from('business_wallets')
            .update({ balance: Number(bizWallet.balance) + parsedAmount }).eq('id', bizWallet.id)
        } else {
          await supabase.from('business_wallets').insert({ business_id: customer.business_id, balance: parsedAmount })
        }
        await supabase.from('business_transactions').insert({
          business_id: customer.business_id,
          type:        'fee_payment',
          amount:      parsedAmount,
          status:      'completed',
          reference,
          notes: `Fee payment from ${customer.first_name} ${customer.last_name}` +
            (studentName ? ` — Student: ${studentName} (${studentId})` : ''),
        })
      }

      if (!isEducation && fullPayment) {
        const { data: escrowWallet } = await supabase
          .from('escrow_wallets').select('*').eq('business_id', customer.business_id).maybeSingle()
        if (escrowWallet) {
          await supabase.from('escrow_wallets')
            .update({ balance: Number(escrowWallet.balance) + parsedAmount }).eq('id', escrowWallet.id)
        } else {
          await supabase.from('escrow_wallets').insert({ business_id: customer.business_id, balance: parsedAmount })
        }
        await supabase.from('sales').insert({
          business_id:    customer.business_id,
          customer_id:    customer.id,
          campaign_id:    enrollment?.campaign_id || null,
          transaction_id: txnId,
          amount:         parsedAmount,
          type:           'retail',
          status:         'pending',
          is_prize:       false,
          notes:          discount ? `Discount prize applied: ${discountPct}% off` : null,
        })
        setIsFullPayment(true)
      }

      if (discount) {
        await supabase.from('customer_discounts').update({ is_used: true }).eq('id', discount.id)
      }

      setStep(successStep)
    } catch (e) {
      console.error('Unexpected error:', e)
      setError('Something went wrong. Please try again.')
    }
    setPaying(false)
  }

  if (loadingEnrollment) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 1 || step === successStep ? navigate('/portal/home') : setStep(step - 1)}
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
          <span className="icon-outlined icon-sm">
            {step === successStep ? 'home' : 'arrow_back'}
          </span>
        </button>
        <div>
          <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            {isEducation ? 'Pay Fees' : 'Make Payment'}
          </div>
          {campaign && (
            <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
              {campaign.name}
            </div>
          )}
        </div>
      </header>

      {/* ── Step banner ── */}
      {step < successStep ? (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: '3px solid var(--color-primary)',
          padding: 'var(--space-6) var(--space-5) var(--space-8)',
        }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-5)' }}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < totalSteps ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: s <= step ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                  background: s < step ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all var(--transition-base)',
                }}>
                  {s < step
                    ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                    : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: s === step ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)' }}>{s}</span>
                  }
                </div>
                {s < totalSteps && (
                  <div style={{ flex: 1, height: 2, background: s < step ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)', transition: 'background var(--transition-slow)' }} />
                )}
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-block',
            background: 'var(--color-primary)',
            border: 'var(--border)',
            padding: '3px var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color: 'var(--color-black)',
            marginBottom: 'var(--space-3)',
          }}>
            {stepSubs[step - 1]}
          </div>
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {stepTitles[step - 1]}
          </h1>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-black)',
          borderBottom: '3px solid var(--color-primary)',
          padding: 'var(--space-8) var(--space-5)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64,
            background: 'var(--color-primary)',
            border: '3px solid var(--color-white)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}>
            <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>check</span>
          </div>
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}>
            Payment successful
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
            {isEducation
              ? 'Fees have been paid successfully'
              : isFullPayment
              ? 'Full payment received — awaiting delivery confirmation'
              : 'Your partial payment has been recorded'}
          </p>
          {txnReference && (
            <div style={{
              display: 'inline-block',
              marginTop: 'var(--space-3)',
              background: 'var(--color-primary)',
              border: 'var(--border)',
              padding: '4px var(--space-4)',
              fontFamily: 'monospace',
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-sm)',
              letterSpacing: '0.1em',
              color: 'var(--color-black)',
            }}>
              {txnReference}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* ── EDUCATION STEP 1: Student details ── */}
        {isEducation && step === 1 && (
          <>
            <SummaryTable rows={[
              { label: 'Campaign',      value: campaign?.name || '—' },
              { label: 'Target amount', value: formatUGX(target) },
              { label: 'Already paid',  value: formatUGX(alreadyPaid) },
              { label: 'Remaining',     value: formatUGX(remaining), color: '#C0392B' },
            ]} />

            {discount && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--color-yellow)',
                border: 'var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>emoji_events</span>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                    Prize draw discount applied!
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.65)' }}>
                    You won a {discountPct}% discount — saving you {formatUGX(discountAmount)}.
                    Your balance to pay is now {formatUGX(remaining)}.
                  </div>
                </div>
              </div>
            )}

            {isFixedSchedule && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">receipt_long</span>
                <div className="alert-content">
                  Fixed payment schedule — minimum <strong>{fixedPct}% of target ({formatUGX(fixedMinimumUGX)})</strong> per payment.
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Student ID</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">badge</span>
                <input
                  type="text"
                  className={`input ${studentIdValid ? 'input-success' : studentIdError ? 'input-error' : ''}`}
                  placeholder="Enter student ID"
                  value={studentId}
                  onChange={e => handleStudentIdChange(e.target.value)}
                  onBlur={handleStudentIdBlur}
                  style={{ textTransform: 'uppercase' }}
                />
                <div className="input-icon-right" style={{ pointerEvents: 'none' }}>
                  {studentLookingUp
                    ? <div className="spinner spinner-sm" />
                    : studentIdValid
                    ? <span className="icon-outlined" style={{ color: '#2D8B45', fontSize: 20 }}>check_circle</span>
                    : null
                  }
                </div>
              </div>
              {studentIdError && <span className="input-hint error">{studentIdError}</span>}
            </div>

            <div className="input-group">
              <label className="input-label">Student name</label>
              <input
                type="text"
                className="input"
                placeholder="Auto-filled from Student ID"
                value={studentName}
                readOnly
                style={{
                  background: studentName ? 'var(--color-green)' : 'var(--color-grey-light)',
                  color: studentName ? 'var(--color-black)' : 'var(--color-grey)',
                  fontWeight: studentName ? 'var(--weight-bold)' : 'var(--weight-regular)',
                  cursor: 'default',
                }}
              />
              {!studentName && (
                <span className="input-hint">Enter a valid Student ID to auto-fill the name.</span>
              )}
            </div>

            <button
              onClick={() => {
                if (!studentIdValid) { setStudentIdError('Please enter a valid Student ID to continue.'); return }
                setStep(2)
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── AMOUNT STEP ── */}
        {step === amountStep && (
          <>
            {/* Balance + remaining row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
            }}>
              {[
                { label: 'Available balance',                        value: formatUGX(balance),    color: 'var(--color-black)' },
                { label: isEducation ? 'Remaining fees' : 'To pay', value: formatUGX(remaining),  color: '#C0392B' },
              ].map(card => (
                <div key={card.label} style={{
                  background: 'var(--color-white)',
                  border: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  padding: 'var(--space-4)',
                }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', color: card.color, letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 20" }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {discount && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--color-yellow)',
                border: 'var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>emoji_events</span>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                    Prize draw discount: {discountPct}% off!
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.65)' }}>
                    You're saving {formatUGX(discountAmount)}.
                    Original: {formatUGX(rawRemaining)} → Now: {formatUGX(remaining)}
                  </div>
                </div>
              </div>
            )}

            {!isEducation && (
              <SummaryTable rows={[
                { label: 'Product',       value: campaign?.name || '—' },
                { label: 'Total price',   value: formatUGX(target) },
                { label: 'Already paid',  value: formatUGX(alreadyPaid) },
                ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#8A6700' }] : []),
                { label: 'Remaining',     value: formatUGX(remaining), color: '#C0392B' },
              ]} />
            )}

            {!isEducation && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  When you complete full payment, your order will appear in the business's Sales queue awaiting delivery confirmation.
                </div>
              </div>
            )}

            {isFixedSchedule && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">receipt_long</span>
                <div className="alert-content">
                  Fixed payment schedule — minimum <strong>{fixedPct}% of target = {formatUGX(effectiveMinimum)}</strong> per payment.
                </div>
              </div>
            )}

            <div className="input-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <label className="input-label" style={{ margin: 0 }}>Amount to pay (UGX)</label>
                <button
                  onClick={() => setAmount(formatAmountInput(String(maxPayable)))}
                  className="btn btn-sm btn-primary"
                >
                  Pay in full
                </button>
              </div>
              <div className="input-wrapper">
                <span style={{
                  position: 'absolute', left: 'var(--space-4)',
                  fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)',
                  color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1,
                }}>
                  UGX
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="input input-lg"
                  style={{
                    paddingLeft: 56,
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--weight-black)',
                    letterSpacing: 'var(--tracking-tight)',
                    fontVariationSettings: "'wdth' 100, 'opsz' 30",
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                <span className="input-hint">
                  Min: {formatUGX(effectiveMinimum)}{isFixedSchedule && ` (${fixedPct}%)`}
                </span>
                <span className="input-hint">Max: {formatUGX(maxPayable)}</span>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={() => {
                if (isNaN(parsedAmount) || parsedAmount < effectiveMinimum) {
                  setError(isFixedSchedule
                    ? `Minimum payment is ${formatUGX(effectiveMinimum)} (${fixedPct}% of target).`
                    : 'Minimum payment is UGX 1,000.')
                  return
                }
                if (parsedAmount > maxPayable) {
                  setError('Amount exceeds your available balance or remaining amount.')
                  return
                }
                setError('')
                setStep(confirmStep)
              }}
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <span className="icon-outlined icon-sm">arrow_forward</span>
              Continue
            </button>
          </>
        )}

        {/* ── CONFIRM STEP ── */}
        {step === confirmStep && (
          <>
            <SummaryTable rows={[
              { label: isEducation ? 'Campaign' : 'Product', value: campaign?.name || '—' },
              ...(isEducation ? [
                { label: 'Student',    value: studentName },
                { label: 'Student ID', value: studentId, mono: true },
              ] : []),
              ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#8A6700' }] : []),
              { label: 'Amount paying',                                         value: formatUGX(parsedAmount) },
              { label: 'Balance after payment',                                 value: formatUGX(balance - parsedAmount) },
              { label: isEducation ? 'Remaining fees after' : 'Still to pay',  value: formatUGX(Math.max(remaining - parsedAmount, 0)), color: Math.max(remaining - parsedAmount, 0) > 0 ? '#C0392B' : '#2D8B45' },
              { label: 'Date & time',                                           value: nowDisplay() },
            ]} />

            {!isEducation && parsedAmount >= remaining && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">
                  This is your final payment. Your order will be placed in the delivery queue and released to the business once they confirm delivery.
                </div>
              </div>
            )}

            {discount && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--color-yellow)',
                border: 'var(--border)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>emoji_events</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.7)' }}>
                  Your prize discount of <strong>{discountPct}%</strong> will be applied and marked as used after this payment.
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{error}</div>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="btn btn-primary btn-full btn-lg"
            >
              {paying
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                : <><span className="icon-outlined icon-sm">north</span> Confirm payment of {formatUGX(parsedAmount)}</>
              }
            </button>
          </>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === successStep && (
          <>
            <SummaryTable rows={[
              { label: 'Reference',                                                 value: txnReference,         mono: true, color: 'var(--color-primary)' },
              { label: isEducation ? 'Campaign' : 'Product',                       value: campaign?.name || '—' },
              ...(isEducation ? [
                { label: 'Student',    value: studentName },
                { label: 'Student ID', value: studentId, mono: true },
              ] : []),
              ...(discount ? [{ label: 'Prize discount applied', value: `${discountPct}% (saved ${formatUGX(discountAmount)})`, color: '#8A6700' }] : []),
              { label: 'Amount paid',                                               value: formatUGX(parsedAmount) },
              { label: isEducation ? 'Remaining fees' : 'Remaining to pay',        value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
              {
                label: 'Status',
                value: isEducation ? 'Completed' : isFullPayment ? 'Awaiting delivery' : 'Partial payment recorded',
                color: isEducation || !isFullPayment ? '#2D8B45' : '#8A6700',
              },
              { label: 'Date & time', value: nowDisplay() },
            ]} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-white)',
              border: 'var(--border)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)', flexShrink: 0 }}>mail</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                A receipt has been sent to <strong style={{ color: 'var(--color-black)' }}>{customer?.email}</strong>
              </span>
            </div>

            <button
              onClick={() => navigate('/portal/home')}
              className="btn btn-black btn-full btn-lg"
            >
              <span className="icon-outlined icon-sm">home</span>
              Back to home
            </button>

            <button
              onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
              className="btn btn-secondary btn-full"
            >
              <span className="icon-outlined icon-sm">receipt_long</span>
              View transactions
            </button>
          </>
        )}
      </div>
    </div>
  )
}