import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Constants ────────────────────────────────────────────────────────────────

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

const PACKAGES = [
  { id: 'starter',    name: 'Starter',    monthly: 49,  annual: 470,  accent: 'var(--color-yellow)',  features: ['1 active campaign', 'Up to 100 customers', '3 vouchers/campaign', 'No prizes'] },
  { id: 'growth',     name: 'Growth',     monthly: 149, annual: 1430, accent: 'var(--color-primary)', features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers/campaign', 'Item & discount prizes'] },
  { id: 'enterprise', name: 'Enterprise', monthly: 399, annual: 3830, accent: 'var(--color-green)',   features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
]

const ADDRESS_LABELS = ['Address line 1 (Street)', 'Address line 2 (Area / Village)', 'City / Town', 'Postal code', 'P.O. Box']

const TABS = [
  { id: 'profile',      icon: 'business',     label: 'Business Profile'  },
  { id: 'kyb',          icon: 'verified_user', label: 'KYB Verification'  },
  { id: 'team',         icon: 'group',         label: 'Team'              },
  { id: 'subscription', icon: 'payments',      label: 'Subscription'      },
  { id: 'security',     icon: 'lock',          label: 'Security'          },
]

// ── FileUploadField ────────────────────────────────────────────────────────

function FileUploadField({ label, businessId, docSlug }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded]   = useState(false)
  const [uploadedName, setUploadedName] = useState('')
  const [uploadError, setUploadError]   = useState('')

  async function handleChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setUploadError(''); setUploading(true)
    try {
      const ext  = f.name.split('.').pop()
      const path = `kyb/${businessId}/${docSlug}.${ext}`
      const { error } = await supabase.storage.from('kyb-documents').upload(path, f, { upsert: true })
      if (error) throw error
      setUploaded(true); setUploadedName(f.name)
    } catch (e) {
      console.error('Upload error:', e)
      setUploadError('Upload failed. Please try again.')
    }
    setUploading(false)
  }

  function handleRemove() { setUploaded(false); setUploadedName(''); setUploadError('') }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1.5px solid var(--color-grey-light)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', flex: 1, marginRight: 'var(--space-4)' }}>{label}</span>
      {uploadError && <span style={{ fontSize: 'var(--text-xs)', color: '#C0392B', marginRight: 'var(--space-2)' }}>{uploadError}</span>}
      {uploading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <div className="spinner spinner-sm spinner-purple" />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>Uploading…</span>
        </div>
      ) : uploaded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span className="icon-outlined" style={{ fontSize: 16, color: '#2D8B45' }}>check_circle</span>
          <span style={{ fontSize: 'var(--text-xs)', color: '#2D8B45', fontWeight: 'var(--weight-bold)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedName}</span>
          <button onClick={handleRemove} className="btn btn-sm btn-danger" style={{ padding: '2px var(--space-2)' }}>Remove</button>
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

export default function Settings({ admin, business }) {
  const [tab, setTab]       = useState('profile')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]   = useState('')

  // Branding
  const [primaryColor, setPrimaryColor]     = useState(business?.primary_color   || '#1B4F72')
  const [secondaryColor, setSecondaryColor] = useState(business?.secondary_color || '#D4AF37')
  const [logoPreview, setLogoPreview]       = useState(business?.logo_url || null)

  // Team
  const [admins, setAdmins]         = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [inviting, setInviting]     = useState(false)

  // Subscription
  const [subscription, setSubscription] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason]       = useState('')
  const [cancelling, setCancelling]           = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw]           = useState(false)

  useEffect(() => {
    if (tab === 'team')         loadAdmins()
    if (tab === 'subscription') loadSubscription()
  }, [tab])

  async function loadAdmins() {
    setAdminsLoading(true)
    const { data } = await supabase.from('business_admins').select('*').eq('business_id', business.id)
    setAdmins(data || [])
    setAdminsLoading(false)
  }

  async function loadSubscription() {
    const { data } = await supabase.from('business_subscriptions')
      .select('*, subscription_packages(*)').eq('business_id', business.id)
      .eq('status', 'active').order('created_at', { ascending: false }).limit(1)
    if (data?.length > 0) { setSubscription(data[0]); setBillingCycle(data[0].billing_cycle || 'monthly') }
  }

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setSuccess('') } else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  function handleLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function saveBranding() {
    setSaving(true)
    try {
      const { error: err } = await supabase.from('businesses').update({
        primary_color: primaryColor, secondary_color: secondaryColor,
        logo_url: logoPreview || business?.logo_url,
      }).eq('id', business.id)
      if (err) throw err
      flash('Branding updated.')
    } catch (e) { flash('Could not save branding. Please try again.', true) }
    setSaving(false)
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
      await loadAdmins()
      flash('Admin invited. They must register at /dashboard/register using this email.')
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
    if (newPassword.length < 8)     { flash('New password must be at least 8 characters.', true); return }
    if (newPassword !== confirmPassword) { flash('Passwords do not match.', true); return }
    setChangingPw(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: admin.email, password: currentPassword })
      if (signInError) { flash('Current password is incorrect.', true); setChangingPw(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      flash('Password updated successfully.')
    } catch (e) { flash('Could not update password. Please try again.', true) }
    setChangingPw(false)
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

  // ── Shared section card ──
  const Card = ({ children, style }) => (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', ...style }}>
      {children}
    </div>
  )

  const SectionHeader = ({ title, badge }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: 'var(--border)', background: 'var(--color-black)' }}>
      <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>{title}</span>
      {badge && badge}
    </div>
  )

  const InfoRow = ({ label, value, last }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-5)', borderBottom: last ? 'none' : '1.5px solid var(--color-grey-light)', background: 'var(--color-white)' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: !value || value === '—' || value === 'Not provided' ? 'var(--color-grey-mid)' : 'var(--color-black)' }}>{value || '—'}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>

      {/* ── CANCEL SUBSCRIPTION MODAL ── */}
      {showCancelModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#C0392B' }}>
              <span className="modal-title">Cancel subscription</span>
              <button onClick={() => setShowCancelModal(false)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">warning</span>
                <div className="alert-content">
                  Cancelling will end your subscription at the close of your current billing period.
                  All campaigns will be paused and customers will lose access to new features.
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Reason for cancelling <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                <select className="input" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                  <option value="">Select a reason</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="not_using">Not using it enough</option>
                  <option value="missing_features">Missing features I need</option>
                  <option value="switching">Switching to another solution</option>
                  <option value="business_closed">Business closing / pausing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Type <strong>CANCEL</strong> to confirm</label>
                <input type="text" className="input" value={cancelConfirmText}
                  onChange={e => setCancelConfirmText(e.target.value.toUpperCase())}
                  placeholder="CANCEL" style={{ fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 'var(--weight-black)' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowCancelModal(false); setCancelConfirmText('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Keep subscription
              </button>
              <button onClick={handleCancelSubscription} disabled={cancelling || cancelConfirmText !== 'CANCEL'} className="btn btn-danger" style={{ flex: 1 }}>
                {cancelling
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Cancelling…</>
                  : <><span className="icon-outlined icon-sm">cancel</span> Confirm cancellation</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE MODAL ── */}
      {showInvite && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Invite admin</span>
              <button onClick={() => setShowInvite(false)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="input-group">
                <label className="input-label">Full name</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">person</span>
                  <input type="text" className="input" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Email address</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">mail</span>
                  <input type="email" className="input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="admin">Admin — full access</option>
                  <option value="viewer">Viewer — read only</option>
                </select>
              </div>
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">The invited admin must register at /dashboard/register using this email.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowInvite(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleInvite} disabled={inviting} className="btn btn-primary" style={{ flex: 1 }}>
                {inviting
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Inviting…</>
                  : <><span className="icon-outlined icon-sm">send</span> Send invite</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB SIDEBAR ── */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess('') }} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: tab === t.id ? 'var(--color-primary)' : 'transparent',
            border: 'none',
            color: tab === t.id ? 'var(--color-black)' : 'var(--color-grey)',
            fontSize: 'var(--text-sm)', fontWeight: tab === t.id ? 'var(--weight-black)' : 'var(--weight-semibold)',
            cursor: 'pointer', textAlign: 'left',
            transition: 'all var(--transition-base)',
            position: 'relative',
          }}>
            {tab === t.id && (
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--color-black)' }} />
            )}
            <span className="icon-outlined" style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>

        {success && (
          <div className="alert alert-success">
            <span className="icon-outlined alert-icon">check_circle</span>
            <div className="alert-content">{success}</div>
          </div>
        )}
        {error && (
          <div className="alert alert-danger">
            <span className="icon-outlined alert-icon">error_outline</span>
            <div className="alert-content">{error}</div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <>
            {/* Business info */}
            <Card>
              <SectionHeader
                title="Business information"
                badge={
                  <span className="badge badge-default no-dot">
                    <span className="icon-outlined icon-xs">lock</span>
                    Read only
                  </span>
                }
              />
              {[
                { label: 'Business name',   value: business?.name },
                { label: 'Sector',          value: business?.sector },
                { label: 'Business phone',  value: business?.phone },
                { label: 'Website',         value: business?.website || '—' },
              ].map((row, i) => (
                <InfoRow key={i} label={row.label} value={row.value} />
              ))}
              {/* Address section */}
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: 'var(--border)', borderBottom: 'var(--border)', background: 'var(--color-bg)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>
                  Business address
                </div>
              </div>
              {addressParts.length === 0 ? (
                <div style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-grey-mid)' }}>
                  No address on file
                </div>
              ) : (
                [...addressParts, 'Uganda'].map((part, i) => (
                  <InfoRow key={i} label={i < addressParts.length ? (ADDRESS_LABELS[i] || 'Other') : 'Country'} value={part} last={i === addressParts.length} />
                ))
              )}
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1.5px solid var(--color-grey-light)', background: 'var(--color-bg)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                To update your business information, contact{' '}
                <a href="mailto:support@partna.co" style={{ color: 'var(--color-black)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>support@partna.co</a>
              </div>
            </Card>

            {/* Branding */}
            <Card>
              <SectionHeader title="Branding" />
              <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-5)' }}>
                  {/* Logo */}
                  <div className="input-group">
                    <label className="input-label">Logo</label>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 'var(--space-2)', padding: 'var(--space-5)',
                      border: '2px dashed var(--color-grey-mid)', background: 'var(--color-bg)', cursor: 'pointer',
                    }}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        : <><span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-grey)' }}>upload</span><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>Upload logo</span></>
                      }
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoSelect} />
                    </label>
                  </div>

                  {/* Primary */}
                  <div className="input-group">
                    <label className="input-label">Primary colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: 'var(--border)', background: 'var(--color-white)' }}>
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 36, height: 36, border: '2px solid var(--color-black)', cursor: 'pointer', padding: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{primaryColor}</span>
                    </div>
                    <span className="input-hint">Header, buttons</span>
                  </div>

                  {/* Secondary */}
                  <div className="input-group">
                    <label className="input-label">Secondary colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: 'var(--border)', background: 'var(--color-white)' }}>
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: 36, height: 36, border: '2px solid var(--color-black)', cursor: 'pointer', padding: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{secondaryColor}</span>
                    </div>
                    <span className="input-hint">Accents, highlights</span>
                  </div>
                </div>

                {/* Preview */}
                <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', background: primaryColor, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <div style={{ width: 28, height: 28, background: secondaryColor, border: '1.5px solid rgba(255,255,255,0.3)' }} />
                    }
                    <span style={{ color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                      {business?.name || 'Your Business'}
                    </span>
                    <div style={{ marginLeft: 'auto', width: 28, height: 28, background: secondaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: primaryColor }}>A</div>
                  </div>
                  <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                    Customer portal header preview
                  </div>
                </div>
              </div>
            </Card>

            <button onClick={saveBranding} disabled={saving} className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }}>
              {saving
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                : <><span className="icon-outlined icon-sm">save</span> Save branding</>
              }
            </button>
          </>
        )}

        {/* ── KYB TAB ── */}
        {tab === 'kyb' && (
          <>
            {/* Status banner */}
            <div className={`alert ${business?.kyb_status === 'verified' ? 'alert-success' : business?.kyb_status === 'pending' ? 'alert-warning' : 'alert-info'}`}>
              <span className="icon-outlined alert-icon">
                {business?.kyb_status === 'verified' ? 'verified_user' : business?.kyb_status === 'pending' ? 'hourglass_top' : 'upload'}
              </span>
              <div className="alert-content">
                <div className="alert-title">
                  {business?.kyb_status === 'verified' ? 'Business verified — full access unlocked'
                    : business?.kyb_status === 'pending' ? 'Verification pending — typically 1–2 business days'
                    : 'Upload documents below to begin verification'}
                </div>
                {business?.kyb_status !== 'verified' && (
                  <div>Verification is required to unlock full platform features and payment processing.</div>
                )}
              </div>
            </div>

            {/* Legal details */}
            <Card>
              <SectionHeader
                title="Legal business details"
                badge={
                  <span className="badge badge-default no-dot">
                    <span className="icon-outlined icon-xs">lock</span>
                    Read only
                  </span>
                }
              />
              {[
                { label: 'Registration type',             value: business?.registration_type ? REG_TYPES.find(r => r.value === business.registration_type)?.label : 'Not provided' },
                { label: 'Legal business name',           value: business?.legal_name            || 'Not provided' },
                { label: 'Business registration number',  value: business?.registration_number   || 'Not provided' },
                { label: 'Tax Identification Number (TIN)', value: business?.tin                 || 'Not provided' },
              ].map((row, i, arr) => (
                <InfoRow key={i} label={row.label} value={row.value} last={i === arr.length - 1} />
              ))}
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1.5px solid var(--color-grey-light)', background: 'var(--color-bg)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                Legal details cannot be edited after submission. Contact{' '}
                <a href="mailto:support@partna.co" style={{ color: 'var(--color-black)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>support@partna.co</a>{' '}
                to make changes.
              </div>
            </Card>

            {/* Doc uploads */}
            {business?.registration_type && KYB_DOCS[business.registration_type] ? (
              <Card>
                <SectionHeader title="Required documents" />
                <div style={{ padding: 'var(--space-5)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>
                    Upload all required documents. Accepted: PDF, JPEG, PNG · Max 10MB per file.
                  </p>
                  {KYB_DOCS[business.registration_type].map((doc, i) => (
                    <FileUploadField key={i} label={doc} businessId={business.id}
                      docSlug={doc.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)} />
                  ))}
                  {business?.kyb_status !== 'verified' && (
                    <button
                      onClick={async () => {
                        await supabase.from('businesses').update({ kyb_status: 'pending' }).eq('id', business.id)
                        flash('Documents submitted. Verification typically takes 1–2 business days.')
                      }}
                      className="btn btn-primary btn-full btn-lg"
                      style={{ marginTop: 'var(--space-5)' }}
                    >
                      <span className="icon-outlined icon-sm">verified_user</span>
                      Submit for verification
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <Card>
                <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
                  <span className="icon-outlined" style={{ fontSize: 36, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>description</span>
                  <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>No registration type on file</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    Contact <a href="mailto:support@partna.co" style={{ color: 'var(--color-black)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>support@partna.co</a> to update your KYB details.
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── TEAM TAB ── */}
        {tab === 'team' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', textTransform: 'uppercase' }}>
                {admins.length} member{admins.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setShowInvite(true)} className="btn btn-primary btn-sm">
                <span className="icon-outlined icon-xs">person_add</span>
                Invite admin
              </button>
            </div>

            {adminsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                <div className="spinner spinner-lg spinner-purple" />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
                  </thead>
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ width: 32, height: 32, background: 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', flexShrink: 0 }}>
                              {a.full_name?.[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{a.full_name}</div>
                              {a.id === admin?.id && <div style={{ fontSize: 10, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>You</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{a.email}</td>
                        <td>
                          <span className={`badge no-dot ${a.role === 'owner' ? 'badge-warning' : 'badge-default'}`} style={{ textTransform: 'capitalize' }}>
                            {a.role}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {a.id !== admin?.id && (
                            <button onClick={() => removeAdmin(a.id)} className="btn btn-sm btn-danger">Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SUBSCRIPTION TAB ── */}
        {tab === 'subscription' && (
          <>
            {/* Current plan */}
            <Card>
              <SectionHeader title="Current plan" />
              <div style={{ padding: 'var(--space-5)' }}>
                {subscription ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)' }}>
                          {subscription.subscription_packages?.name || business?.subscription_package || 'Starter'}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 4 }}>
                          Billed {subscription.billing_cycle} · Started {new Date(subscription.started_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <span className="badge badge-success no-dot">Active</span>
                    </div>
                    <button onClick={() => setShowCancelModal(true)} className="btn btn-sm btn-danger">
                      <span className="icon-outlined icon-xs">cancel</span>
                      Cancel subscription
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                    No active subscription found. Contact <a href="mailto:support@partna.co" style={{ color: 'var(--color-black)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>support@partna.co</a>
                  </p>
                )}
              </div>
            </Card>

            {/* Billing toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', textTransform: 'uppercase' }}>View pricing:</span>
              <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                {['monthly', 'annual'].map((cycle, i) => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{
                    padding: '6px var(--space-4)',
                    background: billingCycle === cycle ? 'var(--color-black)' : 'var(--color-white)',
                    color: billingCycle === cycle ? 'var(--color-white)' : 'var(--color-grey)',
                    border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                    textTransform: 'capitalize', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}>
                    {cycle}
                    {cycle === 'annual' && <span style={{ marginLeft: 6, color: billingCycle === 'annual' ? 'var(--color-green)' : 'var(--color-grey)' }}>~20% off</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Package cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              {PACKAGES.map(p => {
                const isCurrent = (business?.subscription_package || 'starter') === p.id
                return (
                  <div key={p.id} style={{
                    background: 'var(--color-white)',
                    border: isCurrent ? '3px solid var(--color-black)' : 'var(--border)',
                    boxShadow: isCurrent ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{ height: 4, background: p.accent }} />
                    <div style={{ padding: 'var(--space-5)', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 30" }}>
                          ${billingCycle === 'monthly' ? p.monthly : Math.round(p.annual / 12)}
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>/mo</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
                        {p.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                            <span className="icon-outlined" style={{ fontSize: 14, color: '#2D8B45', flexShrink: 0, marginTop: 1 }}>check</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      {isCurrent ? (
                        <div style={{ padding: '4px var(--space-3)', background: 'var(--color-black)', color: 'var(--color-white)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', textAlign: 'center' }}>
                          Current plan
                        </div>
                      ) : (
                        <div style={{ padding: '4px var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', color: 'var(--color-grey)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textAlign: 'center' }}>
                          Contact sales to upgrade
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
              To upgrade, contact <a href="mailto:hello@partna.co" style={{ color: 'var(--color-black)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>hello@partna.co</a>
            </p>
          </>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'security' && (
          <>
            {/* Account info */}
            <Card>
              <SectionHeader title="Account" />
              <div style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                  <div style={{ width: 44, height: 44, background: 'var(--color-black)', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', color: 'var(--color-primary)', flexShrink: 0 }}>
                    {admin?.full_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)' }}>{admin?.full_name}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginTop: 2 }}>
                      {admin?.email} · <span style={{ textTransform: 'capitalize' }}>{admin?.role}</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1.5px solid var(--color-grey-light)' }}>
                  Change password
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {[
                    { label: 'Current password', value: currentPassword, setter: setCurrentPassword },
                    { label: 'New password',      value: newPassword,     setter: setNewPassword     },
                    { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword },
                  ].map((f, i) => (
                    <div className="input-group" key={i}>
                      <label className="input-label">{f.label}</label>
                      <div className="input-wrapper">
                        <span className="icon-outlined input-icon-left">lock</span>
                        <input type="password" className="input" value={f.value} onChange={e => f.setter(e.target.value)} />
                      </div>
                    </div>
                  ))}
                  <button onClick={handleChangePassword} disabled={changingPw} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    {changingPw
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Updating…</>
                      : <><span className="icon-outlined icon-sm">lock_reset</span> Update password</>
                    }
                  </button>
                </div>
              </div>
            </Card>

            {/* Portal URL */}
            <Card>
              <SectionHeader title="Customer portal URL" />
              <div style={{ padding: 'var(--space-5)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>
                  Share this URL with your customers to access the savings portal.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--color-bg)', border: 'var(--border)', padding: 'var(--space-3) var(--space-4)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', flex: 1 }}>
                    {window.location.origin}/portal
                  </span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal`); flash('URL copied to clipboard.') }}
                    className="btn btn-sm btn-black"
                  >
                    <span className="icon-outlined icon-xs">content_copy</span>
                    Copy
                  </button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}