import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function sendAdminEmail({ to, subject, html }) {
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ to, subject, html }),
  })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysSince(d) {
  if (!d) return 0
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
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

function kybBadge(status) {
  const cfg = {
    verified: { bg: C.bgGreen,  color: C.green  },
    pending:  { bg: C.bgOrange, color: C.orange  },
    rejected: { bg: C.bgRed,    color: C.red     },
    skipped:  { bg: C.grayLight, color: C.grayMid },
  }[status] || { bg: C.grayLight, color: C.grayMid }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status || 'unknown'}
    </span>
  )
}

function SectionCard({ title, rightSlot, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>{title}</p>
        {rightSlot}
      </div>
      <div>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderBottom: last ? 'none' : `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.black, textTransform: 'capitalize' }}>{value || '—'}</span>
    </div>
  )
}

const btnPrimary   = { padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnSuccess   = { ...btnPrimary, background: C.green, borderColor: C.green }
const btnDanger    = { ...btnPrimary, background: C.red,   borderColor: C.red   }
const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', resize: 'vertical', transition: 'border-color 0.15s' }

export default function KYBQueue() {
  const navigate = useNavigate()

  const [businesses, setBusinesses]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [kybDocs, setKybDocs]           = useState([])
  const [loadingDocs, setLoadingDocs]   = useState(false)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [kybAction, setKybAction]       = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving]             = useState(false)
  const [successMsg, setSuccessMsg]     = useState('')

  useEffect(() => { loadBusinesses() }, [])
  useEffect(() => { if (selected) loadDocs(selected.id) }, [selected])

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function loadBusinesses() {
    setLoading(true)
    try {
      const { data } = await supabase.from('businesses').select('*, business_admins(full_name, job_title, email)').in('kyb_status', ['pending', 'verified', 'rejected', 'skipped']).order('created_at', { ascending: true })
      setBusinesses(data || [])
    } catch (e) { console.error('KYB queue load error:', e) }
    setLoading(false)
  }

  async function loadDocs(bizId) {
    setLoadingDocs(true); setKybDocs([])
    try {
      const { data } = await supabase.storage.from('kyb-documents').list(bizId)
      setKybDocs(data || [])
    } catch (e) { console.error('KYB docs load error:', e) }
    setLoadingDocs(false)
  }

  async function openDoc(filename) {
    const { data } = await supabase.storage.from('kyb-documents').createSignedUrl(`${selected.id}/${filename}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleAction() {
    if (!kybAction || !selected) return
    if (kybAction === 'reject' && !rejectReason.trim()) return
    setSaving(true)
    try {
      const newStatus = kybAction === 'approve' ? 'verified' : 'rejected'
      const adminName = selected.business_admins?.[0]?.full_name || 'there'
      const emailBody = kybAction === 'approve'
        ? `Your KYB verification for <strong>${selected.name}</strong> has been approved. You now have full access to the Partna platform.`
        : `Your KYB verification for <strong>${selected.name}</strong> was not approved.<br><br><strong>Reason:</strong> ${rejectReason}<br><br>Please resubmit with the correct documents from your Settings page.`
      await supabase.from('businesses').update({ kyb_status: newStatus }).eq('id', selected.id)
      await sendAdminEmail({ to: selected.admin_email, subject: kybAction === 'approve' ? `KYB Approved — ${selected.name} is verified` : `KYB Update — Action required for ${selected.name}`, html: `<p>Hi ${adminName},</p><p>${emailBody}</p><p>— The Partna Team</p>` })
      setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, kyb_status: newStatus } : b))
      setSelected(prev => ({ ...prev, kyb_status: newStatus }))
      setSuccessMsg(kybAction === 'approve' ? `${selected.name} KYB approved. Email sent to ${selected.admin_email}.` : `${selected.name} KYB rejected. Email sent to ${selected.admin_email}.`)
      setKybAction(null); setRejectReason('')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e) { console.error('KYB action error:', e) }
    setSaving(false)
  }

  async function handleDefer() {
    setBusinesses(prev => { const idx = prev.findIndex(b => b.id === selected.id); if (idx === -1) return prev; const u = [...prev]; const [item] = u.splice(idx, 1); u.push(item); return u })
    setSelected(null)
  }

  const filtered     = businesses.filter(b => !filterStatus || b.kyb_status === filterStatus)
  const pendingCount = businesses.filter(b => b.kyb_status === 'pending').length

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
          {pendingCount} pending · {businesses.length} total submissions
        </p>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
          {[
            { value: 'pending',  label: 'Pending'  },
            { value: 'verified', label: 'Verified' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'skipped',  label: 'Skipped'  },
            { value: '',         label: 'All'      },
          ].map(opt => (
            <button key={opt.value} onClick={() => { setFilterStatus(opt.value); setSelected(null) }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: filterStatus === opt.value ? C.black : 'transparent', color: filterStatus === opt.value ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Success toast ── */}
      {successMsg && (
        <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>
          {successMsg}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '64px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>
            {filterStatus === 'pending' ? 'No pending KYB submissions' : 'No submissions found'}
          </p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
            {filterStatus === 'pending' ? 'All businesses are reviewed or have skipped KYB.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 20, alignItems: 'start' }}>

          {/* ── List column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(biz => {
              const days       = daysSince(biz.created_at)
              const isSelected = selected?.id === biz.id
              return (
                <button key={biz.id} onClick={() => { setSelected(biz); setKybAction(null); setRejectReason('') }}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: isSelected ? C.black : C.white,
                    border: `1px solid ${isSelected ? C.black : C.stroke}`,
                    borderRadius: 10, padding: '12px 14px',
                    cursor: 'pointer', transition: 'all 0.12s',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.accent }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = C.white }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                        <img src={biz.logo_url} alt={biz.name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, background: C.bg, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: isSelected ? C.labelBg : C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: isSelected ? C.black : '#F6F7EE', flexShrink: 0 }}>
                          {biz.name?.[0]}
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isSelected ? C.white : C.black, margin: '0 0 2px' }}>{biz.name}</p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.45)' : C.secondary, margin: 0 }}>{biz.sector}</p>
                      </div>
                    </div>
                    {kybBadge(biz.kyb_status)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.35)' : C.grayMid, textTransform: 'capitalize' }}>
                      {biz.registration_type?.replace(/_/g, ' ') || 'Not specified'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.35)' : C.grayMid }}>
                      {days === 0 ? 'Today' : `${days}d ago`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Detail column ── */}
          <div>
            {!selected ? (
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '64px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Select a business to review</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Business info */}
                <SectionCard title={selected.name}
                  rightSlot={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {kybBadge(selected.kyb_status)}
                      <button onClick={() => navigate(`/admin/businesses/${selected.id}`)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>
                        Full profile →
                      </button>
                    </div>
                  }
                >
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0', padding: '8px 18px 0', borderTop: `1px solid ${C.grayLine}` }}>
                    {selected.admin_email}
                  </p>
                  {[
                    { label: 'Sector',              value: selected.sector },
                    { label: 'Registration type',   value: selected.registration_type?.replace(/_/g, ' ') },
                    { label: 'Legal name',          value: selected.legal_name },
                    { label: 'Registration number', value: selected.registration_number },
                    { label: 'TIN',                 value: selected.tin },
                    { label: 'Submitted',           value: formatDate(selected.created_at) },
                    { label: 'Admin name',          value: selected.business_admins?.[0]?.full_name },
                    { label: 'Admin title',         value: selected.business_admins?.[0]?.job_title },
                  ].map((row, i, arr) => (
                    <InfoRow key={i} label={row.label} value={row.value} last={i === arr.length - 1} />
                  ))}
                </SectionCard>

                {/* Documents */}
                <SectionCard title="Uploaded documents"
                  rightSlot={<span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{kybDocs.length} file{kybDocs.length !== 1 ? 's' : ''}</span>}
                >
                  {loadingDocs ? (
                    <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                      <div className="spinner" />
                    </div>
                  ) : kybDocs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary }}>No documents uploaded</div>
                  ) : kybDocs.map((doc, i) => (
                    <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: i < kybDocs.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>
                          {doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}
                        </span>
                      </div>
                      <button onClick={() => openDoc(doc.name)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 12 }}>View →</button>
                    </div>
                  ))}
                </SectionCard>

                {/* Decision */}
                <SectionCard title="Decision">
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {selected.kyb_status === 'verified' && (
                      <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>
                        This business has already been verified.
                      </div>
                    )}

                    {selected.kyb_status === 'rejected' && (
                      <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                        This submission was previously rejected.
                      </div>
                    )}

                    {(selected.kyb_status === 'pending' || selected.kyb_status === 'skipped') && !kybAction && (
                      <>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setKybAction('approve')} style={{ ...btnSuccess, flex: 1, justifyContent: 'center' }}>Approve</button>
                          <button onClick={() => setKybAction('reject')}  style={{ ...btnDanger,  flex: 1, justifyContent: 'center' }}>Reject</button>
                        </div>
                        <button onClick={handleDefer} style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 600, color: C.secondary, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                          Defer — review later
                        </button>
                      </>
                    )}

                    {kybAction === 'approve' && (
                      <>
                        <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>
                          An approval email will be sent to <strong style={{ color: C.black }}>{selected.admin_email}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setKybAction(null)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                          <button onClick={handleAction} disabled={saving} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: saving ? 0.75 : 1 }}>
                            {saving ? <><div className="spinner spinner-sm spinner-light" /> Approving…</> : 'Confirm approval'}
                          </button>
                        </div>
                      </>
                    )}

                    {kybAction === 'reject' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>Rejection reason *</label>
                          <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Explain clearly why the submission is being rejected and what the business needs to resubmit…"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = C.black}
                            onBlur={e => e.target.style.borderColor = C.grayLine}
                          />
                        </div>
                        <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>
                          A rejection email with your reason will be sent to <strong style={{ color: C.black }}>{selected.admin_email}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => { setKybAction(null); setRejectReason('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                          <button onClick={handleAction} disabled={saving || !rejectReason.trim()} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: saving || !rejectReason.trim() ? 0.5 : 1 }}>
                            {saving ? <><div className="spinner spinner-sm spinner-light" /> Rejecting…</> : 'Confirm rejection'}
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                </SectionCard>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}