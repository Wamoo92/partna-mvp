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
    campaigns: 1,
    customers: 100,
    vouchers: 3,
    prizes: false,
    features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'Basic analytics'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 149,
    annual: 1430,
    campaigns: 3,
    customers: 500,
    vouchers: 8,
    prizes: true,
    features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes', 'Advanced analytics'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 399,
    annual: 3830,
    campaigns: null,
    customers: null,
    vouchers: null,
    prizes: true,
    cashPrizes: true,
    features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash', 'Dedicated account manager'],
  },
]

const SECTORS = ['Education', 'Retail', 'Healthcare', 'Hospitality', 'Other']

const REG_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'limited_company', label: 'Private Limited Company (Ltd)' },
]

function generateBusinessId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default function DashboardRegister() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Account
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — Subscription
  const [selectedPackage, setSelectedPackage] = useState('growth')
  const [billingCycle, setBillingCycle] = useState('monthly')

  // Step 3 — Business details
  const [sector, setSector] = useState('')
  const [address, setAddress] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState('#D4AF37')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  // Step 4a — KYB info
  const [regType, setRegType] = useState('')
  const [legalName, setLegalName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [tin, setTin] = useState('')

  // Stored IDs
  const [businessId, setBusinessId] = useState(null)

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleStep1() {
    setError('')
    if (!fullName || !businessName || !email || !phone || !password || !confirmPassword) {
      setError('Please fill in all required fields.')
      return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setStep(2)
  }

  async function handleStep2() {
    setError('')
    if (!selectedPackage) {
      setError('Please select a subscription package.')
      return
    }
    setStep(3)
  }

  async function handleStep3() {
    setError('')
    if (!sector || !address || !bizPhone) {
      setError('Please fill in all required fields.')
      return
    }
    setStep(4)
  }

  async function handleStep4(skip = false) {
    setError('')

    if (!skip && (!regType || !legalName || !regNumber || !tin)) {
      setError('Please fill in all KYB fields or choose to skip.')
      return
    }

    setLoading(true)
    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      })

      if (authError) {
        setError('Could not create account: ' + authError.message)
        setLoading(false)
        return
      }

      const newBusinessId = generateBusinessId()
      setBusinessId(newBusinessId)

      // 2. Create business record
      const { error: bizError } = await supabase.from('businesses').insert({
        id: newBusinessId,
        name: businessName,
        admin_email: email.toLowerCase().trim(),
        phone: bizPhone,
        sector: sector,
        address: address,
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

      // 3. Create business admin record
      const { error: adminError } = await supabase.from('business_admins').insert({
        business_id: newBusinessId,
        full_name: fullName,
        email: email.toLowerCase().trim(),
        phone: phone,
        role: 'owner',
        auth_user_id: authData.user.id,
      })

      if (adminError) {
        console.error('Admin error:', adminError)
        setError('Could not create admin profile. Please try again.')
        setLoading(false)
        return
      }

      // 4. Create subscription record
      const pkg = PACKAGES.find(p => p.id === selectedPackage)
      const { data: pkgData } = await supabase
        .from('subscription_packages')
        .select('id')
        .eq('name', pkg.name)
        .single()

      if (pkgData) {
        await supabase.from('business_subscriptions').insert({
          business_id: newBusinessId,
          package_id: pkgData.id,
          billing_cycle: billingCycle,
          status: 'active',
          started_at: new Date().toISOString(),
        })
      }

      // 5. Sign in immediately
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

  const pkg = PACKAGES.find(p => p.id === selectedPackage)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
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

      {/* Step indicator */}
      <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            {['Account', 'Package', 'Business', 'Verification'].map((label, i) => (
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

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full name *</label>
                  <input type="text" placeholder="Jane Nakamya" value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business name *</label>
                  <input type="text" placeholder="St. Catherine's College" value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Email address *</label>
                  <input type="email" placeholder="jane@stcatherines.ac.ug" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Phone number *</label>
                  <input type="tel" placeholder="+256 7XX XXX XXX" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Password *</label>
                  <input type="password" placeholder="Min 8 characters" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Confirm password *</label>
                  <input type="password" placeholder="Repeat password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                A verification link will be sent to your email address. Demo mode: email verification is simulated.
              </div>

              {error && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

              <button onClick={handleStep1}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                Continue
              </button>
            </div>
          )}

          {/* ── STEP 2: Package ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <button onClick={() => setBillingCycle('monthly')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: billingCycle === 'monthly' ? PARTNA_PRIMARY : '#fff',
                    color: billingCycle === 'monthly' ? '#fff' : PARTNA_PRIMARY,
                    border: `1.5px solid ${PARTNA_PRIMARY}`
                  }}>
                  Monthly
                </button>
                <button onClick={() => setBillingCycle('annual')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: billingCycle === 'annual' ? PARTNA_PRIMARY : '#fff',
                    color: billingCycle === 'annual' ? '#fff' : PARTNA_PRIMARY,
                    border: `1.5px solid ${PARTNA_PRIMARY}`
                  }}>
                  Annual <span className="text-xs ml-1" style={{ color: billingCycle === 'annual' ? PARTNA_GOLD : 'rgba(27,79,114,0.5)' }}>Save ~20%</span>
                </button>
              </div>

              {/* Package cards */}
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
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          ${p.annual}/yr
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs" style={{ color: PARTNA_GOLD }}>✓</span>
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

              {/* Payment placeholder */}
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>PAYMENT DETAILS</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Card number</label>
                    <input type="text" placeholder="•••• •••• •••• ••••"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Expiry</label>
                    <input type="text" placeholder="MM/YY"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>CVV</label>
                    <input type="text" placeholder="•••"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                </div>
                <div className="text-xs mt-3 text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Payment integration coming soon — no charge will be made
                </div>
              </div>

              {error && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={handleStep2}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Continue with {pkg?.name}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Business details ── */}
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

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full business address *</label>
                <input type="text" placeholder="Plot 1, Kampala Road, Kampala, Uganda" value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business phone *</label>
                  <input type="tel" placeholder="+256 7XX XXX XXX" value={bizPhone}
                    onChange={e => setBizPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    Website <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                  </label>
                  <input type="url" placeholder="https://www.yourbusiness.com" value={website}
                    onChange={e => setWebsite(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              {/* Logo + colors */}
              <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>BRANDING</div>
                <div className="grid grid-cols-3 gap-4 items-start">
                  {/* Logo upload */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business logo</label>
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

                  {/* Primary color */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Primary colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                      <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>{primaryColor}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Header, buttons</div>
                  </div>

                  {/* Secondary color */}
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

                {/* Mini preview */}
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

              {error && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={handleStep3}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: KYB ── */}
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
                <input type="text" placeholder="Full registered name" value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business registration number *</label>
                  <input type="text" placeholder="URSB registration number" value={regNumber}
                    onChange={e => setRegNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Tax Identification Number (TIN) *</label>
                  <input type="text" placeholder="URA TIN" value={tin}
                    onChange={e => setTin(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                </div>
              </div>

              {/* Document uploads — placeholder */}
              {regType && (
                <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    REQUIRED DOCUMENTS — {REG_TYPES.find(r => r.value === regType)?.label?.toUpperCase()}
                  </div>
                  {[
                    regType === 'limited_company' && 'Certificate of Incorporation (URSB)',
                    regType === 'limited_company' && 'Memorandum & Articles of Association',
                    regType === 'limited_company' && 'URA TIN Certificate',
                    regType === 'limited_company' && 'Board Resolution authorizing Partna',
                    regType === 'limited_company' && 'National IDs of all directors',
                    regType === 'limited_company' && 'Voided cheque or bank letter',
                    regType === 'partnership' && 'Certificate of Registration (URSB)',
                    regType === 'partnership' && 'Partnership URA TIN',
                    regType === 'partnership' && 'Partnership Deed',
                    regType === 'partnership' && 'Resolution authorizing Partna',
                    regType === 'partnership' && 'ID/Passport copies of all partners',
                    regType === 'partnership' && 'Cancelled cheque or bank letter',
                    regType === 'sole_proprietor' && 'Business Registration Certificate',
                    regType === 'sole_proprietor' && 'National ID, Passport or Driver\'s License',
                    regType === 'sole_proprietor' && 'URA TIN Certificate',
                    regType === 'sole_proprietor' && 'Cancelled cheque or bank statement',
                  ].filter(Boolean).map((doc, i) => (
                    <label key={i} className="flex items-center justify-between py-2 cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{doc}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
                          Upload
                        </span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                      </div>
                    </label>
                  ))}
                  <div className="text-xs mt-3" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Accepted formats: PDF, JPEG, PNG. Documents not stored for demo.
                  </div>
                </div>
              )}

              {error && <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
                  Back
                </button>
                <button onClick={() => handleStep4(true)} disabled={loading}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: 'rgba(0,0,0,0.4)', border: '1.5px solid rgba(0,0,0,0.12)' }}>
                  Skip for now
                </button>
                <button onClick={() => handleStep4(false)} disabled={loading}
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
        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
          © 2026 Partna. All rights reserved.
        </span>
      </footer>

    </div>
  )
}