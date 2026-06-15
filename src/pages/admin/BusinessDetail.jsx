import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const PACKAGES     = ['starter', 'growth', 'enterprise']

async function sendAdminEmail({ to, subject, html }) {
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ to, subject, html }),
  })
}

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function txAmountColor(type) { return type === 'deposit' ? '#2D8B45' : '#C0392B' }

const KYB_BADGE = {
  verified: 'badge-success',
  pending:  'badge-warning',
  rejected: 'badge-danger',
  skipped:  'badge-default',
}

const KYB_LABEL = { verified: 'Verified', pending: 'Pending', rejected: 'Rejected', skipped: 'Skipped' }

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-3) var(--space-5)' }}>
        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>{title}</span>
      </div>
      <div style={{ padding: 'var(--space-5)' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, last, mono, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: last ? 'none' : '1.5px solid var(--color-grey-light)' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: mono ? 'monospace' : 'inherit', color: green ? '#2D8B45' : 'var(--color-black)' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function BusinessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [business, setBusiness]     = useState(null)
  const [admin, setAdmin]           = useState(null)
  const [customers, setCustomers]   = useState([])
  const [campaigns, setCampaigns]   = useState([])
  const [transactions, setTransactions] = useState([])
  const [kybDocs, setKybDocs]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [aum, setAum]               = useState(0)

  const [newPlan, setNewPlan]       = useState('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [planSuccess, setPlanSuccess] = useState(false)

  const [kybAction, setKybAction]     = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [savingKYB, setSavingKYB]     = useState(false)
  const [kybSuccess, setKybSuccess]   = useState('')

  const [statusAction, setStatusAction]   = useState(null)
  const [savingStatus, setSavingStatus]   = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')

  const [activeTab, setActiveTab] = useState('profile')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: bizData } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle()
      if (!bizData) { setLoading(false); return }
      setBusiness(bizData); setNewPlan(bizData.subscription_package || 'growth')

      const { data: adminData } = await supabase.from('business_admins').select('*').eq('business_id', id).eq('role', 'owner').maybeSingle()
      setAdmin(adminData)

      const { data: custData } = await supabase.from('customers').select('*, wallets(balance)').eq('business_id', id).order('created_at', { ascending: false })
      setCustomers(custData || [])
      setAum((custData || []).reduce((s, c) => s + Number(c.wallets?.[0]?.balance || 0), 0))

      const { data: campData } = await supabase.from('campaigns').select('*').eq('business_id', id).order('created_at', { ascending: false })
      setCampaigns(campData || [])

      const custIds = (custData || []).map(c => c.id)
      if (custIds.length > 0) {
        const { data: txnData } = await supabase.from('transactions').select('*, customers(first_name, last_name)').in('customer_id', custIds).order('created_at', { ascending: false }).limit(20)
        setTransactions(txnData || [])
      }

      const { data: files } = await supabase.storage.from('kyb-documents').list(id)
      setKybDocs(files || [])
    } catch (e) { console.error('BusinessDetail load error:', e) }
    setLoading(false)
  }

  async function handleKYBAction() {
    if (!kybAction) return
    if (kybAction === 'reject' && !rejectReason.trim()) return
    setSavingKYB(true)
    try {
      const newStatus = kybAction === 'approve' ? 'verified' : 'rejected'
      const emailBody = kybAction === 'approve'
        ? `Your KYB verification for ${business.name} has been approved. You now have full access to the Partna platform.`
        : `Your KYB verification for ${business.name} was not approved. Reason: ${rejectReason}. Please resubmit with the correct documents from your Settings page.`
      await supabase.from('businesses').update({ kyb_status: newStatus }).eq('id', id)
      await sendAdminEmail({ to: business.admin_email, subject: kybAction === 'approve' ? 'KYB Approved — Welcome to Partna' : 'KYB Update — Action Required', html: `<p>Hi ${admin?.full_name || 'there'},</p><p>${emailBody}</p><p>— The Partna Team</p>` })
      setBusiness(prev => ({ ...prev, kyb_status: newStatus }))
      setKybSuccess(kybAction === 'approve' ? 'KYB approved successfully.' : 'KYB rejected. Business notified.')
      setKybAction(null); setRejectReason('')
    } catch (e) { console.error('KYB action error:', e) }
    setSavingKYB(false)
  }

  async function handlePlanChange() {
    if (!newPlan || newPlan === business.subscription_package) return
    setSavingPlan(true)
    try {
      await supabase.from('businesses').update({ subscription_package: newPlan }).eq('id', id)
      setBusiness(prev => ({ ...prev, subscription_package: newPlan }))
      setPlanSuccess(true); setTimeout(() => setPlanSuccess(false), 3000)
    } catch (e) { console.error('Plan change error:', e) }
    setSavingPlan(false)
  }

  async function handleStatusChange() {
    if (!statusAction) return
    setSavingStatus(true)
    try {
      const newStatus = statusAction === 'reactivate' ? 'active' : statusAction === 'suspend' ? 'suspended' : 'deactivated'
      await supabase.from('businesses').update({ status: newStatus }).eq('id', id)
      setBusiness(prev => ({ ...prev, status: newStatus }))
      setStatusSuccess(`Business ${newStatus} successfully.`)
      setStatusAction(null); setTimeout(() => setStatusSuccess(''), 3000)
    } catch (e) { console.error('Status change error:', e) }
    setSavingStatus(false)
  }

  async function getKybDocUrl(filename) {
    const { data } = await supabase.storage.from('kyb-documents').createSignedUrl(`${id}/${filename}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  if (!business) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-20)', gap: 'var(--space-4)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>Business not found</span>
      <button onClick={() => navigate('/admin/businesses')} className="btn btn-primary">
        <span className="icon-outlined icon-sm">arrow_back</span>
        Back to businesses
      </button>
    </div>
  )

  const bizStatus = business.status || 'active'
  const TABS = ['profile', 'kyb', 'subscription', 'campaigns', 'customers', 'transactions']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button onClick={() => navigate('/admin/businesses')} className="btn btn-secondary btn-sm">
          <span className="icon-outlined icon-xs">arrow_back</span>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
          {business.logo_url && !business.logo_url.startsWith('/') ? (
            <img src={business.logo_url} alt={business.name} style={{ width: 40, height: 40, objectFit: 'contain', background: 'var(--color-bg)', padding: 2, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 40, height: 40, background: 'var(--color-black)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)', color: 'var(--color-primary)', flexShrink: 0 }}>
              {business.name?.[0]}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xl)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 24" }}>
              {business.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{business.sector}</span>
              <span className={`badge no-dot ${KYB_BADGE[business.kyb_status] || 'badge-default'}`}>
                KYB: {KYB_LABEL[business.kyb_status] || 'Unknown'}
              </span>
              <span className={`badge no-dot ${bizStatus === 'active' ? 'badge-success' : bizStatus === 'suspended' ? 'badge-danger' : 'badge-default'}`} style={{ textTransform: 'capitalize' }}>
                {bizStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success toasts */}
      {kybSuccess && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{kybSuccess}</div>
        </div>
      )}
      {statusSuccess && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{statusSuccess}</div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: 'var(--space-3)',
            background: activeTab === tab ? 'var(--color-black)' : 'var(--color-white)',
            color: activeTab === tab ? 'var(--color-white)' : 'var(--color-grey)',
            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
            textTransform: 'capitalize', cursor: 'pointer', transition: 'all var(--transition-fast)',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          <SectionCard title="Business profile">
            <InfoRow label="Business name" value={business.name} />
            <InfoRow label="Sector"        value={business.sector} />
            <InfoRow label="Admin email"   value={business.admin_email} />
            <InfoRow label="Business phone" value={business.phone} />
            <InfoRow label="Address"       value={business.address} />
            <InfoRow label="Website"       value={business.website} />
            <InfoRow label="Registered"    value={formatDate(business.created_at)} last />
          </SectionCard>

          <SectionCard title="Admin details">
            <InfoRow label="Full name"  value={admin?.full_name} />
            <InfoRow label="Job title"  value={admin?.job_title} />
            <InfoRow label="Email"      value={admin?.email} />
            <InfoRow label="Phone"      value={admin?.phone} />
            <InfoRow label="Role"       value={admin?.role} last />
          </SectionCard>

          <SectionCard title="Legal & registration">
            <InfoRow label="Registration type"   value={business.registration_type?.replace(/_/g, ' ')} />
            <InfoRow label="Legal name"          value={business.legal_name} />
            <InfoRow label="Registration number" value={business.registration_number} mono />
            <InfoRow label="TIN"                 value={business.tin} mono last />
          </SectionCard>

          <SectionCard title="Branding">
            {[
              { label: 'Primary colour',   color: business.primary_color   },
              { label: 'Secondary colour', color: business.secondary_color  },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ width: 20, height: 20, background: row.color, border: 'var(--border)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{row.color}</span>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Platform stats">
            <InfoRow label="Total customers"     value={customers.length} />
            <InfoRow label="Total AUM"           value={formatUGX(aum)} green />
            <InfoRow label="Active campaigns"    value={campaigns.filter(c => c.status === 'active').length} />
            <InfoRow label="Total transactions"  value={transactions.length} last />
          </SectionCard>

          <SectionCard title="Account actions">
            {statusSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">{statusSuccess}</div>
              </div>
            )}
            {statusAction ? (
              <div style={{ background: 'var(--color-bg)', border: 'var(--border)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                  Confirm: {statusAction} this business?
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button onClick={() => setStatusAction(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={handleStatusChange} disabled={savingStatus}
                    className={`btn ${statusAction === 'reactivate' ? 'btn-success' : 'btn-danger'}`}
                    style={{ flex: 1 }}>
                    {savingStatus
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                      : 'Confirm'
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {bizStatus === 'active' && (
                  <button onClick={() => setStatusAction('suspend')} className="btn btn-danger btn-full">
                    <span className="icon-outlined icon-sm">block</span>
                    Suspend business
                  </button>
                )}
                {bizStatus === 'suspended' && (
                  <button onClick={() => setStatusAction('reactivate')} className="btn btn-success btn-full">
                    <span className="icon-outlined icon-sm">restart_alt</span>
                    Reactivate business
                  </button>
                )}
                {bizStatus !== 'deactivated' && (
                  <button onClick={() => setStatusAction('deactivate')} className="btn btn-ghost btn-full">
                    <span className="icon-outlined icon-sm">delete</span>
                    Deactivate business
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── KYB ── */}
      {activeTab === 'kyb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <SectionCard title="KYB status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <span className={`badge no-dot ${KYB_BADGE[business.kyb_status] || 'badge-default'}`} style={{ fontSize: 'var(--text-sm)' }}>
                {KYB_LABEL[business.kyb_status] || 'Unknown'}
              </span>
              {business.kyb_status === 'pending' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>Awaiting review</span>
              )}
            </div>

            {business.kyb_status === 'verified' ? (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">verified_user</span>
                <div className="alert-content">This business has been verified.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {kybAction === 'reject' && (
                  <div className="input-group">
                    <label className="input-label">Rejection reason <span className="required">*</span></label>
                    <textarea className="input" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      placeholder="Explain why the KYB submission is being rejected…" rows={3} />
                  </div>
                )}
                {kybAction ? (
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button onClick={() => { setKybAction(null); setRejectReason('') }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleKYBAction} disabled={savingKYB || (kybAction === 'reject' && !rejectReason.trim())}
                      className={`btn ${kybAction === 'approve' ? 'btn-success' : 'btn-danger'}`}
                      style={{ flex: 1 }}>
                      {savingKYB
                        ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                        : kybAction === 'approve' ? 'Confirm approval' : 'Confirm rejection'
                      }
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button onClick={() => setKybAction('approve')} className="btn btn-success" style={{ flex: 1 }}>
                      <span className="icon-outlined icon-sm">check</span>
                      Approve KYB
                    </button>
                    <button onClick={() => setKybAction('reject')} className="btn btn-danger" style={{ flex: 1 }}>
                      <span className="icon-outlined icon-sm">cancel</span>
                      Reject KYB
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Uploaded documents (${kybDocs.length})`}>
            {kybDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                No documents uploaded
              </div>
            ) : (
              kybDocs.map((doc, i) => (
                <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: i < kybDocs.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)' }}>description</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                      {doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}
                    </span>
                  </div>
                  <button onClick={() => getKybDocUrl(doc.name)} className="btn btn-sm btn-secondary">
                    <span className="icon-outlined icon-xs">open_in_new</span>
                    View
                  </button>
                </div>
              ))
            )}
          </SectionCard>
        </div>
      )}

      {/* ── SUBSCRIPTION ── */}
      {activeTab === 'subscription' && (
        <SectionCard title="Subscription plan">
          <InfoRow label="Current plan" value={business.subscription_package} />
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <label className="input-label">Change plan</label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <select className="input" value={newPlan} onChange={e => setNewPlan(e.target.value)} style={{ flex: 1 }}>
                {PACKAGES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <button onClick={handlePlanChange} disabled={savingPlan || newPlan === business.subscription_package} className="btn btn-primary">
                {savingPlan
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                  : <><span className="icon-outlined icon-sm">save</span> Save</>
                }
              </button>
            </div>
            {planSuccess && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">Plan updated successfully.</div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── CAMPAIGNS ── */}
      {activeTab === 'campaigns' && (
        <SectionCard title={`Campaigns (${campaigns.length})`}>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>No campaigns yet</div>
          ) : (
            <div className="table-wrapper" style={{ margin: 'calc(-1 * var(--space-5))', marginTop: 0 }}>
              <table className="table">
                <thead><tr><th>Name</th><th>Status</th><th>Target</th><th>Created</th></tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{c.name}</td>
                      <td><span className={`badge no-dot ${c.status === 'active' ? 'badge-success' : 'badge-default'}`} style={{ textTransform: 'capitalize' }}>{c.status}</span></td>
                      <td style={{ fontWeight: 'var(--weight-bold)' }}>{formatUGX(c.target_amount)}</td>
                      <td style={{ color: 'var(--color-grey)' }}>{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── CUSTOMERS ── */}
      {activeTab === 'customers' && (
        <SectionCard title={`Customers (${customers.length})`}>
          {customers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>No customers yet</div>
          ) : (
            <div className="table-wrapper" style={{ margin: 'calc(-1 * var(--space-5))', marginTop: 0 }}>
              <table className="table">
                <thead><tr><th>Name</th><th>Phone</th><th>Balance</th><th>KYC</th><th></th></tr></thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{c.email}</div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{c.phone}</td>
                      <td style={{ fontWeight: 'var(--weight-bold)', color: '#2D8B45' }}>{formatUGX(c.wallets?.[0]?.balance || 0)}</td>
                      <td><span className={`badge no-dot ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>{c.kyc_status === 'verified' ? 'Verified' : 'Pending'}</span></td>
                      <td><button onClick={() => navigate(`/admin/customers/${c.id}`)} className="btn btn-sm btn-secondary">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── TRANSACTIONS ── */}
      {activeTab === 'transactions' && (
        <SectionCard title={`Recent transactions (${transactions.length})`}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>No transactions yet</div>
          ) : (
            <div className="table-wrapper" style={{ margin: 'calc(-1 * var(--space-5))', marginTop: 0 }}>
              <table className="table">
                <thead><tr><th>Reference</th><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{t.reference || t.id.slice(0, 8)}</span></td>
                      <td style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{t.customers?.first_name} {t.customers?.last_name}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', textTransform: 'capitalize' }}>{t.type}</td>
                      <td style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(t.type) }}>{t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}</td>
                      <td><span className={`badge no-dot ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>{t.status}</span></td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}