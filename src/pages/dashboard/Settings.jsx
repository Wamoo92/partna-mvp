import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Constants ──────────────────────────────────────────────────────────────
const UGANDA_BANKS = [
  'ABSA Uganda',
  'Bank Of Africa (Uganda)',
  'Bank of Baroda',
  'Cairo Bank Uganda',
  'Centenary Rural Development Bank LTD (UG)',
  'DFCU Uganda',
  'Diamond Trust Bank Uganda Limited',
  'Ecobank Uganda Limited',
  'Equity Bank Uganda',
  'Exim bank',
  'Finance Trust',
  'Guaranty Trust Bank Uganda (GT Bank)',
  'Housing Finance Bank',
  'I & M Bank Uganda (Orient)',
  'KCB Bank Uganda Limited',
  'NCBA Bank Uganda Limited',
  'Opportunity Bank',
  'Post Bank Uganda',
  'Stanbic Bank Uganda',
  'Standard Chartered Bank Uganda Limited',
  'Tropical Bank Uganda',
  'United Bank for Africa Uganda Limited (UBA)',
]

const REG_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietorship' },
  { value: 'partnership',     label: 'Partnership' },
  { value: 'limited_company', label: 'Private Limited Company (Ltd)' },
]

const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 49,
    annual: 470,
    accentColor: '#EF8354',
    features: [
      'Up to 100 customers',
      'Unlimited campaigns',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 149,
    annual: 1430,
    accentColor: '#85A0C5',
    features: [
      'Up to 500 customers',
      'Unlimited campaigns',
      'Cashback rewards for customers',
      'Virtual and physical savings card',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 399,
    annual: 3830,
    accentColor: '#59886D',
    features: [
      'Unlimited customers',
      'Unlimited campaigns',
      'Cashback rewards for customers',
      'Virtual and physical savings card',
    ],
  },
]

const ADDRESS_LABELS = ['Address line 1 (Street)', 'Address line 2 (Area / Village)', 'City / Town', 'Postal code', 'P.O. Box']

const TABS = [
  { id: 'profile',      label: 'Business Profile' },
  { id: 'bank_account', label: 'Bank Account'     },
  { id: 'kyb',          label: 'KYB Verification' },
  { id: 'team',         label: 'Team'             },
  { id: 'subscription', label: 'Subscription'     },
  { id: 'security',     label: 'Security'         },
]

