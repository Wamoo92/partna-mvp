import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Constants ──────────────────────────────────────────────────────────────

const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 49,
    annual: 470,
    accent: 'var(--color-yellow)',
    features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 149,
    annual: 1430,
    accent: 'var(--color-primary)',
    features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 399,
    annual: 3830,
    accent: 'var(--color-green)',
    features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'],
  },
]

const SECTORS    = ['Education', 'Retail']
const REG_TYPES  = [
  { value: 'sole_proprietor',  label: 'Sole Proprietorship' },
  { value: 'partnership',      label: 'Partnership' },
  { value: 'limited_company',  label: 'Private Limited Company (Ltd)' },
]
const KYB_DOCS = {
  limited_company:  ['Certificate of Incorporation (URSB)', 'Memorandum & Articles of Association', 'URA TIN Certificate', 'Board Resolution authorizing Partna', 'National IDs of all directors', 'Voided cheque or bank letter'],
  partnership:      ['Certificate of Registration (URSB)', 'Partnership URA TIN', 'Partnership Deed', 'Resolution authorizing Partna', 'ID/Passport copies of all partners', 'Cancelled cheque or bank letter'],
  sole_proprietor:  ['Business Registration Certificate', "National ID, Passport or Driver's License", 'URA TIN Certificate', 'Cancelled cheque or bank statement'],
}
const STEP_LABELS = ['Account', 'Package', 'Business', 'Verification']

// ── Helpers ────────────────────────────────────────────────────────────────

function generateBusinessId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function generateCardNumber() {
  return '5412' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0')
}

