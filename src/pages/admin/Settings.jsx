import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const PACKAGE_DEFAULTS = {
  starter:    { monthly: 49,  annual: 470,  features: ['1 active campaign', 'Up to 100 customers', '3 vouchers per campaign', 'No prizes'] },
  growth:     { monthly: 149, annual: 1430, features: ['3 active campaigns', 'Up to 500 customers', '8 vouchers per campaign', 'Item & discount prizes'] },
  enterprise: { monthly: 399, annual: 3830, features: ['Unlimited campaigns', 'Unlimited customers', 'All vouchers', 'All prize types incl. cash'] },
}
const PACKAGE_ACCENT = { starter: '#EF8354', growth: '#85A0C5', enterprise: '#59886D' }
const SMS_KEYS = [
  { key: 'sms_deposit',              label: 'Deposit receipt'      },
  { key: 'sms_withdrawal_pending',   label: 'Withdrawal pending'   },
  { key: 'sms_withdrawal_completed', label: 'Withdrawal completed' },
  { key: 'sms_payment',              label: 'Fee payment receipt'  },
]
const SMS_VARIABLES = ['{first_name}', '{amount}', '{campaign}', '{reference}', '{balance}', '{business}']
const TABS      = ['fees', 'packages', 'sms', 'email', 'announcement']
const TAB_LABELS = { fees: 'Fees', packages: 'Packages', sms: 'SMS Templates', email: 'Email', announcement: 'Announcement' }

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

const btnPrimary = { padding: '10px 20px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6, letterSpacing: '-0.3px' }

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px', letterSpacing: '-0.4px' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{subtitle}</p>}
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  )
}

function Flash({ show, msg = 'Saved.' }) {
  if (!show) return null
  return <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green }}>{msg}</div>
}

