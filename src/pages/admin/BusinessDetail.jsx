import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const PACKAGES = ['starter', 'growth', 'enterprise']

const KYB_COLORS = {
  verified: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Verified' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Rejected' },
  skipped: { bg: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)', label: 'Skipped' },
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.4)' }}>{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, valueColor }) {
  return (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: valueColor || ADMIN_PRIMARY }}>{value || '—'}</span>
    </div>
  )
}

export default function BusinessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [business, setBusiness] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [customers, setCustomers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [transactions, setTransactions] = useState([])
  const [kybDocs, setKybDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [aum, setAum] = useState(0)

  // Action states
  const [newPlan, setNewPlan] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [planSuccess, setPlanSuccess] = useState(false)

  const [kybAction, setKybAction] = useState(null) // 'approve' | 'reject'
  const [rejectReason, setRejectReason] = useState('')
  const [savingKYB, setSavingKYB] = useState(false)
  const [kybSuccess, setKybSuccess] = useState('')

  const [statusAction, setStatusAction] = useState(null) // 'suspend' | 'reactivate' | 'deactivate'
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')

  const [activeTab, setActiveTab] = useState('profile')

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      // Business
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!bizData) { setLoading(false); return }
      setBusiness(bizData)
      setNewPlan(bizData.subscription_package || 'growth')

      // Admin
      const { data: adminData } = await supabase
        .from('business_admins')
        .select('*')
        .eq('business_id', id)
        .eq('role', 'owner')
        .maybeSingle()
      setAdmin(adminData)

      // Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*, wallets(balance)')
        .eq('business_id', id)
        .order('created_at', { ascending: false })
      setCustomers(custData || [])

      // AUM
      const totalAum = (custData || []).reduce((s, c) => {
        const bal = c.wallets?.[0]?.balance || 0
        return s + Number(bal)
      }, 0)
      setAum(totalAum)

      // Campaigns
      const { data: campData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', id)
        .order('created_at', { ascending: false })
      setCampaigns(campData || [])

      // Recent transactions
      const custIds = (custData || []).map(c => c.id)
      if (custIds.length > 0) {
        const { data: txnData } = await supabase
          .from('transactions')
          .select('*, customers(first_name, last_name)')
          .in('customer_id', custIds)
          .order('created_at', { ascending: false })
          .limit(20)
        setTransactions(txnData || [])
      }

      // KYB documents from Supabase Storage
      const { data: files } = await supabase.storage
        .from('kyb-documents')
        .list(id)
      setKybDocs(files || [])

    } catch (e) {
      console.error('BusinessDetail load error:', e)
    }
    setLoading(false)
  }

  async function handleKYBAction() {
    if (!kybAction) return
    if (kybAction === 'reject' && !rejectReason.trim()) return
    setSavingKYB(true)
    try {
      const newStatus = kybAction === 'approve' ? 'verified' : 'rejected'
      await supabase
        .from('businesses')
        .update({ kyb_status: newStatus })
        .eq('id', id)

      // Send notification email via Resend
      const emailBody = kybAction === 'approve'
        ? `Your KYB verification for ${business.name} has been approved. You now have full access to the Partna platform.`
        : `Your KYB verification for ${business.name} was not approved. Reason: ${rejectReason}. Please resubmit with the correct documents from your Settings page.`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Partna <receipts@partna.io>',
          to: [business.admin_email],
          subject: kybAction === 'approve' ? 'KYB Approved — Welcome to Partna' : 'KYB Update — Action Required',
          html: `<p>Hi ${admin?.full_name || 'there'},</p><p>${emailBody}</p><p>— The Partna Team</p>`,
        }),
      })

      setBusiness(prev => ({ ...prev, kyb_status: newStatus }))
      setKybSuccess(kybAction === 'approve' ? 'KYB approved successfully.' : 'KYB rejected. Business notified.')
      setKybAction(null)
      setRejectReason('')
    } catch (e) {
      console.error('KYB action error:', e)
    }
    setSavingKYB(false)
  }

  async function handlePlanChange() {
    if (!newPlan || newPlan === business.subscription_package) return
    setSavingPlan(true)
    try {
      await supabase
        .from('businesses')
        .update({ subscription_package: newPlan })
        .eq('id', id)
      setBusiness(prev => ({ ...prev, subscription_package: newPlan }))
      setPlanSuccess(true)
      setTimeout(() => setPlanSuccess(false), 3000)
    } catch (e) {
      console.error('Plan change error:', e)
    }
    setSavingPlan(false)
  }

  async function handleStatusChange() {
    if (!statusAction) return
    setSavingStatus(true)
    try {
      const newStatus = statusAction === 'reactivate' ? 'active' : statusAction === 'suspend' ? 'suspended' : 'deactivated'
      await supabase
        .from('businesses')
        .update({ status: newStatus })
        .eq('id', id)
      setBusiness(prev => ({ ...prev, status: newStatus }))
      setStatusSuccess(`Business ${newStatus} successfully.`)
      setStatusAction(null)
      setTimeout(() => setStatusSuccess(''), 3000)
    } catch (e) {
      console.error('Status change error:', e)
    }
    setSavingStatus(false)
  }

  async function getKybDocUrl(filename) {
    const { data } = await supabase.storage
      .from('kyb-documents')
      .createSignedUrl(`${id}/${filename}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function txColor(type) { return type === 'deposit' ? '#16A34A' : '#DC2626' }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  if (!business) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-sm" style={{ color: 'rgba(0,0,0,0.4)' }}>Business not found</div>
      <button onClick={() => navigate('/admin/businesses')}
        className="text-xs font-semibold px-4 py-2 rounded-xl"
        style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
        Back to businesses
      </button>
    </div>
  )

  const kyb = KYB_COLORS[business.kyb_status] || KYB_COLORS.skipped
  const bizStatus = business.status || 'active'

  const TABS = ['profile', 'kyb', 'subscription', 'campaigns', 'customers', 'transactions']

  return (
    <div className="flex flex-col gap-5">

      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/businesses')}
          className="text-xs font-semibold px-3 py-2 rounded-xl"
          style={{ background: '#fff', color: ADMIN_PRIMARY, border: '1.5px solid rgba(27,79,114,0.15)' }}>
          ← Back
        </button>
        <div className="flex items-center gap-3 flex-1">
          {business.logo_url && !business.logo_url.startsWith('/') ? (
            <img src={business.logo_url} alt={business.name}
              className="w-10 h-10 rounded-xl object-contain"
              style={{ background: '#f0f2f5' }} />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: business.primary_color || ADMIN_PRIMARY, color: '#fff' }}>
              {business.name?.[0]}
            </div>
          )}
          <div>
            <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>{business.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{business.sector}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: kyb.bg, color: kyb.color }}>
                KYB: {kyb.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                style={{
                  background: bizStatus === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                  color: bizStatus === 'active' ? '#16A34A' : '#DC2626',
                }}>
                {bizStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success messages */}
      {kybSuccess && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
          ✓ {kybSuccess}
        </div>
      )}
      {statusSuccess && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
          ✓ {statusSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#fff' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize"
            style={{
              background: activeTab === tab ? ADMIN_PRIMARY : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(0,0,0,0.4)',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-2 gap-5">
          <Section title="Business Profile">
            <Row label="Business name" value={business.name} />
            <Row label="Sector" value={business.sector} />
            <Row label="Admin email" value={business.admin_email} />
            <Row label="Business phone" value={business.phone} />
            <Row label="Address" value={business.address} />
            <Row label="Website" value={business.website} />
            <Row label="Registered" value={formatDate(business.created_at)} />
          </Section>

          <Section title="Admin Details">
            <Row label="Full name" value={admin?.full_name} />
            <Row label="Job title" value={admin?.job_title} />
            <Row label="Email" value={admin?.email} />
            <Row label="Phone" value={admin?.phone} />
            <Row label="Role" value={admin?.role} />
          </Section>

          <Section title="Legal & Registration">
            <Row label="Registration type" value={business.registration_type} />
            <Row label="Legal name" value={business.legal_name} />
            <Row label="Registration number" value={business.registration_number} />
            <Row label="TIN" value={business.tin} />
          </Section>

          <Section title="Branding">
            <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Primary colour</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md border"
                  style={{ background: business.primary_color, borderColor: 'rgba(0,0,0,0.1)' }} />
                <span className="text-xs font-mono font-semibold" style={{ color: ADMIN_PRIMARY }}>
                  {business.primary_color}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Secondary colour</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md border"
                  style={{ background: business.secondary_color, borderColor: 'rgba(0,0,0,0.1)' }} />
                <span className="text-xs font-mono font-semibold" style={{ color: ADMIN_PRIMARY }}>
                  {business.secondary_color}
                </span>
              </div>
            </div>
          </Section>

          {/* Account actions */}
          <Section title="Account Actions">
            <div className="flex flex-col gap-3">
              {statusSuccess && (
                <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  ✓ {statusSuccess}
                </div>
              )}
              {statusAction && (
                <div className="flex flex-col gap-2 p-3 rounded-xl"
                  style={{ background: '#f8f9fa', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="text-xs font-semibold" style={{ color: '#333' }}>
                    Confirm: {statusAction} this business?
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStatusAction(null)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: '#fff', color: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.1)' }}>
                      Cancel
                    </button>
                    <button onClick={handleStatusChange} disabled={savingStatus}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{ background: statusAction === 'reactivate' ? '#16A34A' : '#DC2626', color: '#fff' }}>
                      {savingStatus ? 'Saving...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
              {!statusAction && (
                <div className="flex flex-col gap-2">
                  {bizStatus === 'active' && (
                    <button onClick={() => setStatusAction('suspend')}
                      className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                      Suspend business
                    </button>
                  )}
                  {bizStatus === 'suspended' && (
                    <button onClick={() => setStatusAction('reactivate')}
                      className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
                      Reactivate business
                    </button>
                  )}
                  {bizStatus !== 'deactivated' && (
                    <button onClick={() => setStatusAction('deactivate')}
                      className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }}>
                      Deactivate business
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Stats */}
          <Section title="Platform Stats">
            <Row label="Total customers" value={customers.length} />
            <Row label="Total AUM" value={formatUGX(aum)} valueColor="#16A34A" />
            <Row label="Active campaigns" value={campaigns.filter(c => c.status === 'active').length} />
            <Row label="Total transactions" value={transactions.length} />
          </Section>
        </div>
      )}

      {/* ── KYB TAB ── */}
      {activeTab === 'kyb' && (
        <div className="flex flex-col gap-5">
          <Section title="KYB Status">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                style={{ background: kyb.bg, color: kyb.color }}>
                {kyb.label}
              </span>
              {business.kyb_status === 'pending' && (
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Awaiting review
                </span>
              )}
            </div>

            {/* KYB Actions */}
            {business.kyb_status !== 'verified' && (
              <div className="flex flex-col gap-3">
                {kybAction === 'reject' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                      Rejection reason *
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Explain why the KYB submission is being rejected..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-xs outline-none resize-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                    />
                  </div>
                )}
                {kybAction && (
                  <div className="flex gap-2">
                    <button onClick={() => { setKybAction(null); setRejectReason('') }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleKYBAction}
                      disabled={savingKYB || (kybAction === 'reject' && !rejectReason.trim())}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={{
                        background: kybAction === 'approve' ? '#16A34A' : '#DC2626',
                        color: '#fff',
                        opacity: (savingKYB || (kybAction === 'reject' && !rejectReason.trim())) ? 0.5 : 1,
                      }}>
                      {savingKYB ? 'Saving...' : kybAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                    </button>
                  </div>
                )}
                {!kybAction && (
                  <div className="flex gap-3">
                    <button onClick={() => setKybAction('approve')}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: '#16A34A', color: '#fff' }}>
                      ✓ Approve KYB
                    </button>
                    <button onClick={() => setKybAction('reject')}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                      ✕ Reject KYB
                    </button>
                  </div>
                )}
              </div>
            )}
            {business.kyb_status === 'verified' && (
              <div className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
                ✓ This business has been verified
              </div>
            )}
          </Section>

          <Section title="Uploaded Documents">
            {kybDocs.length === 0 ? (
              <div className="text-xs py-4 text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
                No documents uploaded
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {kybDocs.map(doc => (
                  <div key={doc.name} className="flex items-center justify-between py-2"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📄</span>
                      <span className="text-xs" style={{ color: '#333' }}>
                        {doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}
                      </span>
                    </div>
                    <button onClick={() => getKybDocUrl(doc.name)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── SUBSCRIPTION TAB ── */}
      {activeTab === 'subscription' && (
        <Section title="Subscription Plan">
          <div className="flex flex-col gap-4">
            <Row label="Current plan" value={business.subscription_package} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                Change plan
              </label>
              <div className="flex gap-3">
                <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                  {PACKAGES.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <button onClick={handlePlanChange} disabled={savingPlan || newPlan === business.subscription_package}
                  className="px-6 py-3 rounded-xl text-sm font-bold"
                  style={{
                    background: newPlan === business.subscription_package ? 'rgba(27,79,114,0.2)' : ADMIN_PRIMARY,
                    color: '#fff',
                  }}>
                  {savingPlan ? 'Saving...' : 'Save'}
                </button>
              </div>
              {planSuccess && (
                <div className="text-xs px-3 py-2 rounded-xl font-semibold mt-1"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  ✓ Plan updated successfully
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <Section title={`Campaigns (${campaigns.length})`}>
          {campaigns.length === 0 ? (
            <div className="text-xs py-4 text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
              No campaigns yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Name', 'Status', 'Target', 'Created'].map(h => (
                      <th key={h} className="py-2 text-left">
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < campaigns.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>{c.name}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{
                            background: c.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                            color: c.status === 'active' ? '#16A34A' : 'rgba(0,0,0,0.4)',
                          }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs" style={{ color: '#333' }}>{formatUGX(c.target_amount)}</span>
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{formatDate(c.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ── CUSTOMERS TAB ── */}
      {activeTab === 'customers' && (
        <Section title={`Customers (${customers.length})`}>
          {customers.length === 0 ? (
            <div className="text-xs py-4 text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
              No customers yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Name', 'Phone', 'Balance', 'KYC', ''].map(h => (
                      <th key={h} className="py-2 text-left">
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < customers.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="py-2.5 pr-4">
                        <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{c.email}</div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs" style={{ color: '#333' }}>{c.phone}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                          {formatUGX(c.wallets?.[0]?.balance || 0)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: c.kyc_status === 'verified' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                            color: c.kyc_status === 'verified' ? '#16A34A' : '#D97706',
                          }}>
                          {c.kyc_status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => navigate(`/admin/customers/${c.id}`)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab === 'transactions' && (
        <Section title={`Recent Transactions (${transactions.length})`}>
          {transactions.length === 0 ? (
            <div className="text-xs py-4 text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
              No transactions yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Reference', 'Customer', 'Type', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="py-2 text-left">
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: i < transactions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          {t.reference || t.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                          {t.customers?.first_name} {t.customers?.last_name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs capitalize" style={{ color: 'rgba(0,0,0,0.6)' }}>{t.type}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold" style={{ color: txColor(t.type) }}>
                          {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{
                            background: t.status === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                            color: t.status === 'completed' ? '#16A34A' : '#D97706',
                          }}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {formatDate(t.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

    </div>
  )
}