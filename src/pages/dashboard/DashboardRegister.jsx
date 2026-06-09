import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 49,
    annual: 470,
    features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 149,
    annual: 1430,
    features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 399,
    annual: 3830,
    features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'],
  },
]

const SECTORS = ['Education', 'Retail']

const REG_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'limited_company', label: 'Private Limited Company (Ltd)' },
]

const KYB_DOCS = {
  limited_company: [
    'Certificate of Incorporation (URSB)',
    'Memorandum & Articles of Association',
    'URA TIN Certificate',
    'Board Resolution authorizing Partna',
    'National IDs of all directors',
    'Voided cheque or bank letter',
  ],
  partnership: [
    'Certificate of Registration (URSB)',
    'Partnership URA TIN',
    'Partnership Deed',
    'Resolution authorizing Partna',
    'ID/Passport copies of all partners',
    'Cancelled cheque or bank letter',
  ],
  sole_proprietor: [
    'Business Registration Certificate',
    "National ID, Passport or Driver's License",
    'URA TIN Certificate',
    'Cancelled cheque or bank statement',
  ],
}

function FileUploadField({ label }) {
  const [file, setFile] = useState(null)

  function handleChange(e) {
    const f = e.target.files[0]
    if (f) setFile(f)
  }

  function handleRemove(e) {
    e.preventDefault()
    setFile(null)
  }

  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span className="text-xs flex-1 mr-4" style={{ color: 'rgba(0,0,0,0.6)' }}>{label}</span>
      {file ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: '#16A34A' }}>✓</span>
          <span className="text-xs truncate max-w-28" style={{ color: '#16A34A' }}>{file.name}</span>
          <button onClick={handleRemove}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            Remove
          </button>
        </div>
      ) : (
        <label className="cursor-pointer flex-shrink-0">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
            Upload
          </span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleChange} />
        </label>
      )}
    </div>
  )
}

function generateBusinessId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function generateCardNumber() {
  const digits = Math.floor(Math.random() * 1e12).toString().padStart(12, '0')
  return '5412' + digits
}

