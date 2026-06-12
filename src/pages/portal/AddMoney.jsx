import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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

export default function AddMoney({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  // Enrollment context passed from Home via router state
  const enrollmentId = location.state?.enrollmentId || null

  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState('mtn')
  const [momoPhone, setMomoPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingEnrollment, setLoadingEnrollment] = useState(true)
  const [error, setError] = useState('')
  const [txnReference, setTxnReference] = useState('')

  // Enrollment data — loaded from enrollmentId
  const [enrollment, setEnrollment] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [campaign, setCampaign] = useState(null)

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const validAmount = !isNaN(parsedAmount) && parsedAmount >= 1000

  useEffect(() => {
    if (customer) loadEnrollment()
  }, [customer, enrollmentId])

  async function loadEnrollment() {
    setLoadingEnrollment(true)
    try {
      let enrollQuery = supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')

      // If a specific enrollment was passed use it, otherwise fall back to first
      if (enrollmentId) {
        enrollQuery = enrollQuery.eq('id', enrollmentId)
      } else {
        enrollQuery = enrollQuery.order('enrolled_at', { ascending: true }).limit(1)
      }

      const { data } = await enrollQuery.maybeSingle()

      if (data) {
        setEnrollment(data)
        setCampaign(data.campaigns)
        setWallet(data.wallets)
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

  async function handlePay() {
    setError('')
    if (momoPhone.replace(/\s/g, '').length < 10) {
      setError('Please enter a valid phone number.')
      return
    }
    if (!wallet) {
      setError('Could not find wallet. Please go back and try again.')
      return
    }

    setLoading(true)
    try {
      const newBalance = Number(wallet.balance) + parsedAmount
      const reference = generateReference()
      setTxnReference(reference)

      // Insert transaction — linked to the correct campaign
      const { error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id: wallet.id,
          campaign_id: enrollment?.campaign_id || null,
          type: 'deposit',
          amount: parsedAmount,
          status: 'completed',
          network,
          reference,
        })

      if (txnError) {
        console.error('Transaction insert error:', txnError)
        setError('Could not record transaction. Please try again.')
        setLoading(false)
        return
      }

      // Update the campaign-specific wallet balance
      const { error: balanceError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id)

      if (balanceError) {
        console.error('Balance update error:', balanceError)
        setError('Could not update balance. Please try again.')
        setLoading(false)
        return
      }

      setStep(3)
    } catch (e) {
      console.error('Unexpected error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
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
            <div className="text-white text-xs font-semibold">Add Money</div>
            {campaign && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {campaign.name}
              </div>
            )}
          </div>
        </div>
      </header>

      {step < 3 && (
        <div className="px-5 pt-5 pb-8 text-center" style={{ background: brand.primaryColor }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            {[1, 2].map(s => (
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
            {step === 1 ? 'Enter Amount' : 'Mobile Money Details'}
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {step === 1
              ? 'Step 1 of 2 — How much would you like to deposit?'
              : 'Step 2 of 2 — Enter your mobile money details'}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">✅</div>
          <div className="text-white text-xl font-bold mb-1">Payment Received</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Your balance has been updated
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

        {/* ── STEP 1: Amount ── */}
        {step === 1 && (
          <>
            {/* Campaign context */}
            {campaign && (
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                  DEPOSITING INTO
                </div>
                {[
                  { label: 'Campaign', value: campaign.name },
                  { label: 'Current balance', value: formatUGX(wallet?.balance || 0) },
                  { label: 'Target amount', value: formatUGX(campaign.target_amount) },
                ].map((row, i, arr) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Amount (UGX)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                <input type="text" inputMode="numeric" placeholder="0" value={amount}
                  onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="w-full pl-14 pr-4 py-4 rounded-xl text-xl font-bold outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: brand.primaryColor }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Minimum deposit: UGX 1,000
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
                if (validAmount) { setError(''); setStep(2) }
                else setError('Please enter a valid amount of at least UGX 1,000.')
              }}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2"
              style={{ background: validAmount ? brand.primaryColor : 'rgba(27,79,114,0.3)', color: '#fff' }}>
              Continue
            </button>
          </>
        )}

        {/* ── STEP 2: Mobile money details ── */}
        {step === 2 && (
          <>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: brand.primaryColor }}>
                Select network
              </label>
              <div className="flex gap-3">
                {[
                  { id: 'mtn', logo: '/mtn-logo.svg', label: 'MTN MoMo' },
                  { id: 'airtel', logo: '/airtel-logo.svg', label: 'Airtel Money' },
                ].map(net => (
                  <button key={net.id} onClick={() => setNetwork(net.id)}
                    className="flex-1 rounded-2xl p-3 flex flex-col items-center gap-2"
                    style={{
                      background: '#fff',
                      border: network === net.id
                        ? `2px solid ${brand.secondaryColor}`
                        : '2px solid rgba(0,0,0,0.06)',
                    }}>
                    <img src={net.logo} alt={net.label} className="w-12 h-12 object-contain rounded-xl" />
                    <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                      {net.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Mobile money number
              </label>
              <input type="tel" placeholder="+256 7XX XXX XXX" value={momoPhone}
                onChange={e => setMomoPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
            </div>

            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                PAYMENT SUMMARY
              </div>
              {[
                { label: 'Campaign', value: campaign?.name || '—' },
                { label: 'Amount', value: formatUGX(parsedAmount) },
                { label: 'Network', value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money' },
                { label: 'Number', value: momoPhone || '—' },
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
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handlePay} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: loading ? 'rgba(27,79,114,0.3)' : brand.primaryColor, color: '#fff' }}>
              {loading ? 'Processing...' : `Pay ${formatUGX(parsedAmount)}`}
            </button>
          </>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <>
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                TRANSACTION DETAILS
              </div>
              {[
                { label: 'Reference', value: txnReference },
                { label: 'Campaign', value: campaign?.name || '—' },
                { label: 'Amount deposited', value: formatUGX(parsedAmount) },
                { label: 'Network', value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money' },
                { label: 'Number', value: momoPhone },
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