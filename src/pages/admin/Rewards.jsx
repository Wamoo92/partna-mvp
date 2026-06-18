import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Sub-components ─────────────────────────────────────────────────────────

function FormPanel({ title, onClose, children }) {
  return (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--color-black)', borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-white)' }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {children}
      </div>
    </div>
  )
}

function EmptyPanel({ icon, title, sub, action, onAction }) {
  return (
    <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-8)', textAlign: 'center' }}>
      <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>{icon}</span>
      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)' }}>{sub}</div>
      <button onClick={onAction} className="btn btn-primary btn-sm">
        <span className="icon-outlined icon-xs">add</span>
        {action}
      </button>
    </div>
  )
}

const EMPTY_MERCHANT = { name: '', category: '', description: '', website: '' }

const TIER_COLORS = {
  Bronze:   '#CD7F32',
  Silver:   '#A8A9AD',
  Gold:     '#FFD700',
  Platinum: '#E5E4E2',
}

export default function Rewards() {
  const [activeTab, setActiveTab] = useState('merchants')
  const [loading, setLoading]     = useState(true)
  const [success, setSuccess]     = useState('')

  // Merchants
  const [merchants, setMerchants]                     = useState([])
  const [showMerchantForm, setShowMerchantForm]       = useState(false)
  const [editingMerchant, setEditingMerchant]         = useState(null)
  const [merchantForm, setMerchantForm]               = useState(EMPTY_MERCHANT)
  const [merchantLogoFile, setMerchantLogoFile]       = useState(null)
  const [merchantLogoPreview, setMerchantLogoPreview] = useState(null)
  const [merchantLogoError, setMerchantLogoError]     = useState('')
  const [savingMerchant, setSavingMerchant]           = useState(false)
  const [merchantError, setMerchantError]             = useState('')

  // Cashback tiers
  const [tiers, setTiers]           = useState([])
  const [editingTier, setEditingTier] = useState(null)   // tier object being edited
  const [tierForm, setTierForm]     = useState({ min_percentage: '', cashback_rate: '' })
  const [savingTier, setSavingTier] = useState(false)
  const [tierError, setTierError]   = useState('')

  useEffect(() => { loadAll() }, [])

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

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ── Merchant handlers ──────────────────────────────────────────────────

  function openNewMerchant() {
    setEditingMerchant(null)
    setMerchantForm(EMPTY_MERCHANT)
    setMerchantLogoFile(null)
    setMerchantLogoPreview(null)
    setMerchantLogoError('')
    setMerchantError('')
    setShowMerchantForm(true)
  }

  function openEditMerchant(m) {
    setEditingMerchant(m)
    setMerchantForm({
      name:        m.name        || '',
      category:    m.category    || '',
      description: m.description || '',
      website:     m.website     || '',
    })
    setMerchantLogoFile(null)
    setMerchantLogoPreview(m.logo_url || null)
    setMerchantLogoError('')
    setMerchantError('')
    setShowMerchantForm(true)
  }

  function merchantField(key, value) {
    setMerchantForm(prev => ({ ...prev, [key]: value }))
  }

  function handleMerchantLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setMerchantLogoError('')
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setMerchantLogoError('Logo must be PNG, JPEG or SVG.')
      e.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMerchantLogoError('Logo must be smaller than 2MB.')
      e.target.value = ''
      return
    }
    setMerchantLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setMerchantLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function saveMerchant() {
    if (!merchantForm.name.trim()) { setMerchantError('Merchant name is required.'); return }
    setSavingMerchant(true)
    setMerchantError('')
    try {
      let logoUrl = editingMerchant?.logo_url || null

      if (merchantLogoFile) {
        const merchantId = editingMerchant?.id || crypto.randomUUID()
        const fileExt    = merchantLogoFile.name.split('.').pop()
        const filePath   = `merchants/${merchantId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('business-logos')
          .upload(filePath, merchantLogoFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath)
          logoUrl = urlData.publicUrl
        } else {
          console.error('Merchant logo upload error:', uploadError)
        }
      }

      const payload = {
        name:        merchantForm.name.trim(),
        category:    merchantForm.category.trim()    || null,
        description: merchantForm.description.trim() || null,
        website:     merchantForm.website.trim()     || null,
        logo_url:    logoUrl,
      }

      if (editingMerchant) {
        await supabase.from('merchants').update(payload).eq('id', editingMerchant.id)
        flash('Merchant updated.')
      } else {
        await supabase.from('merchants').insert(payload)
        flash('Merchant created.')
      }

      await loadAll()
      setShowMerchantForm(false)
      setEditingMerchant(null)
      setMerchantLogoFile(null)
      setMerchantLogoPreview(null)
    } catch (e) {
      console.error('Save merchant error:', e)
      setMerchantError('Something went wrong. Please try again.')
    }
    setSavingMerchant(false)
  }

  async function toggleMerchantActive(m) {
    await supabase.from('merchants').update({ is_active: !m.is_active }).eq('id', m.id)
    setMerchants(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x))
  }

  // ── Cashback tier handlers ─────────────────────────────────────────────

  function openEditTier(tier) {
    setEditingTier(tier)
    setTierForm({
      min_percentage: String(tier.min_percentage),
      cashback_rate:  String(Number(tier.cashback_rate) * 100), // store as %, display as %
    })
    setTierError('')
  }

  function cancelEditTier() {
    setEditingTier(null)
    setTierError('')
  }

  async function saveTier() {
    const minPct  = Number(tierForm.min_percentage)
    const rate    = Number(tierForm.cashback_rate)

    if (isNaN(minPct) || minPct < 0 || minPct > 100) { setTierError('Minimum percentage must be between 0 and 100.'); return }
    if (isNaN(rate)   || rate < 0   || rate > 100)   { setTierError('Cashback rate must be between 0 and 100.'); return }

    setSavingTier(true)
    setTierError('')
    try {
      await supabase.from('cashback_tiers').update({
        min_percentage: minPct,
        cashback_rate:  rate / 100, // store as decimal e.g. 0.01
      }).eq('id', editingTier.id)

      flash(`${editingTier.name} tier updated.`)
      setEditingTier(null)
      await loadAll()
    } catch (e) {
      console.error('Save tier error:', e)
      setTierError('Something went wrong. Please try again.')
    }
    setSavingTier(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-grey)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
          Cashback rewards — merchants and tier configuration
        </p>
        {activeTab === 'merchants' && (
          <button onClick={openNewMerchant} className="btn btn-primary btn-sm">
            <span className="icon-outlined icon-xs">add</span>
            New merchant
          </button>
        )}
      </div>

      {/* Success toast */}
      {success && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{success}</div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {[
          { id: 'merchants', label: `Merchants (${merchants.length})` },
          { id: 'tiers',     label: 'Cashback Tiers'                  },
        ].map((t, i) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setShowMerchantForm(false); setEditingTier(null) }} style={{
            padding: 'var(--space-3) var(--space-6)',
            background: activeTab === t.id ? 'var(--color-black)' : 'var(--color-white)',
            color: activeTab === t.id ? 'var(--color-white)' : 'var(--color-grey)',
            border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            cursor: 'pointer', transition: 'all var(--transition-fast)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ MERCHANTS TAB ══════════════ */}
      {activeTab === 'merchants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {merchants.length === 0 ? (
              <EmptyPanel
                icon="storefront"
                title="No merchants yet"
                sub="Add Partna merchant partners. Customers earn cashback when they spend at these merchants using their Partna card."
                action="Add first merchant"
                onAction={openNewMerchant}
              />
            ) : merchants.map(m => (
              <div key={m.id} style={{
                background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)',
                padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                opacity: m.is_active !== false ? 1 : 0.55, transition: 'opacity var(--transition-base)',
              }}>
                {/* Logo */}
                <div style={{ width: 48, height: 48, background: 'var(--color-bg)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {m.logo_url ? (
                    <img src={m.logo_url} alt={m.name} style={{ width: 40, height: 40, objectFit: 'contain' }}
                      onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <span className="icon-outlined" style={{ fontSize: 24, color: 'var(--color-grey-mid)' }}>storefront</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{m.name}</span>
                    <span className={`badge no-dot ${m.is_active !== false ? 'badge-success' : 'badge-default'}`}>
                      {m.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: m.description ? 'var(--space-1)' : 0 }}>
                    {m.category || 'No category'}
                    {m.website && <> · <a href={m.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 'var(--weight-bold)' }}>{m.website}</a></>}
                  </div>
                  {m.description && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontStyle: 'italic' }}>
                      {m.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button onClick={() => toggleMerchantActive(m)} className={`btn btn-sm ${m.is_active !== false ? 'btn-danger' : 'btn-success'}`}>
                    {m.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEditMerchant(m)} className="btn btn-sm btn-secondary">
                    <span className="icon-outlined icon-xs">edit</span>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form panel */}
          <div>
            {showMerchantForm ? (
              <FormPanel
                title={editingMerchant ? 'Edit merchant' : 'New merchant'}
                onClose={() => { setShowMerchantForm(false); setEditingMerchant(null) }}
              >
                {merchantError && (
                  <div className="alert alert-danger">
                    <span className="icon-outlined alert-icon">error_outline</span>
                    <div className="alert-content">{merchantError}</div>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Merchant name <span className="required">*</span></label>
                  <input type="text" className="input" value={merchantForm.name}
                    onChange={e => merchantField('name', e.target.value)}
                    placeholder="e.g. Chicken Tonight Uganda" />
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <input type="text" className="input" value={merchantForm.category}
                    onChange={e => merchantField('category', e.target.value)}
                    placeholder="e.g. Food & Dining" />
                </div>

                <div className="input-group">
                  <label className="input-label">Description</label>
                  <textarea className="input" rows={2} value={merchantForm.description}
                    onChange={e => merchantField('description', e.target.value)}
                    placeholder="Short description shown to customers"
                    style={{ resize: 'none' }} />
                </div>

                <div className="input-group">
                  <label className="input-label">Website</label>
                  <div className="input-wrapper">
                    <span className="icon-outlined input-icon-left">language</span>
                    <input type="url" className="input" value={merchantForm.website}
                      onChange={e => merchantField('website', e.target.value)}
                      placeholder="https://example.com" />
                  </div>
                </div>

                {/* Logo upload */}
                <div className="input-group">
                  <label className="input-label">Logo</label>
                  <label style={{
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 'var(--space-5)', gap: 'var(--space-2)',
                    border: merchantLogoError ? '2px dashed var(--color-red)' : '2px dashed var(--color-grey-light)',
                    background: 'var(--color-bg)',
                  }}>
                    {merchantLogoPreview ? (
                      <img src={merchantLogoPreview} alt="Logo preview" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                    ) : (
                      <>
                        <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-grey-mid)' }}>storefront</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>Upload logo</span>
                      </>
                    )}
                    <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: 'none' }} onChange={handleMerchantLogoSelect} />
                  </label>
                  {merchantLogoError
                    ? <span style={{ fontSize: 'var(--text-xs)', color: '#C0392B', fontWeight: 'var(--weight-bold)' }}>{merchantLogoError}</span>
                    : <span className="input-hint">PNG, JPEG or SVG · Max 2MB</span>
                  }
                  {merchantLogoPreview && (
                    <button onClick={() => { setMerchantLogoFile(null); setMerchantLogoPreview(null) }}
                      className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }}>
                      <span className="icon-outlined icon-xs">close</span>
                      Remove logo
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button onClick={() => { setShowMerchantForm(false); setEditingMerchant(null) }} className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button onClick={saveMerchant} disabled={savingMerchant} className="btn btn-primary" style={{ flex: 1 }}>
                    {savingMerchant
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                      : <><span className="icon-outlined icon-sm">save</span> {editingMerchant ? 'Update' : 'Create'}</>
                    }
                  </button>
                </div>
              </FormPanel>
            ) : (
              <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', textAlign: 'center' }}>
                <span className="icon-outlined" style={{ fontSize: 36, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>storefront</span>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Merchant directory</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-normal)' }}>
                  Active merchants are shown to customers on their Card page. Customers earn cashback at these merchants based on their savings tier.
                </div>
                <button onClick={openNewMerchant} className="btn btn-primary btn-full btn-sm">
                  <span className="icon-outlined icon-xs">add</span>
                  Add merchant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ CASHBACK TIERS TAB ══════════════ */}
      {activeTab === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Info banner */}
          <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--color-white)', border: 'var(--border)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>info</span>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
              Tiers are unlocked based on how much of their campaign target a customer has <strong style={{ color: 'var(--color-black)' }}>paid</strong> — not just deposited.
              The cashback rate applies to all active merchants. Platinum tier is retained for 90 days after a campaign is fully paid, then reverts to balance-based calculation.
              Edit the thresholds and rates below — tier names are fixed.
            </div>
          </div>

          {/* Tiers table */}
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', overflow: 'hidden' }}>
            {tiers.map((tier, i) => {
              const isEditing  = editingTier?.id === tier.id
              const tierColor  = TIER_COLORS[tier.name] || 'var(--color-grey)'
              const rateDisplay = (Number(tier.cashback_rate) * 100).toFixed(1)

              return (
                <div key={tier.id} style={{
                  borderBottom: i < tiers.length - 1 ? 'var(--border)' : 'none',
                  background: isEditing ? 'var(--color-bg)' : 'var(--color-white)',
                }}>
                  {/* Tier row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)' }}>
                    {/* Tier badge */}
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: tierColor, flexShrink: 0,
                      boxShadow: `0 0 6px ${tierColor}`,
                    }} />
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: tierColor }}>
                        {tier.name}
                      </span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: 'var(--space-6)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 2 }}>Min % paid</div>
                        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                          {tier.min_percentage}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 2 }}>Cashback rate</div>
                        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: '#2D8B45' }}>
                          {rateDisplay}%
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => isEditing ? cancelEditTier() : openEditTier(tier)}
                      className={`btn btn-sm ${isEditing ? 'btn-secondary' : 'btn-secondary'}`}
                    >
                      <span className="icon-outlined icon-xs">{isEditing ? 'close' : 'edit'}</span>
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <div style={{ padding: '0 var(--space-5) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {tierError && (
                        <div className="alert alert-danger">
                          <span className="icon-outlined alert-icon">error_outline</span>
                          <div className="alert-content">{tierError}</div>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="input-group">
                          <label className="input-label">Minimum % paid to unlock</label>
                          <div className="input-wrapper">
                            <input type="number" className="input" min="0" max="100"
                              value={tierForm.min_percentage}
                              onChange={e => { setTierForm(f => ({ ...f, min_percentage: e.target.value })); setTierError('') }}
                            />
                            <span style={{ position: 'absolute', right: 'var(--space-3)', color: 'var(--color-grey)', fontSize: 'var(--text-sm)', pointerEvents: 'none' }}>%</span>
                          </div>
                          <span className="input-hint">% of campaign target that must be paid</span>
                        </div>
                        <div className="input-group">
                          <label className="input-label">Cashback rate</label>
                          <div className="input-wrapper">
                            <input type="number" className="input" min="0" max="100" step="0.1"
                              value={tierForm.cashback_rate}
                              onChange={e => { setTierForm(f => ({ ...f, cashback_rate: e.target.value })); setTierError('') }}
                            />
                            <span style={{ position: 'absolute', right: 'var(--space-3)', color: 'var(--color-grey)', fontSize: 'var(--text-sm)', pointerEvents: 'none' }}>%</span>
                          </div>
                          <span className="input-hint">% of spend credited as cashback</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={saveTier} disabled={savingTier} className="btn btn-primary btn-sm">
                          {savingTier
                            ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                            : <><span className="icon-outlined icon-xs">save</span> Save {tier.name} tier</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tier summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
            {tiers.map(tier => {
              const tierColor = TIER_COLORS[tier.name] || 'var(--color-grey)'
              return (
                <div key={tier.id} style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-4)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: 3, background: tierColor, position: 'absolute', top: 0, left: 0, right: 0 }} />
                  <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', color: tierColor, marginBottom: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                    {tier.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', color: '#2D8B45', letterSpacing: 'var(--tracking-tight)' }}>
                    {(Number(tier.cashback_rate) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 'var(--space-1)' }}>
                    cashback on spend
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1.5px solid var(--color-grey-light)' }}>
                    Unlocks at <strong>{tier.min_percentage}%</strong> paid
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