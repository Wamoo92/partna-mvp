import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const PACKAGE_DEFAULTS = {
  starter:    { monthly: 49,  annual: 470,  features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'] },
  growth:     { monthly: 149, annual: 1430, features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'] },
  enterprise: { monthly: 399, annual: 3830, features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
}

const PACKAGE_ACCENT = {
  starter:    'var(--color-yellow)',
  growth:     'var(--color-primary)',
  enterprise: 'var(--color-green)',
}

const SMS_KEYS      = [
  { key: 'sms_deposit',              label: 'Deposit receipt'          },
  { key: 'sms_withdrawal_pending',   label: 'Withdrawal pending'       },
  { key: 'sms_withdrawal_completed', label: 'Withdrawal completed'     },
  { key: 'sms_payment',              label: 'Fee payment receipt'      },
]

const SMS_VARIABLES = ['{first_name}', '{amount}', '{campaign}', '{reference}', '{balance}', '{business}']

const TABS = ['fees', 'packages', 'sms', 'email', 'announcement']
const TAB_LABELS = { fees: 'Fees', packages: 'Packages', sms: 'SMS Templates', email: 'Email', announcement: 'Announcement' }

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-5)' }}>
        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: 'var(--space-5)' }}>{children}</div>
    </div>
  )
}

export default function AdminSettings() {
  const [loading, setLoading]   = useState(true)
  const [settings, setSettings] = useState({})
  const [packages, setPackages] = useState(PACKAGE_DEFAULTS)
  const [activeTab, setActiveTab] = useState('fees')

  const [savingFee, setSavingFee]           = useState(false)
  const [feeSuccess, setFeeSuccess]         = useState(false)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [announcementSuccess, setAnnouncementSuccess] = useState(false)
  const [savingSMS, setSavingSMS]           = useState({})
  const [smsSuccess, setSmsSuccess]         = useState({})
  const [savingEmail, setSavingEmail]       = useState(false)
  const [emailSuccess, setEmailSuccess]     = useState(false)
  const [savingPackage, setSavingPackage]   = useState({})
  const [packageSuccess, setPackageSuccess] = useState({})

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const { data } = await supabase.from('platform_settings').select('key, value')
      if (data) { const map = {}; data.forEach(r => { map[r.key] = r.value }); setSettings(map) }

      const { data: pkgData } = await supabase.from('subscription_packages').select('*')
      if (pkgData?.length > 0) {
        const pkgMap = { ...PACKAGE_DEFAULTS }
        pkgData.forEach(p => {
          const name = p.name?.toLowerCase()
          if (pkgMap[name]) pkgMap[name] = { ...pkgMap[name], monthly: p.monthly_price || pkgMap[name].monthly, annual: p.annual_price || pkgMap[name].annual }
        })
        setPackages(pkgMap)
      }
    } catch (e) { console.error('Settings load error:', e) }
    setLoading(false)
  }

  function setSetting(key, value) { setSettings(prev => ({ ...prev, [key]: value })) }
  async function saveSetting(key, value) { await supabase.from('platform_settings').upsert({ key, value }, { onConflict: 'key' }) }

  async function handleSaveFee() {
    setSavingFee(true)
    await saveSetting('transaction_fee_percentage', settings.transaction_fee_percentage)
    setSavingFee(false); setFeeSuccess(true); setTimeout(() => setFeeSuccess(false), 3000)
  }

  async function handleSaveAnnouncement() {
    setSavingAnnouncement(true)
    await saveSetting('announcement_text', settings.announcement_text)
    await saveSetting('announcement_active', settings.announcement_active)
    setSavingAnnouncement(false); setAnnouncementSuccess(true); setTimeout(() => setAnnouncementSuccess(false), 3000)
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
    setSavingEmail(false); setEmailSuccess(true); setTimeout(() => setEmailSuccess(false), 3000)
  }

  async function handleSavePackage(name) {
    setSavingPackage(prev => ({ ...prev, [name]: true }))
    try {
      await supabase.from('subscription_packages').update({ monthly_price: Number(packages[name].monthly), annual_price: Number(packages[name].annual) }).eq('name', name.charAt(0).toUpperCase() + name.slice(1))
      setPackageSuccess(prev => ({ ...prev, [name]: true }))
      setTimeout(() => setPackageSuccess(prev => ({ ...prev, [name]: false })), 3000)
    } catch (e) { console.error('Package save error:', e) }
    setSavingPackage(prev => ({ ...prev, [name]: false }))
  }

  function feePreview() {
    const pct = Number(settings.transaction_fee_percentage) || 0
    const gross = 100000
    const fee = Math.round(gross * pct / 100)
    return { gross, fee, net: gross - fee }
  }

  const preview = feePreview()

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: 'var(--space-3) var(--space-5)',
            background: activeTab === tab ? 'var(--color-black)' : 'var(--color-white)',
            color: activeTab === tab ? 'var(--color-white)' : 'var(--color-grey)',
            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            cursor: 'pointer', transition: 'all var(--transition-fast)',
          }}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── FEES ── */}
      {activeTab === 'fees' && (
        <SectionCard title="Transaction fee" subtitle="Applied to all deposits across the platform">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 400 }}>
            <div className="input-group">
              <label className="input-label">Fee percentage</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <input type="number" step="0.1" min="0" max="100" className="input" style={{ flex: 1 }}
                  value={settings.transaction_fee_percentage || ''}
                  onChange={e => setSetting('transaction_fee_percentage', e.target.value)} />
                <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-lg)' }}>%</span>
              </div>
            </div>

            {/* Preview */}
            <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-black)', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-white)' }}>
                Fee preview
              </div>
              {[
                { label: 'On a deposit of',      value: 'UGX 100,000',                              color: 'var(--color-black)'   },
                { label: 'Fee collected',         value: `UGX ${preview.fee.toLocaleString()}`,      color: '#8A6700'             },
                { label: 'Net to customer wallet', value: `UGX ${preview.net.toLocaleString()}`,    color: '#2D8B45'             },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none', background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>

            {feeSuccess && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">Fee updated successfully.</div>
              </div>
            )}

            <button onClick={handleSaveFee} disabled={savingFee} className="btn btn-primary btn-lg">
              {savingFee
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                : <><span className="icon-outlined icon-sm">save</span> Save fee</>
              }
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── PACKAGES ── */}
      {activeTab === 'packages' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {Object.entries(packages).map(([name, pkg]) => (
            <div key={name} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 4, background: PACKAGE_ACCENT[name] }} />
              <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-3) var(--space-5)' }}>
                <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)', textTransform: 'capitalize' }}>
                  {name} plan
                </span>
              </div>
              <div style={{ padding: 'var(--space-5)', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="input-group">
                    <label className="input-label">Monthly ($)</label>
                    <input type="number" className="input" value={pkg.monthly}
                      onChange={e => setPackages(prev => ({ ...prev, [name]: { ...prev[name], monthly: e.target.value } }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Annual ($)</label>
                    <input type="number" className="input" value={pkg.annual}
                      onChange={e => setPackages(prev => ({ ...prev, [name]: { ...prev[name], annual: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                    Features
                  </div>
                  {pkg.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <span className="icon-outlined" style={{ fontSize: 13, color: '#2D8B45', flexShrink: 0, marginTop: 1 }}>check</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{f}</span>
                    </div>
                  ))}
                </div>
                {packageSuccess[name] && (
                  <div className="alert alert-success">
                    <span className="icon-outlined alert-icon">check_circle</span>
                    <div className="alert-content">Saved.</div>
                  </div>
                )}
                <button onClick={() => handleSavePackage(name)} disabled={savingPackage[name]} className="btn btn-primary btn-full" style={{ marginTop: 'auto' }}>
                  {savingPackage[name]
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                    : <><span className="icon-outlined icon-sm">save</span> Save pricing</>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SMS TEMPLATES ── */}
      {activeTab === 'sms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="alert alert-info">
            <span className="icon-outlined alert-icon">info</span>
            <div className="alert-content">
              Available variables:{' '}
              {SMS_VARIABLES.map(v => (
                <code key={v} style={{ marginLeft: 4, padding: '1px 6px', background: 'rgba(0,0,0,0.08)', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{v}</code>
              ))}
            </div>
          </div>
          {SMS_KEYS.map(({ key, label }) => (
            <SectionCard key={key} title={label}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <textarea className="input" value={settings[key] || ''} onChange={e => setSetting(key, e.target.value)}
                  rows={3} style={{ resize: 'none', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)' }}>
                    {settings[key]?.length || 0} characters
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {smsSuccess[key] && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: '#2D8B45' }}>Saved</span>
                    )}
                    <button onClick={() => handleSaveSMS(key)} disabled={savingSMS[key]} className="btn btn-sm btn-primary">
                      {savingSMS[key]
                        ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                        : <><span className="icon-outlined icon-xs">save</span> Save</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* ── EMAIL ── */}
      {activeTab === 'email' && (
        <SectionCard title="Email settings" subtitle="Configure the sender details for all platform emails">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 400 }}>
            {[
              { key: 'email_sender_name', label: 'Sender name',        placeholder: 'Partna', icon: 'person'  },
              { key: 'email_reply_to',    label: 'Reply-to address',   placeholder: 'support@partna.io', icon: 'mail' },
            ].map(f => (
              <div key={f.key} className="input-group">
                <label className="input-label">{f.label}</label>
                <div className="input-wrapper">
                  <span className="icon-outlined input-icon-left">{f.icon}</span>
                  <input type="text" className="input" value={settings[f.key] || ''} onChange={e => setSetting(f.key, e.target.value)} placeholder={f.placeholder} />
                </div>
              </div>
            ))}

            <div className="alert alert-info">
              <span className="icon-outlined alert-icon">info</span>
              <div className="alert-content">
                Emails are sent from <strong>receipts@partna.io</strong> via Resend. Sender name and reply-to can be customised here.
              </div>
            </div>

            {emailSuccess && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">Email settings updated.</div>
              </div>
            )}

            <button onClick={handleSaveEmail} disabled={savingEmail} className="btn btn-primary btn-lg">
              {savingEmail
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                : <><span className="icon-outlined icon-sm">save</span> Save email settings</>
              }
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── ANNOUNCEMENT ── */}
      {activeTab === 'announcement' && (
        <SectionCard title="System announcement" subtitle="Shows a banner at the top of the business portal dashboard when active">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 520 }}>

            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'var(--color-bg)', border: 'var(--border)' }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>Show announcement</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>Toggle to show or hide the banner across all business portals</div>
              </div>
              <div
                className="toggle"
                onClick={() => setSetting('announcement_active', settings.announcement_active === 'true' ? 'false' : 'true')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div className="toggle-track" style={{ background: settings.announcement_active === 'true' ? 'var(--color-primary)' : undefined }}>
                  <div className="toggle-thumb" style={{ transform: settings.announcement_active === 'true' ? 'translateX(20px)' : 'none' }} />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Announcement text</label>
              <textarea className="input" value={settings.announcement_text || ''} onChange={e => setSetting('announcement_text', e.target.value)}
                placeholder="e.g. Scheduled maintenance on 15 June from 2:00am–4:00am EAT. The platform will be unavailable during this time."
                rows={3} style={{ resize: 'none' }} />
            </div>

            {/* Preview */}
            {settings.announcement_text && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                  Preview
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', background: 'var(--color-yellow)', border: 'var(--border)' }}>
                  <span className="icon-outlined" style={{ fontSize: 18, flexShrink: 0 }}>campaign</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{settings.announcement_text}</span>
                </div>
              </div>
            )}

            {announcementSuccess && (
              <div className="alert alert-success">
                <span className="icon-outlined alert-icon">check_circle</span>
                <div className="alert-content">Announcement updated.</div>
              </div>
            )}

            <button onClick={handleSaveAnnouncement} disabled={savingAnnouncement} className="btn btn-primary btn-lg">
              {savingAnnouncement
                ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                : <><span className="icon-outlined icon-sm">save</span> Save announcement</>
              }
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  )
}