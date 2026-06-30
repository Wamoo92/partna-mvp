import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { formatUGX, businessWithdrawalFees, MIN_BUSINESS_WITHDRAWAL } from '../../lib/constants'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const CHART_FILTERS = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '1yr', days: 365 }]

// ── Helpers ────────────────────────────────────────────────────────────────
function formatAmountInput(val) { return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function txAmountColor(type) { return type === 'deposit' ? '#59886D' : '#CC3939' }
function txLabel(type) { return type === 'deposit' ? 'Deposit' : type === 'withdrawal' ? 'Withdrawal' : type === 'payment' ? 'Fee payment' : type }
function txIconBg(type) {
  if (type === 'deposit')    return { bg: '#E4F8EC', color: '#59886D' }
  if (type === 'withdrawal') return { bg: '#F8E4E4', color: '#CC3939' }
  return { bg: '#F8F0E4', color: '#EF8354' }
}
function buildPath(data, key, max, width, height) {
  if (data.length === 0) return ''
  const step = width / (data.length - 1 || 1)
  return data.map((d, i) => { const x = i * step; const y = height - (d[key] / max) * height; return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) }).join(' ')
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

const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle   = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }
const btnPrimary   = { padding: '10px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }

function StatCard({ label, value, sub, accentColor, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 16px rgba(17,17,17,0.1)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{sub}</p>}
    </div>
  )
}

