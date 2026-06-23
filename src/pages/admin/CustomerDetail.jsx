import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

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
function txIconBg(type) {
  if (type === 'deposit')    return { bg: '#E4F8EC', color: '#59886D' }
  if (type === 'withdrawal') return { bg: '#F8E4E4', color: '#CC3939' }
  return { bg: '#F8F0E4', color: '#EF8354' }
}

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

function SectionCard({ title, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, last, green, red, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: green ? C.green : red ? C.red : C.black, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function CustomerDetail() {
  useEffect(() => { document.title = 'Customer - Partna' }, [])

  const { id } = useParams()
  const navigate = useNavigate()

  const [customer, setCustomer]         = useState(null)
  const [business, setBusiness]         = useState(null)
  const [campaign, setCampaign]         = useState(null)
  const [wallet, setWallet]             = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeTab, setActiveTab]       = useState('profile')

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

  // ── Business logic — unchanged ─────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
      if (!custData) { setLoading(false); return }
      setCustomer(custData)
      if (custData.business_id) { const { data: bizData } = await supabase.from('businesses').select('*').eq('id', custData.business_id).maybeSingle(); setBusiness(bizData) }
      if (custData.campaign_id) { const { data: campData } = await supabase.from('campaigns').select('*').eq('id', custData.campaign_id).maybeSingle(); setCampaign(campData) }
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

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (!customer) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Customer not found</p>
      <button onClick={() => navigate('/admin/customers')} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        ← Back to customers
      </button>
    </div>
  )

  const balance = Number(wallet?.balance || 0)
  const target  = Number(campaign?.target_amount || 0)
  const pct     = target > 0 ? Math.min((balance / target) * 100, 100) : 0
  const TABS    = ['profile', 'transactions', 'actions']

  const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
  const btnSuccess = { width: '100%', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.green, border: `1px solid ${C.green}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnDanger  = { width: '100%', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.red,   border: `1px solid ${C.red}`,   borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate('/admin/customers')} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: C.black, flexShrink: 0 }}>
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 5px' }}>
              {customer.first_name} {customer.last_name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{customer.phone}</span>
              {customer.kyc_status === 'verified'
                ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,  borderRadius: 6, padding: '2px 8px' }}>KYC Verified</span>
                : <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 6, padding: '2px 8px' }}>KYC Pending</span>
              }
              {customer.is_flagged && (
                <span style={{ fontSize: 11, fontWeight: 600, color: C.red, background: C.bgRed, borderRadius: 6, padding: '2px 8px' }}>⚑ Flagged</span>
              )}
            </div>
          </div>
        </div>
      </div>

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
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: C.secondary, marginBottom: 6 }}>
                <span>{pct.toFixed(1)}% saved</span>
                <span>{formatUGX(balance)} of {formatUGX(target)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: C.grayLight, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct >= 75 ? C.green : pct >= 50 ? C.orange : C.blue, transition: 'width 0.4s' }} />
              </div>
            </div>
            <InfoRow label="Wallet balance" value={formatUGX(balance)} green />
            <InfoRow label="Target amount"  value={formatUGX(target)} />
            <InfoRow label="Remaining"      value={formatUGX(Math.max(target - balance, 0))} red />
            <InfoRow label="Progress"       value={pct.toFixed(1) + '%'} last />
          </SectionCard>

          <SectionCard title="Business & campaign">
            <InfoRow label="Business"             value={business?.name} />
            <InfoRow label="Sector"               value={business?.sector} />
            <InfoRow label="Campaign"             value={campaign?.name} />
            <InfoRow label="Campaign status"      value={campaign?.status} />
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
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.secondary }}>No transactions yet</div>
          ) : (
            <div style={{ overflowX: 'auto', margin: '-16px -20px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                    {['Reference', 'Type', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const { bg, color } = txIconBg(t.type)
                    return (
                      <tr key={t.id} style={{ borderBottom: i < transactions.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>{t.reference || t.id.slice(0, 8)}</span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {t.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                              </svg>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.black, textTransform: 'capitalize' }}>{t.type}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: t.type === 'deposit' ? C.green : C.red, whiteSpace: 'nowrap' }}>
                          {t.type === 'deposit' ? '+' : '-'}{formatUGX(t.amount)}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          {t.status === 'completed'
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,  borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>{t.status}</span>
                            : <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize' }}>{t.status}</span>
                          }
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                          {formatDateTime(t.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── ACTIONS ── */}
      {activeTab === 'actions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* KYC verification */}
          <SectionCard title="KYC verification">
            {kycSuccess && <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green, marginBottom: 12 }}>{kycSuccess}</div>}
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '0 0 14px', lineHeight: '140%' }}>
              Current status: <strong style={{ color: customer.kyc_status === 'verified' ? C.green : C.orange }}>{customer.kyc_status}</strong>
            </p>
            {customer.kyc_status !== 'verified' ? (
              <button onClick={handleVerifyKYC} disabled={savingKYC} style={{ ...btnSuccess, opacity: savingKYC ? 0.75 : 1 }}>
                {savingKYC ? <><div className="spinner spinner-sm spinner-light" /> Verifying…</> : 'Manually verify KYC'}
              </button>
            ) : (
              <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>KYC already verified.</div>
            )}
          </SectionCard>

          {/* Flag account */}
          <SectionCard title="Flag account">
            {flagSuccess && <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green, marginBottom: 12 }}>{flagSuccess}</div>}
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '0 0 14px', lineHeight: '140%' }}>
              Flagging an account marks it for review. The customer can still use the platform.
            </p>
            <button onClick={handleToggleFlag} disabled={savingFlag}
              style={{ ...(customer.is_flagged ? btnSuccess : btnDanger), opacity: savingFlag ? 0.75 : 1 }}>
              {savingFlag
                ? <><div className="spinner spinner-sm spinner-light" /> Saving…</>
                : customer.is_flagged ? 'Remove flag' : 'Flag this account'
              }
            </button>
          </SectionCard>

          {/* Manual refund */}
          <SectionCard title="Manual refund">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {refundSuccess && <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>{refundSuccess}</div>}
              {refundError   && <div style={{ background: C.bgRed,   borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red   }}>{refundError}</div>}
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                Creates a pending withdrawal. Current balance: <strong style={{ color: C.green }}>{formatUGX(balance)}</strong>
              </p>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>Refund amount (UGX)</label>
                <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="e.g. 500000"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>Type customer's full name to confirm</label>
                <input type="text" value={refundConfirm} onChange={e => setRefundConfirm(e.target.value)} placeholder={`${customer.first_name} ${customer.last_name}`}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.black}
                  onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>
              <button onClick={handleRefund} disabled={savingRefund} style={{ ...btnDanger, opacity: savingRefund ? 0.75 : 1 }}>
                {savingRefund ? <><div className="spinner spinner-sm spinner-light" /> Processing…</> : 'Process refund'}
              </button>
            </div>
          </SectionCard>

        </div>
      )}

    </div>
  )
}