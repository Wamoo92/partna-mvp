import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const PACKAGES     = ['starter', 'growth', 'enterprise']

const UGANDA_BANKS = [
  'ABSA Uganda','Bank Of Africa (Uganda)','Bank of Baroda','Cairo Bank Uganda',
  'Centenary Rural Development Bank LTD (UG)','DFCU Uganda','Diamond Trust Bank Uganda Limited',
  'Ecobank Uganda Limited','Equity Bank Uganda','Exim bank','Finance Trust',
  'Guaranty Trust Bank Uganda (GT Bank)','Housing Finance Bank','I & M Bank Uganda (Orient)',
  'KCB Bank Uganda Limited','NCBA Bank Uganda Limited','Opportunity Bank','Post Bank Uganda',
  'Stanbic Bank Uganda','Standard Chartered Bank Uganda Limited','Tropical Bank Uganda',
  'United Bank for Africa Uganda Limited (UBA)',
]

async function sendAdminEmail({ to, subject, html }) {
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ to, subject, html }),
  })
}

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
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
}
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString()
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

function Badge({ value }) {
  const cfg = {
    verified:      { bg: C.bgGreen,   color: C.green   },
    pending:       { bg: C.bgOrange,  color: C.orange  },
    rejected:      { bg: C.bgRed,     color: C.red     },
    skipped:       { bg: C.grayLight, color: C.grayMid },
    active:        { bg: C.bgGreen,   color: C.green   },
    suspended:     { bg: C.bgRed,     color: C.red     },
    deactivated:   { bg: C.grayLight, color: C.grayMid },
    completed:     { bg: C.bgGreen,   color: C.green   },
    failed:        { bg: C.bgRed,     color: C.red     },
    grace:         { bg: C.bgOrange,  color: C.orange  },
    cancelled:     { bg: C.grayLight, color: C.grayMid },
    not_submitted: { bg: C.grayLight, color: C.grayMid },
  }[value] || { bg: C.grayLight, color: C.grayMid }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {(value || 'unknown').replace(/_/g, ' ')}
    </span>
  )
}