function generateCvv() {
  return Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

function formatCardInput(val) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(val) {
  const d = val.replace(/\D/g, '').slice(0, 4)
  return d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d
}

// ── File upload row ────────────────────────────────────────────────────────

function FileUploadRow({ label, onChange }) {
  const [file, setFile] = useState(null)
  function handleChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    onChange?.(f)
  }
  function handleRemove(e) {
    e.preventDefault()
    setFile(null)
    onChange?.(null)
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-3) 0',
      borderBottom: '1.5px solid var(--color-grey-light)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', flex: 1, marginRight: 'var(--space-4)' }}>
        {label}
      </span>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span className="icon-outlined" style={{ fontSize: 16, color: '#2D8B45' }}>check_circle</span>
          <span style={{ fontSize: 'var(--text-xs)', color: '#2D8B45', fontWeight: 'var(--weight-bold)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
          <button onClick={handleRemove} className="btn btn-sm btn-danger" style={{ padding: '2px var(--space-2)' }}>
            Remove
          </button>
        </div>
      ) : (
        <label style={{ cursor: 'pointer', flexShrink: 0 }}>
          <span className="btn btn-sm btn-secondary">Upload</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleChange} />
        </label>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function DashboardRegister() {
  const navigate = useNavigate()
  const [step, setStep]                 = useState(1)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [showPaymentSidebar, setShowPaymentSidebar] = useState(false)

  // Step 1
  const [fullName, setFullName]               = useState('')
  const [jobTitle, setJobTitle]               = useState('')
  const [businessName, setBusinessName]       = useState('')
  const [email, setEmail]                     = useState('')
  const [phone, setPhone]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [selectedPackage, setSelectedPackage] = useState('growth')
  const [billingCycle, setBillingCycle]       = useState('monthly')

  // Payment sidebar
  const [cardType, setCardType]               = useState('')
  const [cardholderName, setCardholderName]   = useState('')
  const [cardNumber, setCardNumber]           = useState('')
  const [cardExpiry, setCardExpiry]           = useState('')
  const [cardCvv, setCardCvv]                 = useState('')
  const [billingAddr1, setBillingAddr1]       = useState('')
  const [billingAddr2, setBillingAddr2]       = useState('')
  const [billingCity, setBillingCity]         = useState('')

  // Step 3
  const [sector, setSector]               = useState('')
  const [addrLine1, setAddrLine1]         = useState('')
  const [addrLine2, setAddrLine2]         = useState('')
  const [addrCity, setAddrCity]           = useState('')
  const [addrPostal, setAddrPostal]       = useState('')
  const [addrPOBox, setAddrPOBox]         = useState('')
  const [bizPhone, setBizPhone]           = useState('')
  const [website, setWebsite]             = useState('')
  const [primaryColor, setPrimaryColor]   = useState('#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState('#D4AF37')
  const [logoPreview, setLogoPreview]     = useState(null)
  const [logoFile, setLogoFile]           = useState(null)
  const [logoError, setLogoError]         = useState('')

  // Step 4
  const [regType, setRegType]     = useState('')
  const [legalName, setLegalName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [tin, setTin]             = useState('')
  const [kybFiles, setKybFiles]   = useState({})

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setLogoError('')
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!allowed.includes(file.type)) { setLogoError('Logo must be PNG, JPEG or SVG.'); e.target.value = ''; return }
    if (file.size > 2 * 1024 * 1024) { setLogoError('Logo must be smaller than 2MB.'); e.target.value = ''; return }
    if (file.type === 'image/svg+xml') {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onload = ev => setLogoPreview(ev.target.result)
      reader.readAsDataURL(file)
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          setLogoError(`Image too small (${img.width}×${img.height}px). Min 100×100px.`)
          e.target.value = ''; return
        }
        setLogoFile(file)
        setLogoPreview(ev.target.result)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  function handleKybFileChange(label, file) {
    setKybFiles(prev => ({ ...prev, [label]: file }))
  }

  function validateStep1() {
    setError('')
    if (!fullName || !jobTitle || !businessName || !email || !phone || !password || !confirmPassword) {
      setError('Please fill in all required fields.'); return false
    }
    if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email address.'); return false }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return false }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return false }
    return true
  }

  function validateStep3() {
    setError('')
    if (!sector || !addrLine1 || !addrCity || !bizPhone) { setError('Please fill in all required fields.'); return false }
    if (logoError) { setError('Please fix the logo upload error before continuing.'); return false }
    return true
  }

  function validateStep4(skip) {
    if (skip) return true
    setError('')
    if (!regType || !legalName || !regNumber || !tin) { setError('Please fill in all KYB fields or choose to skip.'); return false }
    return true
  }

  const pkg          = PACKAGES.find(p => p.id === selectedPackage)
  const subPrice     = billingCycle === 'monthly' ? (pkg?.monthly || 0) : (pkg?.annual || 0)
  const trialDiscount = subPrice + 299
  const firstBillingDate = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3)
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  async function handleLaunch(skip = false) {
    if (!validateStep4(skip)) return
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(), password,
      })
      if (authError) {
        setError(authError.message?.includes('already') ? 'An account with this email already exists. Please log in.' : 'Could not create account: ' + authError.message)
        setLoading(false); return
      }
      if (!authData?.user) { setError('Account creation failed. Please try again.'); setLoading(false); return }

      const newBusinessId = generateBusinessId()
      const fullAddress = [addrLine1, addrLine2, addrCity, addrPostal, addrPOBox].filter(Boolean).join(', ')

      let logoUrl = '/partna-icon.svg'
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const filePath = `${newBusinessId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('business-logos').upload(filePath, logoFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath)
          logoUrl = urlData.publicUrl
        } else {
          logoUrl = logoPreview || '/partna-icon.svg'
        }
      }

      const { error: bizError } = await supabase.from('businesses').insert({
        id: newBusinessId, name: businessName, admin_email: email.toLowerCase().trim(),
        phone: bizPhone, sector, address: fullAddress, website: website || null,
        primary_color: primaryColor, secondary_color: secondaryColor, logo_url: logoUrl,
        kyb_status: skip ? 'skipped' : 'pending',
        registration_type: regType || null, legal_name: legalName || null,
        registration_number: regNumber || null, tin: tin || null,
        subscription_package: selectedPackage,
      })
      if (bizError) { setError('Could not create business profile. Please try again.'); setLoading(false); return }

      if (!skip && Object.keys(kybFiles).length > 0) {
        await Promise.all(Object.entries(kybFiles).map(async ([label, file]) => {
          if (!file) return
          const fileExt = file.name.split('.').pop()
          const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
          await supabase.storage.from('kyb-documents').upload(`${newBusinessId}/${safeLabel}.${fileExt}`, file, { upsert: true })
        }))
      }

      const { error: adminError } = await supabase.from('business_admins').insert({
        business_id: newBusinessId, full_name: fullName, job_title: jobTitle,
        email: email.toLowerCase().trim(), phone, role: 'owner', auth_user_id: authData.user.id,
      })
      if (adminError) { setError('Could not create admin profile. Please try again.'); setLoading(false); return }

      const { data: pkgData } = await supabase.from('subscription_packages').select('id').eq('name', pkg.name).maybeSingle()
      if (pkgData) {
        await supabase.from('business_subscriptions').insert({
          business_id: newBusinessId, package_id: pkgData.id,
          billing_cycle: billingCycle, status: 'active', started_at: new Date().toISOString(),
        })
      }

      await supabase.from('business_wallets').insert({ business_id: newBusinessId, balance: 0 })
      await supabase.from('business_cards').insert({ business_id: newBusinessId, card_number: generateCardNumber(), cvv: generateCvv(), expiry_date: '2029-12-31' })
      await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      navigate('/dashboard/overview', { replace: true })
    } catch (e) {
      console.error('Registration error:', e)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ── Shared input style ──
  const inp = { className: 'input', style: {} }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── PAYMENT SIDEBAR ── */}
      {showPaymentSidebar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowPaymentSidebar(false)} />

          {/* Drawer */}
          <div style={{
            width: '100%', maxWidth: 440,
            background: 'var(--color-white)',
            borderLeft: 'var(--border)',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{
              background: 'var(--color-black)',
              borderBottom: 'var(--border)',
              padding: 'var(--space-5) var(--space-6)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)' }}>
                Payment details
              </span>
              <button onClick={() => setShowPaymentSidebar(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex' }}>
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>

            {/* Order summary */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', background: 'var(--color-bg)', borderBottom: 'var(--border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-3)' }}>
                Order summary
              </div>
              {[
                { label: `${pkg?.name} plan (${billingCycle})`, value: billingCycle === 'monthly' ? `$${pkg?.monthly}/mo` : `$${pkg?.annual}/yr` },
                { label: 'Platform setup fee (one-time)',          value: '$299.00' },
                { label: '3-month free trial (100% off)',          value: `−$${trialDiscount}`, green: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1.5px solid var(--color-grey-light)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: row.green ? '#2D8B45' : 'var(--color-grey)', fontWeight: row.green ? 'var(--weight-bold)' : 'var(--weight-regular)' }}>{row.label}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: row.green ? '#2D8B45' : 'var(--color-black)' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', background: 'var(--color-black)', margin: 'var(--space-2) calc(-1 * var(--space-1))', padding: 'var(--space-3) var(--space-4)', marginTop: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>Due today</span>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', color: 'var(--color-green)' }}>$0.00</span>
              </div>
              <div className="alert alert-success" style={{ marginTop: 'var(--space-3)' }}>
                <span className="icon-outlined alert-icon">event</span>
                <div className="alert-content">First billing date: <strong>{firstBillingDate}</strong></div>
              </div>
            </div>

            {/* Card form */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Card type */}
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Card type</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  {['Visa', 'Mastercard'].map(type => (
                    <button key={type} onClick={() => setCardType(type)} style={{
                      flex: 1, padding: 'var(--space-3)',
                      background: cardType === type ? 'var(--color-black)' : 'var(--color-white)',
                      border: 'var(--border)',
                      color: cardType === type ? 'var(--color-white)' : 'var(--color-black)',
                      fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                      cursor: 'pointer', transition: 'all var(--transition-base)',
                    }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Cardholder name</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">person</span>
                  <input type="text" className="input" autoComplete="cc-name" value={cardholderName} onChange={e => setCardholderName(e.target.value)} />
                </div>
                <span className="input-hint">Exact name as it appears on the card.</span>
              </div>

              <div className="input-group">
                <label className="input-label">Card number</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">credit_card</span>
                  <input type="text" inputMode="numeric" className="input" placeholder="•••• •••• •••• ••••" value={cardNumber} onChange={e => setCardNumber(formatCardInput(e.target.value))} maxLength={19} style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group">
                  <label className="input-label">Expiry date</label>
                  <input type="text" inputMode="numeric" className="input" placeholder="MM/YY" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} maxLength={5} />
                </div>
                <div className="input-group">
                  <label className="input-label">CVV / CVC</label>
                  <input type="password" inputMode="numeric" className="input" placeholder="•••" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
                  <span className="input-hint">3–4 digits on back.</span>
                </div>
              </div>

              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
                letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
                color: 'var(--color-grey)', paddingTop: 'var(--space-2)',
                borderTop: 'var(--border)',
              }}>
                Billing address
              </div>

              <div className="input-group">
                <label className="input-label">Address line 1</label>
                <input type="text" className="input" value={billingAddr1} onChange={e => setBillingAddr1(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Address line 2 <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                <input type="text" className="input" value={billingAddr2} onChange={e => setBillingAddr2(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">City</label>
                <input type="text" className="input" value={billingCity} onChange={e => setBillingCity(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Country</label>
                <select className="input"><option value="UG">Uganda</option></select>
              </div>

              <button onClick={() => { setShowPaymentSidebar(false); setStep(3) }} className="btn btn-primary btn-full btn-lg">
                <span className="icon-outlined icon-sm">arrow_forward</span>
                Continue with {pkg?.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{
        background: 'var(--color-white)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-6)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <img src="/partna-icon.svg" alt="Partna" style={{ width: 32, height: 32 }} />
          <div>
            <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 110, 'opsz' 16" }}>
              Part<span style={{ color: 'var(--color-primary)' }}>na</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
              Business Portal
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard/login')} className="btn btn-secondary btn-sm">
          <span className="icon-outlined icon-xs">login</span>
          Log in instead
        </button>
      </header>

      {/* ── STEP BANNER ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-6) var(--space-8)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Step tracker */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 0 }}>
                <div style={{
                  width: 28, height: 28,
                  border: i + 1 <= step ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                  background: i + 1 < step ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all var(--transition-base)',
                }}>
                  {i + 1 < step
                    ? <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-black)' }}>check</span>
                    : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', color: i + 1 === step ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                  }
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i + 1 < step ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)', transition: 'background var(--transition-slow)' }} />
                )}
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-block',
            background: 'var(--color-primary)',
            border: 'var(--border)',
            padding: '3px var(--space-3)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
            color: 'var(--color-black)', marginBottom: 'var(--space-3)',
          }}>
            Step {step} of 4 — {['Personal details', 'Choose plan', 'Business details', 'Verification'][step - 1]}
          </div>
          <h1 style={{
            color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 30",
          }}>
            {['Create your account', 'Choose your plan', 'Business details', 'Business verification (KYB)'][step - 1]}
          </h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, padding: 'var(--space-8) var(--space-6)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {error && (
            <div className="alert alert-danger">
              <span className="icon-outlined alert-icon">error_outline</span>
              <div className="alert-content">{error}</div>
            </div>
          )}

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Full name <span className="required">*</span></label>
                  <input type="text" className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Job title <span className="required">*</span></label>
                  <input type="text" className="input" placeholder="e.g. School Principal, Store Manager" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Business name <span className="required">*</span></label>
                  <input type="text" className="input" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Email address <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">mail</span>
                    <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Phone number <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">phone</span>
                    <input type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Password <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">lock</span>
                    <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <span className="input-hint">Minimum 8 characters.</span>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Confirm password <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">lock</span>
                  <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button onClick={() => { if (validateStep1()) setStep(2) }} className="btn btn-primary btn-full btn-lg">
                <span className="icon-outlined icon-sm">arrow_forward</span>
                Continue
              </button>
            </>
          )}

          {/* ── STEP 2: Package ── */}
          {step === 2 && (
            <>
              {/* Billing toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
                {['monthly', 'annual'].map(cycle => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{
                    padding: 'var(--space-2) var(--space-5)',
                    background: billingCycle === cycle ? 'var(--color-black)' : 'var(--color-white)',
                    border: 'var(--border)',
                    color: billingCycle === cycle ? 'var(--color-white)' : 'var(--color-black)',
                    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                    textTransform: 'capitalize', cursor: 'pointer', transition: 'all var(--transition-base)',
                  }}>
                    {cycle}
                    {cycle === 'annual' && (
                      <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: billingCycle === 'annual' ? 'var(--color-green)' : 'var(--color-grey)' }}>
                        Save ~20%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Package cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                {PACKAGES.map(p => {
                  const active = selectedPackage === p.id
                  return (
                    <button key={p.id} onClick={() => setSelectedPackage(p.id)} style={{
                      background: 'var(--color-white)',
                      border: active ? '3px solid var(--color-black)' : 'var(--border)',
                      boxShadow: active ? 'var(--shadow-md)' : 'none',
                      padding: 'var(--space-5)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                    }}>
                      {/* Accent bar */}
                      <div style={{ height: 4, background: p.accent, margin: 'calc(-1 * var(--space-5)) calc(-1 * var(--space-5)) 0', marginBottom: 0 }} />
                      <div style={{ paddingTop: 'var(--space-2)' }}>
                        <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 30" }}>
                          ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>/mo</span>
                        </div>
                        {billingCycle === 'annual' && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>${p.annual}/yr billed annually</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {p.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                            <span className="icon-outlined" style={{ fontSize: 14, color: '#2D8B45', flexShrink: 0, marginTop: 1 }}>check</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-snug)' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      {active && (
                        <div style={{
                          padding: '4px var(--space-3)',
                          background: 'var(--color-black)',
                          color: 'var(--color-white)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-black)',
                          letterSpacing: 'var(--tracking-widest)',
                          textTransform: 'uppercase',
                          textAlign: 'center',
                        }}>
                          Selected
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={() => setStep(1)} className="btn btn-secondary">
                  <span className="icon-outlined icon-sm">arrow_back</span>
                  Back
                </button>
                <button onClick={() => setShowPaymentSidebar(true)} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                  <span className="icon-outlined icon-sm">arrow_forward</span>
                  Continue with {pkg?.name}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Business details ── */}
          {step === 3 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Sector <span className="required">*</span></label>
                  <select className="input" value={sector} onChange={e => setSector(e.target.value)}>
                    <option value="">Select sector</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Business name</label>
                  <input type="text" className="input" value={businessName} readOnly style={{ background: 'var(--color-bg)', cursor: 'default' }} />
                </div>
              </div>

              {/* Address */}
              <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>
                  Business address
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className="input-group">
                    <label className="input-label">Street address <span className="required">*</span></label>
                    <input type="text" className="input" value={addrLine1} onChange={e => setAddrLine1(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Area / Village <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                    <input type="text" className="input" value={addrLine2} onChange={e => setAddrLine2(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div className="input-group">
                      <label className="input-label">City / Town <span className="required">*</span></label>
                      <input type="text" className="input" value={addrCity} onChange={e => setAddrCity(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Postal code <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                      <input type="text" className="input" value={addrPostal} onChange={e => setAddrPostal(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Country</label>
                      <select className="input"><option value="UG">Uganda</option></select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">P.O. Box <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                      <input type="text" className="input" value={addrPOBox} onChange={e => setAddrPOBox(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Business phone <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">phone</span>
                    <input type="tel" className="input" value={bizPhone} onChange={e => setBizPhone(e.target.value)} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Website <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">language</span>
                    <input type="url" className="input" value={website} onChange={e => setWebsite(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>
                  Branding
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                  {/* Logo upload */}
                  <div className="input-group">
                    <label className="input-label">Logo</label>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 'var(--space-2)', padding: 'var(--space-5)',
                      border: logoError ? '2px dashed #C0392B' : '2px dashed var(--color-grey-mid)',
                      background: 'var(--color-bg)', cursor: 'pointer',
                    }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                      ) : (
                        <>
                          <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-grey)' }}>upload</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', textAlign: 'center' }}>Upload logo</span>
                        </>
                      )}
                      <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: 'none' }} onChange={handleLogoSelect} />
                    </label>
                    {logoError
                      ? <span className="input-hint error">{logoError}</span>
                      : <span className="input-hint">PNG, JPEG or SVG · Max 2MB · Min 100×100px</span>
                    }
                  </div>

                  {/* Primary colour */}
                  <div className="input-group">
                    <label className="input-label">Primary colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: 'var(--border)', background: 'var(--color-white)' }}>
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 36, height: 36, border: '2px solid var(--color-black)', cursor: 'pointer', padding: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{primaryColor}</span>
                    </div>
                    <span className="input-hint">Header, buttons</span>
                  </div>

                  {/* Secondary colour */}
                  <div className="input-group">
                    <label className="input-label">Secondary colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: 'var(--border)', background: 'var(--color-white)' }}>
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: 36, height: 36, border: '2px solid var(--color-black)', cursor: 'pointer', padding: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{secondaryColor}</span>
                    </div>
                    <span className="input-hint">Accents, highlights</span>
                  </div>
                </div>

                {/* Brand preview */}
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', background: primaryColor, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <div style={{ width: 28, height: 28, background: secondaryColor, border: '1.5px solid rgba(255,255,255,0.3)' }} />
                    }
                    <span style={{ color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                      {businessName || 'Your Business'}
                    </span>
                    <div style={{ marginLeft: 'auto', width: 28, height: 28, background: secondaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: primaryColor }}>
                      A
                    </div>
                  </div>
                  <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                    Customer portal header preview
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={() => setStep(2)} className="btn btn-secondary">
                  <span className="icon-outlined icon-sm">arrow_back</span>
                  Back
                </button>
                <button onClick={() => { if (validateStep3()) setStep(4) }} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                  <span className="icon-outlined icon-sm">arrow_forward</span>
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ── STEP 4: KYB ── */}
          {step === 4 && (
            <>
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  KYB verification is required for full platform access. You can skip this step and complete it later from Settings, but features will remain locked until verified.
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Registration type <span className="required">*</span></label>
                <select className="input" value={regType} onChange={e => setRegType(e.target.value)}>
                  <option value="">Select registration type</option>
                  {REG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Legal business name <span className="required">*</span></label>
                <input type="text" className="input" value={legalName} onChange={e => setLegalName(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Registration number <span className="required">*</span></label>
                  <input type="text" className="input" value={regNumber} onChange={e => setRegNumber(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">TIN <span className="required">*</span></label>
                  <input type="text" className="input" value={tin} onChange={e => setTin(e.target.value)} />
                </div>
              </div>

              {regType && KYB_DOCS[regType] && (
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-1)' }}>
                    Required documents — {REG_TYPES.find(r => r.value === regType)?.label}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>
                    Accepted: PDF, JPEG, PNG · Max 10MB per file.
                  </div>
                  {KYB_DOCS[regType].map((doc, i) => (
                    <FileUploadRow key={i} label={doc} onChange={file => handleKybFileChange(doc, file)} />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={() => setStep(3)} className="btn btn-secondary">
                  <span className="icon-outlined icon-sm">arrow_back</span>
                  Back
                </button>
                <button onClick={() => handleLaunch(true)} disabled={loading} className="btn btn-ghost">
                  Skip for now
                </button>
                <button onClick={() => handleLaunch(false)} disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                  {loading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Creating account…</>
                    : <><span className="icon-outlined icon-sm">check</span> Submit & finish</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--space-4) var(--space-6)',
        borderTop: '1.5px solid var(--color-grey-light)',
      }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
          © 2026 Partna. All rights reserved.
        </span>
      </footer>
    </div>
  )
}