function validateSlug(val) {
  if (!val) return 'Please enter a portal URL slug.'
  if (!/^[a-z0-9-]+$/.test(val)) return 'Only lowercase letters, numbers, and hyphens are allowed.'
  if (val.startsWith('-') || val.endsWith('-')) return 'Slug cannot start or end with a hyphen.'
  if (val.length < 3)  return 'Slug must be at least 3 characters.'
  if (val.length > 40) return 'Slug must be 40 characters or fewer.'
  return null
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

const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle   = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }
const hintStyle    = { fontSize: 11, fontWeight: 500, color: C.grayMid, marginTop: 4 }
const btnPrimary   = { padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnDanger    = { ...btnPrimary, background: C.red,   borderColor: C.red   }
const btnSuccess   = { ...btnPrimary, background: C.green, borderColor: C.green }

// ── Shared primitives ──────────────────────────────────────────────────────
function SectionCard({ title, badge, children, noPad }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>{title}</p>
          {badge}
        </div>
      )}
      <div style={noPad ? {} : { padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, last }) {
  const empty = !value || value === '—' || value === 'Not provided'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderBottom: last ? 'none' : `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: empty ? C.grayMid : C.black }}>{value || '—'}</span>
    </div>
  )
}

function Modal({ title, onClose, footer, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 4, lineHeight: 1, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

function ReadOnlyBadge() {
  return <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary, background: C.grayLight, borderRadius: 6, padding: '3px 8px' }}>Read only</span>
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Settings({ admin, business }) {
  const [tab, setTab]         = useState('profile')
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  // Branding
  const [primaryColor, setPrimaryColor]     = useState(business?.primary_color   || '#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState(business?.secondary_color || '#D4AF37')
  const [logoPreview, setLogoPreview]       = useState(business?.logo_url        || null)
  const [heroPreview, setHeroPreview]       = useState(business?.hero_image_url  || null)

  // Team
  const [admins, setAdmins]               = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showInvite, setShowInvite]       = useState(false)
  const [inviteName, setInviteName]       = useState('')
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState('admin')
  const [inviting, setInviting]           = useState(false)

  // Subscription
  const [subscription, setSubscription]           = useState(null)
  const [billingCycle, setBillingCycle]           = useState('monthly')
  const [showCancelModal, setShowCancelModal]     = useState(false)
  const [cancelReason, setCancelReason]           = useState('')
  const [cancelling, setCancelling]               = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw]           = useState(false)
  const [slug, setSlug]                       = useState(business?.slug || '')
  const [slugError, setSlugError]             = useState('')
  const [savingSlug, setSavingSlug]           = useState(false)

  // Bank account
  const [bankAccount, setBankAccount]       = useState(null)
  const [bankLoading, setBankLoading]       = useState(false)
  const [bankForm, setBankForm]             = useState({
    bank_name: '', account_name: '', account_number: '',
    currency: 'UGX', notification_phone: '',
  })
  const [bankFormError, setBankFormError]   = useState('')
  const [savingBank, setSavingBank]         = useState(false)

  useEffect(() => {
    if (tab === 'team')         loadAdmins()
    if (tab === 'subscription') loadSubscription()
    if (tab === 'bank_account') loadBankAccount()
  }, [tab])

  // ── Loaders ───────────────────────────────────────────────────────────────

  async function loadAdmins() {
    setAdminsLoading(true)
    const { data } = await supabase.from('business_admins').select('*').eq('business_id', business.id)
    setAdmins(data || []); setAdminsLoading(false)
  }

  async function loadSubscription() {
    const { data } = await supabase.from('business_subscriptions').select('*, subscription_packages(*)').eq('business_id', business.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1)
    if (data?.length > 0) { setSubscription(data[0]); setBillingCycle(data[0].billing_cycle || 'monthly') }
  }

  async function loadBankAccount() {
    setBankLoading(true)
    try {
      const { data } = await supabase
        .from('business_bank_accounts')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle()
      setBankAccount(data || null)
    } catch (e) { console.error('Load bank account error:', e) }
    setBankLoading(false)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setSuccess('') } else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  function handleLogoSelect(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setLogoPreview(ev.target.result); r.readAsDataURL(f) }
  function handleHeroSelect(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setHeroPreview(ev.target.result); r.readAsDataURL(f) }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function saveBranding() {
    setSaving(true)
    try {
      const { error: err } = await supabase.from('businesses').update({ primary_color: primaryColor, secondary_color: secondaryColor, logo_url: logoPreview || business?.logo_url, hero_image_url: heroPreview || business?.hero_image_url }).eq('id', business.id)
      if (err) throw err; flash('Branding updated.')
    } catch (e) { flash('Could not save branding. Please try again.', true) }
    setSaving(false)
  }

  async function handleSaveBankAccount() {
    setBankFormError('')
    if (!bankForm.bank_name)      { setBankFormError('Please select a bank.'); return }
    if (!bankForm.account_name.trim())   { setBankFormError('Account name is required.'); return }
    if (!bankForm.account_number.trim()) { setBankFormError('Account number is required.'); return }
    setSavingBank(true)
    try {
      const payload = {
        business_id:        business.id,
        bank_name:          bankForm.bank_name,
        account_name:       bankForm.account_name.trim(),
        account_number:     bankForm.account_number.trim(),
        currency:           bankForm.currency,
        notification_phone: bankForm.notification_phone.trim() || null,
      }
      const { error: err } = await supabase
        .from('business_bank_accounts')
        .upsert(payload, { onConflict: 'business_id' })
      if (err) throw err
      await loadBankAccount()
      flash('Bank account linked successfully.')
    } catch (e) {
      console.error('Save bank account error:', e)
      flash('Could not save bank account. Please try again.', true)
    }
    setSavingBank(false)
  }

  async function handleInvite() {
    if (!inviteName || !inviteEmail) { flash('Please fill in all fields.', true); return }
    if (!inviteEmail.includes('@'))  { flash('Please enter a valid email.', true); return }
    setInviting(true)
    try {
      const { data: existing } = await supabase.from('business_admins').select('id').eq('email', inviteEmail.toLowerCase().trim())
      if (existing?.length > 0) { flash('This email is already registered as an admin.', true); setInviting(false); return }
      await supabase.from('business_admins').insert({ business_id: business.id, full_name: inviteName, email: inviteEmail.toLowerCase().trim(), role: inviteRole, auth_user_id: null })
      setShowInvite(false); setInviteName(''); setInviteEmail(''); setInviteRole('admin')
      await loadAdmins(); flash('Admin invited. They must register at /dashboard/register using this email.')
    } catch (e) { flash('Could not invite admin. Please try again.', true) }
    setInviting(false)
  }

  async function removeAdmin(adminId) {
    if (adminId === admin?.id) { flash('You cannot remove yourself.', true); return }
    await supabase.from('business_admins').delete().eq('id', adminId)
    await loadAdmins(); flash('Admin removed.')
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) { flash('Please fill in all fields.', true); return }
    if (newPassword.length < 8)         { flash('New password must be at least 8 characters.', true); return }
    if (newPassword !== confirmPassword) { flash('Passwords do not match.', true); return }
    setChangingPw(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: admin.email, password: currentPassword })
      if (signInError) { flash('Current password is incorrect.', true); setChangingPw(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); flash('Password updated successfully.')
    } catch (e) { flash('Could not update password. Please try again.', true) }
    setChangingPw(false)
  }

  async function handleSaveSlug() {
    setSlugError('')
    const cleanSlug = slug.trim().toLowerCase()
    const validationError = validateSlug(cleanSlug)
    if (validationError) { setSlugError(validationError); return }
    setSavingSlug(true)
    try {
      const { data: existing } = await supabase.from('businesses').select('id').eq('slug', cleanSlug).neq('id', business.id).maybeSingle()
      if (existing) { setSlugError('This slug is already taken. Please choose a different one.'); setSavingSlug(false); return }
      const fullUrl = `https://${cleanSlug}.partna.io`
      const { error: err } = await supabase.from('businesses').update({ slug: cleanSlug, portal_url: fullUrl }).eq('id', business.id)
      if (err) throw err; setSlug(cleanSlug); flash('Portal URL saved. Share ' + fullUrl + ' with your customers.')
    } catch (e) { flash('Could not save portal URL. Please try again.', true) }
    setSavingSlug(false)
  }

  async function handleCancelSubscription() {
    if (cancelConfirmText !== 'CANCEL') { flash('Please type CANCEL to confirm.', true); return }
    setCancelling(true)
    try {
      await supabase.from('business_subscriptions').update({ status: 'cancelled' }).eq('id', subscription.id)
      await supabase.from('businesses').update({ subscription_package: null }).eq('id', business.id)
      setShowCancelModal(false); setCancelReason(''); setCancelConfirmText('')
      flash('Subscription cancelled. You retain access until the end of your current billing period.')
      await loadSubscription()
    } catch (e) { flash('Could not cancel subscription. Please contact support.', true) }
    setCancelling(false)
  }

  const addressParts = (business?.address || '').split(', ').filter(Boolean)
  const supportLink  = <a href="mailto:support@partna.io" style={{ color: C.black, fontWeight: 600, textDecoration: 'underline' }}>support@partna.io</a>

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── CANCEL SUBSCRIPTION MODAL ── */}
      {showCancelModal && (
        <Modal title="Cancel subscription" onClose={() => setShowCancelModal(false)}
          footer={<>
            <button onClick={() => { setShowCancelModal(false); setCancelConfirmText('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Keep subscription</button>
            <button onClick={handleCancelSubscription} disabled={cancelling || cancelConfirmText !== 'CANCEL'} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: cancelling || cancelConfirmText !== 'CANCEL' ? 0.5 : 1 }}>
              {cancelling ? <><div className="spinner spinner-sm spinner-light" /> Cancelling…</> : 'Confirm cancellation'}
            </button>
          </>}>
          <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
            Cancelling will end your subscription at the close of your current billing period. All campaigns will be paused and customers will lose access to new features.
          </div>
          <div>
            <label style={labelStyle}>Reason for cancelling <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
            <select style={inputStyle} value={cancelReason} onChange={e => setCancelReason(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
              <option value="">Select a reason</option>
              <option value="too_expensive">Too expensive</option>
              <option value="not_using">Not using it enough</option>
              <option value="missing_features">Missing features I need</option>
              <option value="switching">Switching to another solution</option>
              <option value="business_closed">Business closing / pausing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Type <strong>CANCEL</strong> to confirm</label>
            <input type="text" style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.12em', fontWeight: 600 }} placeholder="CANCEL" value={cancelConfirmText} onChange={e => setCancelConfirmText(e.target.value.toUpperCase())}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          </div>
        </Modal>
      )}

      {/* ── INVITE MODAL ── */}
      {showInvite && (
        <Modal title="Invite admin" onClose={() => setShowInvite(false)}
          footer={<>
            <button onClick={() => setShowInvite(false)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleInvite} disabled={inviting} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: inviting ? 0.75 : 1 }}>
              {inviting ? <><div className="spinner spinner-sm spinner-light" /> Inviting…</> : 'Send invite'}
            </button>
          </>}>
          {[{ label: 'Full name', val: inviteName, set: setInviteName, type: 'text' }, { label: 'Email address', val: inviteEmail, set: setInviteEmail, type: 'email' }].map(f => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type} style={inputStyle} value={f.val} onChange={e => f.set(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={inviteRole} onChange={e => setInviteRole(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
              <option value="admin">Admin — full access</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
            The invited admin must register at /dashboard/register using this email.
          </div>
        </Modal>
      )}

      {/* ── TAB SIDEBAR ── */}
      <div style={{ width: 196, flexShrink: 0, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden', padding: '6px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess('') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: tab === t.id ? C.bg : 'transparent', color: tab === t.id ? C.black : C.secondary, fontSize: 13, fontWeight: tab === t.id ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}
            onMouseEnter={e => { if (tab !== t.id) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.black } }}
            onMouseLeave={e => { if (tab !== t.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.secondary } }}
          >
            <span style={{ width: 4, height: 16, borderRadius: 2, background: tab === t.id ? C.black : 'transparent', flexShrink: 0 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

        {/* Flash messages */}
        {success && <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{success}</div>}
        {error   && <div style={{ background: C.bgRed,   border: `1px solid ${C.red}`,   borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.red   }}>{error}</div>}

        {/* ══════════════ PROFILE ══════════════ */}
        {tab === 'profile' && (
          <>
            <SectionCard title="Business information" badge={<ReadOnlyBadge />} noPad>
              {[
                { label: 'Business name',  value: business?.name },
                { label: 'Sector',         value: business?.sector },
                { label: 'Business phone', value: business?.phone },
                { label: 'Website',        value: business?.website || '—' },
              ].map((row, i) => <InfoRow key={i} label={row.label} value={row.value} />)}
              <div style={{ padding: '8px 18px', background: C.bg, borderTop: `1px solid ${C.grayLine}`, borderBottom: `1px solid ${C.grayLine}` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Business address</p>
              </div>
              {addressParts.length === 0
                ? <div style={{ padding: '12px 18px', fontSize: 13, fontWeight: 500, color: C.grayMid }}>No address on file</div>
                : [...addressParts, 'Uganda'].map((part, i) => (
                    <InfoRow key={i} label={i < addressParts.length ? (ADDRESS_LABELS[i] || 'Other') : 'Country'} value={part} last={i === addressParts.length} />
                  ))
              }
              <div style={{ padding: '9px 18px', background: C.bg, borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
                To update your business information, contact {supportLink}
              </div>
            </SectionCard>

            <SectionCard title="Branding">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Logo</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px', border: `2px dashed ${C.grayLine}`, borderRadius: 10, background: C.bg, cursor: 'pointer' }}>
                      {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain' }} /> : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Upload logo</span>
                        </>
                      )}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoSelect} />
                    </label>
                  </div>
                  {[
                    { label: 'Primary colour',   val: primaryColor,   set: setPrimaryColor,   hint: 'Header, buttons, CTAs' },
                    { label: 'Secondary colour',  val: secondaryColor, set: setSecondaryColor, hint: 'Accents, highlights' },
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
                <div>
                  <label style={labelStyle}>Portal hero image</label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: heroPreview ? 0 : '24px 20px', border: `2px dashed ${C.grayLine}`, borderRadius: 10, background: C.bg, cursor: 'pointer', overflow: 'hidden', minHeight: 80 }}>
                    {heroPreview ? <img src={heroPreview} alt="Hero" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} /> : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Upload hero image</span>
                      </>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroSelect} />
                  </label>
                  <p style={hintStyle}>Recommended: 1920 × 600px · PNG or JPG · Max 5MB. Shown on your customer portal landing page.</p>
                  {heroPreview && <button onClick={() => setHeroPreview(null)} style={{ ...btnDanger, padding: '5px 10px', fontSize: 12, marginTop: 8 }}>Remove hero image</button>}
                </div>
                <div style={{ border: `1px solid ${C.grayLine}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: primaryColor, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {logoPreview ? <img src={logoPreview} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /> : <div style={{ width: 24, height: 24, background: secondaryColor, borderRadius: 4 }} />}
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{business?.name || 'Your Business'}</span>
                    <div style={{ marginLeft: 'auto', width: 26, height: 26, background: secondaryColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: primaryColor }}>A</div>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, padding: '6px 14px', background: C.bg, margin: 0 }}>Customer portal header preview</p>
                </div>
              </div>
            </SectionCard>

            <button onClick={saveBranding} disabled={saving} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: saving ? 0.75 : 1 }}>
              {saving ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save branding'}
            </button>
          </>
        )}

        {/* ══════════════ BANK ACCOUNT ══════════════ */}
        {tab === 'bank_account' && (
          <>
            {bankLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
            ) : bankAccount ? (
              // ── Linked account — read only ──
              <>
                <SectionCard title="Linked bank account" badge={<ReadOnlyBadge />} noPad>
                  {[
                    { label: 'Bank',                value: bankAccount.bank_name },
                    { label: 'Account name',        value: bankAccount.account_name },
                    { label: 'Account number',      value: bankAccount.account_number },
                    { label: 'Currency',            value: bankAccount.currency },
                    { label: 'Notification phone',  value: bankAccount.notification_phone || '—' },
                  ].map((row, i, arr) => (
                    <InfoRow key={i} label={row.label} value={row.value} last={i === arr.length - 1} />
                  ))}
                  <div style={{ padding: '12px 18px', background: C.bg, borderTop: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
                      To edit your bank account details, contact {supportLink}.
                    </p>
                  </div>
                </SectionCard>

                <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.green, margin: 0 }}>
                    Bank account linked — withdrawals will be sent to this account.
                  </p>
                </div>
              </>
            ) : (
              // ── No account linked — show form ──
              <>
                <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.orange, margin: 0, lineHeight: '150%' }}>
                    No bank account linked yet. You must link a bank account before you can withdraw funds from your business wallet.
                  </p>
                </div>

                <SectionCard title="Link bank account">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Bank *</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        value={bankForm.bank_name}
                        onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = C.black}
                        onBlur={e => e.target.style.borderColor = C.grayLine}
                      >
                        <option value="">Select bank</option>
                        {UGANDA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Account name *</label>
                      <input
                        type="text" style={inputStyle}
                        placeholder="Name as it appears on the account"
                        value={bankForm.account_name}
                        onChange={e => setBankForm(p => ({ ...p, account_name: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = C.black}
                        onBlur={e => e.target.style.borderColor = C.grayLine}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Account number *</label>
                      <input
                        type="text" style={inputStyle}
                        placeholder="Bank account number"
                        value={bankForm.account_number}
                        onChange={e => setBankForm(p => ({ ...p, account_number: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = C.black}
                        onBlur={e => e.target.style.borderColor = C.grayLine}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Currency *</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        value={bankForm.currency}
                        onChange={e => setBankForm(p => ({ ...p, currency: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = C.black}
                        onBlur={e => e.target.style.borderColor = C.grayLine}
                      >
                        <option value="UGX">UGX — Ugandan Shilling</option>
                      </select>
                      <p style={hintStyle}>Additional currencies will be available in future.</p>
                    </div>

                    <div>
                      <label style={labelStyle}>Notification phone <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
                      <input
                        type="tel" style={inputStyle}
                        placeholder="e.g. +256 700 000000"
                        value={bankForm.notification_phone}
                        onChange={e => setBankForm(p => ({ ...p, notification_phone: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = C.black}
                        onBlur={e => e.target.style.borderColor = C.grayLine}
                      />
                      <p style={hintStyle}>Phone number to receive SMS notifications when a withdrawal is processed.</p>
                    </div>

                    {bankFormError && (
                      <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                        {bankFormError}
                      </div>
                    )}

                    <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '150%' }}>
                      Once saved, your bank account details can only be changed by contacting {supportLink}. Please double-check all details before saving.
                    </div>

                    <button
                      onClick={handleSaveBankAccount}
                      disabled={savingBank}
                      style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: savingBank ? 0.75 : 1 }}
                    >
                      {savingBank ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Link bank account'}
                    </button>
                  </div>
                </SectionCard>
              </>
            )}
          </>
        )}

        {/* ══════════════ KYB ══════════════ */}
        {tab === 'kyb' && (
          <>
            {(() => {
              const status = business?.kyb_status
              const cfg = status === 'verified'
                ? { bg: C.bgGreen,  border: C.green,    color: C.green,    title: 'Business verified — full access unlocked' }
                : status === 'pending'
                ? { bg: C.bgOrange, border: C.orange,   color: C.orange,   title: 'Verification in progress — typically 1–2 business days' }
                : { bg: C.bg,       border: C.grayLine, color: C.secondary, title: 'KYB verification not yet submitted' }
              return (
                <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: 0 }}>{cfg.title}</p>
                </div>
              )
            })()}

            <SectionCard title="Legal business details" badge={<ReadOnlyBadge />} noPad>
              {[
                { label: 'Registration type',               value: business?.registration_type ? REG_TYPES.find(r => r.value === business.registration_type)?.label : 'Not provided' },
                { label: 'Legal business name',             value: business?.legal_name          || 'Not provided' },
                { label: 'Business registration number',    value: business?.registration_number || 'Not provided' },
                { label: 'Tax Identification Number (TIN)', value: business?.tin                 || 'Not provided' },
              ].map((row, i, arr) => <InfoRow key={i} label={row.label} value={row.value} last={i === arr.length - 1} />)}
              <div style={{ padding: '9px 18px', background: C.bg, borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
                Legal details cannot be edited after submission. Contact {supportLink} to make changes.
              </div>
            </SectionCard>

            <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '150%' }}>
                KYB documents are submitted to Partna during the onboarding process before your account is created. If you need to update your KYB documents or details, contact {supportLink}.
              </p>
            </div>
          </>
        )}

        {/* ══════════════ TEAM ══════════════ */}
        {tab === 'team' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{admins.length} member{admins.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowInvite(true)} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}>+ Invite admin</button>
            </div>
            {adminsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
            ) : (
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                      {['Name', 'Email', 'Role', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < admins.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: C.black, flexShrink: 0 }}>{a.full_name?.[0]}</div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 1px' }}>{a.full_name}</p>
                              {a.id === admin?.id && <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0 }}>You</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{a.email}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: a.role === 'owner' ? C.orange : C.grayMid, background: a.role === 'owner' ? C.bgOrange : C.grayLight, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>{a.role}</span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {a.id !== admin?.id && <button onClick={() => removeAdmin(a.id)} style={{ ...btnDanger, padding: '5px 10px', fontSize: 12 }}>Remove</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════ SUBSCRIPTION ══════════════ */}
        {tab === 'subscription' && (
          <>
            <SectionCard title="Current plan">
              {subscription ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 4px' }}>
                      {subscription.subscription_packages?.name || business?.subscription_package || 'Starter'}
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 14px' }}>
                      Billed {subscription.billing_cycle} · Started {new Date(subscription.started_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <button onClick={() => setShowCancelModal(true)} style={{ ...btnDanger, padding: '7px 12px', fontSize: 12 }}>Cancel subscription</button>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '3px 8px' }}>Active</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
                  No active subscription found. Contact {supportLink}
                </p>
              )}
            </SectionCard>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>View pricing:</span>
              <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
                {['monthly', 'annual'].map(cycle => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: billingCycle === cycle ? C.black : 'transparent', color: billingCycle === cycle ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {cycle}{cycle === 'annual' && <span style={{ marginLeft: 5, color: billingCycle === 'annual' ? C.green : C.secondary, fontSize: 11 }}>~20% off</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {PACKAGES.map(p => {
                const isCurrent = (business?.subscription_package || 'starter') === p.id
                return (
                  <div key={p.id} style={{ background: C.white, border: `1px solid ${isCurrent ? C.black : C.stroke}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', outline: isCurrent ? `2px solid ${C.black}` : 'none', outlineOffset: 1 }}>
                    <div style={{ height: 3, background: p.accentColor }} />
                    <div style={{ padding: '16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 4px' }}>{p.name}</p>
                        <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0 }}>
                          ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>/mo</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                        {p.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" /></svg>
                            <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      {isCurrent
                        ? <div style={{ background: C.black, borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 600, color: C.white, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current plan</div>
                        : <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 500, color: C.grayMid, textAlign: 'center' }}>Contact sales to upgrade</div>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
              To upgrade, contact <a href="mailto:hello@partna.io" style={{ color: C.black, fontWeight: 600, textDecoration: 'underline' }}>hello@partna.io</a>
            </p>
          </>
        )}

        {/* ══════════════ SECURITY ══════════════ */}
        {tab === 'security' && (
          <>
            <SectionCard title="Account">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${C.grayLine}` }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: C.black, flexShrink: 0 }}>
                  {admin?.full_name?.[0]}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{admin?.full_name}</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{admin?.email} · <span style={{ textTransform: 'capitalize' }}>{admin?.role}</span></p>
                </div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Change password</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Current password',    val: currentPassword, set: setCurrentPassword },
                  { label: 'New password',         val: newPassword,     set: setNewPassword     },
                  { label: 'Confirm new password', val: confirmPassword, set: setConfirmPassword },
                ].map(f => (
                  <div key={f.label}>
                    <label style={labelStyle}>{f.label}</label>
                    <input type="password" style={inputStyle} value={f.val} onChange={e => f.set(e.target.value)}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                ))}
                <button onClick={handleChangePassword} disabled={changingPw} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: changingPw ? 0.75 : 1 }}>
                  {changingPw ? <><div className="spinner spinner-sm spinner-light" /> Updating…</> : 'Update password'}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Customer portal URL">
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '0 0 16px', lineHeight: '140%' }}>
                Set a custom subdomain for your branded customer portal. Once set, share the URL with your customers.
              </p>
              <div>
                <label style={labelStyle}>Portal subdomain</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: '9px 10px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: '8px 0 0 8px', fontSize: 13, fontWeight: 500, color: C.secondary, fontFamily: 'monospace', whiteSpace: 'nowrap', borderRight: 'none' }}>https://</div>
                  <input type="text" style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }} placeholder="your-institution" value={slug}
                    onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError('') }}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  <div style={{ padding: '9px 10px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: '0 8px 8px 0', fontSize: 13, fontWeight: 500, color: C.secondary, fontFamily: 'monospace', whiteSpace: 'nowrap', borderLeft: 'none' }}>.partna.io</div>
                </div>
                {slugError && <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '4px 0 0' }}>{slugError}</p>}
                <p style={hintStyle}>Lowercase letters, numbers, and hyphens only. Minimum 3 characters.</p>
              </div>
              {slug && !slugError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: slug === (business?.slug || '') ? C.bgGreen : C.bg, border: `1px solid ${slug === (business?.slug || '') ? C.green : C.grayLine}`, borderRadius: 8, marginTop: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={slug === (business?.slug || '') ? C.green : C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    {slug === (business?.slug || '') ? <path d="M20 6L9 17l-5-5" /> : <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>}
                  </svg>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.black, flex: 1 }}>https://{slug}.partna.io</span>
                  {slug === (business?.slug || '') && <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>Active</span>}
                </div>
              )}
              <button onClick={handleSaveSlug} disabled={savingSlug || !slug} style={{ ...btnPrimary, alignSelf: 'flex-start', marginTop: 14, opacity: savingSlug || !slug ? 0.5 : 1 }}>
                {savingSlug ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save portal URL'}
              </button>
              {business?.slug && (
                <div style={{ borderTop: `1px solid ${C.grayLine}`, paddingTop: 16, marginTop: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Share with your customers</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.black, flex: 1 }}>https://{business.slug}.partna.io</span>
                    <button onClick={() => { navigator.clipboard.writeText(`https://${business.slug}.partna.io`); flash('URL copied to clipboard.') }} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12 }}>Copy</button>
                  </div>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  )
}