import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { getEffectiveStatus, getDeletionMsRemaining, formatCountdown } from '../../lib/campaignUtils'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function daysLeft(campaign) {
  return Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / 86400000), 0)
}

const WIZARD_STEPS      = ['Basic info', 'Target & dates', 'Payment schedule', 'Vouchers & prizes', 'Review & launch']
const WIZARD_STEPS_RETAIL = ['Product',  'Payment schedule', 'Vouchers & prizes', 'Review & launch']

// ── Countdown timer ────────────────────────────────────────────────────────
function CountdownTimer({ campaign }) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    function tick() { setDisplay(formatCountdown(getDeletionMsRemaining(campaign))) }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [campaign])
  return <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)' }}>{display}</span>
}

// ── Campaign card ──────────────────────────────────────────────────────────
function CampaignCard({ campaign, status, onDelete, onRestart }) {
  const isActive  = status === 'active'
  const isPaused  = status === 'paused'
  const isDeleted = status === 'deleted'

  const scheduleLabel = !campaign.allow_partial_payments
    ? 'Disabled'
    : campaign.payment_discount_percentage > 0
    ? `Fixed — ${campaign.payment_discount_percentage}% minimum`
    : 'Flexible'

  return (
    <div style={{
      background: 'var(--color-white)',
      border: isPaused  ? '2px solid var(--color-yellow)' : 'var(--border)',
      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
      padding: 'var(--space-5)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      opacity: isDeleted ? 0.55 : isPaused ? 0.85 : 1,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-base)',
            color: isDeleted ? 'var(--color-grey)' : 'var(--color-black)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {campaign.name}
          </div>
          {campaign.product_code && (
            <div style={{
              fontFamily: 'monospace', fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-black)', color: 'var(--color-primary)',
              marginTop: 3,
            }}>
              {campaign.product_code}
            </div>
          )}
        </div>
        <span className={`badge no-dot ${isActive ? 'badge-success' : isPaused ? 'badge-warning' : 'badge-default'}`}
          style={{ flexShrink: 0 }}>
          {isActive ? 'Active' : isPaused ? 'Paused' : 'Deleted'}
        </span>
      </div>

      {/* Paused countdown */}
      {isPaused && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-yellow)',
          border: 'var(--border)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="icon-outlined" style={{ fontSize: 16 }}>schedule</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
              Deletion countdown
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xl)', letterSpacing: '0.05em', color: 'var(--color-black)' }}>
            <CountdownTimer campaign={campaign} />
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.55)' }}>
            Time remaining to cancel
          </div>
        </div>
      )}

      {/* Detail rows */}
      <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
        {[
          { label: 'Target',           value: formatUGX(campaign.target_amount) },
          { label: 'Deadline',         value: new Date(campaign.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
          ...(isActive ? [{ label: 'Days remaining', value: daysLeft(campaign) + ' days' }] : []),
          { label: 'Payment schedule', value: scheduleLabel },
        ].map((row, i, arr) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
            background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: isDeleted ? 'var(--color-grey)' : 'var(--color-black)' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {isActive && onDelete && (
        <button onClick={onDelete} className="btn btn-sm btn-danger btn-full">
          <span className="icon-outlined icon-xs">delete</span>
          Delete campaign
        </button>
      )}
      {isPaused && onRestart && (
        <button onClick={onRestart} className="btn btn-sm btn-secondary btn-full">
          <span className="icon-outlined icon-xs">restart_alt</span>
          Restart campaign
        </button>
      )}
      {isDeleted && (
        <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
          Archived — read only
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Campaigns({ admin, business }) {
  const [campaigns, setCampaigns]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showWizard, setShowWizard]   = useState(false)
  const [wizardStep, setWizardStep]   = useState(0)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(null)
  const [deletePassword, setDeletePassword]   = useState('')
  const [deleteError, setDeleteError]         = useState('')
  const [deleting, setDeleting]               = useState(false)

  const [showRestartModal, setShowRestartModal] = useState(null)
  const [restarting, setRestarting]             = useState(false)

  // Wizard state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [productCode, setProductCode] = useState('')
  const [productLookupResult, setProductLookupResult] = useState(null)
  const [productLookupError, setProductLookupError]   = useState('')
  const [lookingUp, setLookingUp]     = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [scheduleType, setScheduleType]     = useState('flexible')
  const [fixedPct, setFixedPct]       = useState(25)
  const [enableVouchers, setEnableVouchers] = useState(false)
  const [enablePrize, setEnablePrize] = useState(false)

  const isRetail = business?.sector === 'Retail'

  useEffect(() => { if (business) loadCampaigns() }, [business])
  useEffect(() => {
    const interval = setInterval(() => { if (business) loadCampaigns() }, 60000)
    return () => clearInterval(interval)
  }, [business])
  useEffect(() => {
    campaigns.forEach(c => {
      if (getEffectiveStatus(c) === 'deleted' && c.status !== 'deleted') processDeletion(c)
    })
  }, [campaigns])

  async function loadCampaigns() {
    setLoading(true)
    try {
      const { data } = await supabase.from('campaigns').select('*')
        .eq('business_id', business.id).order('created_at', { ascending: false })
      setCampaigns(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleteError('')
    if (!deletePassword) { setDeleteError('Please enter your password.'); return }
    setDeleting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: admin.email, password: deletePassword })
      if (signInError) { setDeleteError('Incorrect password. Please try again.'); setDeleting(false); return }
      await supabase.from('campaigns').update({ status: 'paused', deletion_initiated_at: new Date().toISOString() }).eq('id', showDeleteModal.id)
      setShowDeleteModal(null); setDeletePassword('')
      await loadCampaigns()
    } catch (e) { setDeleteError('Something went wrong. Please try again.') }
    setDeleting(false)
  }

  async function handleRestart() {
    setRestarting(true)
    try {
      await supabase.from('campaigns').update({ status: 'active', deletion_initiated_at: null }).eq('id', showRestartModal.id)
      setShowRestartModal(null)
      await loadCampaigns()
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
        if (wallets?.length) {
          for (const wallet of wallets) {
            const amt = Number(wallet.balance)
            if (amt <= 0) continue
            await supabase.from('transactions').insert({ customer_id: wallet.customer_id, wallet_id: wallet.id, campaign_id: campaign.id, type: 'withdrawal', amount: amt, status: 'pending', notes: 'Campaign cancelled — automatic refund to payment source' })
            await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
          }
        }
        await supabase.from('customers').update({ campaign_id: null }).in('id', ids)
      }
      await loadCampaigns()
    } catch (e) { console.error('Deletion processing error:', e) }
  }

  async function handleProductCodeLookup(code) {
    const upper = code.toUpperCase()
    setProductCode(upper); setProductLookupResult(null); setProductLookupError('')
    setName(''); setDescription(''); setTargetAmount(''); setStartDate(''); setEndDate('')
    if (upper.length < 7) return
    setLookingUp(true)
    try {
      const { data } = await supabase.from('products').select('*').eq('business_id', business.id).eq('product_code', upper).eq('is_active', true).maybeSingle()
      if (data) {
        setProductLookupResult(data); setName(data.name); setDescription(data.description || '')
        setTargetAmount(String(data.price).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        const today = new Date(); setStartDate(today.toISOString().split('T')[0])
        const dl = new Date(today); dl.setFullYear(dl.getFullYear() + 1); setEndDate(dl.toISOString().split('T')[0])
      } else {
        setProductLookupError('Product code not found. Check your Products page and try again.')
      }
    } catch (e) { setProductLookupError('Could not look up product code. Please try again.') }
    setLookingUp(false)
  }

  function parsedTarget() { return parseInt(targetAmount.replace(/,/g, ''), 10) || 0 }
  function fixedMinDeposit() { return Math.round(parsedTarget() * (fixedPct / 100)) }

  function validateStep(step) {
    setError('')
    if (step === 0) {
      if (isRetail && !productLookupResult) { setError('Please enter a valid product code.'); return false }
      if (!isRetail && !name)               { setError('Please enter a campaign name.'); return false }
    }
    if (step === 1 && !isRetail) {
      if (!targetAmount || parsedTarget() < 1000) { setError('Please enter a valid target amount.'); return false }
      if (!startDate || !endDate)                  { setError('Please enter start and end dates.'); return false }
      if (new Date(endDate) <= new Date(startDate)) { setError('End date must be after start date.'); return false }
    }
    return true
  }

  function nextStep() {
    if (!validateStep(wizardStep)) return
    if (isRetail && wizardStep === 0) { setWizardStep(2); return }
    setWizardStep(s => s + 1)
  }

  function prevStep() {
    if (isRetail && wizardStep === 2) { setWizardStep(0); return }
    setWizardStep(s => s - 1)
  }

  async function handleLaunch() {
    setError(''); setSaving(true)
    try {
      const minDeposit = enableSchedule && scheduleType === 'fixed' ? fixedMinDeposit() : 0
      const { error: campaignError } = await supabase.from('campaigns').insert({
        business_id: business.id, name, description: description || null,
        target_amount: parsedTarget(), target_date: new Date(endDate).toISOString(),
        minimum_deposit: minDeposit, allow_partial_payments: enableSchedule,
        minimum_payment: minDeposit,
        payment_discount_percentage: enableSchedule && scheduleType === 'fixed' ? fixedPct : 0,
        status: 'active', product_code: productLookupResult?.product_code || null,
      })
      if (campaignError) throw campaignError
      await loadCampaigns(); setShowWizard(false); resetWizard()
    } catch (e) { console.error('Launch error:', e); setError('Could not create campaign. Please try again.') }
    setSaving(false)
  }

  function resetWizard() {
    setWizardStep(0); setName(''); setDescription(''); setTargetAmount('')
    setStartDate(''); setEndDate(''); setProductCode(''); setProductLookupResult(null)
    setProductLookupError(''); setEnableSchedule(false); setScheduleType('flexible')
    setFixedPct(25); setEnableVouchers(false); setEnablePrize(false); setError('')
  }

  const displaySteps = isRetail ? WIZARD_STEPS_RETAIL : WIZARD_STEPS
  function displayStep() {
    if (!isRetail) return wizardStep
    if (wizardStep === 0) return 0
    if (wizardStep === 2) return 1
    if (wizardStep === 3) return 2
    if (wizardStep === 4) return 3
    return wizardStep
  }

  const activeCampaigns  = campaigns.filter(c => getEffectiveStatus(c) === 'active')
  const pausedCampaigns  = campaigns.filter(c => getEffectiveStatus(c) === 'paused')
  const deletedCampaigns = campaigns.filter(c => getEffectiveStatus(c) === 'deleted')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ background: '#C0392B' }}>
              <span className="modal-title">Delete campaign</span>
              <button onClick={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">warning</span>
                <div className="alert-content">
                  Deleting <strong>{showDeleteModal.name}</strong> will pause the campaign immediately
                  and start a 48-hour countdown. All enrolled customers will be notified and their funds
                  automatically refunded. You can cancel this within 48 hours.
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Enter your password to confirm</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">lock</span>
                  <input
                    type="password" className="input"
                    value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDelete()}
                    placeholder="Your account password"
                  />
                </div>
              </div>
              {deleteError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{deleteError}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting || !deletePassword} className="btn btn-danger" style={{ flex: 1 }}>
                {deleting
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Verifying…</>
                  : <><span className="icon-outlined icon-sm">delete</span> Confirm deletion</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTART MODAL ── */}
      {showRestartModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Restart campaign</span>
              <button onClick={() => setShowRestartModal(null)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
                Restart <strong style={{ color: 'var(--color-black)' }}>{showRestartModal.name}</strong>?
                The campaign will become active again and the deletion countdown will be cancelled.
                Customers will regain access.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRestartModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleRestart} disabled={restarting} className="btn btn-primary" style={{ flex: 1 }}>
                {restarting
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Restarting…</>
                  : <><span className="icon-outlined icon-sm">restart_alt</span> Restart</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-grey)', textTransform: 'uppercase' }}>
          {activeCampaigns.length} active · {pausedCampaigns.length} paused · {deletedCampaigns.length} deleted
        </div>
        <button onClick={() => { resetWizard(); setShowWizard(true) }} className="btn btn-primary">
          <span className="icon-outlined icon-sm">add</span>
          New campaign
        </button>
      </div>

      {/* ── CAMPAIGN LISTS ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner spinner-lg spinner-purple" />
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>campaign</span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>No campaigns yet</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-5)' }}>
            {isRetail ? 'Add products first, then create a savings campaign for each product.' : 'Create your first campaign to start enrolling customers.'}
          </div>
          <button onClick={() => { resetWizard(); setShowWizard(true) }} className="btn btn-primary btn-lg">
            <span className="icon-outlined icon-sm">add</span>
            Create campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {activeCampaigns.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {activeCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} status="active"
                  onDelete={() => { setShowDeleteModal(c); setDeletePassword(''); setDeleteError('') }} />
              ))}
            </div>
          )}

          {pausedCampaigns.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: '#8A6700', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="icon-outlined" style={{ fontSize: 14 }}>schedule</span>
                Deletion in progress
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {pausedCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} status="paused" onRestart={() => setShowRestartModal(c)} />
                ))}
              </div>
            </div>
          )}

          {deletedCampaigns.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-3)' }}>
                Deleted campaigns
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {deletedCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} status="deleted" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WIZARD MODAL ── */}
      {showWizard && (
        <div className="modal-backdrop">
          <div className="modal modal-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Wizard header */}
            <div style={{
              background: 'var(--color-black)',
              borderBottom: '3px solid var(--color-primary)',
              padding: 'var(--space-5) var(--space-6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-lg)' }}>
                  New Campaign
                </h2>
                <button onClick={() => setShowWizard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <span className="icon-outlined" style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>close</span>
                </button>
              </div>
              {/* Step tracker */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {displaySteps.map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < displaySteps.length - 1 ? 1 : 0 }}>
                    <div style={{
                      width: 24, height: 24,
                      border: i <= displayStep() ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.2)',
                      background: i < displayStep() ? 'var(--color-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
                      color: i < displayStep() ? 'var(--color-black)' : i === displayStep() ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
                    }}>
                      {i < displayStep()
                        ? <span className="icon-outlined" style={{ fontSize: 12 }}>check</span>
                        : i + 1}
                    </div>
                    {i < displaySteps.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: i < displayStep() ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* ── STEP 0 ── */}
              {wizardStep === 0 && (
                isRetail ? (
                  <>
                    <div className="input-group">
                      <label className="input-label">Product code <span className="required">*</span></label>
                      <div className="input-wrapper">
                        <span className="icon-outlined input-icon-left">inventory_2</span>
                        <input type="text" className={`input ${productLookupResult ? 'input-success' : productLookupError ? 'input-error' : ''}`}
                          value={productCode} onChange={e => handleProductCodeLookup(e.target.value)}
                          placeholder="e.g. PRD-A1B2C3"
                          style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                        <div className="input-icon-right" style={{ pointerEvents: 'none' }}>
                          {lookingUp
                            ? <div className="spinner spinner-sm" />
                            : productLookupResult
                            ? <span className="icon-outlined" style={{ fontSize: 20, color: '#2D8B45' }}>check_circle</span>
                            : null
                          }
                        </div>
                      </div>
                      {productLookupError && <span className="input-hint error">{productLookupError}</span>}
                      <span className="input-hint">Enter a product code from your Products page. Campaign details will auto-fill.</span>
                    </div>

                    {productLookupResult && (
                      <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ background: 'var(--color-black)', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)' }}>
                          Auto-filled from product
                        </div>
                        {[
                          { label: 'Campaign name',  value: name },
                          { label: 'Description',    value: description || '—' },
                          { label: 'Target amount',  value: formatUGX(parsedTarget()) },
                          { label: 'Start date',     value: startDate },
                          { label: 'Deadline',       value: endDate + ' (12 months)' },
                        ].map((row, i, arr) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{row.value}</span>
                          </div>
                        ))}
                        <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span className="icon-outlined" style={{ fontSize: 14 }}>lock</span>
                          These fields are set from the product and cannot be edited.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="input-group">
                      <label className="input-label">Campaign name <span className="required">*</span></label>
                      <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Description <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>(optional)</span></label>
                      <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                    </div>
                  </>
                )
              )}

              {/* ── STEP 1 (education: target & dates) ── */}
              {wizardStep === 1 && !isRetail && (
                <>
                  <div className="input-group">
                    <label className="input-label">Target amount (UGX) <span className="required">*</span></label>
                    <div className="input-wrapper">
                      <span style={{ position: 'absolute', left: 'var(--space-4)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1 }}>UGX</span>
                      <input type="text" inputMode="numeric" className="input" value={targetAmount}
                        onChange={e => setTargetAmount(formatAmountInput(e.target.value))}
                        style={{ paddingLeft: 56 }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="input-group">
                      <label className="input-label">Start date <span className="required">*</span></label>
                      <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Deadline <span className="required">*</span></label>
                      <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 2: Payment schedule ── */}
              {wizardStep === 2 && (
                <>
                  <div style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>Enable payment installments</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 3 }}>Allow customers to make partial payments</div>
                    </div>
                    <div className="toggle" onClick={() => setEnableSchedule(v => !v)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div className="toggle-track" style={{ background: enableSchedule ? 'var(--color-primary)' : undefined }}>
                        <div className="toggle-thumb" style={{ transform: enableSchedule ? 'translateX(20px)' : 'none' }} />
                      </div>
                    </div>
                  </div>

                  {enableSchedule && (
                    <div style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)' }}>Payment type</div>
                      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                        {['flexible', 'fixed'].map((type, i) => (
                          <button key={type} onClick={() => setScheduleType(type)} style={{
                            flex: 1, padding: 'var(--space-3)',
                            background: scheduleType === type ? 'var(--color-black)' : 'var(--color-white)',
                            color: scheduleType === type ? 'var(--color-white)' : 'var(--color-grey)',
                            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                            textTransform: 'capitalize', cursor: 'pointer', transition: 'all var(--transition-fast)',
                          }}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {scheduleType === 'flexible' ? (
                        <div className="alert alert-info">
                          <span className="icon-outlined alert-icon">info</span>
                          <div className="alert-content"><strong>Flexible:</strong> Customers can deposit any amount at any time.</div>
                        </div>
                      ) : (
                        <>
                          <div className="alert alert-info">
                            <span className="icon-outlined alert-icon">info</span>
                            <div className="alert-content"><strong>Fixed:</strong> Each payment must be a set percentage of the target.</div>
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            {[25, 50].map(pct => (
                              <button key={pct} onClick={() => setFixedPct(pct)} style={{
                                flex: 1, padding: 'var(--space-4)',
                                background: fixedPct === pct ? 'var(--color-black)' : 'var(--color-white)',
                                border: fixedPct === pct ? '3px solid var(--color-black)' : 'var(--border)',
                                boxShadow: fixedPct === pct ? 'var(--shadow-sm)' : 'none',
                                cursor: 'pointer', textAlign: 'center',
                                transition: 'all var(--transition-base)',
                              }}>
                                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', color: fixedPct === pct ? 'var(--color-white)' : 'var(--color-black)' }}>
                                  {pct}%
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: fixedPct === pct ? 'rgba(255,255,255,0.6)' : 'var(--color-grey)', marginTop: 4 }}>
                                  of target per payment
                                </div>
                                {parsedTarget() > 0 && (
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: fixedPct === pct ? 'var(--color-primary)' : 'var(--color-grey)', marginTop: 4 }}>
                                    = {formatUGX(Math.round(parsedTarget() * pct / 100))}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── STEP 3: Vouchers & prizes ── */}
              {wizardStep === 3 && (
                <>
                  {[
                    { label: 'Enable vouchers',   sub: 'Add and manage vouchers from Vouchers & Prizes after launch.', val: enableVouchers, set: setEnableVouchers },
                    { label: 'Enable prize draw',  sub: 'Set up prize draws from Vouchers & Prizes after launch.',     val: enablePrize,    set: setEnablePrize   },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{item.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 3 }}>{item.sub}</div>
                      </div>
                      <div className="toggle" onClick={() => item.set(v => !v)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div className="toggle-track" style={{ background: item.val ? 'var(--color-primary)' : undefined }}>
                          <div className="toggle-thumb" style={{ transform: item.val ? 'translateX(20px)' : 'none' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── STEP 4: Review ── */}
              {wizardStep === 4 && (
                <>
                  <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--color-black)', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)' }}>
                      Campaign summary
                    </div>
                    {[
                      { label: 'Name', value: name },
                      ...(isRetail ? [{ label: 'Product code', value: productLookupResult?.product_code }] : []),
                      { label: 'Target', value: formatUGX(parsedTarget()) },
                      { label: 'Start date', value: startDate },
                      { label: 'Deadline', value: endDate },
                      { label: 'Payment schedule', value: !enableSchedule ? 'Disabled' : scheduleType === 'flexible' ? 'Flexible' : `Fixed — ${fixedPct}% per payment (${formatUGX(fixedMinDeposit())})` },
                      { label: 'Vouchers', value: enableVouchers ? 'Enabled' : 'Disabled' },
                      { label: 'Prize draw', value: enablePrize ? 'Enabled' : 'Disabled' },
                    ].filter(Boolean).map((row, i, arr) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="alert alert-success">
                    <span className="icon-outlined alert-icon">rocket_launch</span>
                    <div className="alert-content">
                      This campaign will launch immediately. Customers can start enrolling right away.
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{error}</div>
                </div>
              )}
            </div>

            {/* Wizard footer */}
            <div className="modal-footer">
              {wizardStep > 0 && (
                <button onClick={prevStep} className="btn btn-secondary">
                  <span className="icon-outlined icon-sm">arrow_back</span>
                  Back
                </button>
              )}
              {wizardStep < 4 ? (
                <button onClick={nextStep} className="btn btn-primary" style={{ flex: 1 }}>
                  <span className="icon-outlined icon-sm">arrow_forward</span>
                  Continue
                </button>
              ) : (
                <button onClick={handleLaunch} disabled={saving} className="btn btn-success" style={{ flex: 1 }}>
                  {saving
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Launching…</>
                    : <><span className="icon-outlined icon-sm">rocket_launch</span> Launch campaign</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}