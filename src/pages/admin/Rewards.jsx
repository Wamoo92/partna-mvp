import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const EMPTY_MERCHANT = { name: '', category: '', description: '', website: '' }
const TIER_COLORS    = { Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#FFD700', Platinum: '#E5E4E2' }

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
}

const btnPrimary   = { padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnDanger    = { ...btnPrimary, background: C.red, borderColor: C.red }
const btnSuccess   = { ...btnPrimary, background: C.green, borderColor: C.green }
const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle   = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 6, letterSpacing: '-0.3px' }

// ── Form panel ─────────────────────────────────────────────────────────────
function FormPanel({ title, onClose, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.grayLine}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.4px' }}>{title}</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 4, lineHeight: 1, fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

export default function Rewards() {
  const [activeTab, setActiveTab] = useState('merchants')
  const [loading, setLoading]     = useState(true)
  const [success, setSuccess]     = useState('')

  const [merchants, setMerchants]                     = useState([])
  const [showMerchantForm, setShowMerchantForm]       = useState(false)
  const [editingMerchant, setEditingMerchant]         = useState(null)
  const [merchantForm, setMerchantForm]               = useState(EMPTY_MERCHANT)
  const [merchantLogoFile, setMerchantLogoFile]       = useState(null)
  const [merchantLogoPreview, setMerchantLogoPreview] = useState(null)
  const [merchantLogoError, setMerchantLogoError]     = useState('')
  const [savingMerchant, setSavingMerchant]           = useState(false)
  const [merchantError, setMerchantError]             = useState('')

  const [tiers, setTiers]           = useState([])
  const [editingTier, setEditingTier] = useState(null)
  const [tierForm, setTierForm]     = useState({ min_percentage: '', cashback_rate: '' })
  const [savingTier, setSavingTier] = useState(false)
  const [tierError, setTierError]   = useState('')

  useEffect(() => { loadAll() }, [])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadAll() {
    setLoading(true)
    try {
      const { data: mData } = await supabase.from('merchants').select('*').order('name')
      setMerchants(mData || [])
      const { data: tData } = await supabase.from('cashback_tiers').select('*').order('min_percentage')
      setTiers(tData || [])
    } catch (e) { console.error('Rewards load error:', e) }
    setLoading(false)
  }

  function flash(msg) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  function openNewMerchant() { setEditingMerchant(null); setMerchantForm(EMPTY_MERCHANT); setMerchantLogoFile(null); setMerchantLogoPreview(null); setMerchantLogoError(''); setMerchantError(''); setShowMerchantForm(true) }
  function openEditMerchant(m) { setEditingMerchant(m); setMerchantForm({ name: m.name || '', category: m.category || '', description: m.description || '', website: m.website || '' }); setMerchantLogoFile(null); setMerchantLogoPreview(m.logo_url || null); setMerchantLogoError(''); setMerchantError(''); setShowMerchantForm(true) }
  function merchantField(key, value) { setMerchantForm(prev => ({ ...prev, [key]: value })) }

  function handleMerchantLogoSelect(e) {
    const file = e.target.files[0]; if (!file) return; setMerchantLogoError('')
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setMerchantLogoError('Logo must be PNG, JPEG or SVG.'); e.target.value = ''; return }
    if (file.size > 2 * 1024 * 1024) { setMerchantLogoError('Logo must be smaller than 2MB.'); e.target.value = ''; return }
    setMerchantLogoFile(file); const reader = new FileReader(); reader.onload = ev => setMerchantLogoPreview(ev.target.result); reader.readAsDataURL(file)
  }

  async function saveMerchant() {
    if (!merchantForm.name.trim()) { setMerchantError('Merchant name is required.'); return }
    setSavingMerchant(true); setMerchantError('')
    try {
      let logoUrl = editingMerchant?.logo_url || null
      if (merchantLogoFile) {
        const merchantId = editingMerchant?.id || crypto.randomUUID(); const fileExt = merchantLogoFile.name.split('.').pop(); const filePath = `merchants/${merchantId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('business-logos').upload(filePath, merchantLogoFile, { upsert: true })
        if (!uploadError) { const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath); logoUrl = urlData.publicUrl } else { console.error('Merchant logo upload error:', uploadError) }
      }
      const payload = { name: merchantForm.name.trim(), category: merchantForm.category.trim() || null, description: merchantForm.description.trim() || null, website: merchantForm.website.trim() || null, logo_url: logoUrl }
      if (editingMerchant) { await supabase.from('merchants').update(payload).eq('id', editingMerchant.id); flash('Merchant updated.') }
      else { await supabase.from('merchants').insert(payload); flash('Merchant created.') }
      await loadAll(); setShowMerchantForm(false); setEditingMerchant(null); setMerchantLogoFile(null); setMerchantLogoPreview(null)
    } catch (e) { console.error('Save merchant error:', e); setMerchantError('Something went wrong. Please try again.') }
    setSavingMerchant(false)
  }

  async function toggleMerchantActive(m) {
    await supabase.from('merchants').update({ is_active: !m.is_active }).eq('id', m.id)
    setMerchants(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x))
  }

  function openEditTier(tier) { setEditingTier(tier); setTierForm({ min_percentage: String(tier.min_percentage), cashback_rate: String(Number(tier.cashback_rate) * 100) }); setTierError('') }
  function cancelEditTier() { setEditingTier(null); setTierError('') }

  async function saveTier() {
    const minPct = Number(tierForm.min_percentage); const rate = Number(tierForm.cashback_rate)
    if (isNaN(minPct) || minPct < 0 || minPct > 100) { setTierError('Minimum percentage must be between 0 and 100.'); return }
    if (isNaN(rate)   || rate < 0   || rate > 100)   { setTierError('Cashback rate must be between 0 and 100.'); return }
    setSavingTier(true); setTierError('')
    try {
      await supabase.from('cashback_tiers').update({ min_percentage: minPct, cashback_rate: rate / 100 }).eq('id', editingTier.id)
      flash(`${editingTier.name} tier updated.`); setEditingTier(null); await loadAll()
    } catch (e) { console.error('Save tier error:', e); setTierError('Something went wrong. Please try again.') }
    setSavingTier(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
          Cashback rewards — merchants and tier configuration
        </p>
        {activeTab === 'merchants' && (
          <button onClick={openNewMerchant} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}>+ New merchant</button>
        )}
      </div>

      {/* Success toast */}
      {success && (
        <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>
          {success}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {[
          { id: 'merchants', label: `Merchants (${merchants.length})` },
          { id: 'tiers',     label: 'Cashback Tiers'                  },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setShowMerchantForm(false); setEditingTier(null) }}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: activeTab === t.id ? C.black : 'transparent', color: activeTab === t.id ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ MERCHANTS TAB ══════════════ */}
      {activeTab === 'merchants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Merchant list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {merchants.length === 0 ? (
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>No merchants yet</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
                  Add Partna merchant partners. Customers earn cashback when they spend at these merchants using their Partna card.
                </p>
                <button onClick={openNewMerchant} style={{ ...btnPrimary, marginTop: 4 }}>+ Add first merchant</button>
              </div>
            ) : merchants.map((m, i) => (
              <div key={m.id} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: m.is_active !== false ? 1 : 0.55, transition: 'opacity 0.15s' }}>
                {/* Logo */}
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.bg, border: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {m.logo_url ? (
                    <img src={m.logo_url} alt={m.name} style={{ width: 36, height: 36, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>{m.name}</p>
                    {m.is_active !== false
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,   background: C.bgGreen,   borderRadius: 6, padding: '2px 8px' }}>Active</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: C.grayMid, background: C.grayLight, borderRadius: 6, padding: '2px 8px' }}>Inactive</span>
                    }
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>
                    {m.category || 'No category'}
                    {m.website && <> · <a href={m.website} target="_blank" rel="noopener noreferrer" style={{ color: C.black, fontWeight: 600 }}>{m.website}</a></>}
                  </p>
                  {m.description && <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: '2px 0 0', fontStyle: 'italic' }}>{m.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleMerchantActive(m)} style={{ ...(m.is_active !== false ? btnDanger : btnSuccess), padding: '6px 12px', fontSize: 12 }}>
                    {m.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEditMerchant(m)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Edit</button>
                </div>
              </div>
            ))}
          </div>

          {/* Form / info panel */}
          <div>
            {showMerchantForm ? (
              <FormPanel title={editingMerchant ? 'Edit merchant' : 'New merchant'} onClose={() => { setShowMerchantForm(false); setEditingMerchant(null) }}>
                {merchantError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{merchantError}</div>}

                <div>
                  <label style={labelStyle}>Merchant name *</label>
                  <input style={inputStyle} type="text" value={merchantForm.name} onChange={e => merchantField('name', e.target.value)} placeholder="e.g. Chicken Tonight Uganda"
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input style={inputStyle} type="text" value={merchantForm.category} onChange={e => merchantField('category', e.target.value)} placeholder="e.g. Food & Dining"
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={merchantForm.description} onChange={e => merchantField('description', e.target.value)} placeholder="Short description shown to customers"
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input style={inputStyle} type="url" value={merchantForm.website} onChange={e => merchantField('website', e.target.value)} placeholder="https://example.com"
                    onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
                </div>

                {/* Logo upload */}
                <div>
                  <label style={labelStyle}>Logo</label>
                  <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: 8, border: `2px dashed ${merchantLogoError ? C.red : C.grayLine}`, borderRadius: 10, background: C.bg }}>
                    {merchantLogoPreview ? (
                      <img src={merchantLogoPreview} alt="Logo preview" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>Upload logo</span>
                      </>
                    )}
                    <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: 'none' }} onChange={handleMerchantLogoSelect} />
                  </label>
                  {merchantLogoError
                    ? <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '4px 0 0' }}>{merchantLogoError}</p>
                    : <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>PNG, JPEG or SVG · Max 2MB</p>
                  }
                  {merchantLogoPreview && (
                    <button onClick={() => { setMerchantLogoFile(null); setMerchantLogoPreview(null) }} style={{ ...btnDanger, padding: '5px 10px', fontSize: 12, marginTop: 8 }}>Remove logo</button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowMerchantForm(false); setEditingMerchant(null) }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
                  <button onClick={saveMerchant} disabled={savingMerchant} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingMerchant ? 0.75 : 1 }}>
                    {savingMerchant ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : editingMerchant ? 'Update' : 'Create'}
                  </button>
                </div>
              </FormPanel>
            ) : (
              <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '28px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0 }}>Merchant directory</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
                  Active merchants are shown to customers on their Card page. Customers earn cashback at these merchants based on their savings tier.
                </p>
                <button onClick={openNewMerchant} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12, marginTop: 4 }}>+ Add merchant</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ CASHBACK TIERS TAB ══════════════ */}
      {activeTab === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Info banner */}
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
            Tiers are unlocked based on how much of their campaign target a customer has <strong style={{ color: C.black }}>paid</strong> — not just deposited.
            The cashback rate applies to all active merchants. Platinum tier is retained for 90 days after a campaign is fully paid, then reverts to balance-based calculation.
            Edit the thresholds and rates below — tier names are fixed.
          </div>

          {/* Tiers table */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            {tiers.map((tier, i) => {
              const isEditing   = editingTier?.id === tier.id
              const tierColor   = TIER_COLORS[tier.name] || C.grayMid
              const rateDisplay = (Number(tier.cashback_rate) * 100).toFixed(1)
              return (
                <div key={tier.id} style={{ borderBottom: i < tiers.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: isEditing ? C.bg : C.white }}>
                  {/* Tier row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: tierColor, flexShrink: 0, boxShadow: `0 0 6px ${tierColor}` }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: tierColor, margin: 0, width: 76, flexShrink: 0 }}>{tier.name}</p>
                    <div style={{ flex: 1, display: 'flex', gap: 32 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 2px' }}>Min % paid</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>{tier.min_percentage}%</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 2px' }}>Cashback rate</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.green, margin: 0 }}>{rateDisplay}%</p>
                      </div>
                    </div>
                    <button onClick={() => isEditing ? cancelEditTier() : openEditTier(tier)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {tierError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{tierError}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Minimum % paid to unlock</label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" style={inputStyle} min="0" max="100" value={tierForm.min_percentage}
                              onChange={e => { setTierForm(f => ({ ...f, min_percentage: e.target.value })); setTierError('') }}
                              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                            />
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.secondary, pointerEvents: 'none' }}>%</span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>% of campaign target that must be paid</p>
                        </div>
                        <div>
                          <label style={labelStyle}>Cashback rate</label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" style={inputStyle} min="0" max="100" step="0.1" value={tierForm.cashback_rate}
                              onChange={e => { setTierForm(f => ({ ...f, cashback_rate: e.target.value })); setTierError('') }}
                              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}
                            />
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.secondary, pointerEvents: 'none' }}>%</span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>% of spend credited as cashback</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={saveTier} disabled={savingTier} style={{ ...btnPrimary, padding: '7px 16px', fontSize: 12, opacity: savingTier ? 0.75 : 1 }}>
                          {savingTier ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : `Save ${tier.name} tier`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tier summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {tiers.map(tier => {
              const tierColor = TIER_COLORS[tier.name] || C.grayMid
              return (
                <div key={tier.id} style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tierColor }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: tierColor, margin: '4px 0 6px' }}>{tier.name}</p>
                  <p style={{ fontSize: 26, fontWeight: 600, color: C.green, letterSpacing: '-1px', margin: '0 0 2px', lineHeight: 1 }}>
                    {(Number(tier.cashback_rate) * 100).toFixed(1)}%
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 10px' }}>cashback on spend</p>
                  <div style={{ borderTop: `1px solid ${C.grayLine}`, paddingTop: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>
                      Unlocks at <strong style={{ color: C.black }}>{tier.min_percentage}%</strong> paid
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}