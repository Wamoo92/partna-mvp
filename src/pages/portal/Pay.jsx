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

// ── Shared summary table ───────────────────────────────────────────────────
function SummaryTable({ rows }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px',
          borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none',
          background: i % 2 === 0 ? C.white : C.bg,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black, fontFamily: row.mono ? 'monospace' : 'inherit' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Registration threshold progress bar ───────────────────────────────────
function RegistrationProgress({ totalPaid, minRegAmount }) {
  if (!minRegAmount || minRegAmount <= 0) return null
  const pct          = Math.min((totalPaid / minRegAmount) * 100, 100)
  const met          = totalPaid >= minRegAmount
  const stillNeeded  = Math.max(minRegAmount - totalPaid, 0)

  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Registration threshold</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: met ? C.green : C.secondary }}>
          {met ? 'Met ✓' : `${formatUGX(stillNeeded)} still needed`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: C.grayLight, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: met ? C.green : pct >= 50 ? C.orange : C.blue, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{formatUGX(totalPaid)} paid</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{formatUGX(minRegAmount)} required</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0, lineHeight: '140%' }}>
        This threshold is set by your school and is shown for reference only. You can make payments of any amount above the minimum payment.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

export default function Pay({
 customer }) {
  useEffect(() => { document.title = 'Pay - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const isEducation  = brand.sector === 'Education'
  const enrollmentId = location.state?.enrollmentId || null

  const totalSteps  = isEducation ? 3 : 2
  const successStep = isEducation ? 4 : 3
  const amountStep  = isEducation ? 2 : 1
  const confirmStep = isEducation ? 3 : 2

  const stepLabels = isEducation
    ? ['Student & fees', 'Amount', 'Confirm']
    : ['Amount', 'Confirm']

  const stepTitles = isEducation
    ? ['Student & fee details', 'How much to pay?', 'Confirm payment']
    : ['How much to pay?', 'Confirm payment']

  const [step, setStep] = useState(1)

  const [enrollment, setEnrollment]               = useState(null)
  const [wallet, setWallet]                       = useState(null)
  const [campaign, setCampaign]                   = useState(null)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)

  const [student, setStudent]                     = useState(null)
  const [totalPaidToDate, setTotalPaidToDate]     = useState(0)
  const [studentBalanceData, setStudentBalanceData] = useState(null)
  const [loadingStudent, setLoadingStudent]       = useState(false)

  const [amount, setAmount]         = useState('')
  const [paying, setPaying]         = useState(false)
  const [error, setError]           = useState('')
  const [txnReference, setTxnReference] = useState('')

  const [alreadyPaid, setAlreadyPaid]     = useState(0)
  const [isFullPayment, setIsFullPayment] = useState(false)
  const [discount, setDiscount]           = useState(null)

  useEffect(() => { if (customer) loadEnrollment() }, [customer, enrollmentId])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadEnrollment() {
    setLoadingEnrollment(true)
    try {
      let q = supabase.from('customer_campaigns').select('*, campaigns(*), wallets(*)').eq('customer_id', customer.id).eq('status', 'active')
      if (enrollmentId) { q = q.eq('id', enrollmentId) } else { q = q.order('enrolled_at', { ascending: true }).limit(1) }
      const { data: enrollData } = await q.maybeSingle()
      if (enrollData) {
        setEnrollment(enrollData); setCampaign(enrollData.campaigns); setWallet(enrollData.wallets)
        if (isEducation) {
          if (enrollData.student_id) await loadStudentBalance(enrollData.student_id, enrollData.campaign_id)
        } else {
          const { data: paidData } = await supabase.from('transactions').select('amount').eq('customer_id', customer.id).eq('campaign_id', enrollData.campaign_id).eq('type', 'payment')
          if (paidData) setAlreadyPaid(paidData.reduce((s, t) => s + Number(t.amount), 0))
          const { data: discountData } = await supabase.from('customer_discounts').select('*').eq('customer_id', customer.id).eq('campaign_id', enrollData.campaign_id).eq('is_used', false).maybeSingle()
          if (discountData) setDiscount(discountData)
        }
      }
    } catch (e) { console.error('Load enrollment error:', e) }
    setLoadingEnrollment(false)
  }

  async function loadStudentBalance(studentId, campaignId) {
    setLoadingStudent(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-student-balance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ studentId, campaignId }),
      })
      const data = await res.json()
      if (data.student) { setStudent(data.student); setTotalPaidToDate(data.payments?.totalPaid || 0); setStudentBalanceData(data) }
    } catch (e) { console.error('Load student balance error:', e) }
    setLoadingStudent(false)
  }

  const balance             = wallet   ? Number(wallet.balance)         : 0
  const target              = campaign ? Number(campaign.target_amount) : 0
  const outstanding         = studentBalanceData ? Number(studentBalanceData.payments?.outstanding || 0) : Math.max(target - totalPaidToDate, 0)
  const minPayment          = campaign ? Number(campaign.minimum_payment || 0) : 0
  const minRegAmount        = campaign ? Number(campaign.minimum_registration_amount || 0) : 0
  const maxPayableEdu       = Math.min(outstanding, balance)
  const effectiveMinEdu     = minPayment > 0 ? Math.min(minPayment, maxPayableEdu) : Math.min(1000, maxPayableEdu)
  const discountPct         = discount ? Number(discount.discount_percentage) : 0
  const rawRemaining        = Math.max(target - alreadyPaid, 0)
  const discountAmount      = discountPct > 0 ? Math.round(rawRemaining * (discountPct / 100)) : 0
  const remaining           = Math.max(rawRemaining - discountAmount, 0)
  const maxPayableGeneral   = Math.min(remaining, balance)
  const isFixedSchedule     = campaign?.allow_partial_payments && Number(campaign?.payment_discount_percentage) > 0
  const fixedPct            = isFixedSchedule ? Number(campaign.payment_discount_percentage) : 0
  const fixedMinimumUGX     = isFixedSchedule ? Math.round(target * (fixedPct / 100)) : 1000
  const effectiveMinGeneral = Math.min(fixedMinimumUGX, maxPayableGeneral)
  const maxPayable          = isEducation ? maxPayableEdu     : maxPayableGeneral
  const effectiveMin        = isEducation ? effectiveMinEdu   : effectiveMinGeneral
  const parsedAmount        = parseInt(amount.replace(/,/g, ''), 10)
  const validAmount         = !isNaN(parsedAmount) && parsedAmount >= effectiveMin && parsedAmount <= maxPayable

  async function handleEducationPay() {
    setError(''); setPaying(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-fee-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ customerId: customer.id, walletId: wallet.id, campaignId: enrollment.campaign_id, studentId: enrollment.student_id, amount: parsedAmount }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Payment failed. Please try again.'); setPaying(false); return }
      setTxnReference(data.reference); setTotalPaidToDate(data.totalPaidToDate || totalPaidToDate + parsedAmount)
      if (data.newParentBalance !== undefined) setWallet(w => ({ ...w, balance: data.newParentBalance }))
      setStep(successStep)
    } catch (e) { console.error('Education pay error:', e); setError('Something went wrong. Please try again.') }
    setPaying(false)
  }

  async function handleGeneralPay() {
    setError(''); setPaying(true)
    try {
      if (!wallet) { setError('Could not find wallet.'); setPaying(false); return }
      const newBalance = Number(wallet.balance) - parsedAmount
      if (newBalance < 0) { setError('Insufficient balance.'); setPaying(false); return }
      const reference = generateReference(); setTxnReference(reference)
      const fullPayment = parsedAmount >= remaining
      const { data: txnData, error: txnError } = await supabase.from('transactions').insert({ customer_id: customer.id, wallet_id: wallet.id, campaign_id: enrollment?.campaign_id || null, type: 'payment', amount: parsedAmount, status: 'completed', reference, notes: discount ? `Discount prize applied: ${discountPct}% (${formatUGX(discountAmount)} saved)` : null }).select()
      if (txnError) { setError('Could not record transaction.'); setPaying(false); return }
      const txnId = txnData?.[0]?.id
      if (txnId) { const partnaFee = Math.round(parsedAmount * 0.01); await supabase.from('transaction_fees').insert({ transaction_id: txnId, customer_id: customer.id, fee_type: 'payment', charged_to: 'business', partna_fee: partnaFee, carrier_fee: 0, tax: 0, total_fees: partnaFee, net_amount: parsedAmount - partnaFee }) }
      await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)
      if (fullPayment) {
        const { data: escrowWallet } = await supabase.from('escrow_wallets').select('*').eq('business_id', customer.business_id).maybeSingle()
        if (escrowWallet) { await supabase.from('escrow_wallets').update({ balance: Number(escrowWallet.balance) + parsedAmount }).eq('id', escrowWallet.id) } else { await supabase.from('escrow_wallets').insert({ business_id: customer.business_id, balance: parsedAmount }) }
        await supabase.from('sales').insert({ business_id: customer.business_id, customer_id: customer.id, campaign_id: enrollment?.campaign_id || null, transaction_id: txnId, amount: parsedAmount, type: 'retail', status: 'pending', is_prize: false, notes: discount ? `Discount prize applied: ${discountPct}% off` : null })
        setIsFullPayment(true)
      }
      if (discount) await supabase.from('customer_discounts').update({ is_used: true }).eq('id', discount.id)
      setStep(successStep)
    } catch (e) { console.error('Unexpected error:', e); setError('Something went wrong. Please try again.') }
    setPaying(false)
  }

  function handlePay() { if (isEducation) return handleEducationPay(); return handleGeneralPay() }

  // ── Shared styles ─────────────────────────────────────────────────────
  const btnPrimary = {
    width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600,
    color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 0.15s',
  }
  const btnSecondary = {
    width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600,
    color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loadingEnrollment) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const isSuccess = step === successStep

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => step === 1 || isSuccess ? navigate('/portal/home') : setStep(step - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.secondary }}>
          {isEducation ? 'Pay fees' : 'Make payment'}
        </span>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Stepper (not shown on success) ── */}
          {!isSuccess && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => {
                const done   = s < step
                const active = s === step
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < totalSteps ? 1 : 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                      background: done || active ? C.black : C.white,
                      border: `1px solid ${done || active ? C.black : C.grayLine}`,
                      color: done || active ? C.white : C.grayMid,
                      transition: 'all 0.2s',
                    }}>
                      {done ? '✓' : s}
                    </div>
                    {s < totalSteps && (
                      <div style={{ flex: 1, height: 1, background: done ? C.black : C.grayLine, transition: 'background 0.3s' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Heading ── */}
          <div>
            {!isSuccess ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 8px' }}>
                  Step {step} of {totalSteps} — {stepLabels[step - 1]}
                </p>
                <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
                  {stepTitles[step - 1]}
                </h1>
                {campaign && (
                  <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>{campaign.name}</p>
                )}
              </>
            ) : (
              <>
                {/* Success state heading */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingBottom: 4 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: 0 }}>Payment successful</h1>
                  <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
                    {isEducation ? 'Fees paid successfully' : isFullPayment ? 'Full payment received — awaiting delivery confirmation' : 'Your partial payment has been recorded'}
                  </p>
                  {txnReference && (
                    <div style={{ background: C.labelBg, borderRadius: 8, padding: '6px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: C.black, letterSpacing: '0.08em' }}>
                      {txnReference}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── EDUCATION STEP 1: Student & fee details ── */}
          {isEducation && step === 1 && (
            <>
              {loadingStudent ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div className="spinner spinner-lg" />
                </div>
              ) : !student ? (
                <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
                  No student is linked to this campaign enrollment. Please contact your school to update your account.
                </div>
              ) : (
                <>
                  {/* Student card */}
                  <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 600, color: C.black }}>
                      {student.name?.[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 3px', letterSpacing: '-0.4px' }}>{student.name}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.green }}>{student.partnaStudentId}</span>
                        {student.schoolStudentId && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>· {student.schoolStudentId}</span>}
                        {student.yearGroup && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>· {student.yearGroup}</span>}
                      </div>
                    </div>
                  </div>

                  <SummaryTable rows={[
                    { label: 'Campaign',           value: campaign?.name || '—' },
                    { label: 'Fee type',           value: FEE_TYPE_LABELS[campaign?.fee_type] || campaign?.fee_type || '—' },
                    ...(campaign?.term_or_semester ? [{ label: 'Term',          value: campaign.term_or_semester }] : []),
                    ...(campaign?.academic_year   ? [{ label: 'Academic year', value: campaign.academic_year }]   : []),
                    { label: 'Total fees',          value: formatUGX(target) },
                    { label: 'Total paid to date',  value: formatUGX(totalPaidToDate), color: C.green },
                    { label: 'Outstanding',         value: formatUGX(outstanding), color: outstanding > 0 ? C.red : C.green },
                    ...(minPayment > 0 ? [{ label: 'Minimum per payment', value: formatUGX(minPayment) }] : []),
                  ]} />

                  <RegistrationProgress totalPaid={totalPaidToDate} minRegAmount={minRegAmount} />

                  {outstanding <= 0 ? (
                    <div style={{ background: C.bgGreen, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.green }}>
                      All fees for this campaign have been paid in full.
                    </div>
                  ) : balance <= 0 ? (
                    <div style={{ background: C.bgOrange, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.orange }}>
                      Your wallet balance is UGX 0. Please make a deposit before paying fees.
                    </div>
                  ) : (
                    <button style={btnPrimary} onClick={() => setStep(2)}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
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
              {/* Balance + outstanding mini cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Wallet balance',                                value: formatUGX(balance),                                              valueColor: C.black },
                  { label: isEducation ? 'Outstanding fees' : 'Amount due', value: formatUGX(isEducation ? outstanding : remaining), valueColor: C.red   },
                ].map((card, i) => (
                  <div key={i} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: card.valueColor, margin: 0, letterSpacing: '-0.5px' }}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Education: student reminder */}
              {isEducation && student && (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 600, color: C.black }}>
                    {student.name?.[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{student.name}</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
                      {FEE_TYPE_LABELS[campaign?.fee_type] || ''}{campaign?.term_or_semester ? ` · ${campaign.term_or_semester}` : ''}
                    </p>
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
                    { label: 'Remaining',    value: formatUGX(remaining), color: C.red },
                  ]} />
                  <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                    When you complete full payment, your order will appear in the delivery queue.
                  </div>
                </>
              )}

              {/* Min payment notices */}
              {isEducation && minPayment > 0 && (
                <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
                  Your school requires a minimum payment of <strong style={{ color: C.black }}>{formatUGX(minPayment)}</strong> per transaction.
                </div>
              )}
              {!isEducation && isFixedSchedule && (
                <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
                  Fixed payment schedule — minimum <strong style={{ color: C.black }}>{fixedPct}% of target = {formatUGX(effectiveMinGeneral)}</strong> per payment.
                </div>
              )}

              {/* Amount input */}
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>Amount to pay (UGX)</label>
                  <button
                    onClick={() => setAmount(formatAmountInput(String(maxPayable)))}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    Pay in full
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
                  <input
                    type="text" inputMode="numeric" placeholder="0"
                    value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
                    style={{
                      display: 'block', width: '100%', padding: '12px 14px 12px 52px',
                      fontSize: 28, fontWeight: 600, color: C.black,
                      background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10,
                      outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.5px',
                    }}
                    onFocus={e => e.target.style.borderColor = C.black}
                    onBlur={e => e.target.style.borderColor = C.grayLine}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>Min: {formatUGX(effectiveMin)}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>Max: {formatUGX(maxPayable)}</span>
                </div>
              </div>

              {error && (
                <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red, lineHeight: '140%' }}>{error}</div>
              )}

              <button
                style={btnPrimary}
                onClick={() => {
                  if (isNaN(parsedAmount) || parsedAmount < effectiveMin) { setError(`Minimum payment is ${formatUGX(effectiveMin)}.`); return }
                  if (parsedAmount > maxPayable) { setError('Amount exceeds your available balance or outstanding fees.'); return }
                  setError(''); setStep(confirmStep)
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
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
                  { label: 'Student',   value: student.name },
                  { label: 'Partna ID', value: student.partnaStudentId, mono: true },
                  { label: 'Fee type',  value: FEE_TYPE_LABELS[campaign?.fee_type] || campaign?.fee_type || '—' },
                ] : []),
                ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#8A6700' }] : []),
                { label: 'Amount paying',            value: formatUGX(parsedAmount) },
                { label: 'Wallet balance after',     value: formatUGX(balance - parsedAmount) },
                { label: isEducation ? 'Outstanding after payment' : 'Still to pay', value: formatUGX(Math.max((isEducation ? outstanding : remaining) - parsedAmount, 0)), color: Math.max((isEducation ? outstanding : remaining) - parsedAmount, 0) > 0 ? C.red : C.green },
                { label: 'Date & time',              value: nowDisplay() },
              ]} />

              {isEducation && (
                <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                  This payment will be sent directly to your school. A confirmation SMS will be sent to your registered number.
                </div>
              )}

              {!isEducation && parsedAmount >= remaining && (
                <div style={{ background: C.bgGreen, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>
                  This is your final payment. Your order will be placed in the delivery queue.
                </div>
              )}

              {error && (
                <div style={{ background: C.bgRed, borderRadius: 8, padding: '12px 14px', fontSize: 14, fontWeight: 500, color: C.red }}>{error}</div>
              )}

              <button
                style={{ ...btnPrimary, background: C.green, borderColor: C.green, opacity: paying ? 0.75 : 1, cursor: paying ? 'not-allowed' : 'pointer' }}
                onClick={handlePay} disabled={paying}
                onMouseEnter={e => { if (!paying) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!paying) e.currentTarget.style.opacity = '1' }}
              >
                {paying
                  ? <><div className="spinner spinner-sm spinner-light" /> Processing…</>
                  : `Confirm payment of ${formatUGX(parsedAmount)}`
                }
              </button>
            </>
          )}

          {/* ── SUCCESS STEP ── */}
          {step === successStep && (
            <>
              <SummaryTable rows={[
                { label: 'Reference',  value: txnReference, mono: true, color: C.green },
                { label: isEducation ? 'Campaign' : 'Product', value: campaign?.name || '—' },
                ...(isEducation && student ? [
                  { label: 'Student',   value: student.name },
                  { label: 'Partna ID', value: student.partnaStudentId, mono: true },
                ] : []),
                ...(discount ? [{ label: 'Prize discount applied', value: `${discountPct}% (saved ${formatUGX(discountAmount)})`, color: '#8A6700' }] : []),
                { label: 'Amount paid',      value: formatUGX(parsedAmount) },
                { label: isEducation ? 'Total paid to date' : 'Remaining to pay', value: isEducation ? formatUGX(totalPaidToDate) : formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Status',           value: isEducation ? 'Completed' : isFullPayment ? 'Awaiting delivery' : 'Partial payment recorded', color: C.green },
                { label: 'Date & time',      value: nowDisplay() },
              ]} />

              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>
                  A confirmation SMS has been sent to <strong style={{ color: C.black }}>{customer?.phone}</strong>
                </span>
              </div>

              <button style={btnPrimary} onClick={() => navigate('/portal/home')}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Back to home
              </button>

              <button style={btnSecondary} onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
                onMouseEnter={e => e.currentTarget.style.background = C.accent}
                onMouseLeave={e => e.currentTarget.style.background = C.white}
              >
                View transactions
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}