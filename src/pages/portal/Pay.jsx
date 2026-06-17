import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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

const FEE_TYPE_LABELS = {
  tuition:       'Tuition fees',
  functional:    'Functional fees',
  building_fund: 'Building fund',
  exam:          'Exam fees',
  pta:           'PTA contribution',
  other:         'Other fees',
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

// ── Registration threshold progress bar ───────────────────────────────────
function RegistrationProgress({ totalPaid, minRegAmount, targetAmount }) {
  if (!minRegAmount || minRegAmount <= 0) return null
  const pct     = Math.min((totalPaid / minRegAmount) * 100, 100)
  const met     = totalPaid >= minRegAmount
  const stillNeeded = Math.max(minRegAmount - totalPaid, 0)

  return (
    <div style={{
      background: 'var(--color-white)',
      border: 'var(--border)',
      padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>
          Registration threshold
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: met ? '#2D8B45' : 'var(--color-grey)' }}>
          {met ? 'Met ✓' : `${formatUGX(stillNeeded)} still needed`}
        </span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{
          width: `${pct}%`,
          background: met ? '#2D8B45' : pct >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
          {formatUGX(totalPaid)} paid
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
          {formatUGX(minRegAmount)} required
        </span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>
        This threshold is set by your school and is shown for reference only. You can make payments of any amount above the minimum payment.
      </div>
    </div>
  )
}

export default function Pay({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const isEducation  = brand.sector === 'Education'
  const enrollmentId = location.state?.enrollmentId || null

  // Education: 4 steps (student details → amount → confirm → success)
  // General:   3 steps (amount → confirm → success)
  const totalSteps  = isEducation ? 3 : 2
  const successStep = isEducation ? 4 : 3
  const amountStep  = isEducation ? 2 : 1
  const confirmStep = isEducation ? 3 : 2

  const stepSubs = isEducation
    ? ['Step 1 of 3 — Student & fees', 'Step 2 of 3 — Amount', 'Step 3 of 3 — Confirm']
    : ['Step 1 of 2 — Amount', 'Step 2 of 2 — Confirm']

  const stepTitles = isEducation
    ? ['Student & fee details', 'How much to pay?', 'Confirm payment']
    : ['How much to pay?', 'Confirm payment']

  const [step, setStep] = useState(1)

  // ── Enrollment / wallet / campaign ────────────────────────────────────
  const [enrollment, setEnrollment]               = useState(null)
  const [wallet, setWallet]                       = useState(null)
  const [campaign, setCampaign]                   = useState(null)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)

  // ── Education-specific: student details from enrollment ───────────────
  const [student, setStudent]         = useState(null)   // {id, first_name, last_name, partna_student_id, school_student_id, year_group}
  const [totalPaidToDate, setTotalPaidToDate] = useState(0)
  const [studentBalanceData, setStudentBalanceData] = useState(null)
  const [loadingStudent, setLoadingStudent] = useState(false)

  // ── Payment state ─────────────────────────────────────────────────────
  const [amount, setAmount]           = useState('')
  const [paying, setPaying]           = useState(false)
  const [error, setError]             = useState('')
  const [txnReference, setTxnReference] = useState('')

  // ── General-only state ────────────────────────────────────────────────
  const [alreadyPaid, setAlreadyPaid]         = useState(0)
  const [isFullPayment, setIsFullPayment]     = useState(false)
  const [discount, setDiscount]               = useState(null)

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

        if (isEducation) {
          // Load student linked to this enrollment
          if (enrollData.student_id) {
            await loadStudentBalance(enrollData.student_id, enrollData.campaign_id)
          }
        } else {
          // General: load already paid and discounts
          const { data: paidData } = await supabase
            .from('transactions')
            .select('amount')
            .eq('customer_id', customer.id)
            .eq('campaign_id', enrollData.campaign_id)
            .eq('type', 'payment')
          if (paidData) setAlreadyPaid(paidData.reduce((s, t) => s + Number(t.amount), 0))

          const { data: discountData } = await supabase
            .from('customer_discounts')
            .select('*')
            .eq('customer_id', customer.id)
            .eq('campaign_id', enrollData.campaign_id)
            .eq('is_used', false)
            .maybeSingle()
          if (discountData) setDiscount(discountData)
        }
      }
    } catch (e) {
      console.error('Load enrollment error:', e)
    }
    setLoadingEnrollment(false)
  }

  async function loadStudentBalance(studentId, campaignId) {
    setLoadingStudent(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-student-balance`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ studentId, campaignId }),
      })
      const data = await res.json()
      if (data.student) {
        setStudent(data.student)
        setTotalPaidToDate(data.payments?.totalPaid || 0)
        setStudentBalanceData(data)
      }
    } catch (e) {
      console.error('Load student balance error:', e)
    }
    setLoadingStudent(false)
  }

  // ── Derived values ────────────────────────────────────────────────────
  const balance  = wallet   ? Number(wallet.balance)         : 0
  const target   = campaign ? Number(campaign.target_amount) : 0

  // Education
  const outstanding        = studentBalanceData ? Number(studentBalanceData.payments?.outstanding || 0) : Math.max(target - totalPaidToDate, 0)
  const minPayment         = campaign ? Number(campaign.minimum_payment || 0) : 0
  const minRegAmount       = campaign ? Number(campaign.minimum_registration_amount || 0) : 0
  const maxPayableEdu      = Math.min(outstanding, balance)
  const effectiveMinEdu    = minPayment > 0 ? Math.min(minPayment, maxPayableEdu) : Math.min(1000, maxPayableEdu)

  // General
  const discountPct        = discount ? Number(discount.discount_percentage) : 0
  const rawRemaining       = Math.max(target - alreadyPaid, 0)
  const discountAmount     = discountPct > 0 ? Math.round(rawRemaining * (discountPct / 100)) : 0
  const remaining          = Math.max(rawRemaining - discountAmount, 0)
  const maxPayableGeneral  = Math.min(remaining, balance)
  const isFixedSchedule    = campaign?.allow_partial_payments && Number(campaign?.payment_discount_percentage) > 0
  const fixedPct           = isFixedSchedule ? Number(campaign.payment_discount_percentage) : 0
  const fixedMinimumUGX    = isFixedSchedule ? Math.round(target * (fixedPct / 100)) : 1000
  const effectiveMinGeneral = Math.min(fixedMinimumUGX, maxPayableGeneral)

  const maxPayable     = isEducation ? maxPayableEdu     : maxPayableGeneral
  const effectiveMin   = isEducation ? effectiveMinEdu   : effectiveMinGeneral

  const parsedAmount   = parseInt(amount.replace(/,/g, ''), 10)
  const validAmount    = !isNaN(parsedAmount) && parsedAmount >= effectiveMin && parsedAmount <= maxPayable

  // ── Education payment via Edge Function ───────────────────────────────
  async function handleEducationPay() {
    setError('')
    setPaying(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-fee-payment`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          customerId: customer.id,
          walletId:   wallet.id,
          campaignId: enrollment.campaign_id,
          studentId:  enrollment.student_id,
          amount:     parsedAmount,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Payment failed. Please try again.')
        setPaying(false)
        return
      }

      setTxnReference(data.reference)
      setTotalPaidToDate(data.totalPaidToDate || totalPaidToDate + parsedAmount)

      // Refresh wallet balance from response
      if (data.newParentBalance !== undefined) {
        setWallet(w => ({ ...w, balance: data.newParentBalance }))
      }

      setStep(successStep)
    } catch (e) {
      console.error('Education pay error:', e)
      setError('Something went wrong. Please try again.')
    }
    setPaying(false)
  }

  // ── General payment via direct Supabase (unchanged) ───────────────────
  async function handleGeneralPay() {
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
          notes: discount ? `Discount prize applied: ${discountPct}% (${formatUGX(discountAmount)} saved)` : null,
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

      if (fullPayment) {
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

  function handlePay() {
    if (isEducation) return handleEducationPay()
    return handleGeneralPay()
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
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => step === 1 || step === successStep ? navigate('/portal/home') : setStep(step - 1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: 'var(--color-white)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-5)' }}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < totalSteps ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: s <= step ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                  background: s < step ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all var(--transition-base)',
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
            display: 'inline-block', background: 'var(--color-primary)', border: 'var(--border)',
            padding: '3px var(--space-3)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
            color: 'var(--color-black)', marginBottom: 'var(--space-3)',
          }}>
            {stepSubs[step - 1]}
          </div>
          <h1 style={{
            color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {stepTitles[step - 1]}
          </h1>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-black)', borderBottom: '3px solid var(--color-primary)',
          padding: 'var(--space-8) var(--space-5)', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, background: 'var(--color-primary)',
            border: '3px solid var(--color-white)', boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}>
            <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>check</span>
          </div>
          <h1 style={{
            color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-2)',
          }}>
            Payment successful
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
            {isEducation
              ? 'Fees paid successfully'
              : isFullPayment
              ? 'Full payment received — awaiting delivery confirmation'
              : 'Your partial payment has been recorded'}
          </p>
          {txnReference && (
            <div style={{
              display: 'inline-block', marginTop: 'var(--space-3)',
              background: 'var(--color-primary)', border: 'var(--border)',
              padding: '4px var(--space-4)', fontFamily: 'monospace',
              fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)',
              letterSpacing: '0.1em', color: 'var(--color-black)',
            }}>
              {txnReference}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── EDUCATION STEP 1: Student & fee details ── */}
        {isEducation && step === 1 && (
          <>
            {loadingStudent ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                <div className="spinner spinner-lg spinner-purple" />
              </div>
            ) : !student ? (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">
                  No student is linked to this campaign enrollment. Please contact your school to update your account.
                </div>
              </div>
            ) : (
              <>
                {/* Student card */}
                <div style={{
                  background: 'var(--color-black)', border: 'var(--border)',
                  padding: 'var(--space-4)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                }}>
                  <div style={{
                    width: 48, height: 48, flexShrink: 0,
                    background: 'var(--color-primary)', border: '2px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-black)', color: 'var(--color-black)',
                  }}>
                    {student.name?.[0]}
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)' }}>
                      {student.name}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 2 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}>
                        {student.partnaStudentId}
                      </span>
                      {student.schoolStudentId && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)' }}>
                          · {student.schoolStudentId}
                        </span>
                      )}
                      {student.yearGroup && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)' }}>
                          · {student.yearGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fee summary */}
                <SummaryTable rows={[
                  { label: 'Campaign',          value: campaign?.name || '—' },
                  { label: 'Fee type',          value: FEE_TYPE_LABELS[campaign?.fee_type] || campaign?.fee_type || '—' },
                  ...(campaign?.term_or_semester ? [{ label: 'Term', value: campaign.term_or_semester }] : []),
                  ...(campaign?.academic_year   ? [{ label: 'Academic year', value: campaign.academic_year }] : []),
                  { label: 'Total fees',        value: formatUGX(target) },
                  { label: 'Total paid to date', value: formatUGX(totalPaidToDate), color: '#2D8B45' },
                  { label: 'Outstanding',       value: formatUGX(outstanding), color: outstanding > 0 ? '#C0392B' : '#2D8B45' },
                  ...(minPayment > 0 ? [{ label: 'Minimum per payment', value: formatUGX(minPayment) }] : []),
                ]} />

                {/* Registration threshold progress — informational only */}
                <RegistrationProgress
                  totalPaid={totalPaidToDate}
                  minRegAmount={minRegAmount}
                  targetAmount={target}
                />

                {outstanding <= 0 ? (
                  <div className="alert alert-success">
                    <span className="icon-outlined alert-icon">check_circle</span>
                    <div className="alert-content">
                      All fees for this campaign have been paid in full.
                    </div>
                  </div>
                ) : balance <= 0 ? (
                  <div className="alert alert-warning">
                    <span className="icon-outlined alert-icon">account_balance_wallet</span>
                    <div className="alert-content">
                      Your wallet balance is UGX 0. Please make a deposit before paying fees.
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setStep(2)}
                    className="btn btn-primary btn-full btn-lg"
                    style={{ marginTop: 'var(--space-2)' }}
                  >
                    <span className="icon-outlined icon-sm">arrow_forward</span>
                    Continue to payment
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ── AMOUNT STEP ── */}
        {step === amountStep && (
          <>
            {/* Balance + outstanding cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {[
                { label: 'Wallet balance',                                 value: formatUGX(balance),      color: 'var(--color-black)' },
                { label: isEducation ? 'Outstanding fees' : 'Amount due',  value: formatUGX(isEducation ? outstanding : remaining), color: '#C0392B' },
              ].map(card => (
                <div key={card.label} style={{
                  background: 'var(--color-white)', border: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)',
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

            {/* Education: student reminder */}
            {isEducation && student && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-white)', border: 'var(--border)',
              }}>
                <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0 }}>school</span>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{student.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                    {FEE_TYPE_LABELS[campaign?.fee_type] || ''}
                    {campaign?.term_or_semester ? ` · ${campaign.term_or_semester}` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* General: product summary */}
            {!isEducation && (
              <>
                <SummaryTable rows={[
                  { label: 'Product',      value: campaign?.name || '—' },
                  { label: 'Total price',  value: formatUGX(target) },
                  { label: 'Already paid', value: formatUGX(alreadyPaid) },
                  ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#8A6700' }] : []),
                  { label: 'Remaining',    value: formatUGX(remaining), color: '#C0392B' },
                ]} />
                <div className="alert alert-info">
                  <span className="icon-outlined alert-icon">info</span>
                  <div className="alert-content">
                    When you complete full payment, your order will appear in the delivery queue.
                  </div>
                </div>
              </>
            )}

            {/* Minimum payment info */}
            {isEducation && minPayment > 0 && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  Your school requires a minimum payment of <strong>{formatUGX(minPayment)}</strong> per transaction.
                </div>
              </div>
            )}

            {!isEducation && isFixedSchedule && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">receipt_long</span>
                <div className="alert-content">
                  Fixed payment schedule — minimum <strong>{fixedPct}% of target = {formatUGX(effectiveMinGeneral)}</strong> per payment.
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="input-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <label className="input-label" style={{ margin: 0 }}>Amount to pay (UGX)</label>
                <button onClick={() => setAmount(formatAmountInput(String(maxPayable)))} className="btn btn-sm btn-primary">
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
                  type="text" inputMode="numeric" placeholder="0"
                  value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="input input-lg"
                  style={{ paddingLeft: 56, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 30" }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                <span className="input-hint">Min: {formatUGX(effectiveMin)}</span>
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
                if (isNaN(parsedAmount) || parsedAmount < effectiveMin) {
                  setError(`Minimum payment is ${formatUGX(effectiveMin)}.`)
                  return
                }
                if (parsedAmount > maxPayable) {
                  setError('Amount exceeds your available balance or outstanding fees.')
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
              ...(isEducation && student ? [
                { label: 'Student',       value: student.name },
                { label: 'Partna ID',     value: student.partnaStudentId, mono: true },
                { label: 'Fee type',      value: FEE_TYPE_LABELS[campaign?.fee_type] || campaign?.fee_type || '—' },
              ] : []),
              ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#8A6700' }] : []),
              { label: 'Amount paying',            value: formatUGX(parsedAmount) },
              { label: 'Wallet balance after',     value: formatUGX(balance - parsedAmount) },
              {
                label: isEducation ? 'Outstanding after payment' : 'Still to pay',
                value: formatUGX(Math.max((isEducation ? outstanding : remaining) - parsedAmount, 0)),
                color: Math.max((isEducation ? outstanding : remaining) - parsedAmount, 0) > 0 ? '#C0392B' : '#2D8B45',
              },
              { label: 'Date & time', value: nowDisplay() },
            ]} />

            {isEducation && (
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  This payment will be sent directly to your school. A confirmation SMS will be sent to your registered number.
                </div>
              </div>
            )}

            {!isEducation && parsedAmount >= remaining && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">
                  This is your final payment. Your order will be placed in the delivery queue.
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
              { label: 'Reference',                                          value: txnReference,          mono: true, color: 'var(--color-primary)' },
              { label: isEducation ? 'Campaign' : 'Product',                value: campaign?.name || '—' },
              ...(isEducation && student ? [
                { label: 'Student',   value: student.name },
                { label: 'Partna ID', value: student.partnaStudentId, mono: true },
              ] : []),
              ...(discount ? [{ label: 'Prize discount applied', value: `${discountPct}% (saved ${formatUGX(discountAmount)})`, color: '#8A6700' }] : []),
              { label: 'Amount paid',           value: formatUGX(parsedAmount) },
              { label: isEducation ? 'Total paid to date' : 'Remaining to pay',
                value: isEducation ? formatUGX(totalPaidToDate) : formatUGX(Math.max(remaining - parsedAmount, 0)) },
              {
                label: 'Status',
                value: isEducation ? 'Completed' : isFullPayment ? 'Awaiting delivery' : 'Partial payment recorded',
                color: '#2D8B45',
              },
              { label: 'Date & time', value: nowDisplay() },
            ]} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-white)', border: 'var(--border)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)', flexShrink: 0 }}>sms</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                A confirmation SMS has been sent to <strong style={{ color: 'var(--color-black)' }}>{customer?.phone}</strong>
              </span>
            </div>

            <button onClick={() => navigate('/portal/home')} className="btn btn-black btn-full btn-lg">
              <span className="icon-outlined icon-sm">home</span>
              Back to home
            </button>

            <button onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })} className="btn btn-secondary btn-full">
              <span className="icon-outlined icon-sm">receipt_long</span>
              View transactions
            </button>
          </>
        )}
      </div>
    </div>
  )
}