function Modal({ title, sub, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
            {sub && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '2px 0 0' }}>{sub}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 4, lineHeight: 1, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Setup checklist ────────────────────────────────────────────────────────
function SetupChecklist({ business, hasCampaign, hasBankAccount, navigate }) {
  const items = [
    {
      id:          'password',
      label:       'Set your password',
      detail:      'Done on first login',
      done:        true,
      action:      null,
    },
    {
      id:          'bank_account',
      label:       'Link your bank account',
      detail:      'Required to withdraw funds from your business wallet',
      done:        hasBankAccount,
      action:      () => navigate('/dashboard/settings', { state: { tab: 'bank_account' } }),
      actionLabel: 'Link account →',
    },
    {
      id:          'slug',
      label:       'Set your portal URL',
      detail:      'The link you share with your customers',
      done:        !!business?.slug,
      action:      () => navigate('/dashboard/settings', { state: { tab: 'security', scrollTo: 'portal-url' } }),
      actionLabel: 'Set URL →',
    },
    {
      id:          'logo',
      label:       'Upload your logo',
      detail:      'Appears on your customer portal',
      done:        !!(business?.logo_url && !business.logo_url.startsWith('/partna')),
      action:      () => navigate('/dashboard/settings', { state: { tab: 'profile' } }),
      actionLabel: 'Upload →',
    },
    {
      id:          'campaign',
      label:       'Create your first campaign',
      detail:      'Start enrolling customers',
      done:        hasCampaign,
      action:      () => navigate('/dashboard/campaigns'),
      actionLabel: 'Create campaign →',
    },
  ]

  const completedCount = items.filter(i => i.done).length
  const allDone        = completedCount === items.length
  if (allDone) return null

  const progressPct = (completedCount / items.length) * 100

  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px', letterSpacing: '-0.4px' }}>Complete your setup</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{completedCount} of {items.length} steps complete</p>
        </div>
        <div style={{ width: 120 }}>
          <div style={{ height: 6, background: C.grayLight, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: C.green, borderRadius: 999, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
      <div>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < items.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: item.done ? C.bg : C.white, opacity: item.done ? 0.7 : 1 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: item.done ? C.green : C.white, border: `2px solid ${item.done ? C.green : C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: item.done ? 500 : 600, color: item.done ? C.secondary : C.black, margin: '0 0 2px', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</p>
              {!item.done && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{item.detail}</p>}
            </div>
            {!item.done && item.action && (
              <button onClick={item.action} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = C.black }}
                onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.grayLine }}>
                {item.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Overview({ admin, business }) {
  useEffect(() => { document.title = 'Overview - Partna' }, [])

  const navigate = useNavigate()
  const [loading, setLoading]               = useState(true)
  const [stats, setStats]                   = useState({ totalSavings: 0, activeCustomers: 0, totalPayments: 0 })
  const [businessWallet, setBusinessWallet] = useState(null)
  const [bankAccount, setBankAccount]       = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [campaigns, setCampaigns]           = useState([])
  const [campaignStats, setCampaignStats]   = useState({}) // keyed by campaign id
  const [chartData, setChartData]           = useState([])
  const [chartFilter, setChartFilter]       = useState(7)
  const [chartType, setChartType]           = useState('bar')
  const [allTxns, setAllTxns]               = useState([])

  const [showWithdraw, setShowWithdraw]       = useState(false)
  const [withdrawAmount, setWithdrawAmount]   = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [withdrawError, setWithdrawError]     = useState('')

  useEffect(() => { if (business) loadData() }, [business])
  useEffect(() => { if (allTxns.length > 0 || !loading) buildChartData(allTxns, chartFilter) }, [chartFilter, allTxns])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customers } = await supabase.from('customers').select('id, first_name, last_name, created_at, registration_status').eq('business_id', business.id)
      const customerIds = customers?.map(c => c.id) || []
      let totalSavings = 0
      if (customerIds.length > 0) { const { data: wallets } = await supabase.from('wallets').select('balance').in('customer_id', customerIds); totalSavings = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0 }

      const { data: campaignData } = await supabase.from('campaigns').select('*').eq('business_id', business.id).eq('status', 'active')
      setCampaigns(campaignData || [])

      // ── Load per-campaign stats ───────────────────────────────────────
      if (campaignData && campaignData.length > 0) {
        const statsMap = {}
        await Promise.all(campaignData.map(async (campaign) => {
          try {
            const { data: enrollments } = await supabase
              .from('customer_campaigns')
              .select('customer_id, wallet_id')
              .eq('campaign_id', campaign.id)
              .eq('status', 'active')

            const enrolled   = enrollments?.length || 0
            // Each enrollment has its OWN wallet — scope savings to this
            // campaign's enrollment wallets only, not every wallet the customer owns.
            const walletIds  = (enrollments || []).map(e => e.wallet_id).filter(Boolean)

            let amountSaved = 0
            let amountPaid  = 0

            if (walletIds.length > 0) {
              const { data: wallets } = await supabase
                .from('wallets')
                .select('balance')
                .in('id', walletIds)
              amountSaved = wallets?.reduce((s, w) => s + Number(w.balance), 0) || 0
            }

            if (enrolled > 0) {
              // Payments made toward THIS campaign only
              const { data: payments } = await supabase
                .from('transactions')
                .select('amount')
                .eq('campaign_id', campaign.id)
                .in('type', ['payment', 'fee_payment', 'late_fee_payment'])
              amountPaid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
            }

            statsMap[campaign.id] = { enrolled, amountSaved, amountPaid }
          } catch (e) {
            statsMap[campaign.id] = { enrolled: 0, amountSaved: 0, amountPaid: 0 }
          }
        }))
        setCampaignStats(statsMap)
      }

      let totalPayments = 0; let txns = []
      if (customerIds.length > 0) {
        const { data: payments } = await supabase.from('transactions').select('amount').in('customer_id', customerIds).in('type', ['payment', 'fee_payment', 'late_fee_payment'])
        totalPayments = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
        const { data: allTxnData } = await supabase.from('transactions').select('*, customers(first_name, last_name)').in('customer_id', customerIds).order('created_at', { ascending: false })
        txns = allTxnData || []
      }
      const { data: bizWallet } = await supabase.from('business_wallets').select('*').eq('business_id', business.id).maybeSingle()
      setBusinessWallet(bizWallet)
      const { data: bankData } = await supabase.from('business_bank_accounts').select('*').eq('business_id', business.id).maybeSingle()
      setBankAccount(bankData || null)
      setAllTxns(txns)
      setRecentActivity(txns.slice(0, 10))
      buildChartData(txns, chartFilter)
      setStats({ totalSavings, activeCustomers: customers?.length || 0, totalPayments })
    } catch (e) { console.error('Overview load error:', e) }
    setLoading(false)
  }

  function buildChartData(txns, days) {
    if (days === 365) {
      const monthMap = {}
      for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const key = d.toLocaleDateString('en-UG', { month: 'short' }); if (!monthMap[key]) monthMap[key] = { label: key, deposits: 0, withdrawals: 0 } }
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
      txns.forEach(txn => { const d = new Date(txn.created_at); if (d < cutoff) return; const key = d.toLocaleDateString('en-UG', { month: 'short' }); if (monthMap[key]) { if (txn.type === 'deposit') monthMap[key].deposits += Number(txn.amount); if (txn.type === 'withdrawal') monthMap[key].withdrawals += Number(txn.amount) } })
      setChartData(Object.values(monthMap)); return
    }
    const points = []
    for (let i = days - 1; i >= 0; i--) { const date = new Date(); date.setDate(date.getDate() - i); date.setHours(0, 0, 0, 0); const label = days === 7 ? date.toLocaleDateString('en-UG', { weekday: 'short' }) : date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' }); points.push({ label, date: date.toDateString(), deposits: 0, withdrawals: 0 }) }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    txns.forEach(txn => { const d = new Date(txn.created_at); if (d < cutoff) return; const point = points.find(p => p.date === d.toDateString()); if (point) { if (txn.type === 'deposit') point.deposits += Number(txn.amount); if (txn.type === 'withdrawal') point.withdrawals += Number(txn.amount) } })
    setChartData(points)
  }

  async function handleWithdraw() {
    setWithdrawError('')
    const amount  = parseInt(withdrawAmount.replace(/,/g, ''), 10)
    const balance = businessWallet ? Number(businessWallet.balance) : 0
    if (!amount || amount < MIN_BUSINESS_WITHDRAWAL) { setWithdrawError(`Minimum withdrawal is ${formatUGX(MIN_BUSINESS_WITHDRAWAL)}.`); return }
    if (amount > balance)         { setWithdrawError('Amount exceeds your available balance.'); return }

    setWithdrawLoading(true)
    try {
      // business_transactions / business_wallets are not writable by a business admin
      // under RLS, so the debit, the fee split (3% + UGX 6,000) and the records are
      // all done server-side (service role) by process-business-withdrawal.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setWithdrawError('Your session has expired. Please log in again.'); setWithdrawLoading(false); return }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-business-withdrawal`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body:    JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setWithdrawError(data.error || 'Something went wrong. Please try again.'); setWithdrawLoading(false); return }

      setBusinessWallet(prev => ({ ...prev, balance: data.newBalance }))

      const grossStr     = formatUGX(data.gross)
      const partnaStr    = formatUGX(data.partnaFee)
      const carrierStr   = formatUGX(data.carrierFee)
      const netStr       = formatUGX(data.netAmount)
      const accountNum   = bankAccount.account_number || ''
      const last4        = accountNum.length >= 4 ? accountNum.slice(-4) : accountNum
      const accountLabel = last4 ? `${bankAccount.bank_name} account ending in ${last4}` : bankAccount.bank_name
      const recipients   = [business.admin_email, business.contact_email].filter(Boolean)

      const emailHtml = `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" />
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; letter-spacing: -0.5px;">Withdrawal request received</h2>
        <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
          Hi ${admin?.full_name || 'there'}, we have received your withdrawal request of
          <strong style="color: #111;"> ${grossStr}</strong> from your
          <strong style="color: #111;"> ${business.name}</strong> Partna wallet.
          After fees, <strong style="color: #111;"> ${netStr}</strong> will be transferred to your ${accountLabel} within 1–2 business days.
        </p>
        <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; padding: 16px 18px; margin: 0 0 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500; width: 160px;">Withdrawal amount</td><td style="padding: 6px 0; font-weight: 600; color: #111;">${grossStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Partna fee (3%)</td><td style="padding: 6px 0; font-weight: 600; color: #CC3939;">− ${partnaStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Bank transfer fee</td><td style="padding: 6px 0; font-weight: 600; color: #CC3939;">− ${carrierStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 600;">You receive</td><td style="padding: 6px 0; font-weight: 700; color: #59886D;">${netStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Bank</td><td style="padding: 6px 0; font-weight: 600; color: #111;">${bankAccount.bank_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Account number</td><td style="padding: 6px 0; font-weight: 600; color: #111; font-family: monospace;">${accountNum}</td></tr>
            <tr><td style="padding: 6px 0; color: #959687; font-weight: 500;">Status</td><td style="padding: 6px 0; font-weight: 600; color: #EF8354;">Pending processing</td></tr>
          </table>
        </div>
        <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 20px;">You will receive another email once the transfer has been processed. If you have any questions, contact us at <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600; text-decoration: underline;">billing@partna.io</a>.</p>
        <p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600; text-decoration: none;">Partna</a></p>
      </div>`

      for (const email of recipients) {
        fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body:    JSON.stringify({ to: email, from: 'billing', subject: `Withdrawal request received — ${grossStr}`, html: emailHtml }),
        }).catch(e => console.error('Withdrawal confirmation email error (non-critical):', e))
      }

      setWithdrawSuccess(true)
      await loadData()
    } catch (e) { console.error('Withdrawal error:', e); setWithdrawError('Something went wrong. Please try again.') }
    setWithdrawLoading(false)
  }

  const chartMax       = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)
  const hasData        = chartData.some(d => d.deposits > 0 || d.withdrawals > 0)
  const bizBalance     = businessWallet ? Number(businessWallet.balance) : 0
  const isEducation    = business?.sector === 'Education' || business?.sector === 'education'
  const hasCampaign    = campaigns.length > 0
  const hasBankAccount = !!bankAccount
  const canWithdraw    = bizBalance > 0 && hasBankAccount

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── WITHDRAWAL MODAL ── */}
      {showWithdraw && (
        <Modal
          title="Withdraw funds"
          sub={`Available: ${formatUGX(bizBalance)}`}
          onClose={() => { setShowWithdraw(false); setWithdrawAmount(''); setWithdrawError(''); setWithdrawSuccess(false) }}
        >
          {withdrawSuccess ? (
            <>
              <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Withdrawal request submitted</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                  Your withdrawal of <strong style={{ color: C.black }}>{formatUGX(parseInt(withdrawAmount.replace(/,/g, ''), 10))}</strong> has been submitted. Funds will be transferred within 1–2 business days.
                </p>
              </div>
              <button onClick={() => { setShowWithdraw(false); setWithdrawAmount(''); setWithdrawError(''); setWithdrawSuccess(false) }} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>Done</button>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Amount (UGX)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, fontSize: 13, color: C.secondary, pointerEvents: 'none', zIndex: 1 }}>UGX</span>
                  <input type="text" inputMode="numeric" placeholder="0" value={withdrawAmount} onChange={e => setWithdrawAmount(formatAmountInput(e.target.value))}
                    style={{ ...inputStyle, paddingLeft: 54, fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>Minimum UGX 1,000 · Available: {formatUGX(bizBalance)}</p>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Sending to</label>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary, background: C.grayLight, borderRadius: 6, padding: '2px 8px' }}>Pre-filled · Read only</span>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { label: 'Bank',           value: bankAccount?.bank_name },
                    { label: 'Account name',   value: bankAccount?.account_name },
                    { label: 'Account number', value: bankAccount?.account_number },
                    { label: 'Currency',       value: bankAccount?.currency },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: '5px 0 0', lineHeight: '140%' }}>To change your bank account details, go to Settings → Bank Account.</p>
              </div>

              {/* Fee breakdown — shown before confirming */}
              {(() => {
                const gross = parseInt(withdrawAmount.replace(/,/g, ''), 10)
                if (!gross || gross < MIN_BUSINESS_WITHDRAWAL) return null
                const f = businessWithdrawalFees(gross)
                return (
                  <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                    {[
                      { label: 'Withdrawal amount', value: formatUGX(f.gross),       color: C.black },
                      { label: 'Partna fee (3%)',   value: '− ' + formatUGX(f.partnaFee),  color: C.red },
                      { label: 'Bank transfer fee', value: '− ' + formatUGX(f.carrierFee), color: C.red },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: `1px solid ${C.grayLine}` }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: C.black }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>You receive</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: C.green, letterSpacing: '-0.5px' }}>{formatUGX(f.netAmount)}</span>
                    </div>
                  </div>
                )
              })()}

              {withdrawError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{withdrawError}</div>}
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                Withdrawals are processed within 1–2 business days by the Partna team.
              </div>
              <button onClick={handleWithdraw} disabled={withdrawLoading} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: withdrawLoading ? 0.75 : 1 }}>
                {withdrawLoading ? <><div className="spinner spinner-sm spinner-light" /> Submitting…</> : `Request ${withdrawAmount ? 'UGX ' + withdrawAmount : 'withdrawal'}`}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ── SETUP CHECKLIST ── */}
      <SetupChecklist
        business={business}
        hasCampaign={hasCampaign}
        hasBankAccount={hasBankAccount}
        navigate={navigate}
      />

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <StatCard label="Total savings (AUM)"  value={formatUGX(stats.totalSavings)}    sub="Across all customers"   accentColor={C.blue}   />
        <StatCard label="Active customers"      value={stats.activeCustomers}             sub="Registered accounts"    accentColor={C.orange} />
        <StatCard label={isEducation ? 'Total fees received' : 'Total payments'} value={formatUGX(stats.totalPayments)} sub={isEducation ? 'From all students' : 'Completed payments'} accentColor={C.green} />
        <StatCard label="Active campaigns"      value={campaigns.length}                  sub={campaigns[0]?.name || 'No campaigns yet'} accentColor={C.red} onClick={() => navigate('/dashboard/campaigns')} />

        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Business wallet</p>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue }} />
            </div>
            <p style={{ fontSize: 22, fontWeight: 600, color: bizBalance > 0 ? C.green : C.grayLight, letterSpacing: '-0.8px', margin: '0 0 2px', lineHeight: 1 }}>{formatUGX(bizBalance)}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 14px' }}>
              {!hasBankAccount ? 'Link a bank account to withdraw' : 'Available to withdraw'}
            </p>
          </div>
          <button
            onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError('') }}
            disabled={!canWithdraw}
            title={!hasBankAccount ? 'Link a bank account in Settings before withdrawing' : bizBalance === 0 ? 'No funds to withdraw' : undefined}
            style={{ width: '100%', padding: '8px', fontSize: 13, fontWeight: 600, color: canWithdraw ? C.white : C.grayMid, background: canWithdraw ? C.black : C.grayLight, border: `1px solid ${canWithdraw ? C.black : C.grayLine}`, borderRadius: 8, cursor: canWithdraw ? 'pointer' : 'not-allowed', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* ── CHART + ACTIVITY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>Deposits & Withdrawals</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {[{ color: C.green, label: 'Deposits' }, { color: C.red, label: 'Withdrawals' }].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: 3 }}>
                {[{ id: 'bar', icon: '▌▌' }, { id: 'line', icon: '∿' }].map(t => (
                  <button key={t.id} onClick={() => setChartType(t.id)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: chartType === t.id ? C.black : 'transparent', color: chartType === t.id ? C.white : C.secondary, fontSize: 12, cursor: 'pointer' }}>
                    {t.icon}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3, background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: 3 }}>
                {CHART_FILTERS.map(f => (
                  <button key={f.days} onClick={() => setChartFilter(f.days)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: chartFilter === f.days ? C.black : 'transparent', color: chartFilter === f.days ? C.white : C.secondary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!hasData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, flexDirection: 'column', gap: 8 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>No transaction data yet</p>
            </div>
          ) : chartType === 'bar' ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, paddingBottom: 20, position: 'relative' }}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + pct * 140, height: 1, background: C.grayLine }} />
              ))}
              {chartData.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 140 }}>
                    <div style={{ flex: 1, height: `${(day.deposits / chartMax) * 100}%`, background: C.green, borderRadius: '2px 2px 0 0', minHeight: day.deposits > 0 ? 2 : 0 }} />
                    <div style={{ flex: 1, height: `${(day.withdrawals / chartMax) * 100}%`, background: C.red, borderRadius: '2px 2px 0 0', minHeight: day.withdrawals > 0 ? 2 : 0 }} />
                  </div>
                  {(chartFilter === 7 || i % Math.ceil(chartData.length / 10) === 0) && (
                    <div style={{ fontSize: 9, fontWeight: 500, color: C.grayMid, marginTop: 3 }}>{day.label}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: 160 }}>
              <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none" style={{ display: 'block' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <line key={i} x1="0" y1={140 * pct} x2="600" y2={140 * pct} stroke={C.grayLine} strokeWidth="1" />
                ))}
                <path d={buildPath(chartData, 'deposits', chartMax, 600, 130)} fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={buildPath(chartData, 'withdrawals', chartMax, 600, 130)} fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => { const x = (i / (chartData.length - 1 || 1)) * 600; return d.deposits > 0 ? <circle key={`dep-${i}`} cx={x} cy={130 - (d.deposits / chartMax) * 130} r="3.5" fill={C.green} stroke={C.white} strokeWidth="1.5" /> : null })}
                {chartData.map((d, i) => { const x = (i / (chartData.length - 1 || 1)) * 600; return d.withdrawals > 0 ? <circle key={`wdr-${i}`} cx={x} cy={130 - (d.withdrawals / chartMax) * 130} r="3.5" fill={C.red} stroke={C.white} strokeWidth="1.5" /> : null })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {chartData.filter((_, i) => chartFilter === 7 || i % Math.ceil(chartData.length / 7) === 0).map((d, i) => (
                  <span key={i} style={{ fontSize: 9, fontWeight: 500, color: C.grayMid }}>{d.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>Recent activity</p>
            <button onClick={() => navigate('/dashboard/payments')} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>See all</button>
          </div>
          {recentActivity.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>No activity yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentActivity.slice(0, 8).map((txn, i) => {
                const { bg, color } = txIconBg(txn.type)
                return (
                  <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < Math.min(recentActivity.length, 8) - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {txn.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.customers?.first_name} {txn.customers?.last_name}</p>
                      <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{txLabel(txn.type)}</p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: txAmountColor(txn.type), margin: 0, flexShrink: 0 }}>{txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CAMPAIGNS SUMMARY ── */}
      {campaigns.length > 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>Active campaigns</p>
            <button onClick={() => navigate('/dashboard/campaigns')} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>Manage campaigns</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {campaigns.slice(0, 3).map(c => {
              const s               = campaignStats[c.id] || { enrolled: 0, amountSaved: 0, amountPaid: 0 }
              const collectionTarget = Number(c.target_amount) * s.enrolled
              const savedPct         = collectionTarget > 0 ? Math.min((s.amountSaved / collectionTarget) * 100, 100) : 0
              const paidPct          = collectionTarget > 0 ? Math.min((s.amountPaid  / collectionTarget) * 100, 100) : 0
              const daysLeft         = Math.max(Math.ceil((new Date(c.target_date).getTime() - Date.now()) / 86400000), 0)
              return (
                <div key={c.id} style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Name & deadline */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{daysLeft} days left · Target: {formatUGX(Number(c.target_amount))}/person</p>
                  </div>
                  {/* Enrollment & collection target */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '8px 10px' }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0, lineHeight: 1 }}>{s.enrolled}</p>
                      <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: '2px 0 0' }}>enrolled</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 1px' }}>Collection target</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{s.enrolled > 0 ? formatUGX(collectionTarget) : '—'}</p>
                    </div>
                  </div>
                  {/* Progress bars */}
                  {s.enrolled > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Saved bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, color: C.secondary }}>Saved</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.black }}>{savedPct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: C.grayLight, borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${savedPct}%`, background: C.blue, borderRadius: 999, transition: 'width 0.4s' }} />
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: C.grayMid, margin: '2px 0 0' }}>{formatUGX(s.amountSaved)} of {formatUGX(collectionTarget)}</p>
                      </div>
                      {/* Paid bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, color: C.secondary }}>Paid</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.black }}>{paidPct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: C.grayLight, borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${paidPct}%`, background: C.green, borderRadius: 999, transition: 'width 0.4s' }} />
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: C.grayMid, margin: '2px 0 0' }}>{formatUGX(s.amountPaid)} of {formatUGX(collectionTarget)}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: 0, fontStyle: 'italic' }}>No customers enrolled yet</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>No campaigns yet</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>Create your first campaign to start enrolling customers.</p>
          <button onClick={() => navigate('/dashboard/campaigns')} style={{ ...btnPrimary, marginTop: 4 }}>+ Create campaign</button>
        </div>
      )}

    </div>
  )
}