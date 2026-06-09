import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

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
  const isEducation = brand.sector === 'Education'

  // Education: 3 steps (Student ID → Amount → Confirm → Success)
  // Retail:    2 steps (Amount → Confirm → Success)
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
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [txnReference, setTxnReference] = useState('')

  // Step labels and total steps differ by sector
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

  // For Education: step 1=student, 2=amount, 3=confirm, 4=success
  // For Retail:    step 1=amount,   2=confirm,          3=success
  const successStep = isEducation ? 4 : 3
  const amountStep  = isEducation ? 2 : 1
  const confirmStep = isEducation ? 3 : 2

  useEffect(() => {
    if (customer) loadData()
  }, [customer])

  async function loadData() {
    setLoading(true)
    try {
      const r1 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r1.data && r1.data.length > 0) setWallet(r1.data[0])

      const campaignId = customer.campaign_id
      if (campaignId) {
        const r2 = await supabase.from('campaigns').select('*').eq('id', campaignId)
        if (r2.data && r2.data.length > 0) setCampaign(r2.data[0])
      }

      const { data: paidData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('customer_id', customer.id)
        .eq('type', 'payment')
      if (paidData) {
        setAlreadyPaid(paidData.reduce((sum, t) => sum + Number(t.amount), 0))
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
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
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  const balance = wallet ? Number(wallet.balance) : 0
  const target = campaign ? Number(campaign.target_amount) : 0
  const remaining = Math.max(target - alreadyPaid, 0)
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

  // ── Education only: student ID lookup ──
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
        const fullName = [data.first_name, data.other_names, data.last_name]
          .filter(Boolean).join(' ')
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
      const { data: wallets, error: walletError } = await supabase
        .from('wallets').select('*').eq('customer_id', customer.id)

      if (walletError || !wallets || wallets.length === 0) {
        setError('Could not find wallet. Please try again.')
        setPaying(false)
        return
      }

      const w = wallets[0]
      const newBalance = Number(w.balance) - parsedAmount
      if (newBalance < 0) { setError('Insufficient balance.'); setPaying(false); return }

      const reference = generateReference()
      setTxnReference(reference)

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id: w.id,
          campaign_id: customer.campaign_id,
          type: 'payment',
          amount: parsedAmount,
          status: 'completed',
          reference,
          notes: isEducation && studentName
            ? 'Student: ' + studentName + ' (' + studentId + ')'
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

      await supabase.from('wallets').update({ balance: newBalance }).eq('id', w.id)

      setStep(successStep)
    } catch (e) {
      console.error('Unexpected error:', e)
      setError('Something went wrong. Please try again.')
    }
    setPaying(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => step === 1 ? navigate('/portal/home') : setStep(step - 1)}
          className="text-white text-xl">
          &#8592;
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">
            {isEducation ? 'Pay Fees' : 'Make Payment'}
          </div>
        </div>
      </header>

      {/* Step indicator */}
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
          <div className="text-white text-lg font-bold mb-1">
            {stepLabels[step - 1]}
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {stepSubs[step - 1]}
          </div>
        </div>
      )}

      {/* Success header */}
      {step === successStep && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">✅</div>
          <div className="text-white text-xl font-bold mb-1">Payment Successful</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {isEducation ? 'Fees have been paid successfully' : 'Your payment has been processed'}
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
                { label: 'Remaining', value: formatUGX(remaining) },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{ color: row.label === 'Remaining' ? '#DC2626' : brand.primaryColor }}>
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

            {/* Show campaign summary for Retail on amount step */}
            {!isEducation && (
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>PRODUCT</div>
                {[
                  { label: 'Product', value: campaign?.name || '—' },
                  { label: 'Total price', value: formatUGX(target) },
                  { label: 'Already paid', value: formatUGX(alreadyPaid) },
                  { label: 'Remaining', value: formatUGX(remaining) },
                ].map((row, i, arr) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                    <span className="text-xs font-semibold"
                      style={{ color: row.label === 'Remaining' ? '#DC2626' : brand.primaryColor }}>
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
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
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
                { label: 'Amount paying', value: formatUGX(parsedAmount) },
                { label: 'Balance after payment', value: formatUGX(balance - parsedAmount) },
                { label: isEducation ? 'Remaining fees after' : 'Remaining to pay after', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
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
                { label: 'Amount paid', value: formatUGX(parsedAmount) },
                { label: isEducation ? 'Remaining fees' : 'Remaining to pay', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Status', value: '✓ Completed' },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{
                      color: row.label === 'Status' ? '#16A34A'
                        : row.label === 'Reference' ? brand.secondaryColor
                        : brand.primaryColor,
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

            <button onClick={() => navigate('/portal/transactions')}
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