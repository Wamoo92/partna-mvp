import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { getEffectiveStatus, getDeletionMsRemaining, formatCountdown } from '../../lib/campaignUtils'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatUGX(n) { return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 }) }
function formatAmountInput(val) { return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function daysLeft(campaign) { return Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / 86400000), 0) }

const FEE_TYPES = [
  { value: 'tuition',       label: 'Tuition fees'       },
  { value: 'functional',    label: 'Functional fees'    },
  { value: 'building_fund', label: 'Building fund'      },
  { value: 'exam',          label: 'Exam fees'          },
  { value: 'pta',           label: 'PTA contribution'   },
  { value: 'other',         label: 'Other'              },
]
const WIZARD_STEPS_GENERAL = ['Campaign type','Basic info','Target & dates','Payment schedule','Vouchers & prizes','Review & launch']
const WIZARD_STEPS_EDU     = ['Campaign type','Basic info','Target & fees','Payment schedule','Vouchers & prizes','Review & launch']
const WIZARD_STEPS_RETAIL  = ['Product','Payment schedule','Vouchers & prizes','Review & launch']

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  accent:   '#ECEDE1',
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

const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }
const hintStyle  = { fontSize: 11, fontWeight: 500, color: C.grayMid, marginTop: 4 }
const btnPrimary   = { padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnDanger    = { ...btnPrimary, background: C.red,   borderColor: C.red   }
const btnSuccess   = { ...btnPrimary, background: C.green, borderColor: C.green }

function Modal({ title, onClose, footer, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: wide ? 640 : 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, i, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: last ? 'none' : `1px solid ${C.grayLine}`, background: i % 2 === 0 ? C.white : C.bg }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{value}</span>
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 44, height: 26, borderRadius: 999, background: value ? C.green : C.grayLight, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: C.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
    </div>
  )
}

// ── Countdown timer ────────────────────────────────────────────────────────
function CountdownTimer({ campaign }) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    function tick() { setDisplay(formatCountdown(getDeletionMsRemaining(campaign))) }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [campaign])
  return <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{display}</span>
}

