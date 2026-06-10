import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const PACKAGE_DEFAULTS = {
  starter: { monthly: 49, annual: 470, features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'] },
  growth: { monthly: 149, annual: 1430, features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'] },
  enterprise: { monthly: 399, annual: 3830, features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
}

const SMS_KEYS = [
  { key: 'sms_deposit', label: 'Deposit receipt' },
  { key: 'sms_withdrawal_pending', label: 'Withdrawal pending' },
  { key: 'sms_withdrawal_completed', label: 'Withdrawal completed' },
  { key: 'sms_payment', label: 'Fee payment receipt' },
]

const SMS_VARIABLES = ['{first_name}', '{amount}', '{campaign}', '{reference}', '{balance}', '{business}']

function Section({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
        <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>{title}</div>
        {subtitle && <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{subtitle}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({})
  const [packages, setPackages] = useState(PACKAGE_DEFAULTS)
  const [activeTab, setActiveTab] = useState('fees')

  // Save states
  const [savingFee, setSavingFee] = useState(false)
  const [feeSuccess, setFeeSuccess] = useState(false)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [announcementSuccess, setAnnouncementSuccess] = useState(false)
  const [savingSMS, setSavingSMS] = useState({})
  const [smsSuccess, setSmsSuccess] = useState({})
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [savingPackage, setSavingPackage] = useState({})
  const [packageSuccess, setPackageSuccess] = useState({})

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')

      if (data) {
        const map = {}
        data.forEach(row => { map[row.key] = row.value })
        setSettings(map)
      }

      // Load subscription packages
      const { data: pkgData } = await supabase
        .from('subscription_packages')
        .select('*')
      if (pkgData && pkgData.length > 0) {
        const pkgMap = { ...PACKAGE_DEFAULTS }
        pkgData.forEach(p => {
          const name = p.name?.toLowerCase()
          if (pkgMap[name]) {
            pkgMap[name] = {
              ...pkgMap[name],
              monthly: p.monthly_price || pkgMap[name].monthly,
              annual: p.annual_price || pkgMap[name].annual,
            }
          }
        })
        setPackages(pkgMap)
      }
    } catch (e) {
      console.error('Settings load error:', e)
    }
    setLoading(false)
  }

  function setSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  async function saveSetting(key, value) {
    await supabase
      .from('platform_settings')
      .upsert({ key, value }, { onConflict: 'key' })
  }

  async function handleSaveFee() {
    setSavingFee(true)
    await saveSetting('transaction_fee_percentage', settings.transaction_fee_percentage)
    setSavingFee(false)
    setFeeSuccess(true)
    setTimeout(() => setFeeSuccess(false), 3000)
  }

  async function handleSaveAnnouncement() {
    setSavingAnnouncement(true)
    await saveSetting('announcement_text', settings.announcement_text)
    await saveSetting('announcement_active', settings.announcement_active)
    setSavingAnnouncement(false)
    setAnnouncementSuccess(true)
    setTimeout(() => setAnnouncementSuccess(false), 3000)
  }

  async function handleSaveSMS(key) {
    setSavingSMS(prev => ({ ...prev, [key]: true }))
    await saveSetting(key, settings[key])
    setSavingSMS(prev => ({ ...prev, [key]: false }))
    setSmsSuccess(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setSmsSuccess(prev => ({ ...prev, [key]: false })), 3000)
  }

  async function handleSaveEmail() {
    setSavingEmail(true)
    await saveSetting('email_sender_name', settings.email_sender_name)
    await saveSetting('email_reply_to', settings.email_reply_to)
    setSavingEmail(false)
    setEmailSuccess(true)
    setTimeout(() => setEmailSuccess(false), 3000)
  }

  async function handleSavePackage(name) {
    setSavingPackage(prev => ({ ...prev, [name]: true }))
    try {
      await supabase
        .from('subscription_packages')
        .update({
          monthly_price: Number(packages[name].monthly),
          annual_price: Number(packages[name].annual),
        })
        .eq('name', name.charAt(0).toUpperCase() + name.slice(1))
      setPackageSuccess(prev => ({ ...prev, [name]: true }))
      setTimeout(() => setPackageSuccess(prev => ({ ...prev, [name]: false })), 3000)
    } catch (e) {
      console.error('Package save error:', e)
    }
    setSavingPackage(prev => ({ ...prev, [name]: false }))
  }

  function feePreview() {
    const pct = Number(settings.transaction_fee_percentage) || 0
    const gross = 100000
    const fee = Math.round(gross * pct / 100)
    const net = gross - fee
    return { gross, fee, net }
  }

  const preview = feePreview()

  const TABS = ['fees', 'packages', 'sms', 'email', 'announcement']

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Platform Settings</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
          Configure global platform behaviour
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#fff', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-xs font-semibold capitalize"
            style={{
              background: activeTab === tab ? ADMIN_PRIMARY : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(0,0,0,0.4)',
            }}>
            {tab === 'sms' ? 'SMS Templates' : tab === 'email' ? 'Email' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── FEES TAB ── */}
      {activeTab === 'fees' && (
        <Section title="Transaction Fee" subtitle="Applied to all deposits across the platform">
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                Fee percentage (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.transaction_fee_percentage || ''}
                  onChange={e => setSetting('transaction_fee_percentage', e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                />
                <span className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>%</span>
              </div>
            </div>

            {/* Fee preview */}
            <div className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: ADMIN_PRIMARY }}>Fee preview</div>
              {[
                { label: 'On a deposit of', value: 'UGX 100,000' },
                { label: 'Fee', value: `UGX ${preview.fee.toLocaleString()}`, color: ADMIN_GOLD },
                { label: 'Net to customer wallet', value: `UGX ${preview.net.toLocaleString()}`, color: '#16A34A' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                  <span className="text-xs font-semibold" style={{ color: row.color || '#333' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {feeSuccess && (
              <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                ✓ Fee updated successfully
              </div>
            )}

            <button onClick={handleSaveFee} disabled={savingFee}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: savingFee ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
              {savingFee ? 'Saving...' : 'Save fee'}
            </button>
          </div>
        </Section>
      )}

      {/* ── PACKAGES TAB ── */}
      {activeTab === 'packages' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(packages).map(([name, pkg]) => (
              <Section key={name} title={name.charAt(0).toUpperCase() + name.slice(1) + ' Plan'}>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                        Monthly ($)
                      </label>
                      <input
                        type="number"
                        value={pkg.monthly}
                        onChange={e => setPackages(prev => ({
                          ...prev,
                          [name]: { ...prev[name], monthly: e.target.value }
                        }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                        Annual ($)
                      </label>
                      <input
                        type="number"
                        value={pkg.annual}
                        onChange={e => setPackages(prev => ({
                          ...prev,
                          [name]: { ...prev[name], annual: e.target.value }
                        }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      Features
                    </div>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: ADMIN_GOLD }}>✓</span>
                        <span className="text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {packageSuccess[name] && (
                    <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                      style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                      ✓ Saved
                    </div>
                  )}
                  <button onClick={() => handleSavePackage(name)} disabled={savingPackage[name]}
                    className="w-full py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: savingPackage[name] ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
                    {savingPackage[name] ? 'Saving...' : 'Save pricing'}
                  </button>
                </div>
              </Section>
            ))}
          </div>
        </div>
      )}

      {/* ── SMS TEMPLATES TAB ── */}
      {activeTab === 'sms' && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 rounded-xl text-xs"
            style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)', color: ADMIN_PRIMARY }}>
            Available variables: {SMS_VARIABLES.map(v => (
              <code key={v} className="mx-1 px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: 'rgba(27,79,114,0.1)' }}>{v}</code>
            ))}
          </div>
          {SMS_KEYS.map(({ key, label }) => (
            <Section key={key} title={label}>
              <div className="flex flex-col gap-3">
                <textarea
                  value={settings[key] || ''}
                  onChange={e => setSetting(key, e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-xs outline-none resize-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333', fontFamily: 'inherit' }}
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    {settings[key]?.length || 0} characters
                  </div>
                  <div className="flex items-center gap-3">
                    {smsSuccess[key] && (
                      <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>✓ Saved</span>
                    )}
                    <button onClick={() => handleSaveSMS(key)} disabled={savingSMS[key]}
                      className="text-xs font-bold px-4 py-2 rounded-xl"
                      style={{ background: savingSMS[key] ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
                      {savingSMS[key] ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </Section>
          ))}
        </div>
      )}

      {/* ── EMAIL TAB ── */}
      {activeTab === 'email' && (
        <Section title="Email Settings" subtitle="Configure the sender details for all platform emails">
          <div className="flex flex-col gap-4 max-w-sm">
            {[
              { key: 'email_sender_name', label: 'Sender name', placeholder: 'Partna' },
              { key: 'email_reply_to', label: 'Reply-to address', placeholder: 'support@partna.io' },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>{f.label}</label>
                <input
                  type="text"
                  value={settings[f.key] || ''}
                  onChange={e => setSetting(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
                />
              </div>
            ))}

            <div className="px-4 py-3 rounded-xl text-xs"
              style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)', color: ADMIN_PRIMARY }}>
              Emails are sent from <strong>receipts@partna.io</strong> via Resend. The sender name and reply-to can be customised here.
            </div>

            {emailSuccess && (
              <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                ✓ Email settings updated
              </div>
            )}

            <button onClick={handleSaveEmail} disabled={savingEmail}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: savingEmail ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
              {savingEmail ? 'Saving...' : 'Save email settings'}
            </button>
          </div>
        </Section>
      )}

      {/* ── ANNOUNCEMENT TAB ── */}
      {activeTab === 'announcement' && (
        <Section
          title="System Announcement"
          subtitle="Shows a banner at the top of the business portal dashboard when active">
          <div className="flex flex-col gap-4 max-w-lg">

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Show announcement</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Toggle to show or hide the banner across all business portals
                </div>
              </div>
              <button
                onClick={() => setSetting('announcement_active', settings.announcement_active === 'true' ? 'false' : 'true')}
                className="w-12 h-6 rounded-full transition-all flex items-center px-1"
                style={{ background: settings.announcement_active === 'true' ? '#16A34A' : 'rgba(0,0,0,0.15)' }}>
                <div className="w-4 h-4 rounded-full bg-white transition-all"
                  style={{ transform: settings.announcement_active === 'true' ? 'translateX(24px)' : 'translateX(0)' }} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                Announcement text
              </label>
              <textarea
                value={settings.announcement_text || ''}
                onChange={e => setSetting('announcement_text', e.target.value)}
                placeholder="e.g. Scheduled maintenance on 15 June from 2:00am–4:00am EAT. The platform will be unavailable during this time."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
              />
            </div>

            {/* Preview */}
            {settings.announcement_text && (
              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.4)' }}>Preview</div>
                <div className="px-4 py-3 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)', color: '#92400e' }}>
                  📢 {settings.announcement_text}
                </div>
              </div>
            )}

            {announcementSuccess && (
              <div className="text-xs px-3 py-2 rounded-xl font-semibold"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                ✓ Announcement updated
              </div>
            )}

            <button onClick={handleSaveAnnouncement} disabled={savingAnnouncement}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: savingAnnouncement ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
              {savingAnnouncement ? 'Saving...' : 'Save announcement'}
            </button>
          </div>
        </Section>
      )}

    </div>
  )
}