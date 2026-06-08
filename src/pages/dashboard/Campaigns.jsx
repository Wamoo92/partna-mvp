import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const WIZARD_STEPS = ['Basic info', 'Target & dates', 'Payment schedule', 'Vouchers & prizes', 'Review & launch']

export default function Campaigns({ admin, business }) {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Step 2
  const [targetAmount, setTargetAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Step 3 — payment schedule
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [scheduleType, setScheduleType] = useState('flexible') // 'flexible' | 'fixed'
  const [fixedPct, setFixedPct] = useState(25) // 25 or 50

  // Step 4
  const [enableVouchers, setEnableVouchers] = useState(false)
  const [enablePrize, setEnablePrize] = useState(false)

  useEffect(() => {
    if (business) loadCampaigns()
  }, [business])

  async function loadCampaigns() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('campaigns').select('*').eq('business_id', business.id)
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

  // Minimum payment for fixed schedule
  function fixedMinDeposit() {
    return Math.round(parsedTarget() * (fixedPct / 100))
  }

  function validateStep(step) {
    setError('')
    if (step === 0 && !name) { setError('Please enter a campaign name.'); return false }
    if (step === 1) {
      if (!targetAmount || parsedTarget() < 1000) { setError('Please enter a valid target amount.'); return false }
      if (!startDate || !endDate) { setError('Please enter start and end dates.'); return false }
      if (new Date(endDate) <= new Date(startDate)) { setError('End date must be after start date.'); return false }
    }
    return true
  }

  function nextStep() {
    if (!validateStep(wizardStep)) return
    setWizardStep(s => s + 1)
  }

  async function handleLaunch() {
    setError('')
    setSaving(true)
    try {
      // Compute minimum deposit based on schedule type
      const minDeposit = enableSchedule && scheduleType === 'fixed'
        ? fixedMinDeposit()
        : 0

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          business_id: business.id,
          name,
          description: description || null,
          target_amount: parsedTarget(),
          target_date: new Date(endDate).toISOString(),
          minimum_deposit: minDeposit,
          allow_partial_payments: enableSchedule,
          // Store schedule type in notes field for now
          minimum_payment: minDeposit,
          payment_discount_percentage: enableSchedule && scheduleType === 'fixed' ? fixedPct : 0,
          status: 'active',
        })
        .select().single()

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
    setEnableSchedule(false); setScheduleType('flexible'); setFixedPct(25)
    setEnableVouchers(false); setEnablePrize(false)
    setError('')
  }

  function daysLeft(campaign) {
    return Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / 86400000), 0)
  }

  // Toggle switch component
  function Toggle({ checked, onChange }) {
    return (
      <button
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0"
        style={{ width: '44px', height: '24px' }}>
        <div className="absolute inset-0 rounded-full transition-all"
          style={{ background: checked ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
        <div className="absolute top-1 rounded-full transition-all"
          style={{
            width: '16px', height: '16px', background: '#fff',
            left: checked ? '24px' : '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s ease',
          }} />
      </button>
    )
  }

  // Sub-toggle for Flexible / Fixed
  function ScheduleTypeToggle() {
    return (
      <div className="flex rounded-xl overflow-hidden border"
        style={{ borderColor: 'rgba(27,79,114,0.2)', display: 'inline-flex' }}>
        {['flexible', 'fixed'].map(type => (
          <button key={type} onClick={() => setScheduleType(type)}
            className="px-4 py-2 text-xs font-semibold capitalize"
            style={{
              background: scheduleType === type ? PARTNA_PRIMARY : '#fff',
              color: scheduleType === type ? '#fff' : 'rgba(0,0,0,0.5)',
              borderRight: type === 'flexible' ? '1px solid rgba(27,79,114,0.2)' : 'none',
            }}>
            {type}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
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
            Create your first campaign to start enrolling customers
          </div>
          <button onClick={() => { resetWizard(); setShowWizard(true) }}
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
            Create campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {campaigns.map(c => {
            const scheduleLabel = !c.allow_partial_payments
              ? 'Disabled'
              : c.payment_discount_percentage > 0
              ? `Fixed — ${c.payment_discount_percentage}% minimum`
              : 'Flexible'
            return (
              <div key={c.id} className="rounded-2xl p-5" style={{ background: '#fff' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>{c.name}</div>
                    {c.description && (
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{c.description}</div>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: c.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)', color: c.status === 'active' ? '#16A34A' : 'rgba(0,0,0,0.4)' }}>
                    {c.status}
                  </span>
                </div>
                {[
                  { label: 'Target', value: formatUGX(c.target_amount) },
                  { label: 'Deadline', value: new Date(c.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  { label: 'Days remaining', value: daysLeft(c) + ' days' },
                  { label: 'Payment schedule', value: scheduleLabel },
                  { label: 'Min. payment', value: c.minimum_deposit > 0 ? formatUGX(c.minimum_deposit) : 'None' },
                ].map((row, i, arr) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── WIZARD MODAL ── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: '#f0f2f5', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Wizard header */}
            <div className="px-6 py-5" style={{ background: PARTNA_PRIMARY }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">New Campaign</h2>
                <button onClick={() => setShowWizard(false)} className="text-white text-xl" style={{ opacity: 0.7 }}>✕</button>
              </div>
              <div className="flex items-center gap-2">
                {WIZARD_STEPS.map((label, i) => (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i < wizardStep ? PARTNA_GOLD : i === wizardStep ? '#fff' : 'rgba(255,255,255,0.2)',
                          color: i < wizardStep ? PARTNA_PRIMARY : i === wizardStep ? PARTNA_PRIMARY : 'rgba(255,255,255,0.5)',
                        }}>
                        {i < wizardStep ? '✓' : i + 1}
                      </div>
                      <span className="text-xs hidden sm:block"
                        style={{ color: i === wizardStep ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                        {label}
                      </span>
                    </div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">

              {/* Step 0: Basic info */}
              {wizardStep === 0 && (
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
              )}

              {/* Step 1: Target & dates */}
              {wizardStep === 1 && (
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

              {/* Step 2: Payment schedule */}
              {wizardStep === 2 && (
                <>
                  {/* Enable toggle */}
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>
                          Enable payment installments
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Allow customers to make partial payments toward their target
                        </div>
                      </div>
                      <button
                        onClick={() => setEnableSchedule(v => !v)}
                        className="relative flex-shrink-0 ml-4"
                        style={{ width: '44px', height: '24px' }}>
                        <div className="absolute inset-0 rounded-full transition-all"
                          style={{ background: enableSchedule ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                        <div className="absolute top-1 rounded-full"
                          style={{
                            width: '16px', height: '16px', background: '#fff',
                            left: enableSchedule ? '24px' : '4px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                      </button>
                    </div>
                  </div>

                  {/* Schedule type — only shown when enabled */}
                  {enableSchedule && (
                    <>
                      <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                        <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>
                          PAYMENT TYPE
                        </div>

                        {/* Flexible / Fixed toggle */}
                        <div className="flex rounded-xl overflow-hidden mb-4"
                          style={{ border: `1.5px solid rgba(27,79,114,0.2)`, display: 'inline-flex' }}>
                          {['flexible', 'fixed'].map(type => (
                            <button key={type} onClick={() => setScheduleType(type)}
                              className="px-5 py-2.5 text-sm font-semibold capitalize"
                              style={{
                                background: scheduleType === type ? PARTNA_PRIMARY : '#fff',
                                color: scheduleType === type ? '#fff' : 'rgba(0,0,0,0.5)',
                                borderRight: type === 'flexible' ? '1px solid rgba(27,79,114,0.2)' : 'none',
                              }}>
                              {type}
                            </button>
                          ))}
                        </div>

                        {/* Explanation */}
                        {scheduleType === 'flexible' && (
                          <div className="px-4 py-3 rounded-xl text-xs"
                            style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                            <strong>Flexible:</strong> Customers can deposit any amount at any time toward their target. There is no minimum payment per transaction beyond the campaign minimum deposit (if set).
                          </div>
                        )}

                        {scheduleType === 'fixed' && (
                          <div className="flex flex-col gap-3">
                            <div className="px-4 py-3 rounded-xl text-xs"
                              style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
                              <strong>Fixed:</strong> Each payment must be a set percentage of the target amount. Customers cannot pay less than this minimum per transaction.
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                                Minimum payment per transaction
                              </label>
                              <div className="flex gap-3">
                                {[25, 50].map(pct => (
                                  <button key={pct} onClick={() => setFixedPct(pct)}
                                    className="flex-1 py-3 rounded-xl text-sm font-bold flex flex-col items-center gap-1"
                                    style={{
                                      background: fixedPct === pct ? 'rgba(27,79,114,0.06)' : '#f8f9fa',
                                      border: fixedPct === pct ? `2px solid ${PARTNA_PRIMARY}` : '2px solid rgba(0,0,0,0.06)',
                                      color: PARTNA_PRIMARY,
                                    }}>
                                    <span className="text-xl font-black">{pct}%</span>
                                    <span className="text-xs font-normal" style={{ color: 'rgba(0,0,0,0.4)' }}>
                                      of target per payment
                                    </span>
                                    {parsedTarget() > 0 && (
                                      <span className="text-xs font-semibold" style={{ color: fixedPct === pct ? PARTNA_PRIMARY : 'rgba(0,0,0,0.3)' }}>
                                        = {formatUGX(Math.round(parsedTarget() * pct / 100))}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Step 3: Vouchers & prizes */}
              {wizardStep === 3 && (
                <>
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable vouchers</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Add and manage vouchers from Vouchers & Prizes after launch.
                        </div>
                      </div>
                      <button onClick={() => setEnableVouchers(v => !v)}
                        className="relative flex-shrink-0 ml-4"
                        style={{ width: '44px', height: '24px' }}>
                        <div className="absolute inset-0 rounded-full transition-all"
                          style={{ background: enableVouchers ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                        <div className="absolute top-1 rounded-full"
                          style={{ width: '16px', height: '16px', background: '#fff', left: enableVouchers ? '24px' : '4px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable prize draw</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Set up prize draws from Vouchers & Prizes after launch.
                        </div>
                      </div>
                      <button onClick={() => setEnablePrize(v => !v)}
                        className="relative flex-shrink-0 ml-4"
                        style={{ width: '44px', height: '24px' }}>
                        <div className="absolute inset-0 rounded-full transition-all"
                          style={{ background: enablePrize ? PARTNA_PRIMARY : 'rgba(0,0,0,0.15)' }} />
                        <div className="absolute top-1 rounded-full"
                          style={{ width: '16px', height: '16px', background: '#fff', left: enablePrize ? '24px' : '4px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <>
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <div className="text-xs font-bold mb-3" style={{ color: 'rgba(0,0,0,0.35)' }}>CAMPAIGN SUMMARY</div>
                    {[
                      { label: 'Name', value: name },
                      { label: 'Target', value: formatUGX(parsedTarget()) },
                      { label: 'Start date', value: startDate },
                      { label: 'Deadline', value: endDate },
                      { label: 'Payment schedule', value: !enableSchedule ? 'Disabled' : scheduleType === 'flexible' ? 'Flexible' : `Fixed — ${fixedPct}% per payment (${formatUGX(fixedMinDeposit())})` },
                      { label: 'Vouchers', value: enableVouchers ? 'Enabled' : 'Disabled' },
                      { label: 'Prize draw', value: enablePrize ? 'Enabled' : 'Disabled' },
                    ].map((row, i, arr) => (
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
                  <button onClick={() => setWizardStep(s => s - 1)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#fff', color: PARTNA_PRIMARY, border: '1.5px solid rgba(27,79,114,0.2)' }}>
                    Back
                  </button>
                )}
                {wizardStep < WIZARD_STEPS.length - 1 ? (
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