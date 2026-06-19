import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Constants — unchanged ──────────────────────────────────────────────────
const PACKAGES = [
  { id: 'starter',    name: 'Starter',    monthly: 49,  annual: 470,  features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'] },
  { id: 'growth',     name: 'Growth',     monthly: 149, annual: 1430, features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'] },
  { id: 'enterprise', name: 'Enterprise', monthly: 399, annual: 3830, features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
]
const SECTORS   = ['Education', 'Retail']
const REG_TYPES = [
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

function generateBusinessId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16) })
}
function generateCardNumber() { return '5412' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0') }
function generateCvv() { return Math.floor(Math.random() * 1000).toString().padStart(3, '0') }
function formatCardInput(val) { return val.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') }
function formatExpiry(val) { const d = val.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d }

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

const PKG_ACCENT = { starter: C.orange, growth: C.blue, enterprise: C.green }

const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5, letterSpacing: '-0.3px' }
const hintStyle  = { fontSize: 11, fontWeight: 500, color: C.grayMid, marginTop: 4 }
const btnPrimary = { padding: '10px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }

function SectionCard({ title, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
      {title && <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>}
      {children}
    </div>
  )
}

// ── File upload row ────────────────────────────────────────────────────────
function FileUploadRow({ label, onChange }) {
  const [file, setFile] = useState(null)
  function handleChange(e) { const f = e.target.files[0]; if (!f) return; setFile(f); onChange?.(f) }
  function handleRemove(e) { e.preventDefault(); setFile(null); onChange?.(null) }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary, flex: 1, marginRight: 16 }}>{label}</span>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <button onClick={handleRemove} style={{ ...btnPrimary, background: C.bgRed, borderColor: C.red, color: C.red, padding: '3px 8px', fontSize: 11 }}>Remove</button>
        </div>
      ) : (
        <label style={{ cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ ...btnSecondary, padding: '5px 12px', fontSize: 11 }}>Upload</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleChange} />
        </label>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DashboardRegister() {
  const navigate = useNavigate()
  const [step, setStep]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [showPaymentSidebar, setShowPaymentSidebar] = useState(false)

  const [fullName, setFullName]               = useState('')
  const [jobTitle, setJobTitle]               = useState('')
  const [businessName, setBusinessName]       = useState('')
  const [email, setEmail]                     = useState('')
  const [phone, setPhone]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [selectedPackage, setSelectedPackage] = useState('growth')
  const [billingCycle, setBillingCycle]       = useState('monthly')

  const [cardType, setCardType]             = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [cardNumber, setCardNumber]         = useState('')
  const [cardExpiry, setCardExpiry]         = useState('')
  const [cardCvv, setCardCvv]               = useState('')
  const [billingAddr1, setBillingAddr1]     = useState('')
  const [billingAddr2, setBillingAddr2]     = useState('')
  const [billingCity, setBillingCity]       = useState('')

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

  const [regType, setRegType]     = useState('')
  const [legalName, setLegalName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [tin, setTin]             = useState('')
  const [kybFiles, setKybFiles]   = useState({})

  // ── All business logic — unchanged ────────────────────────────────────

  function handleLogoSelect(e) {
    const file = e.target.files[0]; if (!file) return; setLogoError('')
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!allowed.includes(file.type)) { setLogoError('Logo must be PNG, JPEG or SVG.'); e.target.value = ''; return }
    if (file.size > 2 * 1024 * 1024) { setLogoError('Logo must be smaller than 2MB.'); e.target.value = ''; return }
    if (file.type === 'image/svg+xml') {
      setLogoFile(file); const reader = new FileReader(); reader.onload = ev => setLogoPreview(ev.target.result); reader.readAsDataURL(file); return
    }
    const reader = new FileReader()
    reader.onload = ev => { const img = new Image(); img.onload = () => { if (img.width < 100 || img.height < 100) { setLogoError(`Image too small (${img.width}×${img.height}px). Min 100×100px.`); e.target.value = ''; return }; setLogoFile(file); setLogoPreview(ev.target.result) }; img.src = ev.target.result }
    reader.readAsDataURL(file)
  }

  function handleKybFileChange(label, file) { setKybFiles(prev => ({ ...prev, [label]: file })) }

  function validateStep1() {
    setError('')
    if (!fullName || !jobTitle || !businessName || !email || !phone || !password || !confirmPassword) { setError('Please fill in all required fields.'); return false }
    if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email address.'); return false }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return false }
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
    if (skip) return true; setError('')
    if (!regType || !legalName || !regNumber || !tin) { setError('Please fill in all KYB fields or choose to skip.'); return false }
    return true
  }

  const pkg              = PACKAGES.find(p => p.id === selectedPackage)
  const subPrice         = billingCycle === 'monthly' ? (pkg?.monthly || 0) : (pkg?.annual || 0)
  const trialDiscount    = subPrice + 299
  const firstBillingDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) })()

  async function handleLaunch(skip = false) {
    if (!validateStep4(skip)) return
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: email.toLowerCase().trim(), password })
      if (authError) { setError(authError.message?.includes('already') ? 'An account with this email already exists. Please log in.' : 'Could not create account: ' + authError.message); setLoading(false); return }
      if (!authData?.user) { setError('Account creation failed. Please try again.'); setLoading(false); return }
      const newBusinessId = generateBusinessId()
      const fullAddress = [addrLine1, addrLine2, addrCity, addrPostal, addrPOBox].filter(Boolean).join(', ')
      let logoUrl = '/partna-icon.svg'
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop(); const filePath = `${newBusinessId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('business-logos').upload(filePath, logoFile, { upsert: true })
        if (!uploadError) { const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath); logoUrl = urlData.publicUrl } else { logoUrl = logoPreview || '/partna-icon.svg' }
      }
      const { error: bizError } = await supabase.from('businesses').insert({ id: newBusinessId, name: businessName, admin_email: email.toLowerCase().trim(), phone: bizPhone, sector, address: fullAddress, website: website || null, primary_color: primaryColor, secondary_color: secondaryColor, logo_url: logoUrl, kyb_status: skip ? 'skipped' : 'pending', registration_type: regType || null, legal_name: legalName || null, registration_number: regNumber || null, tin: tin || null, subscription_package: selectedPackage })
      if (bizError) { setError('Could not create business profile. Please try again.'); setLoading(false); return }
      if (!skip && Object.keys(kybFiles).length > 0) {
        await Promise.all(Object.entries(kybFiles).map(async ([label, file]) => { if (!file) return; const fileExt = file.name.split('.').pop(); const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(); await supabase.storage.from('kyb-documents').upload(`${newBusinessId}/${safeLabel}.${fileExt}`, file, { upsert: true }) }))
      }
      const { error: adminError } = await supabase.from('business_admins').insert({ business_id: newBusinessId, full_name: fullName, job_title: jobTitle, email: email.toLowerCase().trim(), phone, role: 'owner', auth_user_id: authData.user.id })
      if (adminError) { setError('Could not create admin profile. Please try again.'); setLoading(false); return }
      const { data: pkgData } = await supabase.from('subscription_packages').select('id').eq('name', pkg.name).maybeSingle()
      if (pkgData) await supabase.from('business_subscriptions').insert({ business_id: newBusinessId, package_id: pkgData.id, billing_cycle: billingCycle, status: 'active', started_at: new Date().toISOString() })
      await supabase.from('business_wallets').insert({ business_id: newBusinessId, balance: 0 })
      await supabase.from('business_cards').insert({ business_id: newBusinessId, card_number: generateCardNumber(), cvv: generateCvv(), expiry_date: '2029-12-31' })
      await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      navigate('/dashboard/overview', { replace: true })
    } catch (e) { console.error('Registration error:', e); setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── PAYMENT SIDEBAR ── */}
      {showPaymentSidebar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ flex: 1, background: 'rgba(17,17,17,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPaymentSidebar(false)} />
          <div style={{ width: '100%', maxWidth: 440, background: C.white, borderLeft: `1px solid ${C.stroke}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-8px 0 32px rgba(17,17,17,0.12)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Payment details</p>
              <button onClick={() => setShowPaymentSidebar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            {/* Order summary */}
            <div style={{ padding: '16px 20px', background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order summary</p>
              {[
                { label: `${pkg?.name} plan (${billingCycle})`, value: billingCycle === 'monthly' ? `$${pkg?.monthly}/mo` : `$${pkg?.annual}/yr` },
                { label: 'Platform setup fee (one-time)',          value: '$299.00' },
                { label: '3-month free trial (100% off)',          value: `−$${trialDiscount}`, color: C.green },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.grayLine}` }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: row.color || C.secondary }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.color || C.black }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.black, borderRadius: 8, marginTop: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Due today</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: C.green, letterSpacing: '-0.5px' }}>$0.00</span>
              </div>
              <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, fontWeight: 500, color: C.green }}>
                First billing date: <strong style={{ color: C.black }}>{firstBillingDate}</strong>
              </div>
            </div>
            {/* Card form */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {/* Card type */}
              <div>
                <label style={labelStyle}>Card type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['Visa', 'Mastercard'].map(type => (
                    <button key={type} onClick={() => setCardType(type)} style={{ flex: 1, padding: '10px', background: cardType === type ? C.black : C.white, border: `1px solid ${cardType === type ? C.black : C.grayLine}`, borderRadius: 8, color: cardType === type ? C.white : C.black, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cardholder name</label>
                <input style={inputStyle} type="text" autoComplete="cc-name" value={cardholderName} onChange={e => setCardholderName(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                <p style={hintStyle}>Exact name as it appears on the card.</p>
              </div>
              <div>
                <label style={labelStyle}>Card number</label>
                <input style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.12em' }} type="text" inputMode="numeric" placeholder="•••• •••• •••• ••••" value={cardNumber} onChange={e => setCardNumber(formatCardInput(e.target.value))} maxLength={19} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Expiry</label>
                  <input style={inputStyle} type="text" inputMode="numeric" placeholder="MM/YY" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} maxLength={5} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <div>
                  <label style={labelStyle}>CVV / CVC</label>
                  <input style={inputStyle} type="password" inputMode="numeric" placeholder="•••" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  <p style={hintStyle}>3–4 digits on back.</p>
                </div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: `1px solid ${C.grayLine}`, paddingTop: 10 }}>Billing address</p>
              <div>
                <label style={labelStyle}>Address line 1</label>
                <input style={inputStyle} type="text" value={billingAddr1} onChange={e => setBillingAddr1(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
              <div>
                <label style={labelStyle}>Address line 2 <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
                <input style={inputStyle} type="text" value={billingAddr2} onChange={e => setBillingAddr2(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} type="text" value={billingCity} onChange={e => setBillingCity(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <select style={inputStyle} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}><option value="UG">Uganda</option></select>
              </div>
              <button onClick={() => { setShowPaymentSidebar(false); setStep(3) }} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '11px 18px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                Continue with {pkg?.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>Partna</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>Business Portal</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard/login')} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}
          onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
          Log in instead
        </button>
      </header>

      {/* ── STEPPER BANNER ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '20px 24px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Step tracker */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: i + 1 < step ? C.black : i + 1 === step ? C.black : C.white, border: `1px solid ${i + 1 <= step ? C.black : C.grayLine}`, color: i + 1 <= step ? C.white : C.grayMid, transition: 'all 0.2s' }}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: i + 1 < step ? C.black : C.grayLine, transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 6px' }}>
            Step {step} of 4 — {['Personal details', 'Choose plan', 'Business details', 'Verification'][step - 1]}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0 }}>
            {['Create your account', 'Choose your plan', 'Business details', 'Business verification (KYB)'][step - 1]}
          </h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {error && (
            <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
              {error}
            </div>
          )}

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <>
              <SectionCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  {[
                    { label: 'Full name *',     val: fullName,       set: setFullName,       type: 'text' },
                    { label: 'Job title *',     val: jobTitle,       set: setJobTitle,       type: 'text',     placeholder: 'e.g. School Principal' },
                    { label: 'Business name *', val: businessName,   set: setBusinessName,   type: 'text' },
                    { label: 'Email address *', val: email,          set: setEmail,          type: 'email' },
                    { label: 'Phone number *',  val: phone,          set: setPhone,          type: 'tel' },
                    { label: 'Password *',      val: password,       set: setPassword,       type: 'password', hint: 'Minimum 8 characters.' },
                  ].map(({ label, val, set, type, placeholder, hint }) => (
                    <div key={label}>
                      <label style={labelStyle}>{label}</label>
                      <input style={inputStyle} type={type} placeholder={placeholder} value={val} onChange={e => set(e.target.value)}
                        onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                      {hint && <p style={hintStyle}>{hint}</p>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={labelStyle}>Confirm password *</label>
                  <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
              </SectionCard>
              <button onClick={() => { if (validateStep1()) setStep(2) }} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '11px 18px' }}>
                Continue
              </button>
            </>
          )}

          {/* ── STEP 2: Package ── */}
          {step === 2 && (
            <>
              {/* Billing toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {['monthly', 'annual'].map(cycle => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{ padding: '8px 20px', background: billingCycle === cycle ? C.black : C.white, border: `1px solid ${billingCycle === cycle ? C.black : C.grayLine}`, borderRadius: 8, color: billingCycle === cycle ? C.white : C.black, fontSize: 13, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {cycle}
                    {cycle === 'annual' && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: billingCycle === 'annual' ? C.green : C.secondary }}> Save ~20%</span>}
                  </button>
                ))}
              </div>

              {/* Package cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {PACKAGES.map(p => {
                  const active = selectedPackage === p.id
                  return (
                    <button key={p.id} onClick={() => setSelectedPackage(p.id)} style={{ background: C.white, border: `1px solid ${active ? C.black : C.stroke}`, borderRadius: 12, padding: '18px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, outline: active ? `2px solid ${C.black}` : 'none', outlineOffset: 1, transition: 'all 0.15s', fontFamily: 'Inter, system-ui, sans-serif' }}>
                      <div style={{ height: 3, background: PKG_ACCENT[p.id], borderRadius: 999, margin: '-18px -16px 0', marginBottom: 0 }} />
                      <div style={{ paddingTop: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 4px' }}>{p.name}</p>
                        <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0 }}>
                          ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>/mo</span>
                        </p>
                        {billingCycle === 'annual' && <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '2px 0 0' }}>${p.annual}/yr billed annually</p>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {p.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" /></svg>
                            <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '130%' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      {active && (
                        <div style={{ background: C.black, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: C.white, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Selected</div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ ...btnSecondary, padding: '10px 18px' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                  ← Back
                </button>
                <button onClick={() => setShowPaymentSidebar(true)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 18px' }}>
                  Continue with {pkg?.name}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Business details ── */}
          {step === 3 && (
            <>
              <SectionCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  <div>
                    <label style={labelStyle}>Sector *</label>
                    <select style={inputStyle} value={sector} onChange={e => setSector(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                      <option value="">Select sector</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Business name</label>
                    <input style={{ ...inputStyle, background: C.bg, cursor: 'default' }} type="text" value={businessName} readOnly />
                  </div>
                </div>
              </SectionCard>

              {/* Address */}
              <SectionCard title="Business address">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Street address *</label>
                    <input style={inputStyle} type="text" value={addrLine1} onChange={e => setAddrLine1(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  <div>
                    <label style={labelStyle}>Area / Village <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
                    <input style={inputStyle} type="text" value={addrLine2} onChange={e => setAddrLine2(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                    {[
                      { label: 'City / Town *', val: addrCity,   set: setAddrCity,   type: 'text' },
                      { label: 'Postal code',   val: addrPostal, set: setAddrPostal, type: 'text', opt: true },
                      { label: 'Country',       val: 'Uganda', readOnly: true },
                      { label: 'P.O. Box',      val: addrPOBox,  set: setAddrPOBox,  type: 'text', opt: true },
                    ].map(({ label, val, set, type, opt, readOnly }) => (
                      <div key={label}>
                        <label style={labelStyle}>{label}{opt && <span style={{ fontWeight: 400, color: C.grayMid }}> (optional)</span>}</label>
                        {readOnly
                          ? <input style={{ ...inputStyle, background: C.bg, cursor: 'default' }} value={val} readOnly />
                          : <input style={inputStyle} type={type} value={val} onChange={e => set(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                        }
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                <div>
                  <label style={labelStyle}>Business phone *</label>
                  <input style={inputStyle} type="tel" value={bizPhone} onChange={e => setBizPhone(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <div>
                  <label style={labelStyle}>Website <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
                  <input style={inputStyle} type="url" value={website} onChange={e => setWebsite(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
              </div>

              {/* Branding */}
              <SectionCard title="Branding">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* Logo */}
                  <div>
                    <label style={labelStyle}>Logo</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px', border: `2px dashed ${logoError ? C.red : C.grayLine}`, borderRadius: 10, background: C.bg, cursor: 'pointer' }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Upload logo</span>
                        </>
                      )}
                      <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: 'none' }} onChange={handleLogoSelect} />
                    </label>
                    <p style={{ ...hintStyle, color: logoError ? C.red : C.grayMid }}>{logoError || 'PNG, JPEG or SVG · Max 2MB · Min 100×100px'}</p>
                  </div>
                  {/* Colours */}
                  {[
                    { label: 'Primary colour', val: primaryColor, set: setPrimaryColor, hint: 'Header, buttons' },
                    { label: 'Secondary colour', val: secondaryColor, set: setSecondaryColor, hint: 'Accents, highlights' },
                  ].map(({ label, val, set, hint }) => (
                    <div key={label}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${C.grayLine}`, borderRadius: 8, background: C.white }}>
                        <input type="color" value={val} onChange={e => set(e.target.value)} style={{ width: 32, height: 32, border: `1px solid ${C.grayLine}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.black }}>{val}</span>
                      </div>
                      <p style={hintStyle}>{hint}</p>
                    </div>
                  ))}
                </div>
                {/* Preview */}
                <div style={{ border: `1px solid ${C.grayLine}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: primaryColor, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {logoPreview ? <img src={logoPreview} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /> : <div style={{ width: 24, height: 24, background: secondaryColor, borderRadius: 4 }} />}
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{businessName || 'Your Business'}</span>
                    <div style={{ marginLeft: 'auto', width: 26, height: 26, background: secondaryColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: primaryColor }}>A</div>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, padding: '6px 14px', background: C.bg, margin: 0 }}>Customer portal header preview</p>
                </div>
              </SectionCard>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ ...btnSecondary, padding: '10px 18px' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                  ← Back
                </button>
                <button onClick={() => { if (validateStep3()) setStep(4) }} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 18px' }}>
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ── STEP 4: KYB ── */}
          {step === 4 && (
            <>
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                KYB verification is required for full platform access. You can skip this step and complete it later from Settings, but features will remain locked until verified.
              </div>

              <SectionCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Registration type *</label>
                    <select style={inputStyle} value={regType} onChange={e => setRegType(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                      <option value="">Select registration type</option>
                      {REG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Legal business name *</label>
                    <input style={inputStyle} type="text" value={legalName} onChange={e => setLegalName(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                    <div>
                      <label style={labelStyle}>Registration number *</label>
                      <input style={inputStyle} type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                    </div>
                    <div>
                      <label style={labelStyle}>TIN *</label>
                      <input style={inputStyle} type="text" value={tin} onChange={e => setTin(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {regType && KYB_DOCS[regType] && (
                <SectionCard title={`Required documents — ${REG_TYPES.find(r => r.value === regType)?.label}`}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '0 0 8px' }}>Accepted: PDF, JPEG, PNG · Max 10MB per file.</p>
                  {KYB_DOCS[regType].map((doc, i) => (
                    <FileUploadRow key={i} label={doc} onChange={file => handleKybFileChange(doc, file)} />
                  ))}
                </SectionCard>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(3)} style={{ ...btnSecondary, padding: '10px 18px' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                  ← Back
                </button>
                <button onClick={() => handleLaunch(true)} disabled={loading} style={{ ...btnSecondary, padding: '10px 16px', color: C.secondary }}>
                  Skip for now
                </button>
                <button onClick={() => handleLaunch(false)} disabled={loading} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 18px', opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? <><div className="spinner spinner-sm spinner-light" /> Creating account…</> : 'Submit & finish'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '14px 24px', borderTop: `1px solid ${C.grayLine}` }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>© 2026 Partna. All rights reserved.</span>
      </footer>

    </div>
  )
}