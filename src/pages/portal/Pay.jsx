import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const CAMPAIGN_ID = 'b1b2c3d4-0000-0000-0000-000000000001'

const DEMO_STUDENTS = {
  'SC001': 'Aisha Nakato',
  'SC002': 'Brian Ssekandi',
  'SC003': 'Christine Namugga',
  'SC004': 'David Mukasa',
  'SC005': 'Esther Nabirye',
  'SC006': 'Frank Wasswa',
  'SC007': 'Grace Nalubega',
  'SC008': 'Henry Kato',
  'SC009': 'Irene Ssemwogerere',
  'SC010': 'James Mugisha',
}

export default function Pay({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentIdError, setStudentIdError] = useState('')
  const [studentIdValid, setStudentIdValid] = useState(false)
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(0)

  useEffect(() => {
    if (customer) loadData()
  }, [customer])

  useEffect(() => {
    if (customer) loadPaid()
  }, [customer])

  async function loadData() {
    setLoading(true)
    try {
      const r1 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r1.data && r1.data.length > 0) setWallet(r1.data[0])

      const r2 = await supabase.from('campaigns').select('*').eq('id', CAMPAIGN_ID)
      if (r2.data && r2.data.length > 0) setCampaign(r2.data[0])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function loadPaid() {
    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('customer_id', customer.id)
      .eq('type', 'payment')
    if (data) {
      const total = data.reduce((sum, t) => sum + Number(t.amount), 0)
      setAlreadyPaid(total)
    }
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
  const target = campaign ? Number(campaign.target_amount) : 1500000
  const remaining = Math.max(target - alreadyPaid, 0)
  const maxPayable = Math.min(remaining, balance)
  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)

  // ── Fixed payment schedule logic ──
  // campaign.payment_discount_percentage stores the fixed % (25 or 50)
  // campaign.minimum_deposit stores the actual UGX minimum per payment
  const isFixedSchedule = campaign?.allow_partial_payments &&
    Number(campaign?.payment_discount_percentage) > 0
  const fixedPct = isFixedSchedule ? Number(campaign.payment_discount_percentage) : 0
  const fixedMinimumUGX = isFixedSchedule
    ? Math.round(target * (fixedPct / 100))
    : 1000 // default minimum for flexible

  // For flexible: min is 1,000. For fixed: min is fixedMinimumUGX (but can't exceed remaining or balance)
  const effectiveMinimum = Math.min(fixedMinimumUGX, maxPayable)

  const validAmount = !isNaN(parsedAmount) &&
    parsedAmount >= effectiveMinimum &&
    parsedAmount <= maxPayable

  function handleStudentIdChange(val) {
    const upper = val.toUpperCase()
    setStudentId(upper)
    setStudentIdError('')
    setStudentIdValid(false)
    setStudentName('')
    if (upper.length >= 3) {
      const found = DEMO_STUDENTS[upper]
      if (found) { setStudentName(found); setStudentIdValid(true) }
    }
  }

  function handleStudentIdBlur() {
    if (!studentId) return
    const found = DEMO_STUDENTS[studentId.toUpperCase()]
    if (!found) {
      setStudentIdError('Student ID not found. Please check and try again.')
      setStudentIdValid(false)
      setStudentName('')
    }
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

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id: w.id,
          campaign_id: CAMPAIGN_ID,
          type: 'payment',
          amount: parsedAmount,
          status: 'completed',
          notes: 'Student: ' + studentName + ' (' + studentId + ')',
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

      const { error: balanceError } = await supabase
        .from('wallets').update({ balance: newBalance }).eq('id', w.id)

      if (balanceError) {
        console.error('Balance error:', balanceError)
        setError('Could not update balance. Please try again.')
        setPaying(false)
        return
      }

      setStep(4)
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
          <div className="text-white text-xs font-semibold">Pay Fees</div>
        </div>
      </header>

      {/* Step indicator */}
      {step < 4 && (
        <div className="px-5 pt-5 pb-8 text-center" style={{ background: brand.primaryColor }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            {[1, 2, 3].map(s => (
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
            {step === 1 && 'Student Details'}
            {step === 2 && 'Enter Amount'}
            {step === 3 && 'Confirm Payment'}
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {step === 1 && 'Step 1 of 3 — Enter the student details'}
            {step === 2 && 'Step 2 of 3 — How much would you like to pay?'}
            {step === 3 && 'Step 3 of 3 — Review and confirm your payment'}
          </div>
        </div>
      )}

      {/* Success header */}
      {step === 4 && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">✅</div>
          <div className="text-white text-xl font-bold mb-1">Payment Successful</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Fees have been paid successfully</div>
        </div>
      )}

      <div className="rounded-t-3xl flex-1 flex flex-col px-5 py-6 gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* ── STEP 1: Student details ── */}
        {step === 1 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>CAMPAIGN</div>
              {[
                { label: 'Campaign', value: campaign?.name || 'Term 3 Fees 2026' },
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

              {/* Payment schedule info */}
              {isFixedSchedule && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(27,79,114,0.06)', color: brand.primaryColor }}>
                    📋 This campaign has a <strong>fixed payment schedule</strong>.
                    Each payment must be at least{' '}
                    <strong>{fixedPct}% of the target ({formatUGX(fixedMinimumUGX)})</strong>.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Student ID</label>
              <div className="relative">
                <input type="text" placeholder="e.g. SC001" value={studentId}
                  onChange={e => handleStudentIdChange(e.target.value)}
                  onBlur={handleStudentIdBlur}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none uppercase"
                  style={{
                    background: '#fff',
                    border: studentIdValid
                      ? '1.5px solid #16A34A'
                      : studentIdError ? '1.5px solid #DC2626' : '1.5px solid rgba(27,79,114,0.15)',
                    color: '#333',
                  }} />
                {studentIdValid && (
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
            <div className="text-center text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
              Demo: try SC001 — SC010
            </div>
          </>
        )}

        {/* ── STEP 2: Amount ── */}
        {step === 2 && (
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
                  <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>Remaining fees</div>
                  <div className="text-base font-bold" style={{ color: '#DC2626' }}>
                    {formatUGX(remaining)}
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed schedule notice */}
            {isFixedSchedule && (
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
                  style={{
                    background: '#fff',
                    border: '1.5px solid rgba(27,79,114,0.15)',
                    color: brand.primaryColor,
                  }} />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                <span>
                  Minimum: {formatUGX(effectiveMinimum)}
                  {isFixedSchedule && ` (${fixedPct}% of target)`}
                </span>
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
                  setError(
                    isFixedSchedule
                      ? `This campaign requires a minimum payment of ${formatUGX(effectiveMinimum)} (${fixedPct}% of target).`
                      : 'Minimum payment is UGX 1,000.'
                  )
                  return
                }
                if (parsedAmount > maxPayable) {
                  setError('Amount exceeds your available balance or remaining fees.')
                  return
                }
                setError('')
                setStep(3)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{ background: validAmount ? brand.primaryColor : 'rgba(27,79,114,0.3)', color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>PAYMENT SUMMARY</div>
              {[
                { label: 'Campaign', value: campaign?.name || 'Term 3 Fees 2026' },
                { label: 'Student', value: studentName },
                { label: 'Student ID', value: studentId },
                { label: 'Amount paying', value: formatUGX(parsedAmount) },
                { label: 'Balance after payment', value: formatUGX(balance - parsedAmount) },
                { label: 'Remaining fees after payment', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{row.value}</span>
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

        {/* ── STEP 4: Success ── */}
        {step === 4 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>TRANSACTION DETAILS</div>
              {[
                { label: 'Campaign', value: campaign?.name || 'Term 3 Fees 2026' },
                { label: 'Student', value: studentName },
                { label: 'Student ID', value: studentId },
                { label: 'Amount paid', value: formatUGX(parsedAmount) },
                { label: 'Remaining fees', value: formatUGX(Math.max(remaining - parsedAmount, 0)) },
                { label: 'Status', value: '✓ Completed' },
                { label: 'Date & time', value: nowDisplay() },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{ color: row.label === 'Status' ? '#16A34A' : brand.primaryColor }}>
                    {row.value}
                  </span>
                </div>
              ))}
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