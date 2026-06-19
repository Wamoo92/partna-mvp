import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}
function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  labelBg:  '#E4E5DD',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  grayLight:'#ECECEC',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
  orange:   '#EF8354',
  bgOrange: '#F8F0E4',
  blue:     '#85A0C5',
}

function statusCfg(status) {
  if (status === 'completed') return { bg: C.bgGreen,  color: C.green,  label: 'Delivered'         }
  if (status === 'rejected')  return { bg: C.bgRed,    color: C.red,    label: 'Rejected'           }
  return                             { bg: C.bgOrange, color: C.orange, label: 'Pending delivery'   }
}

const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s', resize: 'none' }
const btnPrimary   = { padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnSuccess   = { ...btnPrimary, background: C.green, borderColor: C.green }
const btnDanger    = { ...btnPrimary, background: C.red,   borderColor: C.red   }

function Modal({ title, onClose, footer, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  )
}

function StatCard({ label, value, accentColor }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

export default function Sales({ admin, business }) {
  const isEducation = business?.sector === 'Education' || business?.sector === 'education'

  const [sales, setSales]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch]             = useState('')

  const [confirmComplete, setConfirmComplete] = useState(null)
  const [completingId, setCompletingId]       = useState(null)
  const [confirmReject, setConfirmReject]     = useState(null)
  const [rejectReason, setRejectReason]       = useState('')
  const [rejectingId, setRejectingId]         = useState(null)

  const [totalRevenue, setTotalRevenue]   = useState(0)
  const [pendingEscrow, setPendingEscrow] = useState(0)

  useEffect(() => { if (business) loadAll() }, [business])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      const { data: salesData } = await supabase.from('sales').select('*, customers(first_name, last_name, phone, email), campaigns(name, target_amount)').eq('business_id', business.id).order('created_at', { ascending: false })
      setSales(salesData || [])
      const completed = (salesData || []).filter(s => s.status === 'completed')
      const pending   = (salesData || []).filter(s => s.status === 'pending')
      setTotalRevenue(completed.reduce((sum, s) => sum + Number(s.amount), 0))
      setPendingEscrow(pending.reduce((sum, s) => sum + Number(s.amount), 0))
    } catch (e) { console.error('Sales load error:', e) }
    setLoading(false)
  }

  async function handleMarkComplete(sale) {
    setCompletingId(sale.id)
    try {
      await supabase.from('sales').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sale.id)
      const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) await supabase.from('escrow_wallets').update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) }).eq('id', escrow.id)
      const { data: bizWallet } = await supabase.from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (bizWallet) await supabase.from('business_wallets').update({ balance: Number(bizWallet.balance) + Number(sale.amount) }).eq('id', bizWallet.id)
      else await supabase.from('business_wallets').insert({ business_id: business.id, balance: Number(sale.amount) })
      await supabase.from('business_transactions').insert({ business_id: business.id, type: 'sale_completed', amount: sale.amount, status: 'completed', notes: `Sale completed — ${sale.customers?.first_name} ${sale.customers?.last_name} · ${sale.campaigns?.name}` })
      setConfirmComplete(null); await loadAll()
    } catch (e) { console.error('Mark complete error:', e) }
    setCompletingId(null)
  }

  async function handleReject(sale) {
    setRejectingId(sale.id)
    try {
      await supabase.from('sales').update({ status: 'rejected', notes: rejectReason || 'Rejected by business' }).eq('id', sale.id)
      const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) await supabase.from('escrow_wallets').update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) }).eq('id', escrow.id)
      const { data: custWallet } = await supabase.from('wallets').select('*').eq('customer_id', sale.customer_id).maybeSingle()
      if (custWallet) await supabase.from('wallets').update({ balance: Number(custWallet.balance) + Number(sale.amount) }).eq('id', custWallet.id)
      await supabase.from('transactions').insert({ customer_id: sale.customer_id, wallet_id: custWallet?.id, campaign_id: sale.campaign_id, type: 'withdrawal', amount: sale.amount, status: 'completed', notes: `Sale rejected — refund: ${rejectReason || 'Rejected by business'}` })
      setConfirmReject(null); setRejectReason(''); await loadAll()
    } catch (e) { console.error('Reject sale error:', e) }
    setRejectingId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const filtered = sales.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); const name = `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase(); if (!name.includes(q) && !s.customers?.phone?.includes(q)) return false }
    return true
  })
  const pendingCount = sales.filter(s => s.status === 'pending').length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Confirm delivery modal ── */}
      {confirmComplete && (
        <Modal title="Confirm delivery?" onClose={() => setConfirmComplete(null)}
          footer={<>
            <button onClick={() => setConfirmComplete(null)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={() => handleMarkComplete(confirmComplete)} disabled={completingId === confirmComplete.id} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: completingId === confirmComplete.id ? 0.75 : 1 }}>
              {completingId === confirmComplete.id ? <><div className="spinner spinner-sm spinner-light" /> Processing…</> : 'Confirm delivery'}
            </button>
          </>}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
            Marking this sale as delivered will release <strong style={{ color: C.green }}>{formatUGX(confirmComplete.amount)}</strong> from escrow into your business wallet. The customer will receive a delivery confirmation.
          </p>
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{confirmComplete.customers?.first_name} {confirmComplete.customers?.last_name}</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{confirmComplete.campaigns?.name}</p>
          </div>
        </Modal>
      )}

      {/* ── Confirm reject modal ── */}
      {confirmReject && (
        <Modal title="Reject this sale?" onClose={() => { setConfirmReject(null); setRejectReason('') }}
          footer={<>
            <button onClick={() => { setConfirmReject(null); setRejectReason('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={() => handleReject(confirmReject)} disabled={rejectingId === confirmReject.id} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: rejectingId === confirmReject.id ? 0.75 : 1 }}>
              {rejectingId === confirmReject.id ? <><div className="spinner spinner-sm spinner-light" /> Processing…</> : 'Confirm rejection'}
            </button>
          </>}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
            Rejecting will refund <strong style={{ color: C.red }}>{formatUGX(confirmReject.amount)}</strong> back to the customer's wallet. This cannot be undone.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>Reason <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
            <textarea style={inputStyle} rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Item out of stock"
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          </div>
        </Modal>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isEducation ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
        <StatCard label={isEducation ? 'Total fees received' : 'Total sales revenue'} value={formatUGX(totalRevenue)} accentColor={C.green} />
        {!isEducation && <StatCard label="In escrow (pending delivery)" value={formatUGX(pendingEscrow)} accentColor={C.orange} />}
        <StatCard label={isEducation ? 'Total payments' : 'Total orders'} value={sales.length} accentColor={C.blue} />
      </div>

      {/* ── Pending alert (retail only) ── */}
      {!isEducation && pendingCount > 0 && !filterStatus && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{pendingCount} order{pendingCount !== 1 ? 's' : ''} awaiting delivery confirmation</span>
          </div>
          <button onClick={() => setFilterStatus('pending')} style={{ ...btnDanger, padding: '6px 12px', fontSize: 12 }}>Show pending</button>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input style={{ ...inputStyle, paddingLeft: 30 }} type="text" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 16 }}>✕</button>}
        </div>
        {!isEducation && (
          <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
            {[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Delivered' }, { value: 'rejected', label: 'Rejected' }].map(opt => (
              <button key={opt.value} onClick={() => setFilterStatus(opt.value)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: filterStatus === opt.value ? C.black : 'transparent', color: filterStatus === opt.value ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {(search || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterStatus('') }} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {isEducation
                ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>
                : <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>
              }
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{isEducation ? 'No fee payments yet' : 'No sales yet'}</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>{isEducation ? 'Fee payments will appear here when customers pay.' : 'Sales will appear here when customers complete payment.'}</p>
        </div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                  {['Customer', isEducation ? 'Campaign' : 'Product', 'Amount', isEducation ? 'Date' : 'Order date', 'Status', ...(!isEducation ? ['Actions'] : [])].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale, i) => {
                  const cfg = statusCfg(sale.status)
                  return (
                    <tr key={sale.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: '12px 14px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{sale.customers?.first_name} {sale.customers?.last_name}</p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{sale.customers?.phone}</p>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{sale.campaigns?.name || '—'}</span>
                          {sale.is_prize && <span style={{ fontSize: 10, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 5, padding: '2px 6px' }}>Prize</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.green, whiteSpace: 'nowrap' }}>{formatUGX(sale.amount)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 2px', whiteSpace: 'nowrap' }}>{formatDateTime(sale.created_at)}</p>
                        {!isEducation && sale.completed_at && <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: 0, whiteSpace: 'nowrap' }}>Delivered: {formatDateTime(sale.completed_at)}</p>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {isEducation
                          ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.bgGreen, borderRadius: 6, padding: '3px 8px' }}>Received</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px' }}>{cfg.label}</span>
                        }
                      </td>
                      {!isEducation && (
                        <td style={{ padding: '12px 14px' }}>
                          {sale.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setConfirmComplete(sale)} style={{ ...btnSuccess, padding: '5px 10px', fontSize: 12 }}>✓ Delivered</button>
                              <button onClick={() => setConfirmReject(sale)}   style={{ ...btnDanger,  padding: '5px 10px', fontSize: 12 }}>✕ Reject</button>
                            </div>
                          ) : sale.status === 'rejected' && sale.notes ? (
                            <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary, fontStyle: 'italic' }}>{sale.notes}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: C.grayMid }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}