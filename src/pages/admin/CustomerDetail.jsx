import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

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

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [business, setBusiness] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')

  // KYC action
  const [savingKYC, setSavingKYC] = useState(false)
  const [kycSuccess, setKycSuccess] = useState('')

  // Flag action
  const [savingFlag, setSavingFlag] = useState(false)
  const [flagSuccess, setFlagSuccess] = useState('')

  // Refund action
  const [refundAmount, setRefundAmount] = useState('')
  const [refundConfirm, setRefundConfirm] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)
  const [refundSuccess, setRefundSuccess] = useState('')
  const [refundError, setRefundError] = useState('')

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      // Customer
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!custData) { setLoading(false); return }
      setCustomer(custData)

      // Business
      if (custData.business_id) {
        const { data: bizData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', custData.business_id)
          .maybeSingle()
        setBusiness(bizData)
      }

      // Campaign
      if (custData.campaign_id) {
        const { data: campData } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', custData.campaign_id)
          .maybeSingle()
        setCampaign(campData)
      }

      // Wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('customer_id', id)
        .maybeSingle()
      setWallet(walletData)

      // Transactions
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      setTransactions(txnData || [])

    } catch (e) {
      console.error('CustomerDetail load error:', e)
    }
    setLoading(false)
  }

  async function handleVerifyKYC() {
    setSavingKYC(true)
    try {
      await supabase
        .from('customers')
        .update({ kyc_status: 'verified' })
        .eq('id', id)
      setCustomer(prev => ({ ...prev, kyc_status: 'verified' }))
      setKycSuccess('KYC manually verified successfully.')
      setTimeout(() => setKycSuccess(''), 3000)
    } catch (e) {
      console.error('KYC verify error:', e)
    }
    setSavingKYC(false)
  }

  async function handleToggleFlag() {
    setSavingFlag(true)
    try {
      const newFlag = !customer.is_flagged
      await supabase
        .from('customers')
        .update({ is_flagged: newFlag })
        .eq('id', id)
      setCustomer(prev => ({ ...prev, is_flagged: newFlag }))
      setFlagSuccess(newFlag ? 'Account flagged.' : 'Flag removed.')
      setTimeout(() => setFlagSuccess(''), 3000)
    } catch (e) {
      console.error('Flag error:', e)
    }
    setSavingFlag(false)
  }

  async function handleRefund() {
    setRefundError('')
    const amount = Number(refundAmount)
    if (!amount || amount <= 0) {
      setRefundError('Please enter a valid refund amount.')
      return
    }
    const customerName = `${customer.first_name} ${customer.last_name}`
    if (refundConfirm !== customerName) {
      setRefundError(`Please type the customer's full name exactly: "${customerName}"`)
      return
    }
    setSavingRefund(true)
    try {
      const reference = 'TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      await supabase.from('transactions').insert({
        customer_id: id,
        wallet_id: wallet?.id,
        campaign_id: customer.campaign_id,
        type: 'withdrawal',
        amount,
        status: 'pending',
        reference,
        notes: 'Manual refund by Partna admin',
      })
      setRefundSuccess(`Refund of ${formatUGX(amount)} initiated. Reference: ${reference}`)
      setRefundAmount('')
      setRefundConfirm('')
      // Reload transactions
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      setTransactions(txnData || [])
    } catch (e) {
      console.error('Refund error:', e)
      setRefundError('Something went wrong. Please try again.')
    }
    setSavingRefund(false)
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

  function formatDateTime(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-UG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  function txColor(type) { return type === 'deposit' ? '#16A34A' : '#DC2626' }
  function txIcon(type) { return type === 'deposit' ? '↓' : '↑' }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  if (!customer) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-sm" style={{ color: 'rgba(0,0,0,0.4)' }}>Customer not found</div>
      <button onClick={() => navigate('/admin/customers')}
        className="text-xs font-semibold px-4 py-2 rounded-xl"
        style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
        Back to customers
      </button>
    </div>
  )

  const balance = Number(wallet?.balance || 0)
  const target = Number(campaign?.target_amount || 0)
  const pct = target > 0 ? Math.min((balance / target) * 100, 100) : 0

  const TABS = ['profile', 'transactions', 'actions']

  return (
    <div className="flex flex-col gap-5">

      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/customers')}
          className="text-xs font-semibold px-3 py-2 rounded-xl"
          style={{ background: '#fff', color: ADMIN_PRIMARY, border: '1.5px solid rgba(27,79,114,0.15)' }}>
          ← Back
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: business?.primary_color || ADMIN_PRIMARY, color: '#fff' }}>
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>
              {customer.first_name} {customer.last_name}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{customer.phone}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: customer.kyc_status === 'verified' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                  color: customer.kyc_status === 'verified' ? '#16A34A' : '#D97706',
                }}>
                KYC: {customer.kyc_status === 'verified' ? 'Verified' : 'Pending'}
              </span>
              {customer.is_flagged && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                  ⚑ Flagged
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
          <Section title="Personal Details">
            <Row label="First name" value={customer.first_name} />
            <Row label="Last name" value={customer.last_name} />
            {customer.other_names && <Row label="Other names" value={customer.other_names} />}
            <Row label="Phone" value={customer.phone} />
            <Row label="Email" value={customer.email} />
            <Row label="NIN" value={customer.nin ? '••••' + customer.nin.slice(-4) : '—'} />
            <Row label="Draw code" value={customer.draw_code} />
            <Row label="Enrolled" value={formatDate(customer.created_at)} />
          </Section>

          <Section title="Savings Summary">
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                <span>{pct.toFixed(1)}% saved</span>
                <span>{formatUGX(balance)} of {formatUGX(target)}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.08)' }}>
                <div className="h-2 rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? '#16A34A' : pct >= 50 ? ADMIN_GOLD : '#F59E0B',
                  }} />
              </div>
            </div>
            <Row label="Wallet balance" value={formatUGX(balance)} valueColor="#16A34A" />
            <Row label="Target amount" value={formatUGX(target)} />
            <Row label="Remaining" value={formatUGX(Math.max(target - balance, 0))} valueColor="#DC2626" />
            <Row label="Progress" value={pct.toFixed(1) + '%'} />
          </Section>

          <Section title="Business & Campaign">
            <Row label="Business" value={business?.name} />
            <Row label="Sector" value={business?.sector} />
            <Row label="Campaign" value={campaign?.name} />
            <Row label="Campaign status" value={campaign?.status} />
            <Row label="Campaign target date" value={formatDate(campaign?.target_date)} />
          </Section>

          <Section title="Payment Source">
            <Row label="Network" value={customer.payment_network?.toUpperCase()} />
            <Row label="Number" value={customer.payment_number} />
            <Row label="KYC status" value={customer.kyc_status} />
          </Section>
        </div>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab === 'transactions' && (
        <Section title={`Transaction History (${transactions.length})`}>
          {transactions.length === 0 ? (
            <div className="text-xs py-4 text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
              No transactions yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Reference', 'Type', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="py-2 text-left">
                        <span className="text-xs font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={t.id}
                      style={{ borderBottom: i < transactions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-mono" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          {t.reference || t.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold"
                            style={{ color: txColor(t.type) }}>
                            {txIcon(t.type)}
                          </span>
                          <span className="text-xs capitalize" style={{ color: '#333' }}>{t.type}</span>
                        </div>
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
                          {formatDateTime(t.created_at)}
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

      {/* ── ACTIONS TAB ── */}
      {activeTab === 'actions' && (
        <div className="grid grid-cols-2 gap-5">

          {/* KYC verification */}
          <Section title="KYC Verification">
            {kycSuccess && (
              <div className="text-xs px-3 py-2 rounded-xl font-semibold mb-3"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                ✓ {kycSuccess}
              </div>
            )}
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Current status: <span className="font-semibold" style={{
                color: customer.kyc_status === 'verified' ? '#16A34A' : '#D97706'
              }}>{customer.kyc_status}</span>
            </div>
            {customer.kyc_status !== 'verified' ? (
              <button onClick={handleVerifyKYC} disabled={savingKYC}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#16A34A', color: '#fff', opacity: savingKYC ? 0.5 : 1 }}>
                {savingKYC ? 'Verifying...' : '✓ Manually verify KYC'}
              </button>
            ) : (
              <div className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
                ✓ KYC already verified
              </div>
            )}
          </Section>

          {/* Flag account */}
          <Section title="Flag Account">
            {flagSuccess && (
              <div className="text-xs px-3 py-2 rounded-xl font-semibold mb-3"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                ✓ {flagSuccess}
              </div>
            )}
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Flagging an account marks it for review. The customer can still use the platform.
            </div>
            <button onClick={handleToggleFlag} disabled={savingFlag}
              className="w-full py-2.5 rounded-xl text-xs font-bold"
              style={{
                background: customer.is_flagged ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                color: customer.is_flagged ? '#16A34A' : '#DC2626',
                opacity: savingFlag ? 0.5 : 1,
              }}>
              {savingFlag ? 'Saving...' : customer.is_flagged ? '✓ Remove flag' : '⚑ Flag this account'}
            </button>
          </Section>

          {/* Manual refund */}
          <Section title="Manual Refund">
            <div className="flex flex-col gap-3">
              {refundSuccess && (
                <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  ✓ {refundSuccess}
                </div>
              )}
              {refundError && (
                <div className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {refundError}
                </div>
              )}
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Creates a pending withdrawal transaction. Current balance: <span className="font-semibold" style={{ color: '#16A34A' }}>{formatUGX(balance)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                  Refund amount (UGX)
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                  Type customer's full name to confirm
                </label>
                <input
                  type="text"
                  value={refundConfirm}
                  onChange={e => setRefundConfirm(e.target.value)}
                  placeholder={`${customer.first_name} ${customer.last_name}`}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                />
              </div>
              <button onClick={handleRefund} disabled={savingRefund}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: savingRefund ? 'rgba(220,38,38,0.3)' : '#DC2626',
                  color: '#fff',
                }}>
                {savingRefund ? 'Processing...' : 'Process refund'}
              </button>
            </div>
          </Section>

        </div>
      )}

    </div>
  )
}