import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function txAccent(type) {
  if (type === 'deposit')    return 'var(--color-green)'
  if (type === 'withdrawal') return 'var(--color-red)'
  return 'var(--color-yellow)'
}
function txAmountColor(type) { return type === 'deposit' ? '#2D8B45' : '#C0392B' }

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

function InfoRow({ label, value, last, green, red, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: last ? 'none' : '1.5px solid var(--color-grey-light)' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: mono ? 'monospace' : 'inherit', color: green ? '#2D8B45' : red ? '#C0392B' : 'var(--color-black)' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [customer, setCustomer]       = useState(null)
  const [business, setBusiness]       = useState(null)
  const [campaign, setCampaign]       = useState(null)
  const [wallet, setWallet]           = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('profile')

  const [savingKYC, setSavingKYC]     = useState(false)
  const [kycSuccess, setKycSuccess]   = useState('')
  const [savingFlag, setSavingFlag]   = useState(false)
  const [flagSuccess, setFlagSuccess] = useState('')

  const [refundAmount, setRefundAmount]   = useState('')
  const [refundConfirm, setRefundConfirm] = useState('')
  const [savingRefund, setSavingRefund]   = useState(false)
  const [refundSuccess, setRefundSuccess] = useState('')
  const [refundError, setRefundError]     = useState('')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
      if (!custData) { setLoading(false); return }
      setCustomer(custData)

      if (custData.business_id) {
        const { data: bizData } = await supabase.from('businesses').select('*').eq('id', custData.business_id).maybeSingle()
        setBusiness(bizData)
      }

      if (custData.campaign_id) {
        const { data: campData } = await supabase.from('campaigns').select('*').eq('id', custData.campaign_id).maybeSingle()
        setCampaign(campData)
      }

      const { data: walletData } = await supabase.from('wallets').select('*').eq('customer_id', id).maybeSingle()
      setWallet(walletData)

      const { data: txnData } = await supabase.from('transactions').select('*').eq('customer_id', id).order('created_at', { ascending: false })
      setTransactions(txnData || [])
    } catch (e) { console.error('CustomerDetail load error:', e) }
    setLoading(false)
  }

  async function handleVerifyKYC() {
    setSavingKYC(true)
    try {
      await supabase.from('customers').update({ kyc_status: 'verified' }).eq('id', id)
      setCustomer(prev => ({ ...prev, kyc_status: 'verified' }))
      setKycSuccess('KYC manually verified successfully.')
      setTimeout(() => setKycSuccess(''), 3000)
    } catch (e) { console.error('KYC verify error:', e) }
    setSavingKYC(false)
  }

  async function handleToggleFlag() {
    setSavingFlag(true)
    try {
      const newFlag = !customer.is_flagged
      await supabase.from('customers').update({ is_flagged: newFlag }).eq('id', id)
      setCustomer(prev => ({ ...prev, is_flagged: newFlag }))
      setFlagSuccess(newFlag ? 'Account flagged.' : 'Flag removed.')
      setTimeout(() => setFlagSuccess(''), 3000)
    } catch (e) { console.error('Flag error:', e) }
    setSavingFlag(false)
  }

  async function handleRefund() {
    setRefundError('')
    const amount = Number(refundAmount)
    const customerName = `${customer.first_name} ${customer.last_name}`
    if (!amount || amount <= 0) { setRefundError('Please enter a valid refund amount.'); return }
    if (refundConfirm !== customerName) { setRefundError(`Please type the customer's full name exactly: "${customerName}"`); return }
    setSavingRefund(true)
    try {
      const reference = 'TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      await supabase.from('transactions').insert({ customer_id: id, wallet_id: wallet?.id, campaign_id: customer.campaign_id, type: 'withdrawal', amount, status: 'pending', reference, notes: 'Manual refund by Partna admin' })
      setRefundSuccess(`Refund of ${formatUGX(amount)} initiated. Reference: ${reference}`)
      setRefundAmount(''); setRefundConfirm('')
      const { data: txnData } = await supabase.from('transactions').select('*').eq('customer_id', id).order('created_at', { ascending: false })
      setTransactions(txnData || [])
    } catch (e) { console.error('Refund error:', e); setRefundError('Something went wrong. Please try again.') }
    setSavingRefund(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  if (!customer) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-20)', gap: 'var(--space-4)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>Customer not found</span>
      <button onClick={() => navigate('/admin/customers')} className="btn btn-primary">
        <span className="icon-outlined icon-sm">arrow_back</span>
        Back to customers
      </button>
    </div>
  )

  const balance = Number(wallet?.balance || 0)
  const target  = Number(campaign?.target_amount || 0)
  const pct     = target > 0 ? Math.min((balance / target) * 100, 100) : 0
  const TABS    = ['profile', 'transactions', 'actions']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button onClick={() => navigate('/admin/customers')} className="btn btn-secondary btn-sm">
          <span className="icon-outlined icon-xs">arrow_back</span>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            background: 'var(--color-black)',
            border: '2px solid var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)',
            color: 'var(--color-primary)',
          }}>
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div>
            <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xl)', letterSpacing: 'var(--tracking-tight)', fontVariationSettings: "'wdth' 100, 'opsz' 24" }}>
              {customer.first_name} {customer.last_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{customer.phone}</span>
              <span className={`badge no-dot ${customer.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                KYC: {customer.kyc_status === 'verified' ? 'Verified' : 'Pending'}
              </span>
              {customer.is_flagged && (
                <span className="badge no-dot badge-danger">
                  <span className="icon-outlined icon-xs">flag</span>
                  Flagged
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
          <SectionCard title="Personal details">
            <InfoRow label="First name"   value={customer.first_name} />
            <InfoRow label="Last name"    value={customer.last_name} />
            {customer.other_names && <InfoRow label="Other names" value={customer.other_names} />}
            <InfoRow label="Phone"        value={customer.phone} />
            <InfoRow label="Email"        value={customer.email} />
            <InfoRow label="NIN"          value={customer.nin ? '••••' + customer.nin.slice(-4) : '—'} mono />
            <InfoRow label="Draw code"    value={customer.draw_code} mono />
            <InfoRow label="Enrolled"     value={formatDate(customer.created_at)} last />
          </SectionCard>

          <SectionCard title="Savings summary">
            {/* Progress bar */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                <span>{pct.toFixed(1)}% saved</span>
                <span>{formatUGX(balance)} of {formatUGX(target)}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{
                  width: `${pct}%`,
                  background: pct >= 100 ? 'var(--color-green)' : pct >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
                }} />
              </div>
            </div>
            <InfoRow label="Wallet balance" value={formatUGX(balance)} green />
            <InfoRow label="Target amount"  value={formatUGX(target)} />
            <InfoRow label="Remaining"      value={formatUGX(Math.max(target - balance, 0))} red />
            <InfoRow label="Progress"       value={pct.toFixed(1) + '%'} last />
          </SectionCard>

          <SectionCard title="Business & campaign">
            <InfoRow label="Business"            value={business?.name} />
            <InfoRow label="Sector"              value={business?.sector} />
            <InfoRow label="Campaign"            value={campaign?.name} />
            <InfoRow label="Campaign status"     value={campaign?.status} />
            <InfoRow label="Campaign target date" value={formatDate(campaign?.target_date)} last />
          </SectionCard>

          <SectionCard title="Payment source">
            <InfoRow label="Network" value={customer.payment_network?.toUpperCase()} />
            <InfoRow label="Number"  value={customer.payment_number} mono />
            <InfoRow label="KYC"     value={customer.kyc_status} last />
          </SectionCard>
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {activeTab === 'transactions' && (
        <SectionCard title={`Transaction history (${transactions.length})`}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              No transactions yet
            </div>
          ) : (
            <div className="table-wrapper" style={{ margin: 'calc(-1 * var(--space-5))', marginTop: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                          {t.reference || t.id.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ width: 20, height: 20, background: txAccent(t.type), border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="icon-outlined" style={{ fontSize: 11 }}>{t.type === 'deposit' ? 'south' : 'north'}</span>
                          </div>
                          <span style={{ fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>{t.type}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: txAmountColor(t.type) }}>
                        {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                      </td>
                      <td>
                        <span className={`badge no-dot ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                        {formatDateTime(t.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── ACTIONS ── */}
      {activeTab === 'actions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>

          {/* KYC verification */}
          <SectionCard title="KYC verification">
            {kycSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">{kycSuccess}</div>
              </div>
            )}
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-normal)' }}>
              Current status: <strong style={{ color: customer.kyc_status === 'verified' ? '#2D8B45' : '#8A6700' }}>
                {customer.kyc_status}
              </strong>
            </p>
            {customer.kyc_status !== 'verified' ? (
              <button onClick={handleVerifyKYC} disabled={savingKYC} className="btn btn-success btn-full">
                {savingKYC
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Verifying…</>
                  : <><span className="icon-outlined icon-sm">verified_user</span> Manually verify KYC</>
                }
              </button>
            ) : (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">verified_user</span>
                <div className="alert-content">KYC already verified.</div>
              </div>
            )}
          </SectionCard>

          {/* Flag account */}
          <SectionCard title="Flag account">
            {flagSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">{flagSuccess}</div>
              </div>
            )}
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-normal)' }}>
              Flagging an account marks it for review. The customer can still use the platform.
            </p>
            <button onClick={handleToggleFlag} disabled={savingFlag}
              className={`btn btn-full ${customer.is_flagged ? 'btn-success' : 'btn-danger'}`}>
              {savingFlag
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                : customer.is_flagged
                ? <><span className="icon-outlined icon-sm">flag</span> Remove flag</>
                : <><span className="icon-outlined icon-sm">flag</span> Flag this account</>
              }
            </button>
          </SectionCard>

          {/* Manual refund */}
          <SectionCard title="Manual refund">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {refundSuccess && (
                <div className="alert alert-success">
                  <span className="icon-outlined alert-icon">check_circle</span>
                  <div className="alert-content">{refundSuccess}</div>
                </div>
              )}
              {refundError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{refundError}</div>
                </div>
              )}
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Creates a pending withdrawal. Current balance:{' '}
                <strong style={{ color: '#2D8B45' }}>{formatUGX(balance)}</strong>
              </p>
              <div className="input-group">
                <label className="input-label">Refund amount (UGX)</label>
                <input type="number" className="input" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="e.g. 500000" />
              </div>
              <div className="input-group">
                <label className="input-label">Type customer's full name to confirm</label>
                <input type="text" className="input" value={refundConfirm} onChange={e => setRefundConfirm(e.target.value)} placeholder={`${customer.first_name} ${customer.last_name}`} />
              </div>
              <button onClick={handleRefund} disabled={savingRefund} className="btn btn-danger btn-full">
                {savingRefund
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Processing…</>
                  : <><span className="icon-outlined icon-sm">undo</span> Process refund</>
                }
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}