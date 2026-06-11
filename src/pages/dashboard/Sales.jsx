import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

const STATUS_STYLES = {
  pending:   { bg: 'rgba(217,119,6,0.1)',   color: '#D97706',  label: '⏳ Pending delivery' },
  completed: { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A',  label: '✓ Delivered' },
  rejected:  { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626',  label: '✕ Rejected' },
}

export default function Sales({ admin, business }) {
  const isEducation = business?.sector === 'Education' || business?.sector === 'education'

  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  // Confirm complete modal
  const [confirmComplete, setConfirmComplete] = useState(null)
  const [completingId, setCompletingId] = useState(null)

  // Confirm reject modal
  const [confirmReject, setConfirmReject] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)

  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [pendingEscrow, setPendingEscrow] = useState(0)

  useEffect(() => {
    if (business) loadAll()
  }, [business])

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
      const pending = (salesData || []).filter(s => s.status === 'pending')
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
      // Update sale status
      await supabase.from('sales')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', sale.id)

      // Move funds from escrow to business wallet
      const { data: escrow } = await supabase
        .from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) {
        await supabase.from('escrow_wallets')
          .update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) })
          .eq('id', escrow.id)
      }

      const { data: bizWallet } = await supabase
        .from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (bizWallet) {
        await supabase.from('business_wallets')
          .update({ balance: Number(bizWallet.balance) + Number(sale.amount) })
          .eq('id', bizWallet.id)
      } else {
        await supabase.from('business_wallets').insert({
          business_id: business.id,
          balance: Number(sale.amount),
        })
      }

      // Record business transaction
      await supabase.from('business_transactions').insert({
        business_id: business.id,
        type: 'sale_completed',
        amount: sale.amount,
        status: 'completed',
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
      // Update sale status
      await supabase.from('sales')
        .update({ status: 'rejected', notes: rejectReason || 'Rejected by business' })
        .eq('id', sale.id)

      // Release from escrow
      const { data: escrow } = await supabase
        .from('escrow_wallets').select('*').eq('business_id', business.id).maybeSingle()
      if (escrow) {
        await supabase.from('escrow_wallets')
          .update({ balance: Math.max(0, Number(escrow.balance) - Number(sale.amount)) })
          .eq('id', escrow.id)
      }

      // Refund to customer wallet
      const { data: custWallet } = await supabase
        .from('wallets').select('*').eq('customer_id', sale.customer_id).maybeSingle()
      if (custWallet) {
        await supabase.from('wallets')
          .update({ balance: Number(custWallet.balance) + Number(sale.amount) })
          .eq('id', custWallet.id)
      }

      // Record refund transaction
      await supabase.from('transactions').insert({
        customer_id: sale.customer_id,
        wallet_id: custWallet?.id,
        campaign_id: sale.campaign_id,
        type: 'withdrawal',
        amount: sale.amount,
        status: 'completed',
        notes: `Sale rejected — refund: ${rejectReason || 'Rejected by business'}`,
      })

      setConfirmReject(null)
      setRejectReason('')
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
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Confirm complete modal */}
      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: '#fff' }}>
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>
              Confirm delivery?
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Marking this sale as delivered will release{' '}
              <span className="font-bold" style={{ color: '#16A34A' }}>
                {formatUGX(confirmComplete.amount)}
              </span>{' '}
              from escrow into your business wallet.
              The customer will receive a delivery confirmation receipt.
            </div>
            <div className="px-3 py-2 rounded-xl text-xs"
              style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
              <div className="font-semibold">{confirmComplete.customers?.first_name} {confirmComplete.customers?.last_name}</div>
              <div style={{ color: 'rgba(0,0,0,0.4)' }}>{confirmComplete.campaigns?.name}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmComplete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                Cancel
              </button>
              <button onClick={() => handleMarkComplete(confirmComplete)}
                disabled={completingId === confirmComplete.id}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#16A34A', color: '#fff' }}>
                {completingId === confirmComplete.id ? 'Processing...' : '✓ Confirm delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm reject modal */}
      {confirmReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: '#fff' }}>
            <div className="text-sm font-bold" style={{ color: '#DC2626' }}>
              Reject this sale?
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Rejecting will refund{' '}
              <span className="font-bold" style={{ color: '#DC2626' }}>
                {formatUGX(confirmReject.amount)}
              </span>{' '}
              back to the customer's wallet.
              This cannot be undone.
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Item out of stock"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
                style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmReject(null); setRejectReason('') }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                Cancel
              </button>
              <button onClick={() => handleReject(confirmReject)}
                disabled={rejectingId === confirmReject.id}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#DC2626', color: '#fff' }}>
                {rejectingId === confirmReject.id ? 'Processing...' : '✕ Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="text-lg font-bold" style={{ color: PARTNA_PRIMARY }}>
          {isEducation ? 'Fee Payments' : 'Sales'}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {isEducation
            ? 'All fee payments received from customers'
            : 'Manage customer orders and delivery confirmations'}
        </div>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 ${isEducation ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {isEducation ? 'Total fees received' : 'Total sales revenue'}
          </div>
          <div className="text-2xl font-bold" style={{ color: '#16A34A' }}>
            {formatUGX(totalRevenue)}
          </div>
        </div>
        {!isEducation && (
          <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
            <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>In escrow (pending delivery)</div>
            <div className="text-2xl font-bold" style={{ color: '#D97706' }}>
              {formatUGX(pendingEscrow)}
            </div>
          </div>
        )}
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="text-xs mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {isEducation ? 'Total payments' : 'Total orders'}
          </div>
          <div className="text-2xl font-bold" style={{ color: PARTNA_PRIMARY }}>
            {sales.length}
          </div>
        </div>
      </div>

      {/* Pending alert — retail only */}
      {!isEducation && pendingCount > 0 && !filterStatus && (
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div className="text-xs font-semibold" style={{ color: '#92400e' }}>
            ⏳ {pendingCount} order{pendingCount !== 1 ? 's' : ''} awaiting delivery confirmation
          </div>
          <button onClick={() => setFilterStatus('pending')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#D97706', color: '#fff' }}>
            Show pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
        />
        {!isEducation && (
          <>
            {['', 'pending', 'completed', 'rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="text-xs font-semibold px-3 py-2.5 rounded-xl"
                style={{
                  background: filterStatus === s ? PARTNA_PRIMARY : '#fff',
                  color: filterStatus === s ? '#fff' : 'rgba(0,0,0,0.5)',
                  border: filterStatus === s ? 'none' : '1.5px solid rgba(0,0,0,0.1)',
                }}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </>
        )}
        {(search || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterStatus('') }}
            className="text-xs font-semibold px-3 py-2.5 rounded-xl"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-3">{isEducation ? '🧾' : '🛒'}</div>
            <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
              {isEducation ? 'No fee payments yet' : 'No sales yet'}
            </div>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {isEducation
                ? 'Fee payments will appear here when customers pay'
                : 'Sales will appear here when customers complete payment'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
                  {[
                    'Customer',
                    isEducation ? 'Campaign' : 'Product',
                    'Amount',
                    isEducation ? 'Date' : 'Order date',
                    'Status',
                    ...(!isEducation ? ['Actions'] : []),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale, i) => {
                  const statusStyle = STATUS_STYLES[sale.status] || STATUS_STYLES.pending
                  return (
                    <tr key={sale.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold" style={{ color: PARTNA_PRIMARY }}>
                          {sale.customers?.first_name} {sale.customers?.last_name}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {sale.customers?.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#333' }}>
                          {sale.campaigns?.name || '—'}
                        </span>
                        {sale.is_prize && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(212,175,55,0.15)', color: '#92400e' }}>
                            🏆 Prize
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold" style={{ color: '#16A34A' }}>
                          {formatUGX(sale.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {formatDateTime(sale.created_at)}
                        </span>
                        {!isEducation && sale.completed_at && (
                          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.3)', fontSize: '10px' }}>
                            Delivered: {formatDateTime(sale.completed_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {isEducation ? '✓ Received' : statusStyle.label}
                        </span>
                      </td>
                      {!isEducation && (
                        <td className="px-4 py-3">
                          {sale.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setConfirmComplete(sale)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                                ✓ Delivered
                              </button>
                              <button
                                onClick={() => setConfirmReject(sale)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                                style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                                ✕ Reject
                              </button>
                            </div>
                          )}
                          {sale.status === 'completed' && (
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>—</span>
                          )}
                          {sale.status === 'rejected' && sale.notes && (
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
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
    </div>
  )
}