function SectionCard({ title, children, action }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, last, mono, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.grayLine}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: green ? C.green : C.black, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function AdminTable({ cols, rows, emptyMsg }) {
  if (rows.length === 0) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.secondary }}>{emptyMsg}</div>
  )
  return (
    <div style={{ overflowX: 'auto', margin: '-16px -20px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
            {cols.map(c => <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
              {row}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const td = (content, opts = {}) => (
  <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: opts.bold ? 600 : 500, color: opts.color || (opts.secondary ? C.secondary : C.black), whiteSpace: opts.nowrap ? 'nowrap' : 'normal', fontFamily: opts.mono ? 'monospace' : 'inherit', ...opts.style }}>
    {content}
  </td>
)

export default function BusinessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [business, setBusiness]         = useState(null)
  const [admin, setAdmin]               = useState(null)
  const [customers, setCustomers]       = useState([])
  const [campaigns, setCampaigns]       = useState([])
  const [transactions, setTransactions] = useState([])
  const [kybDocs, setKybDocs]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [aum, setAum]                   = useState(0)

  // Bank account state
  const [bankAccount, setBankAccount]       = useState(null)
  const [editingBank, setEditingBank]       = useState(false)
  const [bankForm, setBankForm]             = useState({ bank_name: '', account_name: '', account_number: '', currency: 'UGX', notification_phone: '' })
  const [savingBank, setSavingBank]         = useState(false)
  const [bankError, setBankError]           = useState('')
  const [bankSuccess, setBankSuccess]       = useState('')

  const [newPlan, setNewPlan]           = useState('')
  const [savingPlan, setSavingPlan]     = useState(false)
  const [planSuccess, setPlanSuccess]   = useState(false)

  const [kybAction, setKybAction]       = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [savingKYB, setSavingKYB]       = useState(false)
  const [kybSuccess, setKybSuccess]     = useState('')

  const [statusAction, setStatusAction]   = useState(null)
  const [savingStatus, setSavingStatus]   = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')

  const [subAction, setSubAction]             = useState(null)
  const [subNewPlan, setSubNewPlan]           = useState('')
  const [subBillingCycle, setSubBillingCycle] = useState('monthly')
  const [savingSub, setSavingSub]             = useState(false)
  const [subSuccess, setSubSuccess]           = useState('')
  const [subError, setSubError]               = useState('')

  const [activeTab, setActiveTab] = useState('profile')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: bizData } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle()
      if (!bizData) { setLoading(false); return }
      setBusiness(bizData)
      setNewPlan(bizData.subscription_package || 'growth')
      setSubNewPlan(bizData.subscription_package || 'growth')
      setSubBillingCycle('monthly')

      const { data: adminData } = await supabase.from('business_admins').select('*').eq('business_id', id).eq('role', 'owner').maybeSingle()
      setAdmin(adminData)

      const { data: custData } = await supabase.from('customers').select('*, wallets(balance)').eq('business_id', id).order('created_at', { ascending: false })
      setCustomers(custData || [])
      setAum((custData || []).reduce((s, c) => s + Number(c.wallets?.[0]?.balance || 0), 0))

      const { data: campData } = await supabase.from('campaigns').select('*').eq('business_id', id).order('created_at', { ascending: false })
      setCampaigns(campData || [])

      const custIds = (custData || []).map(c => c.id)
      if (custIds.length > 0) {
        const { data: txnData } = await supabase.from('transactions').select('*, customers(first_name, last_name)').in('customer_id', custIds).order('created_at', { ascending: false }).limit(20)
        setTransactions(txnData || [])
      }

      const { data: files } = await supabase.storage.from('kyb-documents').list(id)
      setKybDocs(files || [])

      // Fetch bank account
      const { data: bankData } = await supabase.from('business_bank_accounts').select('*').eq('business_id', id).maybeSingle()
      setBankAccount(bankData || null)
      if (bankData) {
        setBankForm({
          bank_name:          bankData.bank_name,
          account_name:       bankData.account_name,
          account_number:     bankData.account_number,
          currency:           bankData.currency,
          notification_phone: bankData.notification_phone || '',
        })
      }
    } catch (e) { console.error('BusinessDetail load error:', e) }
    setLoading(false)
  }

  // ── Bank account save (admin can create or update) ─────────────────────
  async function handleSaveBankAccount() {
    setBankError('')
    if (!bankForm.bank_name)             { setBankError('Please select a bank.'); return }
    if (!bankForm.account_name.trim())   { setBankError('Account name is required.'); return }
    if (!bankForm.account_number.trim()) { setBankError('Account number is required.'); return }
    setSavingBank(true)
    try {
      const payload = {
        business_id:        id,
        bank_name:          bankForm.bank_name,
        account_name:       bankForm.account_name.trim(),
        account_number:     bankForm.account_number.trim(),
        currency:           bankForm.currency,
        notification_phone: bankForm.notification_phone.trim() || null,
      }
      const { error } = await supabase
        .from('business_bank_accounts')
        .upsert(payload, { onConflict: 'business_id' })
      if (error) throw error
      await loadAll()
      setEditingBank(false)
      setBankSuccess('Bank account saved.')
      setTimeout(() => setBankSuccess(''), 3000)
    } catch (e) {
      console.error('Save bank account error:', e)
      setBankError('Could not save bank account. Please try again.')
    }
    setSavingBank(false)
  }

  // ── All other handlers — unchanged ────────────────────────────────────

  async function handleKYBAction() {
    if (!kybAction) return
    if (kybAction === 'reject' && !rejectReason.trim()) return
    setSavingKYB(true)
    try {
      const newStatus = kybAction === 'approve' ? 'verified' : 'rejected'
      await supabase.from('businesses').update({ kyb_status: newStatus }).eq('id', id)
      setBusiness(prev => ({ ...prev, kyb_status: newStatus }))
      setKybSuccess(kybAction === 'approve' ? 'KYB approved successfully.' : 'KYB rejected. Business notified.')
      setKybAction(null); setRejectReason('')
    } catch (e) { console.error('KYB action error:', e) }
    setSavingKYB(false)
  }

  async function handlePlanChange() {
    if (!newPlan || newPlan === business.subscription_package) return
    setSavingPlan(true)
    try {
      await supabase.from('businesses').update({ subscription_package: newPlan }).eq('id', id)
      setBusiness(prev => ({ ...prev, subscription_package: newPlan }))
      setPlanSuccess(true); setTimeout(() => setPlanSuccess(false), 3000)
    } catch (e) { console.error('Plan change error:', e) }
    setSavingPlan(false)
  }

  async function handleStatusChange() {
    if (!statusAction) return
    setSavingStatus(true)
    try {
      const newStatus = statusAction === 'reactivate' ? 'active' : statusAction === 'suspend' ? 'suspended' : 'deactivated'
      await supabase.from('businesses').update({ status: newStatus }).eq('id', id)
      setBusiness(prev => ({ ...prev, status: newStatus }))
      setStatusSuccess(`Business ${newStatus} successfully.`)
      setStatusAction(null); setTimeout(() => setStatusSuccess(''), 3000)
    } catch (e) { console.error('Status change error:', e) }
    setSavingStatus(false)
  }

  async function getKybDocUrl(filename) {
    const { data } = await supabase.storage.from('kyb-documents').createSignedUrl(`${id}/${filename}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleMarkPaid() {
    setSavingSub(true); setSubError('')
    try {
      const now       = new Date()
      const newExpiry = addDays(now, subBillingCycle === 'annual' ? 365 : 30)
      const updates   = { subscription_status: 'active', subscription_expires_at: newExpiry, grace_period_ends_at: null, suspension_ends_at: null, trial_ends_at: null }
      await supabase.from('businesses').update(updates).eq('id', id)
      setBusiness(prev => ({ ...prev, ...updates }))
      if (business.admin_email) {
        await sendAdminEmail({ to: business.admin_email, subject: 'Payment confirmed — Partna subscription active', html: `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;"><img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" /><h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Payment confirmed</h2><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">Hi ${admin?.full_name || 'there'}, your Partna subscription for <strong>${business.name}</strong> is now active. Your next billing date is <strong>${formatDateTime(newExpiry)}</strong>.</p><p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a></p></div>` })
      }
      setSubSuccess('Payment marked. Subscription extended and business notified.')
      setSubAction(null)
    } catch (e) { setSubError('Could not mark as paid. Please try again.') }
    setSavingSub(false)
  }

  async function handleUpgradePlan() {
    if (!subNewPlan || subNewPlan === business.subscription_package) { setSubError('Please select a different plan.'); return }
    setSavingSub(true); setSubError('')
    try {
      await supabase.from('businesses').update({ subscription_package: subNewPlan }).eq('id', id)
      setBusiness(prev => ({ ...prev, subscription_package: subNewPlan }))
      if (business.admin_email) {
        await sendAdminEmail({ to: business.admin_email, subject: `Your Partna plan has been updated to ${subNewPlan.charAt(0).toUpperCase() + subNewPlan.slice(1)}`, html: `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;"><img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" /><h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Plan updated</h2><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">Hi ${admin?.full_name || 'there'}, your Partna plan for <strong>${business.name}</strong> has been updated to <strong>${subNewPlan.charAt(0).toUpperCase() + subNewPlan.slice(1)}</strong>.</p><p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a></p></div>` })
      }
      setSubSuccess(`Plan changed to ${subNewPlan}. Business notified.`)
      setSubAction(null)
    } catch (e) { setSubError('Could not update plan. Please try again.') }
    setSavingSub(false)
  }

  async function handleSuspendSubscription() {
    setSavingSub(true); setSubError('')
    try {
      const gracePeriodEnds = addDays(new Date(), 7)
      const updates = { subscription_status: 'grace', grace_period_ends_at: gracePeriodEnds }
      await supabase.from('businesses').update(updates).eq('id', id)
      setBusiness(prev => ({ ...prev, ...updates }))
      if (business.admin_email) {
        await sendAdminEmail({ to: business.admin_email, subject: 'Action required — Partna subscription payment overdue', html: `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;"><img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" /><h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Payment overdue</h2><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">Hi ${admin?.full_name || 'there'}, your Partna subscription for <strong>${business.name}</strong> has an overdue payment. You have a <strong>7-day grace period</strong> until <strong>${formatDateTime(gracePeriodEnds)}</strong> to make payment before your account is suspended.</p><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">Please contact <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a> to arrange payment.</p><p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a></p></div>` })
      }
      setSubSuccess('Grace period started. Business has 7 days to pay before suspension.')
      setSubAction(null)
    } catch (e) { setSubError('Could not update subscription status. Please try again.') }
    setSavingSub(false)
  }

  async function handleCancelSubscription() {
    setSavingSub(true); setSubError('')
    try {
      const updates = { subscription_status: 'cancelled', suspension_ends_at: null, grace_period_ends_at: null }
      await supabase.from('businesses').update(updates).eq('id', id)
      await supabase.from('campaigns').update({ status: 'paused' }).eq('business_id', id).eq('status', 'active')
      setBusiness(prev => ({ ...prev, ...updates }))
      if (business.admin_email) {
        await sendAdminEmail({ to: business.admin_email, subject: 'Your Partna subscription has been cancelled', html: `<div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;"><img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 24px;" /><h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Subscription cancelled</h2><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">Hi ${admin?.full_name || 'there'}, your Partna subscription for <strong>${business.name}</strong> has been cancelled. All active campaigns have been paused. Customer funds are unaffected and withdrawals remain available.</p><p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">To reactivate your account, please contact <a href="mailto:billing@partna.io" style="color: #111; font-weight: 600;">billing@partna.io</a>.</p><p style="font-size: 13px; color: #959687; margin: 0;">Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a></p></div>` })
      }
      setSubSuccess('Subscription cancelled. All active campaigns paused. Business notified.')
      setSubAction(null)
    } catch (e) { setSubError('Could not cancel subscription. Please try again.') }
    setSavingSub(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (!business) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>Business not found</p>
      <button onClick={() => navigate('/admin/businesses')} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        ← Back to businesses
      </button>
    </div>
  )

  const bizStatus     = business.status || 'active'
  const subStatus     = business.subscription_status || 'active'
  const isOnTrial     = business.trial_ends_at && new Date(business.trial_ends_at) > new Date()
  const trialDaysLeft = business.trial_ends_at ? Math.max(0, Math.ceil((new Date(business.trial_ends_at) - new Date()) / 86400000)) : 0
  const TABS          = ['profile', 'kyb', 'subscription', 'campaigns', 'customers', 'transactions']

  const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
  const btnPrimary   = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSecondary = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnDanger    = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnSuccess   = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.green, border: `1px solid ${C.green}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
  const btnOrange    = { padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.white, background: C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/admin/businesses')} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {business.logo_url && !business.logo_url.startsWith('/') ? (
            <img src={business.logo_url} alt={business.name} style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, background: C.bg, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, color: '#F6F7EE', flexShrink: 0 }}>
              {business.name?.[0]}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 5px' }}>{business.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{business.sector}</span>
              <Badge value={business.kyb_status} />
              <Badge value={bizStatus} />
              {isOnTrial && (
                <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, background: 'rgba(133,160,197,0.12)', borderRadius: 6, padding: '3px 8px' }}>
                  Trial — {trialDaysLeft}d left
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {kybSuccess    && <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{kybSuccess}</div>}
      {statusSuccess && <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{statusSuccess}</div>}
      {bankSuccess   && <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{bankSuccess}</div>}

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

      {/* ══════════════ PROFILE ══════════════ */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SectionCard title="Business profile">
            <InfoRow label="Business name"  value={business.name} />
            <InfoRow label="Sector"         value={business.sector} />
            <InfoRow label="Admin email"    value={business.admin_email} />
            <InfoRow label="Business phone" value={business.phone} />
            <InfoRow label="Address"        value={business.address} />
            <InfoRow label="Website"        value={business.website} />
            <InfoRow label="Registered"     value={formatDate(business.created_at)} last />
          </SectionCard>

          <SectionCard title="Admin details">
            <InfoRow label="Full name"  value={admin?.full_name} />
            <InfoRow label="Job title"  value={admin?.job_title} />
            <InfoRow label="Email"      value={admin?.email} />
            <InfoRow label="Phone"      value={admin?.phone} />
            <InfoRow label="Role"       value={admin?.role} last />
          </SectionCard>

          <SectionCard title="Legal & registration">
            <InfoRow label="Registration type"   value={business.registration_type?.replace(/_/g, ' ')} />
            <InfoRow label="Legal name"          value={business.legal_name} />
            <InfoRow label="Registration number" value={business.registration_number} mono />
            <InfoRow label="TIN"                 value={business.tin} mono last />
          </SectionCard>

          <SectionCard title="Branding">
            {[
              { label: 'Primary colour',   color: business.primary_color   },
              { label: 'Secondary colour', color: business.secondary_color },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: row.color, border: `1px solid ${C.grayLine}` }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.black }}>{row.color || '—'}</span>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Platform stats">
            <InfoRow label="Total customers"    value={customers.length} />
            <InfoRow label="Total AUM"          value={formatUGX(aum)} green />
            <InfoRow label="Active campaigns"   value={campaigns.filter(c => c.status === 'active').length} />
            <InfoRow label="Total transactions" value={transactions.length} last />
          </SectionCard>

          {/* ── Bank account card ── */}
          <SectionCard
            title="Linked bank account"
            action={
              !editingBank ? (
                <button
                  onClick={() => {
                    setEditingBank(true)
                    setBankError('')
                    if (!bankAccount) setBankForm({ bank_name: '', account_name: '', account_number: '', currency: 'UGX', notification_phone: '' })
                  }}
                  style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}
                >
                  {bankAccount ? 'Edit' : '+ Link account'}
                </button>
              ) : null
            }
          >
            {editingBank ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 5 }}>Bank *</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={bankForm.bank_name} onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                    <option value="">Select bank</option>
                    {UGANDA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Account name *',    key: 'account_name',       placeholder: 'Name on account',            type: 'text' },
                  { label: 'Account number *',  key: 'account_number',     placeholder: 'Bank account number',        type: 'text' },
                  { label: 'Notification phone', key: 'notification_phone', placeholder: '+256 7XX XXX XXX (optional)', type: 'tel'  },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type} style={inputStyle} placeholder={f.placeholder}
                      value={bankForm[f.key]} onChange={e => setBankForm(p => ({ ...p, [f.key]: e.target.value }))}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.black, marginBottom: 5 }}>Currency</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={bankForm.currency} onChange={e => setBankForm(p => ({ ...p, currency: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                    <option value="UGX">UGX — Ugandan Shilling</option>
                  </select>
                </div>
                {bankError && <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 500, color: C.red }}>{bankError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditingBank(false); setBankError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center', padding: '8px' }}>Cancel</button>
                  <button onClick={handleSaveBankAccount} disabled={savingBank} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '8px', opacity: savingBank ? 0.7 : 1 }}>
                    {savingBank ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save'}
                  </button>
                </div>
              </div>
            ) : bankAccount ? (
              <>
                <InfoRow label="Bank"               value={bankAccount.bank_name} />
                <InfoRow label="Account name"       value={bankAccount.account_name} />
                <InfoRow label="Account number"     value={bankAccount.account_number} mono />
                <InfoRow label="Currency"           value={bankAccount.currency} />
                <InfoRow label="Notification phone" value={bankAccount.notification_phone || '—'} last />
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '0 0 12px' }}>No bank account linked yet.</p>
                <button onClick={() => { setEditingBank(true); setBankError('') }} style={{ ...btnPrimary, fontSize: 12, padding: '7px 14px' }}>+ Link bank account</button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Account actions">
            {statusAction ? (
              <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0 }}>Confirm: {statusAction} this business?</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStatusAction(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
                  <button onClick={handleStatusChange} disabled={savingStatus} style={{ ...(statusAction === 'reactivate' ? btnSuccess : btnDanger), flex: 1, opacity: savingStatus ? 0.75 : 1, cursor: savingStatus ? 'not-allowed' : 'pointer', justifyContent: 'center' }}>
                    {savingStatus ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bizStatus === 'active' && (
                  <button onClick={() => setStatusAction('suspend')} style={{ ...btnDanger, width: '100%', justifyContent: 'center' }}>Suspend business</button>
                )}
                {bizStatus === 'suspended' && (
                  <button onClick={() => setStatusAction('reactivate')} style={{ ...btnSuccess, width: '100%', justifyContent: 'center' }}>Reactivate business</button>
                )}
                {bizStatus !== 'deactivated' && (
                  <button onClick={() => setStatusAction('deactivate')} style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Deactivate business
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ══════════════ KYB ══════════════ */}
      {activeTab === 'kyb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="KYB status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Badge value={business.kyb_status} />
              {business.kyb_status === 'pending' && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Awaiting review</span>}
            </div>
            {business.kyb_status === 'verified' ? (
              <div style={{ background: C.bgGreen, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>This business has been verified.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {kybAction === 'reject' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6 }}>Rejection reason *</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                      placeholder="Explain why the KYB submission is being rejected…"
                      style={{ ...inputStyle, resize: 'vertical' }}
                      onFocus={e => e.target.style.borderColor = C.black}
                      onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                )}
                {kybAction ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setKybAction(null); setRejectReason('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                    <button onClick={handleKYBAction} disabled={savingKYB || (kybAction === 'reject' && !rejectReason.trim())}
                      style={{ ...(kybAction === 'approve' ? btnSuccess : btnDanger), flex: 1, justifyContent: 'center', opacity: (savingKYB || (kybAction === 'reject' && !rejectReason.trim())) ? 0.6 : 1 }}>
                      {savingKYB ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : kybAction === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setKybAction('approve')} style={{ ...btnSuccess, flex: 1, justifyContent: 'center' }}>Approve KYB</button>
                    <button onClick={() => setKybAction('reject')}  style={{ ...btnDanger,  flex: 1, justifyContent: 'center' }}>Reject KYB</button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
          <SectionCard title={`Uploaded documents (${kybDocs.length})`}>
            {kybDocs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary }}>No documents uploaded</div>
            ) : kybDocs.map((doc, i) => (
              <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < kybDocs.length - 1 ? `1px solid ${C.grayLine}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>{doc.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, '')}</span>
                </div>
                <button onClick={() => getKybDocUrl(doc.name)} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>View →</button>
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ══════════════ SUBSCRIPTION ══════════════ */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {subSuccess && <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{subSuccess}</div>}
          {subError   && <div style={{ background: C.bgRed,   border: `1px solid ${C.red}`,   borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.red   }}>{subError}</div>}
          <SectionCard title="Subscription overview">
            {isOnTrial && (
              <div style={{ background: 'rgba(133,160,197,0.12)', border: `1px solid ${C.blue}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.blue, margin: '0 0 2px' }}>Free trial active</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.blue, margin: 0, opacity: 0.85 }}>{trialDaysLeft} days remaining · Ends {formatDateTime(business.trial_ends_at)}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>No billing until trial ends</span>
              </div>
            )}
            {subStatus === 'grace' && (
              <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.orange, margin: '0 0 2px' }}>Grace period active</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.85 }}>Payment overdue. Grace period ends {formatDateTime(business.grace_period_ends_at)}.</p>
              </div>
            )}
            {subStatus === 'cancelled' && (
              <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.red, margin: '0 0 2px' }}>Subscription cancelled</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: 0, opacity: 0.85 }}>All campaigns have been paused.</p>
              </div>
            )}
            <InfoRow label="Plan"                 value={business.subscription_package ? business.subscription_package.charAt(0).toUpperCase() + business.subscription_package.slice(1) : '—'} />
            <InfoRow label="Subscription status"  value={<Badge value={subStatus} />} />
            <InfoRow label="Trial ends"           value={business.trial_ends_at ? formatDateTime(business.trial_ends_at) : 'No trial'} />
            <InfoRow label="Subscription expires" value={formatDateTime(business.subscription_expires_at)} />
            <InfoRow label="Grace period ends"    value={formatDateTime(business.grace_period_ends_at)} />
            <InfoRow label="Customer count"       value={`${customers.length} customers`} last />
          </SectionCard>
          <SectionCard title="Subscription actions">
            {subAction === null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { setSubAction('mark_paid'); setSubError('') }} style={{ ...btnSuccess, width: '100%', justifyContent: 'center' }}>✓ Mark as paid — extend billing period</button>
                <button onClick={() => { setSubAction('upgrade'); setSubError('') }} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>Change plan</button>
                {subStatus !== 'grace' && subStatus !== 'cancelled' && (
                  <button onClick={() => { setSubAction('suspend'); setSubError('') }} style={{ ...btnOrange, width: '100%', justifyContent: 'center' }}>Start grace period — payment overdue</button>
                )}
                {subStatus !== 'cancelled' && (
                  <button onClick={() => { setSubAction('cancel'); setSubError('') }} style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel subscription</button>
                )}
                {subStatus === 'cancelled' && (
                  <button onClick={() => { setSubAction('mark_paid'); setSubError('') }} style={{ ...btnSuccess, width: '100%', justifyContent: 'center' }}>Reactivate — mark payment received</button>
                )}
              </div>
            )}
            {subAction === 'mark_paid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Mark payment received</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>This will set the subscription to active and extend the billing period by the selected cycle.</p>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>Billing cycle paid</label>
                  <select value={subBillingCycle} onChange={e => setSubBillingCycle(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                    <option value="monthly">Monthly — extend by 30 days</option>
                    <option value="annual">Annual — extend by 365 days</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setSubAction(null); setSubError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                  <button onClick={handleMarkPaid} disabled={savingSub} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: savingSub ? 0.7 : 1 }}>
                    {savingSub ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Confirm payment received'}
                  </button>
                </div>
              </div>
            )}
            {subAction === 'upgrade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Change subscription plan</p>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }}>New plan</label>
                  <select value={subNewPlan} onChange={e => setSubNewPlan(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                    <option value="starter">Starter — $49/month</option>
                    <option value="growth">Growth — $149/month</option>
                    <option value="enterprise">Enterprise — $399/month</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setSubAction(null); setSubError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                  <button onClick={handleUpgradePlan} disabled={savingSub || subNewPlan === business.subscription_package} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingSub || subNewPlan === business.subscription_package ? 0.5 : 1 }}>
                    {savingSub ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Confirm plan change'}
                  </button>
                </div>
              </div>
            )}
            {subAction === 'suspend' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Start grace period</p>
                <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
                  This will start a 7-day grace period. The business will be notified by email and must pay within 7 days to avoid account suspension.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setSubAction(null); setSubError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                  <button onClick={handleSuspendSubscription} disabled={savingSub} style={{ ...btnOrange, flex: 1, justifyContent: 'center', opacity: savingSub ? 0.7 : 1 }}>
                    {savingSub ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Start grace period'}
                  </button>
                </div>
              </div>
            )}
            {subAction === 'cancel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Cancel subscription</p>
                <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
                  This will cancel the subscription and pause all active campaigns. The business admin will be notified by email. Customer funds are not affected.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setSubAction(null); setSubError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Keep subscription</button>
                  <button onClick={handleCancelSubscription} disabled={savingSub} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: savingSub ? 0.7 : 1 }}>
                    {savingSub ? <><div className="spinner spinner-sm spinner-light" /> Cancelling…</> : 'Confirm cancellation'}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ══════════════ CAMPAIGNS ══════════════ */}
      {activeTab === 'campaigns' && (
        <SectionCard title={`Campaigns (${campaigns.length})`}>
          <AdminTable cols={['Name', 'Status', 'Target', 'Created']} emptyMsg="No campaigns yet"
            rows={campaigns.map(c => [
              td(<p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0 }}>{c.name}</p>, {}),
              td(<Badge value={c.status} />, {}),
              td(formatUGX(c.target_amount), { bold: true }),
              td(formatDate(c.created_at), { secondary: true, nowrap: true }),
            ])} />
        </SectionCard>
      )}

      {/* ══════════════ CUSTOMERS ══════════════ */}
      {activeTab === 'customers' && (
        <SectionCard title={`Customers (${customers.length})`}>
          <AdminTable cols={['Name', 'Phone', 'Balance', 'KYC', '']} emptyMsg="No customers yet"
            rows={customers.map(c => [
              td(<><p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{c.first_name} {c.last_name}</p><p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{c.email}</p></>, {}),
              td(c.phone, { secondary: true }),
              td(formatUGX(c.wallets?.[0]?.balance || 0), { bold: true, color: C.green }),
              td(<Badge value={c.kyc_status === 'verified' ? 'verified' : 'pending'} />, {}),
              td(<button onClick={() => navigate(`/admin/customers/${c.id}`)} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>View →</button>, {}),
            ])} />
        </SectionCard>
      )}

      {/* ══════════════ TRANSACTIONS ══════════════ */}
      {activeTab === 'transactions' && (
        <SectionCard title={`Recent transactions (${transactions.length})`}>
          <AdminTable cols={['Reference', 'Customer', 'Type', 'Amount', 'Status', 'Date']} emptyMsg="No transactions yet"
            rows={transactions.map(t => [
              td(t.reference || t.id.slice(0, 8), { mono: true, secondary: true }),
              td(`${t.customers?.first_name} ${t.customers?.last_name}`, { bold: true }),
              td(t.type, { secondary: true }),
              td(`${t.type === 'deposit' ? '+' : '-'}${formatUGX(t.amount)}`, { bold: true, color: t.type === 'deposit' ? C.green : C.red }),
              td(<Badge value={t.status} />, {}),
              td(formatDate(t.created_at), { secondary: true, nowrap: true }),
            ])} />
        </SectionCard>
      )}

    </div>
  )
}