function generateCvv() {
  return Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

export default function DashboardRegister() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPaymentSidebar, setShowPaymentSidebar] = useState(false)

  // Step 1
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [selectedPackage, setSelectedPackage] = useState('growth')
  const [billingCycle, setBillingCycle] = useState('monthly')

  // Payment sidebar
  const [cardType, setCardType] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [billingAddr1, setBillingAddr1] = useState('')
  const [billingAddr2, setBillingAddr2] = useState('')
  const [billingCity, setBillingCity] = useState('')

  // Step 3
  const [sector, setSector] = useState('')
  const [addrLine1, setAddrLine1] = useState('')
  const [addrLine2, setAddrLine2] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrPostal, setAddrPostal] = useState('')
  const [addrPOBox, setAddrPOBox] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState('#D4AF37')
  const [logoPreview, setLogoPreview] = useState(null)

  // Step 4
  const [regType, setRegType] = useState('')
  const [legalName, setLegalName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [tin, setTin] = useState('')

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function formatCardNumber(val) {
    const digits = val.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  function formatExpiry(val) {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
    return digits
  }

  function validateStep1() {
    setError('')
    if (!fullName || !jobTitle || !businessName || !email || !phone || !password || !confirmPassword) {
      setError('Please fill in all required fields.'); return false
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.'); return false
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.'); return false
    }
    return true
  }

  function validateStep3() {
    setError('')
    if (!sector || !addrLine1 || !addrCity || !bizPhone) {
      setError('Please fill in all required fields.'); return false
    }
    return true
  }

  function validateStep4(skip) {
    if (skip) return true
    setError('')
    if (!regType || !legalName || !regNumber || !tin) {
      setError('Please fill in all KYB fields or choose to skip.'); return false
    }
    return true
  }

  const pkg = PACKAGES.find(p => p.id === selectedPackage)

  const subPrice = billingCycle === 'monthly' ? (pkg?.monthly || 0) : (pkg?.annual || 0)
  const setupFee = 299
  const trialDiscount = subPrice + setupFee
  const firstBillingDate = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  async function handleLaunch(skip = false) {
    if (!validateStep4(skip)) return
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      })

      if (authError) {
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          setError('An account with this email already exists. Please log in instead.')
        } else {
          setError('Could not create account: ' + authError.message)
        }
        setLoading(false)
        return
      }

      if (!authData?.user) {
        setError('Account creation failed. Please try again.')
        setLoading(false)
        return
      }

      const newBusinessId = generateBusinessId()
      const fullAddress = [addrLine1, addrLine2, addrCity, addrPostal, addrPOBox].filter(Boolean).join(', ')

      const { error: bizError } = await supabase.from('businesses').insert({
        id: newBusinessId,
        name: businessName,
        admin_email: email.toLowerCase().trim(),
        phone: bizPhone,
        sector,
        address: fullAddress,
        website: website || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        logo_url: logoPreview || '/partna-icon.svg',
        kyb_status: skip ? 'skipped' : 'pending',
        registration_type: regType || null,
        legal_name: legalName || null,
        registration_number: regNumber || null,
        tin: tin || null,
        subscription_package: selectedPackage,
      })

      if (bizError) {
        console.error('Business error:', bizError)
        setError('Could not create business profile. Please try again.')
        setLoading(false)
        return
      }

      // Include job_title in admin record
      const { error: adminError } = await supabase.from('business_admins').insert({
        business_id: newBusinessId,
        full_name: fullName,
        job_title: jobTitle,
        email: email.toLowerCase().trim(),
        phone,
        role: 'owner',
        auth_user_id: authData.user.id,
      })

      if (adminError) {
        console.error('Admin error:', adminError)
        setError('Could not create admin profile. Please try again.')
        setLoading(false)
        return
      }

      const { data: pkgData } = await supabase
        .from('subscription_packages').select('id').eq('name', pkg.name).maybeSingle()

      if (pkgData) {
        await supabase.from('business_subscriptions').insert({
          business_id: newBusinessId,
          package_id: pkgData.id,
          billing_cycle: billingCycle,
          status: 'active',
          started_at: new Date().toISOString(),
        })
      }

      await supabase.from('business_wallets').insert({
        business_id: newBusinessId,
        balance: 0,
      })

      await supabase.from('business_cards').insert({
        business_id: newBusinessId,
        card_number: generateCardNumber(),
        cvv: generateCvv(),
        expiry_date: '2029-12-31',
      })

      await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      navigate('/dashboard/overview', { replace: true })
    } catch (e) {
      console.error('Registration error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const STEP_LABELS = ['Account', 'Package', 'Business', 'Verification']

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* ── PAYMENT SIDEBAR ── */}
      {showPaymentSidebar && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1" onClick={() => setShowPaymentSidebar(false)}
            style={{ background: 'rgba(0,0,0,0.4)' }} />
          <div className="w-full max-w-md flex flex-col overflow-y-auto"
            style={{ background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Payment details</div>
              <button onClick={() => setShowPaymentSidebar(false)}
                className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>ORDER SUMMARY</div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  {pkg?.name} plan ({billingCycle === 'monthly' ? 'monthly' : 'annual'})
                </span>
                <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  {billingCycle === 'monthly' ? `$${pkg?.monthly}/mo` : `$${pkg?.annual}/yr`}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Platform setup fee (one-time)</span>
                <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>$299.00</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>3-month free trial (100% off)</span>
                <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>−${trialDiscount}</span>
              </div>
              <div className="h-px my-3" style={{ background: 'rgba(0,0,0,0.08)' }} />
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Due today</span>
                <span className="text-xl font-bold" style={{ color: PARTNA_GOLD }}>$0.00</span>
              </div>
              <div className="px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#16A34A' }}>
                First billing date: {firstBillingDate}
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Card type</label>
                <div className="flex gap-3">
                  {['Visa', 'Mastercard'].map(type => (
                    <button key={type} onClick={() => setCardType(type)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{
                        background: cardType === type ? 'rgba(27,79,114,0.06)' : '#fff',
                        border: cardType === type ? `2px solid ${PARTNA_PRIMARY}` : '2px solid rgba(0,0,0,0.1)',
                        color: PARTNA_PRIMARY,
                      }}>
                      {type === 'Visa' ? '💳 Visa' : '💳 Mastercard'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Cardholder name</label>
                <input type="text" autoComplete="cc-name" value={cardholderName}
                  onChange={e => setCardholderName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Exact name as it appears on the card</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Card number</label>
                <input type="text" inputMode="numeric" autoComplete="cc-number"
                  placeholder="•••• •••• •••• ••••" value={cardNumber}
                  onChange={e => setCardNumber(formatCardNumber(e.target.value))} maxLength={19}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono tracking-widest"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Expiry date</label>
                  <input type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
                    value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} maxLength={5}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>CVV / CVC</label>
                  <input type="password" inputMode="numeric" placeholder="•••" value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    minLength={3} maxLength={4}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>3–4 digits on back of card</div>
                </div>
              </div>
              <div className="text-xs font-bold pt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>BILLING ADDRESS</div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Address line 1</label>
                <input type="text" value={billingAddr1} onChange={e => setBillingAddr1(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Address line 2 <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                </label>
                <input type="text" value={billingAddr2} onChange={e => setBillingAddr2(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>City</label>
                <input type="text" value={billingCity} onChange={e => setBillingCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Country</label>
                <select className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  <option value="UG">Uganda</option>
                </select>
              </div>
              <button onClick={() => { setShowPaymentSidebar(false); setStep(3) }}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                Continue with {pkg?.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-3">
          <img src="/partna-icon.svg" alt="Partna" className="w-8 h-8" />
          <div>
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Partna</div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Business Portal</div>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard/login')}
          className="text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ color: PARTNA_PRIMARY, border: `1.5px solid ${PARTNA_PRIMARY}` }}>
          Log in instead
        </button>
      </header>

      {/* ── STEP INDICATOR ── */}
      <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: i + 1 < step ? PARTNA_GOLD : i + 1 === step ? '#fff' : 'rgba(255,255,255,0.2)',
                      color: i + 1 < step ? PARTNA_PRIMARY : i + 1 === step ? PARTNA_PRIMARY : 'rgba(255,255,255,0.5)',
                    }}>
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs hidden sm:block"
                    style={{ color: i + 1 === step ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    {label}
                  </span>
                </div>
                {i < 3 && <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />}
              </div>
            ))}
          </div>
          <h1 className="text-white text-xl font-bold">
            {step === 1 && 'Create your account'}
            {step === 2 && 'Choose your plan'}
            {step === 3 && 'Business details'}
            {step === 4 && 'Business verification (KYB)'}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {step === 1 && 'Step 1 of 4 — Personal and login details'}
            {step === 2 && 'Step 2 of 4 — Select a subscription package'}
            {step === 3 && 'Step 3 of 4 — Tell us about your business'}
            {step === 4 && 'Step 4 of 4 — Verify your business (optional, required for full access)'}
          </p>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">

          {error && (
            <div className="text-xs px-4 py-3 rounded-xl mb-4" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full name *</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Job title *</label>
                  <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                    placeholder="e.g. School Principal, Store Manager"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business name *</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Email address *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Phone number *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Minimum 8 characters</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Confirm password *</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>
              <button onClick={() => { if (validateStep1()) setStep(2) }}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                Continue
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                {['monthly', 'annual'].map(cycle => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold capitalize"
                    style={{
                      background: billingCycle === cycle ? PARTNA_PRIMARY : '#fff',
                      color: billingCycle === cycle ? '#fff' : PARTNA_PRIMARY,
                      border: `1.5px solid ${PARTNA_PRIMARY}`
                    }}>
                    {cycle}
                    {cycle === 'annual' && (
                      <span className="text-xs ml-1.5"
                        style={{ color: billingCycle === 'annual' ? PARTNA_GOLD : 'rgba(27,79,114,0.5)' }}>
                        Save ~20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {PACKAGES.map(p => (
                  <button key={p.id} onClick={() => setSelectedPackage(p.id)}
                    className="rounded-2xl p-5 text-left flex flex-col gap-3"
                    style={{
                      background: '#fff',
                      border: selectedPackage === p.id ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)',
                    }}>
                    <div>
                      <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>{p.name}</div>
                      <div className="text-2xl font-bold mt-1" style={{ color: PARTNA_PRIMARY }}>
                        ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                        <span className="text-xs font-normal" style={{ color: 'rgba(0,0,0,0.4)' }}>/mo</span>
                      </div>
                      {billingCycle === 'annual' && (
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>${p.annual}/yr</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs flex-shrink-0" style={{ color: PARTNA_GOLD }}>✓</span>
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {selectedPackage === p.id && (
                      <div className="text-xs font-bold text-center py-1.5 rounded-lg"
                        style={{ background: PARTNA_GOLD, color: PARTNA_PRIMARY }}>
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={() => setShowPaymentSidebar(true)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Continue with {pkg?.name} →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Sector *</label>
                  <select value={sector} onChange={e => setSector(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: sector ? '#333' : 'rgba(0,0,0,0.4)' }}>
                    <option value="">Select sector</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business name</label>
                  <input type="text" value={businessName} readOnly
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>BUSINESS ADDRESS</div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Address line 1 (Street address) *
                    </label>
                    <input type="text" value={addrLine1} onChange={e => setAddrLine1(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Address line 2 (Area / Village)
                      <span className="ml-1" style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                    </label>
                    <input type="text" value={addrLine2} onChange={e => setAddrLine2(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>City / Town *</label>
                      <input type="text" value={addrCity} onChange={e => setAddrCity(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                        Postal code <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                      </label>
                      <input type="text" value={addrPostal} onChange={e => setAddrPostal(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Country</label>
                      <select className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                        <option value="UG">Uganda</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                        P.O. Box <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                      </label>
                      <input type="text" value={addrPOBox} onChange={e => setAddrPOBox(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business phone *</label>
                  <input type="tel" value={bizPhone} onChange={e => setBizPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Website <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                  </label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>BRANDING</div>
                <div className="grid grid-cols-3 gap-4 items-start">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Logo</label>
                    <label className="cursor-pointer flex flex-col items-center justify-center rounded-xl py-4 gap-2"
                      style={{ border: '2px dashed rgba(27,79,114,0.2)', background: '#f8f9fa' }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain" />
                      ) : (
                        <>
                          <span className="text-2xl">📷</span>
                          <span className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>Upload logo</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Primary colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                      <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>{primaryColor}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Header, buttons</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Secondary colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                      <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>{secondaryColor}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Accents, highlights</div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ background: primaryColor }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="" className="w-7 h-7 object-contain" style={{ mixBlendMode: 'screen' }} />
                      : <div className="w-7 h-7 rounded-full" style={{ background: secondaryColor }} />
                    }
                    <span className="text-white text-xs font-semibold">{businessName || 'Your Business'}</span>
                    <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: secondaryColor, color: primaryColor }}>A</div>
                  </div>
                  <div className="px-4 py-2 text-xs" style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.4)' }}>
                    Preview of customer portal header
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={() => { if (validateStep3()) setStep(4) }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)', color: PARTNA_PRIMARY }}>
                KYB verification is required for full platform access. You can skip this step and complete it later from your settings, but features will remain locked until verified.
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Registration type *</label>
                <select value={regType} onChange={e => setRegType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: regType ? '#333' : 'rgba(0,0,0,0.4)' }}>
                  <option value="">Select registration type</option>
                  {REG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Legal business name *</label>
                <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business registration number *</label>
                  <input type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>TIN *</label>
                  <input type="text" value={tin} onChange={e => setTin(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              {regType && KYB_DOCS[regType] && (
                <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    REQUIRED DOCUMENTS — {REG_TYPES.find(r => r.value === regType)?.label?.toUpperCase()}
                  </div>
                  <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Accepted: PDF, JPEG, PNG. Max 10MB per file.
                  </div>
                  {KYB_DOCS[regType].map((doc, i) => (
                    <FileUploadField key={i} label={doc} />
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={() => handleLaunch(true)} disabled={loading}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: 'rgba(0,0,0,0.4)', border: '1.5px solid rgba(0,0,0,0.12)' }}>
                  Skip for now
                </button>
                <button onClick={() => handleLaunch(false)} disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: loading ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                  {loading ? 'Creating account...' : 'Submit & finish'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <footer className="text-center py-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>© 2026 Partna. All rights reserved.</span>
      </footer>

    </div>
  )
}