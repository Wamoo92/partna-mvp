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
  const [minDeposit, setMinDeposit] = useState('')

  // Step 3
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [installments, setInstallments] = useState([])

  // Step 4 — simplified checkboxes only
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

  function autoSuggestInstallments() {
    if (!startDate || !endDate || !targetAmount) return
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30)))
    const target = parsedTarget()
    const amountPerInstallment = Math.round(target / months)
    const suggested = []
    for (let i = 0; i < months; i++) {
      const dueDate = new Date(start)
      dueDate.setMonth(dueDate.getMonth() + i + 1)
      suggested.push({
        installment_number: i + 1,
        installment_name: `Installment ${i + 1}`,
        due_date: dueDate.toISOString().split('T')[0],
        amount: amountPerInstallment,
        percentage_of_target: Math.round((amountPerInstallment / target) * 100),
      })
    }
    setInstallments(suggested)
  }

  function updateInstallment(i, field, value) {
    const updated = [...installments]
    updated[i] = { ...updated[i], [field]: value }
    setInstallments(updated)
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
    if (wizardStep === 2 && enableSchedule && installments.length === 0) {
      autoSuggestInstallments()
    }
    setWizardStep(s => s + 1)
  }

  async function handleLaunch() {
    setError('')
    setSaving(true)
    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          business_id: business.id,
          name,
          description: description || null,
          target_amount: parsedTarget(),
          target_date: new Date(endDate).toISOString(),
          minimum_deposit: minDeposit ? parseInt(minDeposit.replace(/,/g, ''), 10) : 0,
          allow_partial_payments: enableSchedule,
          minimum_payment: installments[0]?.amount || 0,
          status: 'active',
        })
        .select().single()

      if (campaignError) throw campaignError

      if (enableSchedule && installments.length > 0) {
        await supabase.from('payment_schedules').insert(
          installments.map(inst => ({
            campaign_id: campaignData.id,
            business_id: business.id,
            installment_number: inst.installment_number,
            installment_name: inst.installment_name,
            due_date: new Date(inst.due_date).toISOString(),
            amount: inst.amount,
            percentage_of_target: inst.percentage_of_target,
          }))
        )
      }

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
    setStartDate(''); setEndDate(''); setMinDeposit('')
    setEnableSchedule(false); setInstallments([])
    setEnableVouchers(false); setEnablePrize(false)
    setError('')
  }

  function daysLeft(campaign) {
    return Math.max(Math.ceil((new Date(campaign.target_date).getTime() - Date.now()) / 86400000), 0)
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
          {campaigns.map(c => (
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
                { label: 'Min deposit', value: c.minimum_deposit ? formatUGX(c.minimum_deposit) : 'None' },
                { label: 'Payment schedule', value: c.allow_partial_payments ? 'Enabled' : 'Disabled' },
              ].map((row, i, arr) => (
                <div key={i} className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Campaign Wizard Modal */}
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
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                      Minimum deposit per transaction <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                      <input type="text" inputMode="numeric" value={minDeposit}
                        onChange={e => setMinDeposit(formatAmountInput(e.target.value))}
                        className="w-full pl-14 pr-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }} />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Payment schedule */}
              {wizardStep === 2 && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer rounded-xl px-4 py-3"
                    style={{ background: '#fff' }}>
                    <input type="checkbox" checked={enableSchedule}
                      onChange={e => setEnableSchedule(e.target.checked)} className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable payment installments</div>
                      <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                        Set milestone payment dates for customers
                      </div>
                    </div>
                  </label>

                  {enableSchedule && (
                    <>
                      <button onClick={autoSuggestInstallments}
                        className="text-xs font-semibold px-4 py-2 rounded-lg self-start"
                        style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
                        ✨ Auto-suggest installments
                      </button>

                      {installments.length > 0 && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
                          <div className="px-4 py-2 text-xs font-bold"
                            style={{ color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            INSTALLMENT SCHEDULE
                          </div>
                          {installments.map((inst, i) => (
                            <div key={i} className="grid gap-3 px-4 py-3 items-center"
                              style={{
                                gridTemplateColumns: '1fr 1fr 1fr auto',
                                borderBottom: i < installments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none'
                              }}>
                              <input type="text" value={inst.installment_name}
                                onChange={e => updateInstallment(i, 'installment_name', e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-xs outline-none"
                                style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                              <input type="date" value={inst.due_date}
                                onChange={e => updateInstallment(i, 'due_date', e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-xs outline-none"
                                style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                              <input type="text" value={inst.amount.toLocaleString()}
                                onChange={e => updateInstallment(i, 'amount', parseInt(e.target.value.replace(/,/g, ''), 10) || 0)}
                                className="px-3 py-1.5 rounded-lg text-xs outline-none"
                                style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                              <button onClick={() => setInstallments(installments.filter((_, j) => j !== i))}
                                className="text-xs" style={{ color: '#DC2626' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Step 3: Vouchers & prizes — checkboxes only */}
              {wizardStep === 3 && (
                <>
                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={enableVouchers}
                        onChange={e => setEnableVouchers(e.target.checked)} className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable vouchers</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          You can add and manage vouchers for this campaign from the Vouchers & Prizes section after launch.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="rounded-2xl p-4" style={{ background: '#fff' }}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={enablePrize}
                        onChange={e => setEnablePrize(e.target.checked)} className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>Enable prize draw</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          You can set up and manage prize draws for this campaign from the Vouchers & Prizes section after launch.
                        </div>
                      </div>
                    </label>
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
                      { label: 'Min deposit', value: minDeposit ? formatUGX(parseInt(minDeposit.replace(/,/g, ''), 10)) : 'None' },
                      { label: 'Payment schedule', value: enableSchedule ? `${installments.length} installments` : 'Disabled' },
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