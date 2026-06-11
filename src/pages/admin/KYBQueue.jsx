import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const KYB_COLORS = {
  verified: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Verified' },
  pending: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Rejected' },
  skipped: { bg: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)', label: 'Skipped' },
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function sendAdminEmail({ to, subject, html }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ to, subject, html }),
  })
}

export default function KYBQueue() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [kybDocs, setKybDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [filterStatus, setFilterStatus] = useState('pending')

  const [kybAction, setKybAction] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

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
    } catch (e) {
      console.error('KYB queue load error:', e)
    }
    setLoading(false)
  }

  async function loadDocs(bizId) {
    setLoadingDocs(true)
    setKybDocs([])
    try {
      const { data } = await supabase.storage.from('kyb-documents').list(bizId)
      setKybDocs(data || [])
    } catch (e) {
      console.error('KYB docs load error:', e)
    }
    setLoadingDocs(false)
  }

  async function openDoc(filename) {
    const { data } = await supabase.storage
      .from('kyb-documents')
      .createSignedUrl(`${selected.id}/${filename}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleAction() {
    if (!kybAction || !selected) return
    if (kybAction === 'reject' && !rejectReason.trim()) return
    setSaving(true)
    try {
      const newStatus = kybAction === 'approve' ? 'verified' : 'rejected'
      await supabase.from('businesses').update({ kyb_status: newStatus }).eq('id', selected.id)

      // Send via Edge Function — no API key in browser
      const adminEmail = selected.admin_email
      const adminName = selected.business_admins?.[0]?.full_name || 'there'
      const emailBody = kybAction === 'approve'
        ? `Your KYB verification for <strong>${selected.name}</strong> has been approved. You now have full access to the Partna platform.`
        : `Your KYB verification for <strong>${selected.name}</strong> was not approved.<br><br><strong>Reason:</strong> ${rejectReason}<br><br>Please resubmit with the correct documents from your Settings page.`

      await sendAdminEmail({
        to: adminEmail,
        subject: kybAction === 'approve'
          ? `KYB Approved — ${selected.name} is verified`
          : `KYB Update — Action required for ${selected.name}`,
        html: `<p>Hi ${adminName},</p><p>${emailBody}</p><p>— The Partna Team</p>`,
      })

      setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, kyb_status: newStatus } : b))
      setSelected(prev => ({ ...prev, kyb_status: newStatus }))
      setSuccessMsg(kybAction === 'approve'
        ? `✓ ${selected.name} KYB approved. Email sent to ${adminEmail}.`
        : `✓ ${selected.name} KYB rejected. Email sent to ${adminEmail}.`
      )
      setKybAction(null)
      setRejectReason('')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (e) {
      console.error('KYB action error:', e)
    }
    setSaving(false)
  }

  async function handleDefer() {
    setBusinesses(prev => {
      const idx = prev.findIndex(b => b.id === selected.id)
      if (idx === -1) return prev
      const updated = [...prev]
      const [item] = updated.splice(idx, 1)
      updated.push(item)
      return updated
    })
    setSelected(null)
  }

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function daysSince(d) {
    if (!d) return 0
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  }

  const filtered = businesses.filter(b => !filterStatus || b.kyb_status === filterStatus)
  const pendingCount = businesses.filter(b => b.kyb_status === 'pending').length

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>KYB Review Queue</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {pendingCount} pending · {businesses.length} total submissions
          </div>
        </div>
        <div className="flex gap-2">
          {['pending', 'verified', 'rejected', 'skipped', ''].map((s, i) => (
            <button key={i} onClick={() => { setFilterStatus(s); setSelected(null) }}
              className="text-xs font-semibold px-3 py-2 rounded-xl"
              style={{
                background: filterStatus === s ? ADMIN_PRIMARY : '#fff',
                color: filterStatus === s ? '#fff' : 'rgba(0,0,0,0.5)',
                border: filterStatus === s ? 'none' : '1.5px solid rgba(0,0,0,0.1)',
              }}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
          {successMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
          <div className="text-3xl mb-3">📋</div>
          <div className="text-sm font-bold mb-1" style={{ color: ADMIN_PRIMARY }}>
            {filterStatus === 'pending' ? 'No pending KYB submissions' : 'No submissions found'}
          </div>
          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {filterStatus === 'pending' ? 'All businesses are reviewed or have skipped KYB.' : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-5" style={{ alignItems: 'start' }}>

          <div className="col-span-2 flex flex-col gap-2">
            {filtered.map(biz => {
              const kyb = KYB_COLORS[biz.kyb_status] || KYB_COLORS.skipped
              const days = daysSince(biz.created_at)
              const isSelected = selected?.id === biz.id
              return (
                <button key={biz.id}
                  onClick={() => { setSelected(biz); setKybAction(null); setRejectReason('') }}
                  className="w-full text-left rounded-2xl p-4 flex flex-col gap-2 transition-all"
                  style={{
                    background: isSelected ? ADMIN_PRIMARY : '#fff',
                    border: isSelected ? 'none' : '1.5px solid rgba(0,0,0,0.06)',
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {biz.logo_url && !biz.logo_url.startsWith('/') ? (
                        <img src={biz.logo_url} alt={biz.name}
                          className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                          style={{ background: '#f0f2f5' }} />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: isSelected ? 'rgba(255,255,255,0.2)' : (biz.primary_color || ADMIN_PRIMARY),
                            color: '#fff',
                          }}>
                          {biz.name?.[0]}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold"
                          style={{ color: isSelected ? '#fff' : ADMIN_PRIMARY }}>
                          {biz.name}
                        </div>
                        <div className="text-xs"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>
                          {biz.sector}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: kyb.bg, color: kyb.color }}>
                      {kyb.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)' }}>
                      {biz.registration_type?.replace(/_/g, ' ') || 'Not specified'}
                    </span>
                    <span className="text-xs"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)' }}>
                      {days === 0 ? 'Today' : `${days}d ago`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="col-span-3">
            {!selected ? (
              <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
                <div className="text-3xl mb-3">👈</div>
                <div className="text-sm font-semibold" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Select a business to review
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">

                <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-base font-bold mb-1" style={{ color: ADMIN_PRIMARY }}>
                        {selected.name}
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{selected.admin_email}</div>
                    </div>
                    <button onClick={() => navigate(`/admin/businesses/${selected.id}`)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                      Full profile →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {[
                      { label: 'Sector', value: selected.sector },
                      { label: 'Registration type', value: selected.registration_type?.replace(/_/g, ' ') },
                      { label: 'Legal name', value: selected.legal_name },
                      { label: 'Registration number', value: selected.registration_number },
                      { label: 'TIN', value: selected.tin },
                      { label: 'Submitted', value: formatDate(selected.created_at) },
                      { label: 'Admin name', value: selected.business_admins?.[0]?.full_name },
                      { label: 'Admin title', value: selected.business_admins?.[0]?.job_title },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-1.5"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                        <span className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                          {row.value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold uppercase tracking-wide mb-3"
                    style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Uploaded Documents ({kybDocs.length})
                  </div>
                  {loadingDocs ? (
                    <div className="text-xs py-2" style={{ color: 'rgba(0,0,0,0.3)' }}>Loading documents...</div>
                  ) : kybDocs.length === 0 ? (
                    <div className="text-xs py-2" style={{ color: 'rgba(0,0,0,0.3)' }}>No documents uploaded</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {kybDocs.map(doc => (
                        <div key={doc.name} className="flex items-center justify-between py-2"
                          style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                          <div className="flex items-center gap-2">
                            <span>📄</span>
                            <span className="text-xs" style={{ color: '#333' }}>
                              {doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}
                            </span>
                          </div>
                          <button onClick={() => openDoc(doc.name)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
                  <div className="text-xs font-bold uppercase tracking-wide mb-4"
                    style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Decision
                  </div>

                  {selected.kyb_status === 'verified' && (
                    <div className="text-xs px-3 py-2.5 rounded-xl font-semibold"
                      style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                      ✓ This business has already been verified
                    </div>
                  )}

                  {selected.kyb_status === 'rejected' && (
                    <div className="text-xs px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                      ✕ This submission was previously rejected
                    </div>
                  )}

                  {(selected.kyb_status === 'pending' || selected.kyb_status === 'skipped') && !kybAction && (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <button onClick={() => setKybAction('approve')}
                          className="flex-1 py-3 rounded-xl text-sm font-bold"
                          style={{ background: '#16A34A', color: '#fff' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => setKybAction('reject')}
                          className="flex-1 py-3 rounded-xl text-sm font-bold"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                          ✕ Reject
                        </button>
                      </div>
                      <button onClick={handleDefer}
                        className="w-full py-2.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }}>
                        ↓ Defer — review later
                      </button>
                    </div>
                  )}

                  {kybAction === 'approve' && (
                    <div className="flex flex-col gap-3">
                      <div className="text-xs px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#16A34A' }}>
                        An approval email will be sent to <strong>{selected.admin_email}</strong>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setKybAction(null)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                          Cancel
                        </button>
                        <button onClick={handleAction} disabled={saving}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: '#16A34A', color: '#fff', opacity: saving ? 0.5 : 1 }}>
                          {saving ? 'Approving...' : 'Confirm approval'}
                        </button>
                      </div>
                    </div>
                  )}

                  {kybAction === 'reject' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                          Rejection reason *
                        </label>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                          placeholder="Explain clearly why the submission is being rejected and what the business needs to resubmit..."
                          rows={3} className="w-full px-4 py-3 rounded-xl text-xs outline-none resize-none"
                          style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                      </div>
                      <div className="text-xs px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#DC2626' }}>
                        A rejection email with your reason will be sent to <strong>{selected.admin_email}</strong>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => { setKybAction(null); setRejectReason('') }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                          Cancel
                        </button>
                        <button onClick={handleAction} disabled={saving || !rejectReason.trim()}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                          style={{
                            background: '#DC2626', color: '#fff',
                            opacity: (saving || !rejectReason.trim()) ? 0.5 : 1,
                          }}>
                          {saving ? 'Rejecting...' : 'Confirm rejection'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}