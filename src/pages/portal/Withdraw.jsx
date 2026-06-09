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

export default function Withdraw({ customer }) {
  const brand = useBrand()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState('mtn')
  const [momoPhone, setMomoPhone] = useState('')
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txnReference, setTxnReference] = useState('')

  const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
  const balance = wallet ? Number(wallet.balance) : 0
  const validAmount = !isNaN(parsedAmount) && parsedAmount >= 5000 && parsedAmount <= balance

  useEffect(() => {
    if (customer) loadWallet()
  }, [customer])

  async function loadWallet() {
    const { data } = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
    if (data && data.length > 0) setWallet(data[0])
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

  function getCarrierFee(amt) {
    if (amt <= 15000) return 570
    if (amt <= 45000) return 800
    if (amt <= 125000) return 1350
    if (amt <= 250000) return 2500
    if (amt <= 500000) return 4100
    if (amt <= 1000000) return 6000
    return 7250
  }

  function getFees(amt) {
    if (!amt || isNaN(amt)) return { partnaFee: 0, carrierFee: 0, tax: 0, totalFees: 0, netAmount: 0 }
    const partnaFee = Math.round(amt * 0.03)
    const carrierFee = getCarrierFee(amt)
    const tax = Math.round(amt * 0.005)
    const totalFees = partnaFee + carrierFee + tax
    const netAmount = amt - totalFees
    return { partnaFee, carrierFee, tax, totalFees, netAmount }
  }

  const fees = getFees(parsedAmount)

  async function handleWithdraw() {
    setError('')
    if (momoPhone.replace(/\s/g, '').length < 10) {
      setError('Please enter a valid phone number.')
      return
    }
    setLoading(true)
    try {
      const { data: wallets, error: walletError } = await supabase
        .from('wallets').select('*').eq('customer_id', customer.id)

      if (walletError || !wallets || wallets.length === 0) {
        setError('Could not find wallet. Please try again.')
        setLoading(false)
        return
      }

      const w = wallets[0]
      const newBalance = Number(w.balance) - parsedAmount

      if (newBalance < 0) { setError('Insufficient balance.'); setLoading(false); return }

      // Generate reference before insert so it shows on success screen
      const reference = generateReference()
      setTxnReference(reference)

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          wallet_id: w.id,
          campaign_id: customer.campaign_id || null,
          type: 'withdrawal',
          amount: parsedAmount,
          status: 'pending',   // withdrawals are pending until processed by Partna
          network: network,
          reference,
        })
        .select()

      if (txnError) {
        console.error('Transaction error:', txnError)
        setError('Could not record transaction. Please try again.')
        setLoading(false)
        return
      }

      const txnId = txnData?.[0]?.id
      if (txnId) {
        await supabase.from('transaction_fees').insert({
          transaction_id: txnId,
          customer_id: customer.id,
          network: network,
          fee_type: 'withdrawal',
          charged_to: 'user',
          partna_fee: fees.partnaFee,
          carrier_fee: fees.carrierFee,
          tax: fees.tax,
          total_fees: fees.totalFees,
          net_amount: fees.netAmount,
        })
      }

      // Zero balance immediately — funds are being withdrawn
      const { error: balanceError } = await supabase
        .from('wallets').update({ balance: newBalance }).eq('id', w.id)

      if (balanceError) {
        console.error('Balance error:', balanceError)
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button
          onClick={() => step === 1 ? navigate('/portal/home') : setStep(step - 1)}
          className="text-white text-xl">
          &#8592;
        </button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">Withdraw</div>
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
            {step === 1 && 'Enter Amount'}
            {step === 2 && 'Withdrawal Details'}
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {step === 1 && 'Step 1 of 2 — How much would you like to withdraw?'}
            {step === 2 && 'Step 2 of 2 — Enter your mobile money details'}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="px-5 pt-8 pb-10 text-center" style={{ background: brand.primaryColor }}>
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-white text-xl font-bold mb-1">Withdrawal Requested</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Your request is being processed
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
            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>Available balance</div>
                  <div className="text-base font-bold" style={{ color: brand.primaryColor }}>
                    {formatUGX(balance)}
                  </div>
                </div>
                <button
                  onClick={() => setAmount(formatAmountInput(String(balance)))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
                  Withdraw all
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Amount (UGX)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                <input type="text" inputMode="numeric" placeholder="0" value={amount}
                  onChange={e => setAmount(formatAmountInput(e.target.value))}
                  className="w-full pl-14 pr-4 py-4 rounded-xl text-xl font-bold outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: brand.primaryColor }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Minimum withdrawal: UGX 5,000
              </div>
            </div>

            {validAmount && (
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>FEE PREVIEW</div>
                {[
                  { label: 'Withdrawal amount', value: formatUGX(parsedAmount), color: brand.primaryColor },
                  { label: 'Partna service fee (3%)', value: '− ' + formatUGX(fees.partnaFee), color: '#DC2626' },
                  { label: 'Mobile money carrier fee', value: '− ' + formatUGX(fees.carrierFee), color: '#DC2626' },
                  { label: 'Tax (0.5%)', value: '− ' + formatUGX(fees.tax), color: '#DC2626' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-bold" style={{ color: brand.primaryColor }}>You receive</span>
                  <span className="text-sm font-bold" style={{ color: '#16A34A' }}>{formatUGX(fees.netAmount)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!validAmount) {
                  if (isNaN(parsedAmount) || parsedAmount < 5000)
                    setError('Minimum withdrawal is UGX 5,000.')
                  else if (parsedAmount > balance)
                    setError('Amount exceeds your available balance of ' + formatUGX(balance) + '.')
                  return
                }
                setError('')
                setStep(2)
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
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>WITHDRAWAL SUMMARY</div>
              {[
                { label: 'Withdrawal amount', value: formatUGX(parsedAmount), color: brand.primaryColor },
                { label: 'Partna service fee (3%)', value: '− ' + formatUGX(fees.partnaFee), color: '#DC2626' },
                { label: 'Mobile money carrier fee', value: '− ' + formatUGX(fees.carrierFee), color: '#DC2626' },
                { label: 'Tax (0.5%)', value: '− ' + formatUGX(fees.tax), color: '#DC2626' },
                { label: 'Network', value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money', color: brand.primaryColor },
                { label: 'Number', value: momoPhone || '—', color: brand.primaryColor },
                { label: 'Date & time', value: nowDisplay(), color: brand.primaryColor },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-1"
                style={{ borderTop: `2px solid ${brand.secondaryColor}` }}>
                <span className="text-xs font-bold" style={{ color: brand.primaryColor }}>You receive</span>
                <span className="text-sm font-bold" style={{ color: '#16A34A' }}>{formatUGX(fees.netAmount)}</span>
              </div>
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button onClick={handleWithdraw} disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: loading ? 'rgba(27,79,114,0.3)' : brand.primaryColor, color: '#fff' }}>
              {loading ? 'Processing...' : `Withdraw ${formatUGX(parsedAmount)}`}
            </button>
          </>
        )}

        {/* ── STEP 3: Success / pending ── */}
        {step === 3 && (
          <>
            <div className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.15)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: brand.primaryColor }}>
                ⏱ Processing time
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Withdrawals typically take <strong>1–2 business days</strong> to process.
                You will receive a notification once your withdrawal has been successfully processed.
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                TRANSACTION DETAILS
              </div>
              {[
                { label: 'Reference', value: txnReference, color: brand.secondaryColor, mono: true },
                { label: 'Amount withdrawn', value: formatUGX(parsedAmount), color: brand.primaryColor },
                { label: 'Partna service fee', value: '− ' + formatUGX(fees.partnaFee), color: '#DC2626' },
                { label: 'Carrier fee', value: '− ' + formatUGX(fees.carrierFee), color: '#DC2626' },
                { label: 'Tax', value: '− ' + formatUGX(fees.tax), color: '#DC2626' },
                { label: 'You receive', value: formatUGX(fees.netAmount), color: '#16A34A' },
                { label: 'Network', value: network === 'mtn' ? 'MTN MoMo' : 'Airtel Money', color: brand.primaryColor },
                { label: 'Number', value: momoPhone, color: brand.primaryColor },
                { label: 'Status', value: '⏳ Pending', color: '#D97706' },
                { label: 'Date & time', value: nowDisplay(), color: brand.primaryColor },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{
                      color: row.color,
                      fontFamily: row.mono ? 'monospace' : 'inherit',
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