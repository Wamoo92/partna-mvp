import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG = {
  verified: { badge: 'badge-success', label: 'Verified'  },
  pending:  { badge: 'badge-warning', label: 'Pending'   },
  rejected: { badge: 'badge-danger',  label: 'Rejected'  },
  skipped:  { badge: 'badge-default', label: 'Skipped'   },
}

export default function KYBQueue() {
  const navigate = useNavigate()

  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [kybDocs, setKybDocs]       = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [filterStatus, setFilterStatus] = useState('pending')

  const [kybAction, setKybAction]     = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving]           = useState(false)
  const [successMsg, setSuccessMsg]   = useState('')

  useEffect(() => { loadBusinesses() }, [])
  useEffect(() => { if (selected) loadDocs(selected.id) }, [selected])

  async function loadBusinesses() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('businesses')
        .select('*, business_admins(full_name, job_title, email)')
        .in('kyb_status', ['pending', 'verified', 'rejected', 'skipped'])
        .order('created_at', { ascending: true })
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
      const newStatus   = kybAction === 'approve' ? 'verified' : 'rejected'
      const adminName   = selected.business_admins?.[0]?.full_name || 'there'
      const emailBody   = kybAction === 'approve'
        ? `Your KYB verification for <strong>${selected.name}</strong> has been approved. You now have full access to the Partna platform.`
        : `Your KYB verification for <strong>${selected.name}</strong> was not approved.<br><br><strong>Reason:</strong> ${rejectReason}<br><br>Please resubmit with the correct documents from your Settings page.`

      await supabase.from('businesses').update({ kyb_status: newStatus }).eq('id', selected.id)
      await sendAdminEmail({
        to: selected.admin_email,
        subject: kybAction === 'approve' ? `KYB Approved — ${selected.name} is verified` : `KYB Update — Action required for ${selected.name}`,
        html: `<p>Hi ${adminName},</p><p>${emailBody}</p><p>— The Partna Team</p>`,
      })

      setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, kyb_status: newStatus } : b))
      setSelected(prev => ({ ...prev, kyb_status: newStatus }))
      setSuccessMsg(kybAction === 'approve'
        ? `${selected.name} KYB approved. Email sent to ${selected.admin_email}.`
        : `${selected.name} KYB rejected. Email sent to ${selected.admin_email}.`)
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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', textTransform: 'uppercase', marginTop: 4 }}>
            {pendingCount} pending · {businesses.length} total submissions
          </p>
        </div>
        {/* Status filter */}
        <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
          {[
            { value: 'pending',  label: 'Pending'  },
            { value: 'verified', label: 'Verified' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'skipped',  label: 'Skipped'  },
            { value: '',         label: 'All'      },
          ].map((opt, i) => (
            <button key={opt.value} onClick={() => { setFilterStatus(opt.value); setSelected(null) }} style={{
              padding: '6px var(--space-4)',
              background: filterStatus === opt.value ? 'var(--color-black)' : 'var(--color-white)',
              color: filterStatus === opt.value ? 'var(--color-white)' : 'var(--color-grey)',
              border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Success toast ── */}
      {successMsg && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{successMsg}</div>
        </div>
      )}

      {/* ── Empty ── */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>verified_user</span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {filterStatus === 'pending' ? 'No pending KYB submissions' : 'No submissions found'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
            {filterStatus === 'pending' ? 'All businesses are reviewed or have skipped KYB.' : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 'var(--space-5)', alignItems: 'start' }}>

          {/* ── List column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map(biz => {
              const cfg        = STATUS_CONFIG[biz.kyb_status] || STATUS_CONFIG.skipped
              const days       = daysSince(biz.created_at)
              const isSelected = selected?.id === biz.id

              return (
                <button key={biz.id}
                  onClick={() => { setSelected(biz); setKybAction(null); setRejectReason('') }}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: isSelected ? 'var(--color-black)' : 'var(--color-white)',
                    border: isSelected ? '3px solid var(--color-primary)' : 'var(--border)',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    padding: 'var(--space-4)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                        <img src={biz.logo_url} alt={biz.name} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, background: 'var(--color-bg)', padding: 2 }} />
                      ) : (
                        <div style={{
                          width: 32, height: 32, flexShrink: 0,
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-black)',
                          border: '1.5px solid rgba(255,255,255,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)',
                          color: isSelected ? 'var(--color-black)' : 'var(--color-primary)',
                        }}>
                          {biz.name?.[0]}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: isSelected ? 'var(--color-white)' : 'var(--color-black)' }}>
                          {biz.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: isSelected ? 'rgba(255,255,255,0.5)' : 'var(--color-grey)', marginTop: 2 }}>
                          {biz.sector}
                        </div>
                      </div>
                    </div>
                    <span className={`badge no-dot ${cfg.badge}`} style={{ flexShrink: 0 }}>{cfg.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: isSelected ? 'rgba(255,255,255,0.4)' : 'var(--color-grey)', textTransform: 'capitalize' }}>
                      {biz.registration_type?.replace(/_/g, ' ') || 'Not specified'}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: isSelected ? 'rgba(255,255,255,0.4)' : 'var(--color-grey)' }}>
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
              <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
                <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>arrow_back</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>Select a business to review</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {/* Business info */}
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', color: 'var(--color-white)' }}>{selected.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{selected.admin_email}</div>
                    </div>
                    <button onClick={() => navigate(`/admin/businesses/${selected.id}`)} className="btn btn-sm btn-primary">
                      <span className="icon-outlined icon-xs">open_in_new</span>
                      Full profile
                    </button>
                  </div>
                  {[
                    { label: 'Sector',               value: selected.sector },
                    { label: 'Registration type',    value: selected.registration_type?.replace(/_/g, ' ') },
                    { label: 'Legal name',           value: selected.legal_name },
                    { label: 'Registration number',  value: selected.registration_number },
                    { label: 'TIN',                  value: selected.tin },
                    { label: 'Submitted',            value: formatDate(selected.created_at) },
                    { label: 'Admin name',           value: selected.business_admins?.[0]?.full_name },
                    { label: 'Admin title',          value: selected.business_admins?.[0]?.job_title },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-5)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', textTransform: 'capitalize' }}>{row.value || '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Documents */}
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-3) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>
                      Uploaded documents
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.4)' }}>
                      {kybDocs.length} file{kybDocs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {loadingDocs ? (
                    <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
                      <div className="spinner spinner-purple" />
                    </div>
                  ) : kybDocs.length === 0 ? (
                    <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      No documents uploaded
                    </div>
                  ) : (
                    kybDocs.map((doc, i) => (
                      <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', borderBottom: i < kybDocs.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-grey)' }}>description</span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                            {doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}
                          </span>
                        </div>
                        <button onClick={() => openDoc(doc.name)} className="btn btn-sm btn-secondary">
                          <span className="icon-outlined icon-xs">open_in_new</span>
                          View
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Decision */}
                <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-3) var(--space-5)' }}>
                    <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>Decision</span>
                  </div>
                  <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                    {selected.kyb_status === 'verified' && (
                      <div className="alert alert-success">
                        <span className="icon-outlined alert-icon">verified_user</span>
                        <div className="alert-content">This business has already been verified.</div>
                      </div>
                    )}

                    {selected.kyb_status === 'rejected' && (
                      <div className="alert alert-danger">
                        <span className="icon-outlined alert-icon">cancel</span>
                        <div className="alert-content">This submission was previously rejected.</div>
                      </div>
                    )}

                    {(selected.kyb_status === 'pending' || selected.kyb_status === 'skipped') && !kybAction && (
                      <>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                          <button onClick={() => setKybAction('approve')} className="btn btn-success" style={{ flex: 1 }}>
                            <span className="icon-outlined icon-sm">check</span>
                            Approve
                          </button>
                          <button onClick={() => setKybAction('reject')} className="btn btn-danger" style={{ flex: 1 }}>
                            <span className="icon-outlined icon-sm">cancel</span>
                            Reject
                          </button>
                        </div>
                        <button onClick={handleDefer} className="btn btn-ghost btn-full">
                          <span className="icon-outlined icon-sm">keyboard_arrow_down</span>
                          Defer — review later
                        </button>
                      </>
                    )}

                    {kybAction === 'approve' && (
                      <>
                        <div className="alert alert-success">
                          <span className="icon-outlined alert-icon">mail</span>
                          <div className="alert-content">An approval email will be sent to <strong>{selected.admin_email}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                          <button onClick={() => setKybAction(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                          <button onClick={handleAction} disabled={saving} className="btn btn-success" style={{ flex: 1 }}>
                            {saving
                              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Approving…</>
                              : <><span className="icon-outlined icon-sm">check</span> Confirm approval</>
                            }
                          </button>
                        </div>
                      </>
                    )}

                    {kybAction === 'reject' && (
                      <>
                        <div className="input-group">
                          <label className="input-label">Rejection reason <span className="required">*</span></label>
                          <textarea className="input" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Explain clearly why the submission is being rejected and what the business needs to resubmit…"
                            rows={3} />
                        </div>
                        <div className="alert alert-danger">
                          <span className="icon-outlined alert-icon">mail</span>
                          <div className="alert-content">A rejection email with your reason will be sent to <strong>{selected.admin_email}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                          <button onClick={() => { setKybAction(null); setRejectReason('') }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                          <button onClick={handleAction} disabled={saving || !rejectReason.trim()} className="btn btn-danger" style={{ flex: 1 }}>
                            {saving
                              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Rejecting…</>
                              : <><span className="icon-outlined icon-sm">cancel</span> Confirm rejection</>
                            }
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}