export default function AdminSettings() {
  const [loading, setLoading]     = useState(true)
  const [settings, setSettings]   = useState({})
  const [packages, setPackages]   = useState(PACKAGE_DEFAULTS)
  const [activeTab, setActiveTab] = useState('fees')

  const [savingFee, setSavingFee]                       = useState(false)
  const [feeSuccess, setFeeSuccess]                     = useState(false)
  const [savingAnnouncement, setSavingAnnouncement]     = useState(false)
  const [announcementSuccess, setAnnouncementSuccess]   = useState(false)
  const [savingSMS, setSavingSMS]                       = useState({})
  const [smsSuccess, setSmsSuccess]                     = useState({})
  const [savingEmail, setSavingEmail]                   = useState(false)
  const [emailSuccess, setEmailSuccess]                 = useState(false)
  const [savingPackage, setSavingPackage]               = useState({})
  const [packageSuccess, setPackageSuccess]             = useState({})

  useEffect(() => { loadSettings() }, [])

  // ── Business logic — unchanged ────────────────────────────────────────

  async function loadSettings() {
    setLoading(true)
    try {
      const { data } = await supabase.from('platform_settings').select('key, value')
      if (data) { const map = {}; data.forEach(r => { map[r.key] = r.value }); setSettings(map) }
      const { data: pkgData } = await supabase.from('subscription_packages').select('*')
      if (pkgData?.length > 0) {
        const pkgMap = { ...PACKAGE_DEFAULTS }
        pkgData.forEach(p => { const name = p.name?.toLowerCase(); if (pkgMap[name]) pkgMap[name] = { ...pkgMap[name], monthly: p.monthly_price || pkgMap[name].monthly, annual: p.annual_price || pkgMap[name].annual } })
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
    const gross = 100000; const fee = Math.round(gross * pct / 100)
    return { gross, fee, net: gross - fee }
  }
  const preview = feePreview()

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: activeTab === tab ? C.black : 'transparent', color: activeTab === tab ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── FEES ── */}
      {activeTab === 'fees' && (
        <SectionCard title="Transaction fee" subtitle="Applied to all deposits across the platform">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
            <div>
              <label style={labelStyle}>Fee percentage</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" step="0.1" min="0" max="100" style={{ ...inputStyle, flex: 1 }}
                  value={settings.transaction_fee_percentage || ''}
                  onChange={e => setSetting('transaction_fee_percentage', e.target.value)}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                />
                <span style={{ fontSize: 18, fontWeight: 600, color: C.black }}>%</span>
              </div>
            </div>

            {/* Preview */}
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: C.black, padding: '8px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee preview</p>
              </div>
              {[
                { label: 'On a deposit of',       value: 'UGX 100,000',                           color: C.black  },
                { label: 'Fee collected',          value: `UGX ${preview.fee.toLocaleString()}`,   color: C.orange },
                { label: 'Net to customer wallet', value: `UGX ${preview.net.toLocaleString()}`,   color: C.green  },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>

            <Flash show={feeSuccess} msg="Fee updated successfully." />

            <button onClick={handleSaveFee} disabled={savingFee} style={{ ...btnPrimary, opacity: savingFee ? 0.75 : 1, cursor: savingFee ? 'not-allowed' : 'pointer' }}>
              {savingFee ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save fee'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── PACKAGES ── */}
      {activeTab === 'packages' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {Object.entries(packages).map(([name, pkg]) => (
            <div key={name} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 3, background: PACKAGE_ACCENT[name] }} />
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, textTransform: 'capitalize' }}>{name} plan</p>
              </div>
              <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Monthly ($)</label>
                    <input type="number" style={inputStyle} value={pkg.monthly}
                      onChange={e => setPackages(prev => ({ ...prev, [name]: { ...prev[name], monthly: e.target.value } }))}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Annual ($)</label>
                    <input type="number" style={inputStyle} value={pkg.annual}
                      onChange={e => setPackages(prev => ({ ...prev, [name]: { ...prev[name], annual: e.target.value } }))}
                      onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                    />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Features</p>
                  {pkg.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Flash show={packageSuccess[name]} />
                <button onClick={() => handleSavePackage(name)} disabled={savingPackage[name]}
                  style={{ ...btnPrimary, width: '100%', justifyContent: 'center', marginTop: 'auto', opacity: savingPackage[name] ? 0.75 : 1 }}>
                  {savingPackage[name] ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save pricing'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SMS TEMPLATES ── */}
      {activeTab === 'sms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Variables info */}
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 6px' }}>Available variables:</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SMS_VARIABLES.map(v => (
                <code key={v} style={{ padding: '2px 8px', background: C.labelBg, borderRadius: 5, fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.black }}>
                  {v}
                </code>
              ))}
            </div>
          </div>

          {SMS_KEYS.map(({ key, label }) => (
            <SectionCard key={key} title={label}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea style={{ ...inputStyle, resize: 'none' }} rows={3}
                  value={settings[key] || ''} onChange={e => setSetting(key, e.target.value)}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>{settings[key]?.length || 0} characters</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {smsSuccess[key] && <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Saved</span>}
                    <button onClick={() => handleSaveSMS(key)} disabled={savingSMS[key]}
                      style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12, opacity: savingSMS[key] ? 0.75 : 1 }}>
                      {savingSMS[key] ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
            {[
              { key: 'email_sender_name', label: 'Sender name',      placeholder: 'Partna'           },
              { key: 'email_reply_to',    label: 'Reply-to address', placeholder: 'support@partna.io' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input type="text" style={inputStyle} value={settings[f.key] || ''} onChange={e => setSetting(f.key, e.target.value)} placeholder={f.placeholder}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                />
              </div>
            ))}

            <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
              Emails are sent from <strong style={{ color: C.black }}>receipts@partna.io</strong> via Resend. Sender name and reply-to can be customised here.
            </div>

            <Flash show={emailSuccess} msg="Email settings updated." />

            <button onClick={handleSaveEmail} disabled={savingEmail} style={{ ...btnPrimary, opacity: savingEmail ? 0.75 : 1 }}>
              {savingEmail ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save email settings'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── ANNOUNCEMENT ── */}
      {activeTab === 'announcement' && (
        <SectionCard title="System announcement" subtitle="Shows a banner at the top of the business portal dashboard when active">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500 }}>

            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>Show announcement</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>Toggle to show or hide the banner across all business portals</p>
              </div>
              {/* Pill toggle */}
              <div
                onClick={() => setSetting('announcement_active', settings.announcement_active === 'true' ? 'false' : 'true')}
                style={{ width: 44, height: 26, borderRadius: 999, background: settings.announcement_active === 'true' ? C.green : C.grayLight, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: settings.announcement_active === 'true' ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: C.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Announcement text</label>
              <textarea style={{ ...inputStyle, resize: 'none' }} rows={3}
                value={settings.announcement_text || ''}
                onChange={e => setSetting('announcement_text', e.target.value)}
                placeholder="e.g. Scheduled maintenance on 15 June from 2:00am–4:00am EAT. The platform will be unavailable during this time."
                onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
              />
            </div>

            {/* Preview */}
            {settings.announcement_text && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preview</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{settings.announcement_text}</span>
                </div>
              </div>
            )}

            <Flash show={announcementSuccess} msg="Announcement updated." />

            <button onClick={handleSaveAnnouncement} disabled={savingAnnouncement} style={{ ...btnPrimary, opacity: savingAnnouncement ? 0.75 : 1 }}>
              {savingAnnouncement ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Save announcement'}
            </button>
          </div>
        </SectionCard>
      )}

    </div>
  )
}