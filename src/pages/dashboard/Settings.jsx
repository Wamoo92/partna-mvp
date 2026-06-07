import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const SECTORS = ['Education', 'Retail', 'Healthcare', 'Hospitality', 'Other']

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

const PACKAGES = [
  { id: 'starter', name: 'Starter', monthly: 49, annual: 470, features: ['1 active campaign', 'Up to 100 customers', '3 vouchers/campaign', 'No prizes'] },
  { id: 'growth', name: 'Growth', monthly: 149, annual: 1430, features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers/campaign', 'Item & discount prizes'] },
  { id: 'enterprise', name: 'Enterprise', monthly: 399, annual: 3830, features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
]

function FileUploadField({ label, businessId, docSlug }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [uploadedName, setUploadedName] = useState('')
  const [error, setError] = useState('')

  async function handleChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setError('')
    setUploading(true)
    try {
      const ext = f.name.split('.').pop()
      const path = `kyb/${businessId}/${docSlug}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('kyb-documents')
        .upload(path, f, { upsert: true })
      if (uploadError) throw uploadError
      setUploaded(true)
      setUploadedName(f.name)
    } catch (e) {
      console.error('Upload error:', e)
      setError('Upload failed. Please try again.')
      setFile(null)
    }
    setUploading(false)
  }

  async function handleRemove() {
    setFile(null)
    setUploaded(false)
    setUploadedName('')
    setError('')
    // Optionally delete from storage - skip for now
  }

  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span className="text-xs flex-1 mr-4" style={{ color: 'rgba(0,0,0,0.6)' }}>{label}</span>
      {error && <span className="text-xs mr-2" style={{ color: '#DC2626' }}>{error}</span>}
      {uploading ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Uploading...</span>
        </div>
      ) : uploaded ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: '#16A34A' }}>✓</span>
          <span className="text-xs max-w-28 truncate" style={{ color: '#16A34A' }}>{uploadedName}</span>
          <button onClick={handleRemove}
            className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
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

export default function Settings({ admin, business }) {
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Business profile
  const [bizName, setBizName] = useState(business?.name || '')
  const [sector, setSector] = useState(business?.sector || '')
  const [address, setAddress] = useState(business?.address || '')
  const [bizPhone, setBizPhone] = useState(business?.phone || '')
  const [website, setWebsite] = useState(business?.website || '')
  const [primaryColor, setPrimaryColor] = useState(business?.primary_color || '#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState(business?.secondary_color || '#D4AF37')
  const [logoPreview, setLogoPreview] = useState(business?.logo_url || null)

  // Admins
  const [admins, setAdmins] = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [inviting, setInviting] = useState(false)

  // Subscription
  const [subscription, setSubscription] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  useEffect(() => {
    if (tab === 'team') loadAdmins()
    if (tab === 'subscription') loadSubscription()
  }, [tab])

  async function loadAdmins() {
    setAdminsLoading(true)
    const { data } = await supabase.from('business_admins').select('*').eq('business_id', business.id)
    setAdmins(data || [])
    setAdminsLoading(false)
  }

  async function loadSubscription() {
    const { data } = await supabase
      .from('business_subscriptions')
      .select('*, subscription_packages(*)')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      setSubscription(data[0])
      setBillingCycle(data[0].billing_cycle || 'monthly')
    }
  }

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { error: err } = await supabase.from('businesses').update({
        name: bizName, sector, address, phone: bizPhone,
        website: website || null, primary_color: primaryColor,
        secondary_color: secondaryColor, logo_url: logoPreview || business?.logo_url,
      }).eq('id', business.id)
      if (err) throw err
      flash('Business profile updated.')
    } catch (e) {
      flash('Could not save profile. Please try again.', true)
    }
    setSaving(false)
  }

  async function handleInvite() {
    if (!inviteName || !inviteEmail) { flash('Please fill in all fields.', true); return }
    if (!inviteEmail.includes('@')) { flash('Please enter a valid email.', true); return }
    setInviting(true)
    try {
      const { data: existing } = await supabase
        .from('business_admins').select('id').eq('email', inviteEmail.toLowerCase().trim())
      if (existing && existing.length > 0) {
        flash('This email is already registered as an admin.', true)
        setInviting(false)
        return
      }
      await supabase.from('business_admins').insert({
        business_id: business.id,
        full_name: inviteName,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        auth_user_id: null,
      })
      setShowInvite(false)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('admin')
      await loadAdmins()
      flash('Admin invited. They must register at /dashboard/register using this email.')
    } catch (e) {
      flash('Could not invite admin. Please try again.', true)
    }
    setInviting(false)
  }

  async function removeAdmin(adminId) {
    if (adminId === admin?.id) { flash('You cannot remove yourself.', true); return }
    await supabase.from('business_admins').delete().eq('id', adminId)
    await loadAdmins()
    flash('Admin removed.')
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) { flash('Please fill in all fields.', true); return }
    if (newPassword.length < 8) { flash('New password must be at least 8 characters.', true); return }
    if (newPassword !== confirmPassword) { flash('Passwords do not match.', true); return }
    setChangingPw(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: admin.email, password: currentPassword,
      })
      if (signInError) { flash('Current password is incorrect.', true); setChangingPw(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      flash('Password updated successfully.')
    } catch (e) {
      flash('Could not update password. Please try again.', true)
    }
    setChangingPw(false)
  }

  async function handleCancelSubscription() {
    if (cancelConfirmText !== 'CANCEL') {
      flash('Please type CANCEL to confirm.', true); return
    }
    setCancelling(true)
    try {
      await supabase.from('business_subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscription.id)
      await supabase.from('businesses')
        .update({ subscription_package: null })
        .eq('id', business.id)
      setShowCancelModal(false)
      setCancelReason('')
      setCancelConfirmText('')
      flash('Subscription cancelled. You will retain access until the end of your current billing period.')
      await loadSubscription()
    } catch (e) {
      flash('Could not cancel subscription. Please contact support.', true)
    }
    setCancelling(false)
  }

  const kybReadOnly = business?.kyb_status === 'verified' || business?.kyb_status === 'pending'

  const TABS = [
    { id: 'profile', label: '🏢 Business Profile' },
    { id: 'kyb', label: '🔍 KYB Verification' },
    { id: 'team', label: '👥 Team' },
    { id: 'subscription', label: '💳 Subscription' },
    { id: 'security', label: '🔒 Security' },
  ]

  return (
    <div className="flex gap-6">

      {/* Cancel subscription modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: '#DC2626' }}>Cancel subscription</div>
              <button onClick={() => setShowCancelModal(false)}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            <div className="px-4 py-3 rounded-xl mb-4 text-xs"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              ⚠ Cancelling will immediately end your subscription at the close of your current billing period.
              All campaigns will be paused and customers will lose access to new features. This cannot be undone.
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Reason for cancelling (optional)
                </label>
                <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  <option value="">Select a reason</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="not_using">Not using it enough</option>
                  <option value="missing_features">Missing features I need</option>
                  <option value="switching">Switching to another solution</option>
                  <option value="business_closed">Business closing / pausing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Type <strong>CANCEL</strong> to confirm
                </label>
                <input type="text" value={cancelConfirmText}
                  onChange={e => setCancelConfirmText(e.target.value.toUpperCase())}
                  placeholder="CANCEL"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelConfirmText('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                Keep subscription
              </button>
              <button onClick={handleCancelSubscription} disabled={cancelling || cancelConfirmText !== 'CANCEL'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: cancelConfirmText === 'CANCEL' ? '#DC2626' : 'rgba(220,38,38,0.3)',
                  color: '#fff'
                }}>
                {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab sidebar */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess('') }}
            className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold"
            style={{
              background: tab === t.id ? PARTNA_PRIMARY : 'transparent',
              color: tab === t.id ? '#fff' : 'rgba(0,0,0,0.5)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col gap-4">

        {success && (
          <div className="px-4 py-3 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="px-4 py-3 rounded-xl text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            {error}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>Business Information</div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business name</label>
                  <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Sector</label>
                  <select value={sector} onChange={e => setSector(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                    <option value="">Select sector</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Business phone</label>
                  <input type="tel" value={bizPhone} onChange={e => setBizPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Website</label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>Branding</div>
              <div className="grid grid-cols-3 gap-4 items-start mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Logo</label>
                  <label className="cursor-pointer flex flex-col items-center justify-center rounded-xl py-5 gap-2"
                    style={{ border: '2px dashed rgba(27,79,114,0.2)', background: '#f8f9fa' }}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain" />
                    ) : (
                      <>
                        <span className="text-2xl">📷</span>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Upload logo</span>
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
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: primaryColor }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="" className="w-7 h-7 object-contain" style={{ mixBlendMode: 'screen' }} />
                    : <div className="w-7 h-7 rounded-full" style={{ background: secondaryColor }} />
                  }
                  <span className="text-white text-xs font-semibold">{bizName || 'Your Business'}</span>
                  <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: secondaryColor, color: primaryColor }}>A</div>
                </div>
                <div className="px-4 py-2 text-xs" style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.4)' }}>
                  Preview of customer portal header
                </div>
              </div>
            </div>

            <button onClick={saveProfile} disabled={saving}
              className="self-start px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: saving ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}

        {/* ── KYB TAB ── */}
        {tab === 'kyb' && (
          <div className="flex flex-col gap-4">
            {/* Status banner */}
            <div className="px-4 py-3 rounded-xl"
              style={{
                background: business?.kyb_status === 'verified' ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
                border: `1px solid ${business?.kyb_status === 'verified' ? 'rgba(22,163,74,0.2)' : 'rgba(217,119,6,0.2)'}`,
              }}>
              <div className="text-xs font-bold"
                style={{ color: business?.kyb_status === 'verified' ? '#16A34A' : '#D97706' }}>
                {business?.kyb_status === 'verified'
                  ? '✓ Business verified — full platform access unlocked'
                  : business?.kyb_status === 'pending'
                  ? '⏳ Verification pending — typically takes 1–2 business days'
                  : '⚠ Business not yet verified — upload documents below to begin'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
                {business?.kyb_status === 'verified'
                  ? 'Your business details have been verified by Partna.'
                  : 'Verification is required to unlock full platform features and payment processing.'}
              </div>
            </div>

            {/* Read-only legal details */}
            <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Legal Business Details</div>
                {kybReadOnly && (
                  <span className="text-xs px-2 py-1 rounded-lg font-semibold"
                    style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
                    🔒 Read only
                  </span>
                )}
              </div>
              <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {kybReadOnly
                  ? 'Legal details cannot be edited after submission. Contact support@partna.co to make changes.'
                  : 'Fill in your legal business details to begin the KYB verification process.'}
              </div>

              {[
                { label: 'Registration type', value: business?.registration_type ? REG_TYPES.find(r => r.value === business.registration_type)?.label : 'Not provided' },
                { label: 'Legal business name', value: business?.legal_name || 'Not provided' },
                { label: 'Business registration number', value: business?.registration_number || 'Not provided' },
                { label: 'Tax Identification Number (TIN)', value: business?.tin || 'Not provided' },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold"
                    style={{ color: row.value === 'Not provided' ? 'rgba(0,0,0,0.25)' : PARTNA_PRIMARY }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Document uploads — always active */}
            {business?.registration_type && KYB_DOCS[business.registration_type] && (
              <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
                <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Required Documents</div>
                <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Upload all required documents. Accepted formats: PDF, JPEG, PNG. Max 10MB per file.
                </div>
                {KYB_DOCS[business.registration_type].map((doc, i) => (
                  <FileUploadField
                    key={i}
                    label={doc}
                    businessId={business.id}
                    docSlug={doc.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)}
                  />
                ))}

                {business?.kyb_status !== 'verified' && (
                  <button
                    onClick={async () => {
                      await supabase.from('businesses').update({ kyb_status: 'pending' }).eq('id', business.id)
                      flash('Documents submitted. Verification typically takes 1–2 business days.')
                    }}
                    className="w-full mt-4 py-3 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                    Submit for verification
                  </button>
                )}
              </div>
            )}

            {!business?.registration_type && (
              <div className="rounded-2xl p-6 text-center" style={{ background: '#fff' }}>
                <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  No registration type on file
                </div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
                  Contact support@partna.co to update your KYB details.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TEAM TAB ── */}
        {tab === 'team' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {admins.length} team member{admins.length !== 1 ? 's' : ''}
              </div>
              <button onClick={() => setShowInvite(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                + Invite admin
              </button>
            </div>

            {adminsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-4 rounded-full animate-spin"
                  style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                <div className="grid px-5 py-3 text-xs font-bold"
                  style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr', color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafafa' }}>
                  <span>Name</span><span>Email</span><span>Role</span><span></span>
                </div>
                {admins.map((a, i) => (
                  <div key={a.id} className="grid items-center px-5 py-3"
                    style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr', borderBottom: i < admins.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(27,79,114,0.1)', color: PARTNA_PRIMARY }}>
                        {a.full_name?.[0]}
                      </div>
                      <div>
                        <div className="text-xs font-semibold" style={{ color: '#333' }}>{a.full_name}</div>
                        {a.id === admin?.id && <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>You</div>}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>{a.email}</div>
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: a.role === 'owner' ? 'rgba(212,175,55,0.15)' : 'rgba(27,79,114,0.08)', color: a.role === 'owner' ? '#B8860B' : PARTNA_PRIMARY }}>
                        {a.role}
                      </span>
                    </div>
                    <div className="text-right">
                      {a.id !== admin?.id && (
                        <button onClick={() => removeAdmin(a.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showInvite && (
              <div className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Invite Admin</div>
                    <button onClick={() => setShowInvite(false)} className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
                  </div>
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full name</label>
                      <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Email address</label>
                      <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Role</label>
                      <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                        <option value="admin">Admin — full access</option>
                        <option value="viewer">Viewer — read only</option>
                      </select>
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl text-xs mb-4"
                    style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                    The invited admin must register at /dashboard/register using this email.
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowInvite(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>Cancel</button>
                    <button onClick={handleInvite} disabled={inviting}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: inviting ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                      {inviting ? 'Inviting...' : 'Send invite'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUBSCRIPTION TAB ── */}
        {tab === 'subscription' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-3" style={{ color: PARTNA_PRIMARY }}>Current Plan</div>
              {subscription ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold" style={{ color: PARTNA_PRIMARY }}>
                        {subscription.subscription_packages?.name || business?.subscription_package || 'Starter'}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        Billed {subscription.billing_cycle} · Started {new Date(subscription.started_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                      ✓ Active
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-lg"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    Cancel subscription
                  </button>
                </>
              ) : (
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  No active subscription found. Contact support@partna.co
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>View pricing:</span>
              {['monthly', 'annual'].map(cycle => (
                <button key={cycle} onClick={() => setBillingCycle(cycle)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold capitalize"
                  style={{
                    background: billingCycle === cycle ? PARTNA_PRIMARY : '#fff',
                    color: billingCycle === cycle ? '#fff' : PARTNA_PRIMARY,
                    border: `1.5px solid ${PARTNA_PRIMARY}`,
                  }}>
                  {cycle}
                  {cycle === 'annual' && (
                    <span className="ml-1.5" style={{ color: billingCycle === 'annual' ? PARTNA_GOLD : 'rgba(27,79,114,0.5)' }}>
                      ~20% off
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {PACKAGES.map(p => {
                const isCurrent = (business?.subscription_package || 'starter') === p.id
                return (
                  <div key={p.id} className="rounded-2xl p-5"
                    style={{ background: '#fff', border: isCurrent ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)' }}>
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>{p.name}</div>
                    <div className="text-2xl font-bold mb-3" style={{ color: PARTNA_PRIMARY }}>
                      ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                      <span className="text-xs font-normal" style={{ color: 'rgba(0,0,0,0.4)' }}>/mo</span>
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs flex-shrink-0" style={{ color: PARTNA_GOLD }}>✓</span>
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {isCurrent ? (
                      <div className="w-full py-2 rounded-xl text-xs font-bold text-center"
                        style={{ background: PARTNA_GOLD, color: PARTNA_PRIMARY }}>Current plan</div>
                    ) : (
                      <div className="w-full py-2 rounded-xl text-xs font-semibold text-center"
                        style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.4)' }}>
                        Contact sales to upgrade
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.35)' }}>
              To upgrade your plan, contact hello@partna.co
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'security' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Account</div>
              <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Logged in as <strong>{admin?.email}</strong> · Role: <strong className="capitalize">{admin?.role}</strong>
              </div>
              <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>Change Password</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Current password', value: currentPassword, setter: setCurrentPassword },
                  { label: 'New password', value: newPassword, setter: setNewPassword },
                  { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{field.label}</label>
                    <input type="password" value={field.value} onChange={e => field.setter(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                ))}
                <button onClick={handleChangePassword} disabled={changingPw}
                  className="self-start px-6 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: changingPw ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                  {changingPw ? 'Updating...' : 'Update password'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Customer Portal URL</div>
              <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Share this URL with your customers to access the savings portal
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#f0f2f5' }}>
                <span className="text-xs font-mono flex-1" style={{ color: PARTNA_PRIMARY }}>
                  {window.location.origin}/portal
                </span>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal`)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}