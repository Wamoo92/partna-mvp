import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { getEffectiveStatus, getDeletionMsRemaining, formatCountdown } from '../../lib/campaignUtils'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const WIZARD_STEPS = ['Basic info', 'Target & dates', 'Payment schedule', 'Vouchers & prizes', 'Review & launch']

function CountdownTimer({ campaign }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    function tick() {
      const ms = getDeletionMsRemaining(campaign)
      setDisplay(formatCountdown(ms))
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [campaign])

  return <span className="font-mono">{display}</span>
}

export default function Campaigns({ admin, business }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(null) // campaign obj
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Restart modal
  const [showRestartModal, setShowRestartModal] = useState(null)
  const [restarting, setRestarting] = useState(false)

  // Step 1 — Education
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Step 1 — Retail
  const [productCode, setProductCode] = useState('')
  const [productLookupResult, setProductLookupResult] = useState(null)
  const [productLookupError, setProductLookupError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  // Step 2
  const [targetAmount, setTargetAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Step 3
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [scheduleType, setScheduleType] = useState('flexible')
  const [fixedPct, setFixedPct] = useState(25)

  // Step 4
  const [enableVouchers, setEnableVouchers] = useState(false)
  const [enablePrize, setEnablePrize] = useState(false)

  const isRetail = business?.sector === 'Retail'

  useEffect(() => {
    if (business) loadCampaigns()
  }, [business])

  // Periodically re-check campaigns so lazy deletion triggers
  useEffect(() => {
    const interval = setInterval(() => {
      if (business) loadCampaigns()
    }, 60000) // re-check every minute
    return () => clearInterval(interval)
  }, [business])

  async function loadCampaigns() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
      setCampaigns(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatAmountInput(val) {
    const digits = val.replace(/\D/g, '')
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function parsedTarget() {
    return parseInt(targetAmount.replace(/,/g, ''), 10) || 0
  }

  function fixedMinDeposit() {
    return Math.round(parsedTarget() * (fixedPct / 100))
  }

  // ── Delete campaign ──
  async function handleDelete() {
    setDeleteError('')
    if (!deletePassword) { setDeleteError('Please enter your password.'); return }
    setDeleting(true)
    try {
      // Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: admin.email,
        password: deletePassword,
      })
      if (signInError) { setDeleteError('Incorrect password. Please try again.'); setDeleting(false); return }

      // Pause campaign and start 48hr countdown
      await supabase.from('campaigns').update({
        status: 'paused',
        deletion_initiated_at: new Date().toISOString(),
      }).eq('id', showDeleteModal.id)

      setShowDeleteModal(null)
      setDeletePassword('')
      await loadCampaigns()
    } catch (e) {
      setDeleteError('Something went wrong. Please try again.')
    }
    setDeleting(false)
  }

  // ── Restart campaign (only within 48hr window) ──
  async function handleRestart() {
    setRestarting(true)
    try {
      await supabase.from('campaigns').update({
        status: 'active',
        deletion_initiated_at: null,
      }).eq('id', showRestartModal.id)

      setShowRestartModal(null)
      await loadCampaigns()
    } catch (e) {
      console.error('Restart error:', e)
    }
    setRestarting(false)
  }

  // ── Lazy deletion: mark as deleted + process refunds ──
  async function processDeletion(campaign) {
    try {
      // Mark campaign as deleted
      await supabase.from('campaigns').update({ status: 'deleted' }).eq('id', campaign.id)

      // Find all customers enrolled in this campaign
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('campaign_id', campaign.id)

      if (customers && customers.length > 0) {
        const customerIds = customers.map(c => c.id)

        // Get wallets with non-zero balances
        const { data: wallets } = await supabase
          .from('wallets')
          .select('*')
          .in('customer_id', customerIds)
          .gt('balance', 0)

        if (wallets && wallets.length > 0) {
          for (const wallet of wallets) {
            const refundAmount = Number(wallet.balance)
            if (refundAmount <= 0) continue

            // Create withdrawal transaction for refund
            await supabase.from('transactions').insert({
              customer_id: wallet.customer_id,
              wallet_id: wallet.id,
              campaign_id: campaign.id,
              type: 'withdrawal',
              amount: refundAmount,
              status: 'pending',
              notes: 'Campaign cancelled — automatic refund to payment source',
            })

            // Zero out wallet balance immediately
            await supabase.from('wallets').update({ balance: 0 }).eq('id', wallet.id)
          }
        }

        // Clear campaign_id from all enrolled customers so they go to SelectCampaign
        await supabase
          .from('customers')
          .update({ campaign_id: null })
          .in('id', customerIds)
      }

      await loadCampaigns()
    } catch (e) {
      console.error('Deletion processing error:', e)
    }
  }

  // Check for campaigns that need lazy deletion on load
  useEffect(() => {
    campaigns.forEach(c => {
      if (getEffectiveStatus(c) === 'deleted' && c.status !== 'deleted') {
        processDeletion(c)
      }
    })
  }, [campaigns])

  // ── Retail product code lookup ──
  async function handleProductCodeLookup(code) {
    const upper = code.toUpperCase()
    setProductCode(upper)
    setProductLookupResult(null)
    setProductLookupError('')
    setName(''); setDescription(''); setTargetAmount(''); setStartDate(''); setEndDate('')
    if (upper.length < 7) return
    setLookingUp(true)
    try {
      const { data } = await supabase
        .from('products').select('*')
        .eq('business_id', business.id)
        .eq('product_code', upper)
        .eq('is_active', true)
        .maybeSingle()
      if (data) {
        setProductLookupResult(data)
        setName(data.name)
        setDescription(data.description || '')
        setTargetAmount(String(data.price).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        const today = new Date()
        setStartDate(today.toISOString().split('T')[0])
        const deadline = new Date(today)
        deadline.setFullYear(deadline.getFullYear() + 1)
        setEndDate(deadline.toISOString().split('T')[0])
      } else {
        setProductLookupError('Product code not found. Check your Products page and try again.')
      }
    } catch (e) {
      setProductLookupError('Could not look up product code. Please try again.')
    }
    setLookingUp(false)
  }

  function validateStep(step) {
    setError('')
    if (step === 0) {
      if (isRetail) {
        if (!productLookupResult) { setError('Please enter a valid product code to continue.'); return false }
      } else {
        if (!name) { setError('Please enter a campaign name.'); return false }
      }
    }
    if (step === 1 && !isRetail) {
      if (!targetAmount || parsedTarget() < 1000) { setError('Please enter a valid target amount.'); return false }
      if (!startDate || !endDate) { setError('Please enter start and end dates.'); return false }
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
    setError('')
    setSaving(true)
    try {
      const minDeposit = enableSchedule && scheduleType === 'fixed' ? fixedMinDeposit() : 0
      const { error: campaignError } = await supabase.from('campaigns').insert({
        business_id: business.id,
        name,
        description: description || null,
        target_amount: parsedTarget(),
        target_date: new Date(endDate).toISOString(),
        minimum_deposit: minDeposit,
        allow_partial_payments: enableSchedule,
        minimum_payment: minDeposit,
        payment_discount_percentage: enableSchedule && scheduleType === 'fixed' ? fixedPct : 0,
        status: 'active',
        product_code: productLookupResult?.product_code || null,
      })
      if (campaignError) throw campaignError
      await loadCampaigns()
      setShowWizard(false)
      resetWizard()
    } catch (e) {
      console.error('Launch error:', e)
      setError('Could not create campaign. Please try again.')
    }
    setSaving(false)
  }

  function resetWizard() {
    setWizardStep(0)
    setName(''); setDescription(''); setTargetAmount('')
    setStartDate(''); setEndDate('')
    setProductCode(''); setProductLookupResult(null); setProductLookupError('')
    setEnableSchedule(false); setScheduleType('flexible'); setFixedPct(25)
    setEnableVouchers(false); setEnablePrize(false)
    setError('')
  }

  function daysLeft(campaign) {
    return Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / 86400000), 0)
  }

  const displaySteps = isRetail
    ? ['Product', 'Payment schedule', 'Vouchers & prizes', 'Review & launch']
    : WIZARD_STEPS

  function displayStep() {
    if (!isRetail) return wizardStep
    if (wizardStep === 0) return 0
    if (wizardStep === 2) return 1
    if (wizardStep === 3) return 2
    if (wizardStep === 4) return 3
    return wizardStep
  }

  // Separate campaigns by effective status
  const activeCampaigns = campaigns.filter(c => getEffectiveStatus(c) === 'active')
  const pausedCampaigns = campaigns.filter(c => getEffectiveStatus(c) === 'paused')
  const deletedCampaigns = campaigns.filter(c => getEffectiveStatus(c) === 'deleted')

  return (
    <div className="flex flex-col gap-6">

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: '#DC2626' }}>Delete campaign</div>
              <button onClick={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            <div className="px-4 py-3 rounded-xl mb-4 text-xs"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              ⚠ Deleting <strong>{showDeleteModal.name}</strong> will pause the campaign immediately
              and start a 48-hour countdown. All enrolled customers will be notified and their funds
              automatically refunded within 2–5 working days. You can cancel this within 48 hours.
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Your account password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              />
            </div>

            {deleteError && (
              <div className="text-xs px-4 py-3 rounded-xl mb-4"
                style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(null); setDeletePassword(''); setDeleteError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting || !deletePassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: deletePassword && !deleting ? '#DC2626' : 'rgba(220,38,38,0.3)',
                  color: '#fff',
                }}>
                {deleting ? 'Verifying...' : 'Confirm deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTART MODAL ── */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Restart campaign</div>
              <button onClick={() => setShowRestartModal(null)}
                className="text-lg" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>
            <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Restart <strong>{showRestartModal.name}</strong>? The campaign will become active again
              and the deletion countdown will be cancelled. Customers will regain access.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRestartModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                Cancel
              </button>
              <button onClick={handleRestart} disabled={restarting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: restarting ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                {restarting ? 'Restarting...' : 'Restart campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ROW ── */}
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {activeCampaigns.length} active · {pausedCampaigns.length} paused · {deletedCampaigns.length} deleted
        </div>
        <button onClick={() => { resetWizard(); setShowWizard(true) }}
          className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
          + New campaign
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>No campaigns yet</div>
          <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {isRetail
              ? 'Add products first, then create a savings campaign for each product'
              : 'Create your first campaign to start enrolling customers'}
          </div>
          <button onClick={() => { resetWizard(); setShowWizard(true) }}
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
            Create campaign
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Active campaigns */}
          {activeCampaigns.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {activeCampaigns.map(c => (
                <CampaignCard
                  key={c.id} campaign={c} status="active"
                  formatUGX={formatUGX} daysLeft={daysLeft}
                  onDelete={() => { setShowDeleteModal(c); setDeletePassword(''); setDeleteError('') }}
                />
              ))}
            </div>
          )}

          {/* Paused campaigns — deletion in progress */}
          {pausedCampaigns.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-3" style={{ color: '#D97706' }}>
                ⏳ DELETION IN PROGRESS
              </div>
              <div className="grid grid-cols-2 gap-4">
                {pausedCampaigns.map(c => (
                  <CampaignCard
                    key={c.id} campaign={c} status="paused"
                    formatUGX={formatUGX} daysLeft={daysLeft}
                    onRestart={() => setShowRestartModal(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Deleted campaigns — read-only history */}
          {deletedCampaigns.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                DELETED CAMPAIGNS
              </div>
              <div className="grid grid-cols-2 gap-4">
                {deletedCampaigns.map(c => (
                  <CampaignCard
                    key={c.id} campaign={c} status="deleted"
                    formatUGX={formatUGX} daysLeft={daysLeft}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WIZARD MODAL ── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: '#f0f2f5', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">New Campaign</h2>
                <button onClick={() => setShowWizard(false)} className="text-white text-xl" style={{ opacity: 0.7 }}>✕</button>
              </div>
              <div className="flex items-center gap-2">
                {displaySteps.map((label, i) => (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i < displayStep() ? PARTNA_GOLD : i === displayStep() ? '#fff' : 'rgba(255,255,255,0.2)',
                          color: i < displayStep() ? PARTNA_PRIMARY : i === displayStep() ? PARTNA_PRIMARY : 'rgba(255,255,255,0.5)',
                        }}>
                        {i < displayStep() ? '✓' : i + 1}
                      </div>
                      <span className="text-xs hidden sm:block"
                        style={{ color: i === displayStep() ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                        {label}
                      </span>
                    </div>
                    {i < displaySteps.length - 1 && (
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">

              {/* Step 0 */}
              {wizardStep === 0 && (
                isRetail ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Product code *</label>
                      <div className="relative">
                        <input type="text" value={productCode}
                          onChange={e => handleProductCodeLookup(e.target.value)}
                          placeholder="e.g. PRD-A1B2C3"
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none uppercase font-mono tracking-wider"
                          style={{
                            background: '#fff',
                            border: productLookupResult ? '1.5px solid #16A34A' : productLookupError ? '1.5px solid #DC2626' : '1.5px solid rgba(27,79,114,0.15)',
                            color: '#333',
                          }} />
                        {lookingUp && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin"
                            style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
                        )}
                        {productLookupResult && !lookingUp && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: '#16A34A' }}>✓</span>
                        )}
                      </div>
                      {productLookupError && <div className="text-xs" style={{ color: '#DC2626' }}>{productLookupError}</div>}
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                        Enter a product code from your Products page. Campaign details will be auto-filled.
                      </div>
                    </div>
                    {productLookupResult && (
                      <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                        <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>AUTO-FILLED FROM PRODUCT</div>
                        {[
                          { label: 'Campaign name', value: name },
                          { label: 'Description', value: description || '—' },
                          { label: 'Target amount', value: formatUGX(parsedTarget()) },
                          { label: 'Start date', value: startDate },
                          { label: 'Deadline', value: endDate + ' (12 months)' },
                        ].map((row, i, arr) => (
                          <div key={i} className="flex justify-between items-center py-1.5"
                            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                            <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                          </div>
                        ))}
                        <div className="mt-3 pt-2 text-xs" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.35)' }}>
                          🔒 These fields are set from the product and cannot be edited.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Campaign name *</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                        Description <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                      </label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                  </>
                )
              )}

              {/* Step 1 — Education only */}
              {wizardStep === 1 && !isRetail && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Target amount (UGX) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                      <input type="text" inputMode="numeric"
                        value={targetAmount} onChange={e => setTargetAmount(formatAmountInput(e.target.value))}
                        className="w-full pl-14 pr-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Start date *</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>Deadline *</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2 — Payment schedule */}
              {wizardStep === 2 && (
                <>
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable payment installments</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>Allow customers to make partial payments</div>
                      </div>
                      <button onClick={() => setEnableSchedule(v => !v)}
                        className="relative flex-shrink-0 ml-4" style={{ width: '44px', height: '24px' }}>
                        <div className="absolute inset-0 rounded-full transition-all"
                          style={{ background: enableSchedule ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                        <div className="absolute top-1 rounded-full"
                          style={{ width: '16px', height: '16px', background: '#fff', left: enableSchedule ? '24px' : '4px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  </div>
                  {enableSchedule && (
                    <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                      <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>PAYMENT TYPE</div>
                      <div className="flex rounded-xl overflow-hidden mb-4"
                        style={{ border: `1.5px solid rgba(27,79,114,0.2)`, display: 'inline-flex' }}>
                        {['flexible', 'fixed'].map(type => (
                          <button key={type} onClick={() => setScheduleType(type)}
                            className="px-5 py-2.5 text-sm font-semibold capitalize"
                            style={{ background: scheduleType === type ? PARTNA_PRIMARY : '#fff', color: scheduleType === type ? '#fff' : 'rgba(0,0,0,0.5)', borderRight: type === 'flexible' ? '1px solid rgba(27,79,114,0.2)' : 'none' }}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {scheduleType === 'flexible' && (
                        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                          <strong>Flexible:</strong> Customers can deposit any amount at any time.
                        </div>
                      )}
                      {scheduleType === 'fixed' && (
                        <div className="flex flex-col gap-3">
                          <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                            <strong>Fixed:</strong> Each payment must be a set percentage of the target.
                          </div>
                          <div className="flex gap-3">
                            {[25, 50].map(pct => (
                              <button key={pct} onClick={() => setFixedPct(pct)}
                                className="flex-1 py-3 rounded-xl flex flex-col items-center gap-1"
                                style={{ background: fixedPct === pct ? 'rgba(27,79,114,0.06)' : '#f8f9fa', border: fixedPct === pct ? `2px solid ${PARTNA_PRIMARY}` : '2px solid rgba(0,0,0,0.06)', color: PARTNA_PRIMARY }}>
                                <span className="text-xl font-black">{pct}%</span>
                                <span className="text-xs font-normal" style={{ color: 'rgba(0,0,0,0.4)' }}>of target per payment</span>
                                {parsedTarget() > 0 && (
                                  <span className="text-xs font-semibold" style={{ color: fixedPct === pct ? PARTNA_PRIMARY : 'rgba(0,0,0,0.3)' }}>
                                    = {formatUGX(Math.round(parsedTarget() * pct / 100))}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Step 3 — Vouchers & prizes */}
              {wizardStep === 3 && (
                <>
                  {[
                    { label: 'Enable vouchers', sub: 'Add and manage vouchers from Vouchers & Prizes after launch.', val: enableVouchers, set: setEnableVouchers },
                    { label: 'Enable prize draw', sub: 'Set up prize draws from Vouchers & Prizes after launch.', val: enablePrize, set: setEnablePrize },
                  ].map((item, i) => (
                    <div key={i} className="rounded-2xl p-4" style={{ background: '#fff' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>{item.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{item.sub}</div>
                        </div>
                        <button onClick={() => item.set(v => !v)}
                          className="relative flex-shrink-0 ml-4" style={{ width: '44px', height: '24px' }}>
                          <div className="absolute inset-0 rounded-full transition-all"
                            style={{ background: item.val ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                          <div className="absolute top-1 rounded-full"
                            style={{ width: '16px', height: '16px', background: '#fff', left: item.val ? '24px' : '4px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Step 4 — Review */}
              {wizardStep === 4 && (
                <>
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>CAMPAIGN SUMMARY</div>
                    {[
                      { label: 'Name', value: name },
                      isRetail ? { label: 'Product code', value: productLookupResult?.product_code } : null,
                      { label: 'Target', value: formatUGX(parsedTarget()) },
                      { label: 'Start date', value: startDate },
                      { label: 'Deadline', value: endDate },
                      { label: 'Payment schedule', value: !enableSchedule ? 'Disabled' : scheduleType === 'flexible' ? 'Flexible' : `Fixed — ${fixedPct}% per payment (${formatUGX(fixedMinDeposit())})` },
                      { label: 'Vouchers', value: enableVouchers ? 'Enabled' : 'Disabled' },
                      { label: 'Prize draw', value: enablePrize ? 'Enabled' : 'Disabled' },
                    ].filter(Boolean).map((row, i, arr) => (
                      <div key={i} className="flex justify-between items-center py-1.5"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                        <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 rounded-xl text-xs"
                    style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#16A34A' }}>
                    ✓ This campaign will launch immediately. Customers can start enrolling right away.
                  </div>
                </>
              )}

              {error && (
                <div className="text-xs px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {wizardStep > 0 && (
                  <button onClick={prevStep}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#fff', color: PARTNA_PRIMARY, border: '1.5px solid rgba(27,79,114,0.2)' }}>
                    Back
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button onClick={nextStep}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
                    Continue
                  </button>
                ) : (
                  <button onClick={handleLaunch} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: saving ? 'rgba(27,79,114,0.3)' : '#16A34A', color: '#fff' }}>
                    {saving ? 'Launching...' : '🚀 Launch campaign'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Campaign card component ──
function CampaignCard({ campaign, status, formatUGX, daysLeft, onDelete, onRestart }) {
  const isDeleted = status === 'deleted'
  const isPaused = status === 'paused'
  const isActive = status === 'active'

  const scheduleLabel = !campaign.allow_partial_payments
    ? 'Disabled'
    : campaign.payment_discount_percentage > 0
    ? `Fixed — ${campaign.payment_discount_percentage}% minimum`
    : 'Flexible'

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: '#fff',
        opacity: isDeleted ? 0.5 : isPaused ? 0.8 : 1,
        filter: isDeleted || isPaused ? 'grayscale(0.3)' : 'none',
        border: isPaused ? '2px solid rgba(217,119,6,0.3)' : isDeleted ? '2px solid rgba(0,0,0,0.08)' : 'none',
      }}>

      {/* Campaign header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold" style={{ color: isDeleted ? 'rgba(0,0,0,0.4)' : '#1B4F72' }}>
            {campaign.name}
          </div>
          {campaign.product_code && (
            <div className="text-xs font-mono mt-0.5" style={{ color: '#D4AF37' }}>
              {campaign.product_code}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: isActive ? 'rgba(22,163,74,0.1)' : isPaused ? 'rgba(217,119,6,0.1)' : 'rgba(0,0,0,0.06)',
            color: isActive ? '#16A34A' : isPaused ? '#D97706' : 'rgba(0,0,0,0.4)',
          }}>
          {isActive ? 'Active' : isPaused ? 'Paused' : 'Deleted'}
        </span>
      </div>

      {/* Paused: countdown */}
      {isPaused && (
        <div className="px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: '#D97706' }}>
            ⏳ Deletion countdown
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: '#D97706' }}>
            <CountdownTimer campaign={campaign} />
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
            dd:hh:mm:ss remaining to cancel
          </div>
        </div>
      )}

      {/* Campaign details */}
      {[
        { label: 'Target', value: formatUGX(campaign.target_amount) },
        { label: 'Deadline', value: new Date(campaign.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
        !isDeleted && !isPaused ? { label: 'Days remaining', value: daysLeft(campaign) + ' days' } : null,
        { label: 'Payment schedule', value: scheduleLabel },
      ].filter(Boolean).map((row, i, arr) => (
        <div key={i} className="flex justify-between items-center py-1"
          style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
          <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
          <span className="text-xs font-semibold" style={{ color: isDeleted ? 'rgba(0,0,0,0.4)' : '#1B4F72' }}>
            {row.value}
          </span>
        </div>
      ))}

      {/* Action buttons */}
      {isActive && onDelete && (
        <button onClick={onDelete}
          className="w-full py-2 rounded-xl text-xs font-semibold mt-1"
          style={{ background: '#FEE2E2', color: '#DC2626' }}>
          Delete campaign
        </button>
      )}
      {isPaused && onRestart && (
        <button onClick={onRestart}
          className="w-full py-2 rounded-xl text-xs font-semibold mt-1"
          style={{ background: 'rgba(27,79,114,0.08)', color: '#1B4F72' }}>
          ↩ Restart campaign
        </button>
      )}
      {isDeleted && (
        <div className="text-xs text-center py-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
          Read only — campaign archived
        </div>
      )}
    </div>
  )
}