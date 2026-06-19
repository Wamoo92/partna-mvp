import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

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

function Badge({ value, type }) {
  const cfg = {
    verified:    { bg: C.bgGreen,   color: C.green  },
    pending:     { bg: C.bgOrange,  color: C.orange  },
    rejected:    { bg: C.bgRed,     color: C.red     },
    skipped:     { bg: C.grayLight, color: C.grayMid },
    active:      { bg: C.bgGreen,   color: C.green  },
    suspended:   { bg: C.bgRed,     color: C.red     },
    deactivated: { bg: C.grayLight, color: C.grayMid },
    completed:   { bg: C.bgGreen,   color: C.green  },
    failed:      { bg: C.bgRed,     color: C.red     },
  }[value] || { bg: C.grayLight, color: C.grayMid }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {value || 'unknown'}
    </span>
  )
}

// ── Section card ───────────────────────────────────────────────────────────
function SectionCard({ title, children, action }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

// ── Info row ───────────────────────────────────────────────────────────────
function InfoRow({ label, value, last, mono, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: green ? C.green : C.black, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </span>
    </div>
  )
}

// ── Shared table wrapper ───────────────────────────────────────────────────
function AdminTable({ cols, rows, emptyMsg }) {
  if (rows.length === 0) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.secondary }}>{emptyMsg}</div>
  )
  return (
    <div style={{ overflowX: 'auto', margin: '-16px -20px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
            {cols.map(c => <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
              {row}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const td = (content, opts = {}) => (
  <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: opts.bold ? 600 : 500, color: opts.color || (opts.secondary ? C.secondary : C.black), whiteSpace: opts.nowrap ? 'nowrap' : 'normal', fontFamily: opts.mono ? 'monospace' : 'inherit', ...opts.style }}>
    {content}
  </td>
)

export default function BusinessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [business, setBusiness]         = useState(null)
  const [admin, setAdmin]               = useState(null)
  const [customers, setCustomers]       = useState([])
  const [campaigns, setCampaigns]       = useState([])
  const [transactions, setTransactions] = useState([])
  const [kybDocs, setKybDocs]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [aum, setAum]                   = useState(0)

  const [newPlan, setNewPlan]           = useState('')
  const [savingPlan, setSavingPlan]     = useState(false)
  const [planSuccess, setPlanSuccess]   = useState(false)

  const [kybAction, setKybAction]       = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [savingKYB, setSavingKYB]       = useState(false)
  const [kybSuccess, setKybSuccess]     = useState('')

  const [statusAction, setStatusAction]   = useState(null)
  const [savingStatus, setSavingStatus]   = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')

  const [activeTab, setActiveTab] = useState('profile')

  useEffect(() => { loadAll() }, [id])

  // ── All business logic — unchanged ────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (!business) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Business not found</p>
      <button onClick={() => navigate('/admin/businesses')} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        ← Back to businesses
      </button>
    </div>
  )

  const bizStatus = business.status || 'active'
  const TABS = ['profile', 'kyb', 'subscription', 'campaigns', 'customers', 'transactions']

  const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
  const btnPrimary = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSecondary = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnDanger = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSuccess = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.green, border: `1px solid ${C.green}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/admin/businesses')} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {business.logo_url && !business.logo_url.startsWith('/') ? (
            <img src={business.logo_url} alt={business.name} style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, background: C.bg, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, color: '#F6F7EE', flexShrink: 0 }}>
              {business.name?.[0]}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 5px' }}>{business.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{business.sector}</span>
              <Badge value={business.kyb_status} />
              <Badge value={bizStatus} />
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {kybSuccess && (
        <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{kybSuccess}</div>
      )}
      {statusSuccess && (
        <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{statusSuccess}</div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none',
            background: activeTab === tab ? C.black : 'transparent',
            color: activeTab === tab ? C.white : C.secondary,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SectionCard title="Business profile">
            <InfoRow label="Business name"  value={business.name} />
            <InfoRow label="Sector"         value={business.sector} />
            <InfoRow label="Admin email"    value={business.admin_email} />
            <InfoRow label="Business phone" value={business.phone} />
            <InfoRow label="Address"        value={business.address} />
            <InfoRow label="Website"        value={business.website} />
            <InfoRow label="Registered"     value={formatDate(business.created_at)} last />
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
              { label: 'Primary colour',   color: business.primary_color  },
              { label: 'Secondary colour', color: business.secondary_color },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: row.color, border: `1px solid ${C.grayLine}` }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.black }}>{row.color || '—'}</span>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Platform stats">
            <InfoRow label="Total customers"    value={customers.length} />
            <InfoRow label="Total AUM"          value={formatUGX(aum)} green />
            <InfoRow label="Active campaigns"   value={campaigns.filter(c => c.status === 'active').length} />
            <InfoRow label="Total transactions" value={transactions.length} last />
          </SectionCard>

          <SectionCard title="Account actions">
            {statusAction ? (
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0 }}>Confirm: {statusAction} this business?</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStatusAction(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
                  <button onClick={handleStatusChange} disabled={savingStatus} style={{ ...(statusAction === 'reactivate' ? btnSuccess : btnDanger), flex: 1, opacity: savingStatus ? 0.75 : 1, cursor: savingStatus ? 'not-allowed' : 'pointer', justifyContent: 'center' }}>
                    {savingStatus ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bizStatus === 'active' && (
                  <button onClick={() => setStatusAction('suspend')} style={{ ...btnDanger, width: '100%', justifyContent: 'center' }}>Suspend business</button>
                )}
                {bizStatus === 'suspended' && (
                  <button onClick={() => setStatusAction('reactivate')} style={{ ...btnSuccess, width: '100%', justifyContent: 'center' }}>Reactivate business</button>
                )}
                {bizStatus !== 'deactivated' && (
                  <button onClick={() => setStatusAction('deactivate')} style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="KYB status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Badge value={business.kyb_status} />
              {business.kyb_status === 'pending' && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Awaiting review</span>}
            </div>

            {business.kyb_status === 'verified' ? (
              <div style={{ background: C.bgGreen, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>
                This business has been verified.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {kybAction === 'reject' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>Rejection reason *</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                      placeholder="Explain why the KYB submission is being rejected…"
                      style={{ ...inputStyle, resize: 'vertical' }}
                      onFocus={e => e.target.style.borderColor = C.black}
                      onBlur={e => e.target.style.borderColor = C.grayLine}
                    />
                  </div>
                )}
                {kybAction ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setKybAction(null); setRejectReason('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                    <button onClick={handleKYBAction} disabled={savingKYB || (kybAction === 'reject' && !rejectReason.trim())}
                      style={{ ...(kybAction === 'approve' ? btnSuccess : btnDanger), flex: 1, justifyContent: 'center', opacity: (savingKYB || (kybAction === 'reject' && !rejectReason.trim())) ? 0.6 : 1 }}>
                      {savingKYB ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : kybAction === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setKybAction('approve')} style={{ ...btnSuccess, flex: 1, justifyContent: 'center' }}>Approve KYB</button>
                    <button onClick={() => setKybAction('reject')}  style={{ ...btnDanger,  flex: 1, justifyContent: 'center' }}>Reject KYB</button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Uploaded documents (${kybDocs.length})`}>
            {kybDocs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary }}>No documents uploaded</div>
            ) : kybDocs.map((doc, i) => (
              <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < kybDocs.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}</span>
                </div>
                <button onClick={() => getKybDocUrl(doc.name)} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>View →</button>
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── SUBSCRIPTION ── */}
      {activeTab === 'subscription' && (
        <SectionCard title="Subscription plan">
          <InfoRow label="Current plan" value={business.subscription_package} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.black }}>Change plan</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)} style={{ ...inputStyle, flex: 1 }}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}
              >
                {PACKAGES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <button onClick={handlePlanChange} disabled={savingPlan || newPlan === business.subscription_package}
                style={{ ...btnPrimary, opacity: savingPlan || newPlan === business.subscription_package ? 0.5 : 1, cursor: savingPlan || newPlan === business.subscription_package ? 'not-allowed' : 'pointer' }}>
                {savingPlan ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save'}
              </button>
            </div>
            {planSuccess && <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>Plan updated successfully.</div>}
          </div>
        </SectionCard>
      )}

      {/* ── CAMPAIGNS ── */}
      {activeTab === 'campaigns' && (
        <SectionCard title={`Campaigns (${campaigns.length})`}>
          <AdminTable
            cols={['Name', 'Status', 'Target', 'Created']}
            emptyMsg="No campaigns yet"
            rows={campaigns.map(c => [
              td(<><p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0 }}>{c.name}</p></>, {}),
              td(<Badge value={c.status} />, {}),
              td(formatUGX(c.target_amount), { bold: true }),
              td(formatDate(c.created_at), { secondary: true, nowrap: true }),
            ])}
          />
        </SectionCard>
      )}

      {/* ── CUSTOMERS ── */}
      {activeTab === 'customers' && (
        <SectionCard title={`Customers (${customers.length})`}>
          <AdminTable
            cols={['Name', 'Phone', 'Balance', 'KYC', '']}
            emptyMsg="No customers yet"
            rows={customers.map(c => [
              td(<><p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{c.first_name} {c.last_name}</p><p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{c.email}</p></>, {}),
              td(c.phone, { secondary: true }),
              td(formatUGX(c.wallets?.[0]?.balance || 0), { bold: true, color: C.green }),
              td(<Badge value={c.kyc_status === 'verified' ? 'verified' : 'pending'} />, {}),
              td(<button onClick={() => navigate(`/admin/customers/${c.id}`)} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>View →</button>, {}),
            ])}
          />
        </SectionCard>
      )}

      {/* ── TRANSACTIONS ── */}
      {activeTab === 'transactions' && (
        <SectionCard title={`Recent transactions (${transactions.length})`}>
          <AdminTable
            cols={['Reference', 'Customer', 'Type', 'Amount', 'Status', 'Date']}
            emptyMsg="No transactions yet"
            rows={transactions.map(t => [
              td(t.reference || t.id.slice(0, 8), { mono: true, secondary: true }),
              td(`${t.customers?.first_name} ${t.customers?.last_name}`, { bold: true }),
              td(t.type, { secondary: true }),
              td(`${t.type === 'deposit' ? '+' : '-'}${formatUGX(t.amount)}`, { bold: true, color: t.type === 'deposit' ? C.green : C.red }),
              td(<Badge value={t.status} />, {}),
              td(formatDate(t.created_at), { secondary: true, nowrap: true }),
            ])}
          />
        </SectionCard>
      )}

    </div>
  )
}