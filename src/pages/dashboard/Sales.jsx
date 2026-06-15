import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

const STATUS_CONFIG = {
  pending:   { badge: 'badge-warning', icon: 'schedule',      label: 'Pending delivery' },
  completed: { badge: 'badge-success', icon: 'check_circle',  label: 'Delivered'        },
  rejected:  { badge: 'badge-danger',  icon: 'cancel',        label: 'Rejected'         },
}

export default function Sales({ admin, business }) {
  const isEducation = business?.sector === 'Education' || business?.sector === 'education'

  const [sales, setSales]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch]         = useState('')

  const [confirmComplete, setConfirmComplete] = useState(null)
  const [completingId, setCompletingId]       = useState(null)
  const [confirmReject, setConfirmReject]     = useState(null)
  const [rejectReason, setRejectReason]       = useState('')
  const [rejectingId, setRejectingId]         = useState(null)

  const [totalRevenue, setTotalRevenue] = useState(0)
  const [pendingEscrow, setPendingEscrow] = useState(0)

  useEffect(() => { if (business) loadAll() }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, customers(first_name, last_name, phone, email), campaigns(name, target_amount)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      setSales(salesData || [])
      const completed = (salesData || []).filter(s => s.status === 'completed')
      const pending   = (salesData || []).filter(s => s.status === 'pending')
      setTotalRevenue(completed.reduce((sum, s) => sum + Number(s.amount), 0))
      setPendingEscrow(pending.reduce((sum, s) => sum + Number(s.amount), 0))
    } catch (e) {
      console.error('Sales load error:', e)
    }
    setLoading(false)
  }

  async function handleMarkComplete(sale) {
    setCompletingId(sale.id)
    try {
      await supabase.from('sales')
        .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sale.id)

      const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) {
        await supabase.from('escrow_wallets')
          .update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) }).eq('id', escrow.id)
      }

      const { data: bizWallet } = await supabase.from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (bizWallet) {
        await supabase.from('business_wallets')
          .update({ balance: Number(bizWallet.balance) + Number(sale.amount) }).eq('id', bizWallet.id)
      } else {
        await supabase.from('business_wallets').insert({ business_id: business.id, balance: Number(sale.amount) })
      }

      await supabase.from('business_transactions').insert({
        business_id: business.id, type: 'sale_completed', amount: sale.amount, status: 'completed',
        notes: `Sale completed — ${sale.customers?.first_name} ${sale.customers?.last_name} · ${sale.campaigns?.name}`,
      })

      setConfirmComplete(null)
      await loadAll()
    } catch (e) {
      console.error('Mark complete error:', e)
    }
    setCompletingId(null)
  }

  async function handleReject(sale) {
    setRejectingId(sale.id)
    try {
      await supabase.from('sales')
        .update({ status: 'rejected', notes: rejectReason || 'Rejected by business' }).eq('id', sale.id)

      const { data: escrow } = await supabase.from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) {
        await supabase.from('escrow_wallets')
          .update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) }).eq('id', escrow.id)
      }

      const { data: custWallet } = await supabase.from('wallets').select('*').eq('customer_id', sale.customer_id).maybeSingle()
      if (custWallet) {
        await supabase.from('wallets')
          .update({ balance: Number(custWallet.balance) + Number(sale.amount) }).eq('id', custWallet.id)
      }

      await supabase.from('transactions').insert({
        customer_id: sale.customer_id, wallet_id: custWallet?.id, campaign_id: sale.campaign_id,
        type: 'withdrawal', amount: sale.amount, status: 'completed',
        notes: `Sale rejected — refund: ${rejectReason || 'Rejected by business'}`,
      })

      setConfirmReject(null); setRejectReason('')
      await loadAll()
    } catch (e) {
      console.error('Reject sale error:', e)
    }
    setRejectingId(null)
  }

  const filtered = sales.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const name = `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase()
      if (!name.includes(q) && !s.customers?.phone?.includes(q)) return false
    }
    return true
  })

  const pendingCount = sales.filter(s => s.status === 'pending').length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Confirm delivery modal ── */}
      {confirmComplete && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#2D8B45' }}>
              <span className="modal-title">Confirm delivery?</span>
              <button onClick={() => setConfirmComplete(null)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Marking this sale as delivered will release{' '}
                <strong style={{ color: '#2D8B45' }}>{formatUGX(confirmComplete.amount)}</strong>{' '}
                from escrow into your business wallet. The customer will receive a delivery confirmation.
              </p>
              <div style={{ background: 'var(--color-bg)', border: 'var(--border)', padding: 'var(--space-3) var(--space-4)' }}>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                  {confirmComplete.customers?.first_name} {confirmComplete.customers?.last_name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                  {confirmComplete.campaigns?.name}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmComplete(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => handleMarkComplete(confirmComplete)}
                disabled={completingId === confirmComplete.id}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                {completingId === confirmComplete.id
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                  : <><span className="icon-outlined icon-sm">check</span> Confirm delivery</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm reject modal ── */}
      {confirmReject && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#C0392B' }}>
              <span className="modal-title">Reject this sale?</span>
              <button onClick={() => { setConfirmReject(null); setRejectReason('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Rejecting will refund{' '}
                <strong style={{ color: '#C0392B' }}>{formatUGX(confirmReject.amount)}</strong>{' '}
                back to the customer's wallet. This cannot be undone.
              </p>
              <div className="input-group">
                <label className="input-label">
                  Reason{' '}
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  className="input"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Item out of stock"
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setConfirmReject(null); setRejectReason('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmReject)}
                disabled={rejectingId === confirmReject.id}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                {rejectingId === confirmReject.id
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                  : <><span className="icon-outlined icon-sm">cancel</span> Confirm rejection</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isEducation ? '1fr 1fr' : '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ height: 3, background: 'var(--color-green)', marginBottom: 'var(--space-3)' }} />
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
            {isEducation ? 'Total fees received' : 'Total sales revenue'}
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30", lineHeight: 1 }}>
            {formatUGX(totalRevenue)}
          </div>
        </div>

        {!isEducation && (
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
            <div style={{ height: 3, background: 'var(--color-yellow)', marginBottom: 'var(--space-3)' }} />
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
              In escrow (pending delivery)
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30", lineHeight: 1 }}>
              {formatUGX(pendingEscrow)}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)' }}>
          <div style={{ height: 3, background: 'var(--color-primary)', marginBottom: 'var(--space-3)' }} />
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
            {isEducation ? 'Total payments' : 'Total orders'}
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 105, 'opsz' 30", lineHeight: 1 }}>
            {sales.length}
          </div>
        </div>
      </div>

      {/* ── Pending alert (retail only) ── */}
      {!isEducation && pendingCount > 0 && !filterStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--color-yellow)',
          border: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0 }}>schedule</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
              {pendingCount} order{pendingCount !== 1 ? 's' : ''} awaiting delivery confirmation
            </span>
          </div>
          <button onClick={() => setFilterStatus('pending')} className="btn btn-sm btn-black">
            Show pending
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <span className="icon-outlined search-icon">search</span>
          <input
            type="text"
            className="input search-input"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <span className="icon-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>

        {!isEducation && (
          <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
            {[
              { value: '',          label: 'All'       },
              { value: 'pending',   label: 'Pending'   },
              { value: 'completed', label: 'Delivered' },
              { value: 'rejected',  label: 'Rejected'  },
            ].map((opt, i) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                style={{
                  padding: '6px var(--space-4)',
                  background: filterStatus === opt.value ? 'var(--color-black)' : 'var(--color-white)',
                  color: filterStatus === opt.value ? 'var(--color-white)' : 'var(--color-grey)',
                  border: 'none',
                  borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                  letterSpacing: 'var(--tracking-wide)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {(search || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterStatus('') }} className="btn btn-sm btn-danger">
            <span className="icon-outlined icon-xs">close</span>
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
            {isEducation ? 'receipt_long' : 'shopping_cart'}
          </span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {isEducation ? 'No fee payments yet' : 'No sales yet'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
            {isEducation
              ? 'Fee payments will appear here when customers pay.'
              : 'Sales will appear here when customers complete payment.'}
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>{isEducation ? 'Campaign' : 'Product'}</th>
                <th>Amount</th>
                <th>{isEducation ? 'Date' : 'Order date'}</th>
                <th>Status</th>
                {!isEducation && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => {
                const cfg = STATUS_CONFIG[sale.status] || STATUS_CONFIG.pending
                return (
                  <tr key={sale.id}>
                    {/* Customer */}
                    <td>
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                        {sale.customers?.first_name} {sale.customers?.last_name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                        {sale.customers?.phone}
                      </div>
                    </td>

                    {/* Campaign / Product */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                          {sale.campaigns?.name || '—'}
                        </span>
                        {sale.is_prize && (
                          <span className="badge badge-warning no-dot" style={{ fontSize: 10 }}>
                            Prize
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td>
                      <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                        {formatUGX(sale.amount)}
                      </span>
                    </td>

                    {/* Date */}
                    <td>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                        {formatDateTime(sale.created_at)}
                      </div>
                      {!isEducation && sale.completed_at && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey-mid)', marginTop: 2 }}>
                          Delivered: {formatDateTime(sale.completed_at)}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      {isEducation ? (
                        <span className="badge badge-success no-dot">Received</span>
                      ) : (
                        <span className={`badge ${cfg.badge} no-dot`}>{cfg.label}</span>
                      )}
                    </td>

                    {/* Actions (retail only) */}
                    {!isEducation && (
                      <td>
                        {sale.status === 'pending' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <button onClick={() => setConfirmComplete(sale)} className="btn btn-sm btn-success">
                              <span className="icon-outlined icon-xs">check</span>
                              Delivered
                            </button>
                            <button onClick={() => setConfirmReject(sale)} className="btn btn-sm btn-danger">
                              <span className="icon-outlined icon-xs">cancel</span>
                              Reject
                            </button>
                          </div>
                        )}
                        {sale.status === 'completed' && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey-mid)' }}>—</span>
                        )}
                        {sale.status === 'rejected' && sale.notes && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>
                            {sale.notes}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}