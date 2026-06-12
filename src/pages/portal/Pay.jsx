import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const PARTNA_GOLD = '#D4AF37'

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'TXN-'
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

export default function Pay({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const location = useLocation()
  const isEducation = brand.sector === 'Education'

  const enrollmentId = location.state?.enrollmentId || null

  const [step, setStep] = useState(1)

  // Education-only state
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentIdError, setStudentIdError] = useState('')
  const [studentIdValid, setStudentIdValid] = useState(false)
  const [studentLookingUp, setStudentLookingUp] = useState(false)

  // Shared state
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [txnReference, setTxnReference] = useState('')
  const [isFullPayment, setIsFullPayment] = useState(false)

  // Discount prize state
  const [discount, setDiscount] = useState(null)

  const totalSteps = isEducation ? 3 : 2
  const stepLabels = isEducation
    ? ['Student Details', 'Enter Amount', 'Confirm Payment']
    : ['Enter Amount', 'Confirm Payment']
  const stepSubs = isEducation
    ? [
        'Step 1 of 3 — Enter the student details',
        'Step 2 of 3 — How much would you like to pay?',
        'Step 3 of 3 — Review and confirm your payment',
      ]
    : [
        'Step 1 of 2 — How much would you like to pay?',
        'Step 2 of 2 — Review and confirm your payment',
      ]

  const successStep = isEducation ? 4 : 3
  const amountStep  = isEducation ? 2 : 1
  const confirmStep = isEducation ? 3 : 2

  useEffect(() => {
    if (customer) loadEnrollment()
  }, [customer, enrollmentId])

  async function loadEnrollment() {
    setLoadingEnrollment(true)
    try {
      // Load the specific enrollment (or first active if none passed)
      let query = supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')

      if (enrollmentId) {
        query = query.eq('id', enrollmentId)
      } else {
        query = query.order('enrolled_at', { ascending: true }).limit(1)
      }

      const { data: enrollData } = await query.maybeSingle()

      if (enrollData) {
        setEnrollment(enrollData)
        setCampaign(enrollData.campaigns)
        setWallet(enrollData.wallets)

        // Already paid for this specific campaign
        const { data: paidData } = await supabase
          .from('transactions')
          .select('amount')
          .eq('customer_id', customer.id)
          .eq('campaign_id', enrollData.campaign_id)
          .eq('type', 'payment')
        if (paidData) {
          setAlreadyPaid(paidData.reduce((sum, t) => sum + Number(t.amount), 0))
        }

        // Unused discount for this specific campaign
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

  const balance = wallet ? Number(wallet.balance) : 0
  const target = campaign ? Number(campaign.target_amount) : 0
  const rawRemaining = Math.max(target - alreadyPaid, 0)

  const discountPct = discount ? Number(discount.discount_percentage) : 0
  const discountAmount = discountPct > 0 ? Math.round(rawRemaining * (discountPct / 100)) : 0
  const remaining = Math.max(rawRemaining - discountAmount, 0)

  const maxPayable = Math.min(remaining, balance)
  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)

  const isFixedSchedule = campaign?.allow_partial_payments &&
    Number(campaign?.payment_discount_percentage) > 0
  const fixedPct = isFixedSchedule ? Number(campaign.payment_discount_percentage) : 0
  const fixedMinimumUGX = isFixedSchedule ? Math.round(target * (fixedPct / 100)) : 1000
  const effectiveMinimum = Math.min(fixedMinimumUGX, maxPayable)

  const validAmount = !isNaN(parsedAmount) &&
    parsedAmount >= effectiveMinimum &&
    parsedAmount <= maxPayable

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
        const fullName = [data.first_name, data.other_names, data.last_name].filter(Boolean).join(' ')
        setStudentName(fullName)
        setStudentIdValid(true)
      } else {
        setStudentIdValid(false)
        setStudentName('')
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
      if (!wallet) {
        setError('Could not find wallet. Please go back and try again.')
        setPaying(false)
        return
      }

      const newBalance = Number(wallet.balance) - parsedAmount
      if (newBalance < 0) { setError('Insufficient balance.'); setPaying(false); return }

      const reference = generateReference()
      setTxnReference(reference)

      const fullPayment = parsedAmount >= remaining

      // Record transaction — scoped to the correct campaign
      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id: wallet.id,
          campaign_id: enrollment?.campaign_id || null,
          type: 'payment',
          amount: parsedAmount,
          status: 'completed',
          reference,
          notes: isEducation && studentName
            ? 'Student: ' + studentName + ' (' + studentId + ')'
            : discount
            ? `Discount prize applied: ${discountPct}% (${formatUGX(discountAmount)} saved)`
            : null,
        })
        .select()

      if (txnError) {
        console.error('Transaction error:', txnError)
        setError('Could not record transaction. Please try again.')
        setPaying(false)
        return
      }

      const txnId = txnData?.[0]?.id

      // Fee
      if (txnId) {
        const partnaFee = Math.round(parsedAmount * 0.01)
        await supabase.from('transaction_fees').insert({
          transaction_id: txnId,
          customer_id: customer.id,
          fee_type: 'payment',
          charged_to: 'business',
          partna_fee: partnaFee,
          carrier_fee: 0,
          tax: 0,
          total_fees: partnaFee,
          net_amount: parsedAmount - partnaFee,
        })
      }

      // Deduct from campaign-specific wallet
      await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id)

      // ── EDUCATION: funds → business wallet directly ──
      if (isEducation) {
        const { data: bizWallet } = await supabase
          .from('business_wallets')
          .select('*')
          .eq('business_id', customer.business_id)
          .maybeSingle()

        if (bizWallet) {
          await supabase.from('business_wallets')
            .update({ balance: Number(bizWallet.balance) + parsedAmount })
            .eq('id', bizWallet.id)
        } else {
          await supabase.from('business_wallets').insert({
            business_id: customer.business_id,
            balance: parsedAmount,
          })
        }

        await supabase.from('business_transactions').insert({
          business_id: customer.business_id,
          type: 'fee_payment',
          amount: parsedAmount,
          status: 'completed',
          reference,
          notes: `Fee payment from ${customer.first_name} ${customer.last_name}` +
            (studentName ? ` — Student: ${studentName} (${studentId})` : ''),
        })
      }

      // ── RETAIL + FULL PAYMENT: funds → escrow + create sales record ──
      if (!isEducation && fullPayment) {
        const { data: escrowWallet } = await supabase
          .from('escrow_wallets')
          .select('*')
          .eq('business_id', customer.business_id)
          .maybeSingle()

        if (escrowWallet) {
          await supabase.from('escrow_wallets')
            .update({ balance: Number(escrowWallet.balance) + parsedAmount })
            .eq('id', escrowWallet.id)
        } else {
          await supabase.from('escrow_wallets').insert({
            business_id: customer.business_id,
            balance: parsedAmount,
          })
        }

        await supabase.from('sales').insert({
          business_id: customer.business_id,
          customer_id: customer.id,
          campaign_id: enrollment?.campaign_id || null,
          transaction_id: txnId,
          amount: parsedAmount,
          type: 'retail',
          status: 'pending',
          is_prize: false,
          notes: discount ? `Discount prize applied: ${discountPct}% off` : null,
        })

        setIsFullPayment(true)
      }

      // Mark discount as used
      if (discount) {
        await supabase.from('customer_discounts')
          .update({ is_used: true })
          .eq('id', discount.id)
      }

      setStep(successStep)
    } catch (e) {
      console.error('Unexpected error:', e)
      setError('Something went wrong. Please try again.')
    }
    setPaying(false)
  }

  if (loadingEnrollment) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => step === 1 ? navigate('/portal/home') : setStep(step - 1)}
          className="text-white text-xl">
          &#8592;
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain"
            style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-white text-xs font-semibold">
              {isEducation ? 'Pay Fees' : 'Make Payment'}
            </div>
            {campaign && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {campaign.name}
              </div>
            )}
          </div>
        </div>
      </header>

      {step < successStep && (
        <div className="px-5 pt-5 pb-8 text-center" style={{ background: brand.primaryColor }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div key={s} className="rounded-full transition-all"
                style={{
                  width: s === step ? '24px' : '8px',
                  height: '8px',
                  background: s === step
                    ? brand.secondaryColor
                    : s < step ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.25)',
                }} />
            ))}
          </div>
          <div className="text-white text-lg font-bold mb-1">{stepLabels[step - 1]}</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{stepSubs[step - 1]}</div>
        </div>
      )}

      {step === successStep && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">✅</div>
          <div className="text-white text-xl font-bold mb-1">Payment Successful</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {isEducation
              ? 'Fees have been paid successfully'
              : isFullPayment
              ? 'Full payment received — awaiting delivery confirmation'
              : 'Your partial payment has been recorded'}
          </div>
          {txnReference && (
            <div className="mt-2 text-xs font-mono font-bold" style={{ color: brand.secondaryColor }}>
              {txnReference}
            </div>
          )}
        </div>
      )}

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* ── EDUCATION STEP 1: Student details ── */}
        {isEducation && step === 1 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>CAMPAIGN</div>
              {[
                { label: 'Campaign', value: campaign?.name || '—' },
                { label: 'Target amount', value: formatUGX(target) },
                { label: 'Already paid', value: formatUGX(alreadyPaid) },
                { label: 'Remaining', value: formatUGX(remaining), color: '#DC2626' },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color || brand.primaryColor }}>
                    {row.value}
                  </span>
                </div>
              ))}
              {discount && (
                <div className="mt-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)' }}>
                  <div className="text-xs font-bold mb-0.5" style={{ color: '#92400e' }}>
                    🏆 Prize draw discount applied!
                  </div>
                  <div className="text-xs" style={{ color: '#92400e' }}>
                    You won a {discountPct}% discount — saving you {formatUGX(discountAmount)}.
                    Your balance to pay is now {formatUGX(remaining)}.
                  </div>
                </div>
              )}
              {isFixedSchedule && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(27,79,114,0.06)', color: brand.primaryColor }}>
                    📋 Fixed payment schedule — minimum{' '}
                    <strong>{fixedPct}% of target ({formatUGX(fixedMinimumUGX)})</strong> per payment.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Student ID</label>
              <div className="relative">
                <input type="text" placeholder="Enter student ID" value={studentId}
                  onChange={e => handleStudentIdChange(e.target.value)}
                  onBlur={handleStudentIdBlur}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none uppercase"
                  style={{
                    background: '#fff',
                    border: studentIdValid ? '1.5px solid #16A34A'
                      : studentIdError ? '1.5px solid #DC2626'
                      : '1.5px solid rgba(27,79,114,0.15)',
                    color: '#333',
                  }} />
                {studentLookingUp && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
                )}
                {studentIdValid && !studentLookingUp && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold"
                    style={{ color: '#16A34A' }}>✓</span>
                )}
              </div>
              {studentIdError && (
                <div className="text-xs" style={{ color: '#DC2626' }}>{studentIdError}</div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Student name</label>
              <input type="text" placeholder="Auto-filled from Student ID" value={studentName} readOnly
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: studentName ? 'rgba(22,163,74,0.05)' : '#f8f8f8',
                  border: studentName ? '1.5px solid #16A34A' : '1.5px solid rgba(27,79,114,0.1)',
                  color: studentName ? '#16A34A' : 'rgba(0,0,0,0.3)',
                  fontWeight: studentName ? 600 : 400,
                }} />
              {!studentName && (
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                  Enter a valid Student ID to auto-fill the student name
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!studentIdValid) {
                  setStudentIdError('Please enter a valid Student ID to continue.')
                  return
                }
                setStep(2)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{ background: studentIdValid ? brand.primaryColor : 'rgba(27,79,114,0.3)', color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {/* ── AMOUNT STEP ── */}
        {step === amountStep && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>Available balance</div>
                  <div className="text-base font-bold" style={{ color: brand.primaryColor }}>
                    {formatUGX(balance)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {isEducation ? 'Remaining fees' : 'Remaining to pay'}
                  </div>
                  <div className="text-base font-bold" style={{ color: '#DC2626' }}>
                    {formatUGX(remaining)}
                  </div>
                </div>
              </div>
            </div>

            {discount && (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)' }}>
                <div className="text-xs font-bold mb-0.5" style={{ color: '#92400e' }}>
                  🏆 Prize draw discount: {discountPct}% off!
                </div>
                <div className="text-xs" style={{ color: '#92400e' }}>
                  You're saving {formatUGX(discountAmount)}.
                  Original: {formatUGX(rawRemaining)} → Now: {formatUGX(remaining)}
                </div>
              </div>
            )}

            {!isEducation && (
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>PRODUCT</div>
                {[
                  { label: 'Product', value: campaign?.name || '—' },
                  { label: 'Total price', value: formatUGX(target) },
                  { label: 'Already paid', value: formatUGX(alreadyPaid) },
                  ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: PARTNA_GOLD }] : []),
                  { label: 'Remaining', value: formatUGX(remaining), color: '#DC2626' },
                ].map((row, i, arr) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: row.color || brand.primaryColor }}>
                      {row.value}
                    </span>
                  </div>
                ))}
                {isFixedSchedule && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'rgba(27,79,114,0.06)', color: brand.primaryColor }}>
                      📋 Fixed payment schedule — minimum{' '}
                      <strong>{fixedPct}% of target ({formatUGX(fixedMinimumUGX)})</strong> per payment.
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isEducation && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)', color: brand.primaryColor }}>
                ℹ️ When you complete full payment, your order will appear in the business's Sales queue awaiting delivery confirmation.
              </div>
            )}

            {isFixedSchedule && isEducation && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)', color: brand.primaryColor }}>
                📋 Fixed payment schedule: minimum payment is{' '}
                <strong>{fixedPct}% of target = {formatUGX(effectiveMinimum)}</strong>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                  Amount to pay (UGX)
                </label>
                <button onClick={() => setAmount(formatAmountInput(String(maxPayable)))}
                  className="text-xs font-semibold px-3 py-1 rounded-lg"
                  style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
                  Pay in full
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                <input type="text" inputMode="numeric" placeholder="0" value={amount}
                  onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="w-full pl-14 pr-4 py-4 rounded-xl text-xl font-bold outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: brand.primaryColor }} />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                <span>Minimum: {formatUGX(effectiveMinimum)}{isFixedSchedule && ` (${fixedPct}%)`}</span>
                <span>Maximum: {formatUGX(maxPayable)}</span>
              </div>
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
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
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{ background: validAmount ? brand.primaryColor : 'rgba(27,79,114,0.3)', color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {/* ── CONFIRM STEP ── */}
        {step === confirmStep && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                PAYMENT SUMMARY
              </div>
              {[
                { label: isEducation ? 'Campaign' : 'Product', value: campaign?.name || '—' },
                ...(isEducation ? [
                  { label: 'Student', value: studentName },
                  { label: 'Student ID', value: studentId },
                ] : []),
                ...(discount ? [{ label: `Prize discount (${discountPct}%)`, value: `− ${formatUGX(discountAmount)}`, color: '#D97706' }] : []),
                { label: 'Amount paying', value: formatUGX(parsedAmount) },
                { label: 'Balance after payment', value: formatUGX(balance - parsedAmount) },
                { label: isEducation ? 'Remaining fees after' : 'Remaining to pay after', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color || brand.primaryColor }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {!isEducation && parsedAmount >= remaining && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#166534' }}>
                ✓ This is your final payment. Your order will be placed in the delivery queue and released to the business once they confirm delivery.
              </div>
            )}

            {discount && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#92400e' }}>
                🏆 Your prize discount of {discountPct}% will be applied and marked as used after this payment.
              </div>
            )}

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handlePay} disabled={paying}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: paying ? 'rgba(27,79,114,0.3)' : brand.primaryColor, color: '#fff' }}>
              {paying ? 'Processing...' : `Confirm Payment of ${formatUGX(parsedAmount)}`}
            </button>
          </>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === successStep && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                TRANSACTION DETAILS
              </div>
              {[
                { label: 'Reference', value: txnReference },
                { label: isEducation ? 'Campaign' : 'Product', value: campaign?.name || '—' },
                ...(isEducation ? [
                  { label: 'Student', value: studentName },
                  { label: 'Student ID', value: studentId },
                ] : []),
                ...(discount ? [{ label: 'Prize discount applied', value: `${discountPct}% (saved ${formatUGX(discountAmount)})`, color: '#D97706' }] : []),
                { label: 'Amount paid', value: formatUGX(parsedAmount) },
                { label: isEducation ? 'Remaining fees' : 'Remaining to pay', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                {
                  label: 'Status',
                  value: isEducation ? '✓ Completed' : isFullPayment ? '⏳ Awaiting delivery' : '✓ Partial payment recorded',
                },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{
                      color: row.color || (row.label === 'Status'
                        ? (isEducation || !isFullPayment ? '#16A34A' : '#D97706')
                        : row.label === 'Reference' ? brand.secondaryColor
                        : brand.primaryColor),
                      fontFamily: row.label === 'Reference' ? 'monospace' : 'inherit',
                    }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 rounded-xl text-xs text-center"
              style={{ background: 'rgba(27,79,114,0.06)', color: 'rgba(0,0,0,0.5)' }}>
              📧 A receipt has been sent to {customer?.email}
            </div>

            <button onClick={() => navigate('/portal/home')}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: brand.primaryColor, color: '#fff' }}>
              Back to Home
            </button>

            <button onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'transparent', color: brand.primaryColor, border: '1.5px solid rgba(27,79,114,0.2)' }}>
              View transactions
            </button>
          </>
        )}

      </div>
    </div>
  )
}