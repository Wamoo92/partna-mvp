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

const PACKAGES = [
  {
    id: 'starter', name: 'Starter', monthly: 49, annual: 470,
    features: ['1 active campaign', 'Up to 100 customers', '3 vouchers/campaign', 'No prizes'],
  },
  {
    id: 'growth', name: 'Growth', monthly: 149, annual: 1430,
    features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers/campaign', 'Item & discount prizes'],
  },
  {
    id: 'enterprise', name: 'Enterprise', monthly: 399, annual: 3830,
    features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'],
  },
]

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
  const [logoFile, setLogoFile] = useState(null)

  // KYB
  const [regType, setRegType] = useState(business?.registration_type || '')
  const [legalName, setLegalName] = useState(business?.legal_name || '')
  const [regNumber, setRegNumber] = useState(business?.registration_number || '')
  const [tin, setTin] = useState(business?.tin || '')

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

  // PIN / password
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
    const { data } = await supabase
      .from('business_admins').select('*').eq('business_id', business.id)
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
    setTimeout(() => { setSuccess(''); setError('') }, 3000)
  }

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('businesses')
        .update({
          name: bizName,
          sector,
          address,
          phone: bizPhone,
          website: website || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoPreview || business?.logo_url,
        })
        .eq('id', business.id)

      if (err) throw err
      flash('Business profile updated.')
    } catch (e) {
      flash('Could not save profile. Please try again.', true)
    }
    setSaving(false)
  }

  async function saveKyb() {
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('businesses')
        .update({
          registration_type: regType || null,
          legal_name: legalName || null,
          registration_number: regNumber || null,
          tin: tin || null,
          kyb_status: regType && legalName && regNumber && tin ? 'pending' : business?.kyb_status,
        })
        .eq('id', business.id)

      if (err) throw err
      flash('KYB information saved. Verification typically takes 1–2 business days.')
    } catch (e) {
      flash('Could not save KYB information. Please try again.', true)
    }
    setSaving(false)
  }

  async function handleInvite() {
    setError('')
    if (!inviteName || !inviteEmail) { flash('Please fill in all fields.', true); return }
    if (!inviteEmail.includes('@')) { flash('Please enter a valid email.', true); return }
    setInviting(true)
    try {
      // Check if already exists
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
        auth_user_id: null, // They'll link when they register
      })
      setShowInvite(false)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('admin')
      await loadAdmins()
      flash('Admin invited. They will need to register at /dashboard/register using this email.')
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
    setError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      flash('Please fill in all fields.', true); return
    }
    if (newPassword.length < 8) { flash('New password must be at least 8 characters.', true); return }
    if (newPassword !== confirmPassword) { flash('Passwords do not match.', true); return }
    setChangingPw(true)
    try {
      // Re-authenticate first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: admin.email,
        password: currentPassword,
      })
      if (signInError) { flash('Current password is incorrect.', true); setChangingPw(false); return }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      flash('Password updated successfully.')
    } catch (e) {
      flash('Could not update password. Please try again.', true)
    }
    setChangingPw(false)
  }

  const TABS = [
    { id: 'profile', label: '🏢 Business Profile' },
    { id: 'kyb', label: '🔍 KYB Verification' },
    { id: 'team', label: '👥 Team' },
    { id: 'subscription', label: '💳 Subscription' },
    { id: 'security', label: '🔒 Security' },
  ]

  return (
    <div className="flex gap-6">

      {/* Tab sidebar */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
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

        {/* Flash messages */}
        {success && (
          <div className="px-4 py-3 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="px-4 py-3 rounded-xl text-xs"
            style={{ background: '#FEE2E2', color: '#991B1B' }}>
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
                {/* Logo */}
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

                {/* Primary colour */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Primary colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                    <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>{primaryColor}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>Header, buttons</div>
                </div>

                {/* Secondary colour */}
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

              {/* Live preview */}
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
                background: business?.kyb_status === 'verified'
                  ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
                border: `1px solid ${business?.kyb_status === 'verified' ? 'rgba(22,163,74,0.2)' : 'rgba(217,119,6,0.2)'}`,
              }}>
              <div className="text-xs font-bold"
                style={{ color: business?.kyb_status === 'verified' ? '#16A34A' : '#D97706' }}>
                {business?.kyb_status === 'verified'
                  ? '✓ Business verified'
                  : business?.kyb_status === 'pending'
                  ? '⏳ Verification pending — typically takes 1–2 business days'
                  : '⚠ Business not yet verified — complete the form below'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Verification is required to unlock full platform features and access real payment processing.
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>Legal Business Details</div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Registration type</label>
                  <select value={regType} onChange={e => setRegType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: regType ? '#333' : 'rgba(0,0,0,0.4)' }}>
                    <option value="">Select registration type</option>
                    {REG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Legal business name</label>
                  <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)}
                    placeholder="Full registered name"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Business registration number
                    </label>
                    <input type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)}
                      placeholder="URSB registration number"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Tax Identification Number (TIN)
                    </label>
                    <input type="text" value={tin} onChange={e => setTin(e.target.value)}
                      placeholder="URA TIN"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Document uploads */}
            {regType && (
              <div className="rounded-2xl p-6" style={{ background: '#fff' }}>
                <div className="text-sm font-bold mb-4" style={{ color: PARTNA_PRIMARY }}>Required Documents</div>
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
                ].filter(Boolean).map((doc, i, arr) => (
                  <label key={i} className="flex items-center justify-between py-2.5 cursor-pointer"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{doc}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
                        Upload
                      </span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                    </div>
                  </label>
                ))}
                <div className="text-xs mt-3" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Accepted: PDF, JPEG, PNG. Max 10MB per document. Documents not stored in demo.
                </div>
              </div>
            )}

            <button onClick={saveKyb} disabled={saving}
              className="self-start px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: saving ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
              {saving ? 'Saving...' : 'Save & submit for verification'}
            </button>
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
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span></span>
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
                        {a.id === admin?.id && (
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>You</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>{a.email}</div>
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{
                          background: a.role === 'owner' ? `rgba(212,175,55,0.15)` : 'rgba(27,79,114,0.08)',
                          color: a.role === 'owner' ? '#B8860B' : PARTNA_PRIMARY,
                        }}>
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

            {/* Invite modal */}
            {showInvite && (
              <div className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Invite Admin</div>
                    <button onClick={() => setShowInvite(false)}
                      className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
                  </div>
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Full name</label>
                      <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                        placeholder="Jane Nakamya"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Email address</label>
                      <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        placeholder="jane@yourbusiness.com"
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
                    The invited admin must register at /dashboard/register using this email address.
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowInvite(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                      Cancel
                    </button>
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
            {/* Current plan */}
            <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
              <div className="text-sm font-bold mb-3" style={{ color: PARTNA_PRIMARY }}>Current Plan</div>
              {subscription ? (
                <div className="flex items-center justify-between">
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
              ) : (
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  No active subscription found. Contact support.
                </div>
              )}
            </div>

            {/* Billing toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>Billing:</span>
              {['monthly', 'annual'].map(cycle => (
                <button key={cycle} onClick={() => setBillingCycle(cycle)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold capitalize"
                  style={{
                    background: billingCycle === cycle ? PARTNA_PRIMARY : '#fff',
                    color: billingCycle === cycle ? '#fff' : PARTNA_PRIMARY,
                    border: `1.5px solid ${PARTNA_PRIMARY}`,
                  }}>
                  {cycle} {cycle === 'annual' && <span style={{ color: billingCycle === 'annual' ? PARTNA_GOLD : 'rgba(27,79,114,0.5)' }}>~20% off</span>}
                </button>
              ))}
            </div>

            {/* Package cards */}
            <div className="grid grid-cols-3 gap-4">
              {PACKAGES.map(p => {
                const isCurrent = (business?.subscription_package || 'starter') === p.id
                return (
                  <div key={p.id} className="rounded-2xl p-5"
                    style={{
                      background: '#fff',
                      border: isCurrent ? `2px solid ${PARTNA_GOLD}` : '2px solid rgba(0,0,0,0.06)',
                    }}>
                    <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>{p.name}</div>
                    <div className="text-2xl font-bold mb-3" style={{ color: PARTNA_PRIMARY }}>
                      ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                      <span className="text-xs font-normal" style={{ color: 'rgba(0,0,0,0.4)' }}>/mo</span>
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      {p.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs" style={{ color: PARTNA_GOLD }}>✓</span>
                          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {isCurrent ? (
                      <div className="w-full py-2 rounded-xl text-xs font-bold text-center"
                        style={{ background: PARTNA_GOLD, color: PARTNA_PRIMARY }}>
                        Current plan
                      </div>
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
              Payment integration coming soon. To upgrade your plan, contact hello@partna.co
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
                    <input type="password" value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      placeholder="••••••••"
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
              <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>Portal URL</div>
              <div className="text-xs mb-3" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Share this URL with your customers to access the savings portal
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: '#f0f2f5' }}>
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