// ── Campaign card ──────────────────────────────────────────────────────────
function CampaignCard({ campaign, status, onDelete, onRestart }) {
  const isActive  = status === 'active'
  const isPaused  = status === 'paused'
  const isDeleted = status === 'deleted'
  const isEdu     = campaign.campaign_type === 'education_fees'
  const feeTypeLabel = FEE_TYPES.find(f => f.value === campaign.fee_type)?.label || campaign.fee_type || '—'
  const scheduleLabel = !campaign.allow_partial_payments ? 'Disabled' : campaign.payment_discount_percentage > 0 ? `Fixed — ${campaign.payment_discount_percentage}% minimum` : 'Flexible'

  const statusCfg = isActive ? { bg: C.bgGreen, color: C.green, label: 'Active' } : isPaused ? { bg: C.bgOrange, color: C.orange, label: 'Paused' } : { bg: C.grayLight, color: C.grayMid, label: 'Deleted' }

  return (
    <div style={{ background: C.white, border: `1px solid ${isPaused ? C.orange : C.stroke}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, opacity: isDeleted ? 0.55 : isPaused ? 0.9 : 1, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: isDeleted ? C.secondary : C.black, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px' }}>{campaign.name}</p>
          {isEdu && (
            <p style={{ fontSize: 11, fontWeight: 600, color: C.blue, margin: 0 }}>
              {feeTypeLabel}{campaign.academic_year ? ` · ${campaign.academic_year}` : ''}{campaign.term_or_semester ? ` · ${campaign.term_or_semester}` : ''}
            </p>
          )}
          {campaign.product_code && <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.green, margin: '2px 0 0' }}>{campaign.product_code}</p>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusCfg.color, background: statusCfg.bg, borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>{statusCfg.label}</span>
      </div>

      {/* Countdown */}
      {isPaused && (
        <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.orange }}>Deletion countdown</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: C.orange, margin: '0 0 2px', letterSpacing: '0.04em' }}><CountdownTimer campaign={campaign} /></p>
          <p style={{ fontSize: 11, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.8 }}>Time remaining to cancel</p>
        </div>
      )}

      {/* Detail rows */}
      <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, overflow: 'hidden' }}>
        {[
          { label: 'Target',           value: formatUGX(campaign.target_amount) },
          { label: 'Deadline',         value: new Date(campaign.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
          ...(isActive ? [{ label: 'Days remaining', value: daysLeft(campaign) + ' days' }] : []),
          ...(isEdu && campaign.minimum_payment > 0 ? [{ label: 'Min. payment', value: formatUGX(campaign.minimum_payment) }] : []),
          ...(isEdu && campaign.minimum_registration_amount > 0 ? [{ label: 'Registration threshold', value: formatUGX(campaign.minimum_registration_amount) }] : []),
          ...(!isEdu ? [{ label: 'Payment schedule', value: scheduleLabel }] : []),
        ].map((row, i, arr) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: isDeleted ? C.secondary : C.black }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {isActive && onDelete && (
        <button onClick={onDelete} style={{ ...btnDanger, width: '100%', justifyContent: 'center', padding: '8px' }}>Delete campaign</button>
      )}
      {isPaused && onRestart && (
        <button onClick={onRestart} style={{ ...btnSecondary, width: '100%', justifyContent: 'center', padding: '8px' }}
          onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
          Restart campaign
        </button>
      )}
      {isDeleted && <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: C.grayMid, margin: 0 }}>Archived — read only</p>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Campaigns({ admin, business }) {
  const [campaigns, setCampaigns]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [deletePassword, setDeletePassword]   = useState('')
  const [deleteError, setDeleteError]         = useState('')
  const [deleting, setDeleting]               = useState(false)

  const [showRestartModal, setShowRestartModal] = useState(null)
  const [restarting, setRestarting]             = useState(false)

  const [campaignType, setCampaignType]   = useState('general')
  const [name, setName]                   = useState('')
  const [description, setDescription]     = useState('')
  const [targetAmount, setTargetAmount]   = useState('')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [scheduleType, setScheduleType]   = useState('flexible')
  const [fixedPct, setFixedPct]           = useState(25)
  const [enableVouchers, setEnableVouchers] = useState(false)
  const [enablePrize, setEnablePrize]     = useState(false)

  const [productCode, setProductCode]                 = useState('')
  const [productLookupResult, setProductLookupResult] = useState(null)
  const [productLookupError, setProductLookupError]   = useState('')
  const [lookingUp, setLookingUp]                     = useState(false)

  const [feeType, setFeeType]                                     = useState('tuition')
  const [academicYear, setAcademicYear]                           = useState('')
  const [termOrSemester, setTermOrSemester]                       = useState('')
  const [minimumPayment, setMinimumPayment]                       = useState('')
  const [minimumRegistrationAmount, setMinimumRegistrationAmount] = useState('')

  const isRetail = business?.sector === 'Retail'
  const isEdu    = !isRetail && campaignType === 'education_fees'
  const displaySteps = isRetail ? WIZARD_STEPS_RETAIL : isEdu ? WIZARD_STEPS_EDU : WIZARD_STEPS_GENERAL

  function displayStep() {
    if (isRetail) { if (wizardStep === 0) return 0; if (wizardStep === 2) return 1; if (wizardStep === 3) return 2; if (wizardStep === 4) return 3; return wizardStep }
    return wizardStep
  }

  useEffect(() => { if (business) loadCampaigns() }, [business])
  useEffect(() => { const i = setInterval(() => { if (business) loadCampaigns() }, 60000); return () => clearInterval(i) }, [business])
  useEffect(() => { campaigns.forEach(c => { if (getEffectiveStatus(c) === 'deleted' && c.status !== 'deleted') processDeletion(c) }) }, [campaigns])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadCampaigns() {
    setLoading(true)
    try {
      const { data } = await supabase.from('campaigns').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
      setCampaigns(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleteError(''); if (!deletePassword) { setDeleteError('Please enter your password.'); return }
    setDeleting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: admin.email, password: deletePassword })
      if (signInError) { setDeleteError('Incorrect password. Please try again.'); setDeleting(false); return }
      await supabase.from('campaigns').update({ status: 'paused', deletion_initiated_at: new Date().toISOString() }).eq('id', showDeleteModal.id)
      setShowDeleteModal(null); setDeletePassword(''); await loadCampaigns()
    } catch (e) { setDeleteError('Something went wrong. Please try again.') }
    setDeleting(false)
  }

  async function handleRestart() {
    setRestarting(true)
    try {
      await supabase.from('campaigns').update({ status: 'active', deletion_initiated_at: null }).eq('id', showRestartModal.id)
      setShowRestartModal(null); await loadCampaigns()
    } catch (e) { console.error('Restart error:', e) }
    setRestarting(false)
  }

  async function processDeletion(campaign) {
    try {
      await supabase.from('campaigns').update({ status: 'deleted' }).eq('id', campaign.id)
      const { data: customers } = await supabase.from('customers').select('id').eq('campaign_id', campaign.id)
      if (customers?.length) {
        const ids = customers.map(c => c.id)
        const { data: wallets } = await supabase.from('wallets').select('*').in('customer_id', ids).gt('balance', 0)
        if (wallets?.length) { for (const wallet of wallets) { const amt = Number(wallet.balance); if (amt <= 0) continue; await supabase.from('transactions').insert({ customer_id: wallet.customer_id, wallet_id: wallet.id, campaign_id: campaign.id, type: 'withdrawal', amount: amt, status: 'pending', notes: 'Campaign cancelled — automatic refund to payment source' }); await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id) } }
        await supabase.from('customers').update({ campaign_id: null }).in('id', ids)
      }
      await loadCampaigns()
    } catch (e) { console.error('Deletion processing error:', e) }
  }

  async function handleProductCodeLookup(code) {
    const upper = code.toUpperCase(); setProductCode(upper); setProductLookupResult(null); setProductLookupError('')
    setName(''); setDescription(''); setTargetAmount(''); setStartDate(''); setEndDate('')
    if (upper.length < 7) return; setLookingUp(true)
    try {
      const { data } = await supabase.from('products').select('*').eq('business_id', business.id).eq('product_code', upper).eq('is_active', true).maybeSingle()
      if (data) { setProductLookupResult(data); setName(data.name); setDescription(data.description || ''); setTargetAmount(String(data.price).replace(/\B(?=(\d{3})+(?!\d))/g, ',')); const today = new Date(); setStartDate(today.toISOString().split('T')[0]); const dl = new Date(today); dl.setFullYear(dl.getFullYear() + 1); setEndDate(dl.toISOString().split('T')[0]) }
      else { setProductLookupError('Product code not found. Check your Products page and try again.') }
    } catch (e) { setProductLookupError('Could not look up product code. Please try again.') }
    setLookingUp(false)
  }

  function parsedTarget()    { return parseInt(targetAmount.replace(/,/g, ''), 10) || 0 }
  function parsedMinPay()    { return parseInt(minimumPayment.replace(/,/g, ''), 10) || 0 }
  function parsedMinReg()    { return parseInt(minimumRegistrationAmount.replace(/,/g, ''), 10) || 0 }
  function fixedMinDeposit() { return Math.round(parsedTarget() * (fixedPct / 100)) }

  function validateStep(step) {
    setError('')
    if (isRetail) { if (step === 0 && !productLookupResult) { setError('Please enter a valid product code.'); return false }; return true }
    if (step === 0) return true
    if (step === 1) { if (!name) { setError('Please enter a campaign name.'); return false } }
    if (step === 2) {
      if (!targetAmount || parsedTarget() < 1000) { setError('Please enter a valid target amount (minimum UGX 1,000).'); return false }
      if (!startDate || !endDate)                  { setError('Please enter start and end dates.'); return false }
      if (new Date(endDate) <= new Date(startDate)) { setError('End date must be after start date.'); return false }
      if (isEdu && parsedMinPay() > 0 && parsedMinPay() > parsedTarget()) { setError('Minimum payment cannot exceed the target amount.'); return false }
      if (isEdu && parsedMinReg() > 0 && parsedMinReg() > parsedTarget()) { setError('Registration threshold cannot exceed the target amount.'); return false }
    }
    return true
  }

  function nextStep() { if (!validateStep(wizardStep)) return; if (isRetail && wizardStep === 0) { setWizardStep(2); return }; setWizardStep(s => s + 1) }
  function prevStep() { if (isRetail && wizardStep === 2) { setWizardStep(0); return }; setWizardStep(s => s - 1) }

  const maxStep = isRetail ? 4 : 5

  async function handleLaunch() {
    setError(''); setSaving(true)
    try {
      const minDeposit = enableSchedule && scheduleType === 'fixed' ? fixedMinDeposit() : 0
      const payload = { business_id: business.id, name, description: description || null, target_amount: parsedTarget(), target_date: new Date(endDate).toISOString(), status: 'active', campaign_type: isRetail ? 'general' : campaignType, minimum_deposit: minDeposit, allow_partial_payments: enableSchedule, minimum_payment: isEdu ? parsedMinPay() : minDeposit, payment_discount_percentage: enableSchedule && scheduleType === 'fixed' ? fixedPct : 0, product_code: productLookupResult?.product_code || null, fee_type: isEdu ? feeType : null, academic_year: isEdu && academicYear ? academicYear : null, term_or_semester: isEdu && termOrSemester ? termOrSemester : null, minimum_registration_amount: isEdu ? parsedMinReg() : 0 }
      const { error: campaignError } = await supabase.from('campaigns').insert(payload)
      if (campaignError) throw campaignError
      await loadCampaigns(); setShowWizard(false); resetWizard()
    } catch (e) { console.error('Launch error:', e); setError('Could not create campaign. Please try again.') }
    setSaving(false)
  }

  function resetWizard() {
    setWizardStep(0); setCampaignType('general'); setName(''); setDescription(''); setTargetAmount(''); setStartDate(''); setEndDate('')
    setProductCode(''); setProductLookupResult(null); setProductLookupError(''); setEnableSchedule(false); setScheduleType('flexible'); setFixedPct(25)
    setEnableVouchers(false); setEnablePrize(false); setError('')
    setFeeType('tuition'); setAcademicYear(''); setTermOrSemester(''); setMinimumPayment(''); setMinimumRegistrationAmount('')
  }

  // ─────────────────────────────────────────────────────────────────────────

  const activeCampaigns  = campaigns.filter(c => getEffectiveStatus(c) === 'active')
  const pausedCampaigns  = campaigns.filter(c => getEffectiveStatus(c) === 'paused')
  const deletedCampaigns = campaigns.filter(c => getEffectiveStatus(c) === 'deleted')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <Modal title="Delete campaign" onClose={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }}
          footer={<>
            <button onClick={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting || !deletePassword} style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: deleting || !deletePassword ? 0.5 : 1 }}>
              {deleting ? <><div className="spinner spinner-sm spinner-light" /> Verifying…</> : 'Confirm deletion'}
            </button>
          </>}>
          <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: '140%' }}>
            Deleting <strong style={{ color: C.black }}>{showDeleteModal.name}</strong> will pause the campaign immediately and start a 48-hour countdown. All enrolled customers will be notified and their funds automatically refunded. You can cancel this within 48 hours.
          </div>
          <div>
            <label style={labelStyle}>Enter your password to confirm</label>
            <input type="password" style={inputStyle} value={deletePassword} onChange={e => setDeletePassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDelete()} placeholder="Your account password"
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          </div>
          {deleteError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{deleteError}</div>}
        </Modal>
      )}

      {/* ── RESTART MODAL ── */}
      {showRestartModal && (
        <Modal title="Restart campaign" onClose={() => setShowRestartModal(null)}
          footer={<>
            <button onClick={() => setShowRestartModal(null)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleRestart} disabled={restarting} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: restarting ? 0.75 : 1 }}>
              {restarting ? <><div className="spinner spinner-sm spinner-light" /> Restarting…</> : 'Restart'}
            </button>
          </>}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
            Restart <strong style={{ color: C.black }}>{showRestartModal.name}</strong>? The campaign will become active again and the deletion countdown will be cancelled. Customers will regain access.
          </p>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
          {activeCampaigns.length} active · {pausedCampaigns.length} paused · {deletedCampaigns.length} deleted
        </p>
        <button onClick={() => { resetWizard(); setShowWizard(true) }} style={btnPrimary}>+ New campaign</button>
      </div>

      {/* ── CAMPAIGN LISTS ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
      ) : campaigns.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>No campaigns yet</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>{isRetail ? 'Add products first, then create a savings campaign for each product.' : 'Create your first campaign to start enrolling customers.'}</p>
          <button onClick={() => { resetWizard(); setShowWizard(true) }} style={{ ...btnPrimary, padding: '10px 20px', marginTop: 4 }}>+ Create campaign</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {activeCampaigns.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {activeCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} status="active" onDelete={() => { setShowDeleteModal(c); setDeletePassword(''); setDeleteError('') }} />
              ))}
            </div>
          )}
          {pausedCampaigns.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.orange, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deletion in progress</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {pausedCampaigns.map(c => <CampaignCard key={c.id} campaign={c} status="paused" onRestart={() => setShowRestartModal(c)} />)}
              </div>
            </div>
          )}
          {deletedCampaigns.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deleted campaigns</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {deletedCampaigns.map(c => <CampaignCard key={c.id} campaign={c} status="deleted" />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WIZARD MODAL ── */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(17,17,17,0.14)', overflow: 'hidden' }}>

            {/* Wizard header */}
            <div style={{ background: C.black, padding: '18px 22px 20px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ color: C.white, fontWeight: 600, fontSize: 16, margin: 0, letterSpacing: '-0.4px' }}>New Campaign</p>
                <button onClick={() => setShowWizard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>✕</button>
              </div>
              {/* Step tracker */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {displaySteps.map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < displaySteps.length - 1 ? 1 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `1px solid ${i <= displayStep() ? C.white : 'rgba(255,255,255,0.2)'}`, background: i < displayStep() ? C.white : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: i < displayStep() ? C.black : i === displayStep() ? C.white : 'rgba(255,255,255,0.3)' }}>
                      {i < displayStep() ? '✓' : i + 1}
                    </div>
                    {i < displaySteps.length - 1 && <div style={{ flex: 1, height: 1, background: i < displayStep() ? C.white : 'rgba(255,255,255,0.15)', margin: '0 4px' }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Wizard body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>

              {/* RETAIL STEP 0: Product code */}
              {isRetail && wizardStep === 0 && (
                <>
                  <div>
                    <label style={labelStyle}>Product code *</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.08em', borderColor: productLookupResult ? C.green : productLookupError ? C.red : C.grayLine }}
                        value={productCode} onChange={e => handleProductCodeLookup(e.target.value)} placeholder="e.g. PRD-A1B2C3"
                        onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = productLookupResult ? C.green : productLookupError ? C.red : C.grayLine} />
                      {(lookingUp || productLookupResult) && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          {lookingUp ? <div className="spinner spinner-sm" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                        </div>
                      )}
                    </div>
                    {productLookupError && <p style={{ ...hintStyle, color: C.red }}>{productLookupError}</p>}
                    <p style={hintStyle}>Enter a product code from your Products page. Campaign details will auto-fill.</p>
                  </div>
                  {productLookupResult && (
                    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: C.black }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Auto-filled from product</p>
                      </div>
                      {[{ label: 'Campaign name', value: name }, { label: 'Description', value: description || '—' }, { label: 'Target amount', value: formatUGX(parsedTarget()) }, { label: 'Start date', value: startDate }, { label: 'Deadline', value: endDate + ' (12 months)' }].map((row, i, arr) => (
                        <SummaryRow key={i} label={row.label} value={row.value} i={i} last={i === arr.length - 1} />
                      ))}
                      <div style={{ padding: '7px 14px', background: C.bg, display: 'flex', alignItems: 'center', gap: 7, borderTop: `1px solid ${C.grayLine}` }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>These fields are set from the product and cannot be edited.</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* NON-RETAIL STEP 0: Campaign type */}
              {!isRetail && wizardStep === 0 && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                    Choose the type of campaign you want to create. This determines which fields are available and how payments are processed.
                  </p>
                  {[
                    { value: 'general', label: 'General savings campaign', sub: 'A flexible savings campaign toward any goal. Customers save toward a target amount and deadline. Suitable for any business type.' },
                    { value: 'education_fees', label: 'Education fees campaign', sub: 'A campaign designed for school fee collection. Includes fee type, academic year, minimum payment enforcement, and a registration threshold indicator for parents.' },
                  ].map(opt => {
                    const sel = campaignType === opt.value
                    return (
                      <button key={opt.value} onClick={() => setCampaignType(opt.value)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: sel ? C.black : C.white, border: `1px solid ${sel ? C.black : C.grayLine}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: sel ? C.labelBg : C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel ? C.black : C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            {opt.value === 'general' ? <><path d="M12 22C6 22 2 18 2 12V4l10-2 10 2v8c0 6-4 10-10 10z" /></> : <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>}
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: sel ? C.white : C.black, margin: '0 0 4px' }}>{opt.label}</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: sel ? 'rgba(255,255,255,0.55)' : C.secondary, margin: 0, lineHeight: '140%' }}>{opt.sub}</p>
                        </div>
                        <div style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, borderRadius: '50%', border: `2px solid ${sel ? C.white : C.grayMid}`, background: sel ? C.white : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sel && <div style={{ width: 8, height: 8, background: C.black, borderRadius: '50%' }} />}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {/* NON-RETAIL STEP 1: Basic info */}
              {!isRetail && wizardStep === 1 && (
                <>
                  <div>
                    <label style={labelStyle}>Campaign name *</label>
                    <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder={isEdu ? 'e.g. Term 1 2026 Tuition Fees' : 'e.g. School Fees 2026'}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  <div>
                    <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
                    <textarea style={{ ...inputStyle, resize: 'none' }} rows={3} value={description} onChange={e => setDescription(e.target.value)}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                  </div>
                  {isEdu && (
                    <>
                      <div>
                        <label style={labelStyle}>Fee type *</label>
                        <select style={inputStyle} value={feeType} onChange={e => setFeeType(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
                          {FEE_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                        </select>
                        <p style={hintStyle}>Select the category of fee this campaign collects.</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={labelStyle}>Academic year</label>
                          <input style={inputStyle} type="text" value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2026" maxLength={9}
                            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                        </div>
                        <div>
                          <label style={labelStyle}>Term / semester</label>
                          <input style={inputStyle} type="text" value={termOrSemester} onChange={e => setTermOrSemester(e.target.value)} placeholder="e.g. Term 1"
                            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* NON-RETAIL STEP 2: Target & dates */}
              {!isRetail && wizardStep === 2 && (
                <>
                  <div>
                    <label style={labelStyle}>Target amount (UGX) *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
                      <input style={{ ...inputStyle, paddingLeft: 52 }} type="text" inputMode="numeric" value={targetAmount} onChange={e => setTargetAmount(formatAmountInput(e.target.value))} placeholder={isEdu ? 'Total fee amount e.g. 800,000' : '0'}
                        onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                    </div>
                    {isEdu && <p style={hintStyle}>The total fee amount parents are saving toward.</p>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Start date *</label>
                      <input style={inputStyle} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                    </div>
                    <div>
                      <label style={labelStyle}>Payment deadline *</label>
                      <input style={inputStyle} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                      {isEdu && <p style={hintStyle}>The date fees are due at your school.</p>}
                    </div>
                  </div>
                  {isEdu && (
                    <>
                      <div style={{ height: 1, background: C.grayLine }} />
                      <div>
                        <label style={labelStyle}>Minimum payment per transaction (UGX)</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
                          <input style={{ ...inputStyle, paddingLeft: 52 }} type="text" inputMode="numeric" value={minimumPayment} onChange={e => setMinimumPayment(formatAmountInput(e.target.value))} placeholder="0 — no minimum"
                            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                        </div>
                        <p style={hintStyle}>Partna will block any payment below this amount. Leave at 0 to allow any payment size.</p>
                      </div>
                      <div>
                        <label style={labelStyle}>Registration threshold (UGX) — informational only</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
                          <input style={{ ...inputStyle, paddingLeft: 52 }} type="text" inputMode="numeric" value={minimumRegistrationAmount} onChange={e => setMinimumRegistrationAmount(formatAmountInput(e.target.value))} placeholder="0 — not set"
                            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                        </div>
                        <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', marginTop: 8, fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                          This is the amount your school requires paid before a student can be registered (e.g. 50% of fees). Partna displays this to parents as a progress milestone but does <strong style={{ color: C.black }}>not</strong> block payments below it.
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP 2 (retail) / STEP 3 (non-retail): Payment schedule */}
              {((isRetail && wizardStep === 2) || (!isRetail && wizardStep === 3)) && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>Enable payment installments</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>Allow customers to make partial payments</p>
                    </div>
                    <Toggle value={enableSchedule} onChange={setEnableSchedule} />
                  </div>
                  {enableSchedule && (
                    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment type</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['flexible', 'fixed'].map(type => (
                          <button key={type} onClick={() => setScheduleType(type)} style={{ flex: 1, padding: '9px', background: scheduleType === type ? C.black : C.white, border: `1px solid ${scheduleType === type ? C.black : C.grayLine}`, borderRadius: 8, color: scheduleType === type ? C.white : C.black, fontSize: 13, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {scheduleType === 'flexible' ? (
                        <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
                          <strong style={{ color: C.black }}>Flexible:</strong> Customers can deposit any amount at any time.
                        </div>
                      ) : (
                        <>
                          <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
                            <strong style={{ color: C.black }}>Fixed:</strong> Each payment must be a set percentage of the target.
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            {[25, 50].map(pct => (
                              <button key={pct} onClick={() => setFixedPct(pct)} style={{ flex: 1, padding: '14px', background: fixedPct === pct ? C.black : C.white, border: `1px solid ${fixedPct === pct ? C.black : C.grayLine}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                <p style={{ fontSize: 22, fontWeight: 600, color: fixedPct === pct ? C.white : C.black, margin: '0 0 3px', letterSpacing: '-0.5px' }}>{pct}%</p>
                                <p style={{ fontSize: 12, fontWeight: 500, color: fixedPct === pct ? 'rgba(255,255,255,0.6)' : C.secondary, margin: 0 }}>of target per payment</p>
                                {parsedTarget() > 0 && <p style={{ fontSize: 12, fontWeight: 600, color: fixedPct === pct ? C.green : C.grayMid, margin: '3px 0 0' }}>{formatUGX(Math.round(parsedTarget() * pct / 100))}</p>}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* STEP 3 (retail) / STEP 4 (non-retail): Vouchers & prizes */}
              {((isRetail && wizardStep === 3) || (!isRetail && wizardStep === 4)) && (
                <>
                  {[
                    { label: 'Enable vouchers',  sub: 'Add and manage vouchers from Vouchers & Prizes after launch.', val: enableVouchers, set: setEnableVouchers },
                    { label: 'Enable prize draw', sub: 'Set up prize draws from Vouchers & Prizes after launch.',     val: enablePrize,    set: setEnablePrize   },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{item.label}</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{item.sub}</p>
                      </div>
                      <Toggle value={item.val} onChange={item.set} />
                    </div>
                  ))}
                </>
              )}

              {/* STEP 4 (retail) / STEP 5 (non-retail): Review & launch */}
              {((isRetail && wizardStep === 4) || (!isRetail && wizardStep === 5)) && (
                <>
                  <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: C.black }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campaign summary</p>
                    </div>
                    {[
                      { label: 'Type',    value: isEdu ? 'Education fees' : 'General savings' },
                      { label: 'Name',    value: name },
                      ...(isRetail ? [{ label: 'Product code', value: productLookupResult?.product_code }] : []),
                      ...(isEdu ? [{ label: 'Fee type', value: FEE_TYPES.find(f => f.value === feeType)?.label }] : []),
                      ...(isEdu && academicYear ? [{ label: 'Academic year', value: academicYear }] : []),
                      ...(isEdu && termOrSemester ? [{ label: 'Term / semester', value: termOrSemester }] : []),
                      { label: 'Target',  value: formatUGX(parsedTarget()) },
                      { label: 'Start',   value: startDate },
                      { label: 'Deadline', value: endDate },
                      ...(isEdu && parsedMinPay() > 0 ? [{ label: 'Min. payment', value: formatUGX(parsedMinPay()) }] : []),
                      ...(isEdu && parsedMinReg() > 0 ? [{ label: 'Registration threshold (info only)', value: formatUGX(parsedMinReg()) }] : []),
                      ...(!isEdu ? [{ label: 'Payment schedule', value: !enableSchedule ? 'Disabled' : scheduleType === 'flexible' ? 'Flexible' : `Fixed — ${fixedPct}% (${formatUGX(fixedMinDeposit())})` }] : []),
                      { label: 'Vouchers',  value: enableVouchers ? 'Enabled' : 'Disabled' },
                      { label: 'Prize draw', value: enablePrize ? 'Enabled' : 'Disabled' },
                    ].filter(Boolean).map((row, i, arr) => (
                      <SummaryRow key={i} label={row.label} value={row.value} i={i} last={i === arr.length - 1} />
                    ))}
                  </div>
                  <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>
                    This campaign will launch immediately. Customers can start enrolling right away.
                  </div>
                </>
              )}

              {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{error}</div>}
            </div>

            {/* Wizard footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>
              {wizardStep > 0 && (
                <button onClick={prevStep} style={{ ...btnSecondary, padding: '9px 16px' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accent} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                  ← Back
                </button>
              )}
              {wizardStep < maxStep ? (
                <button onClick={nextStep} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Continue</button>
              ) : (
                <button onClick={handleLaunch} disabled={saving} style={{ ...btnSuccess, flex: 1, justifyContent: 'center', opacity: saving ? 0.75 : 1 }}>
                  {saving ? <><div className="spinner spinner-sm spinner-light" /> Launching…</> : 'Launch campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}