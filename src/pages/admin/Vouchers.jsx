import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_VOUCHER = {
  title: '', description: '', merchant_id: '', discount_type: 'percentage',
  discount_value: '', min_balance_percentage: '', expiry_offset_fraction: '',
  terms_and_conditions: '', is_active: true,
}

const EMPTY_MERCHANT = { name: '', category: '' }

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

export default function Vouchers() {
  const [vouchers, setVouchers]   = useState([])
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('vouchers')

  // Voucher form
  const [showVoucherForm, setShowVoucherForm]   = useState(false)
  const [editingVoucher, setEditingVoucher]     = useState(null)
  const [voucherForm, setVoucherForm]           = useState(EMPTY_VOUCHER)
  const [savingVoucher, setSavingVoucher]       = useState(false)
  const [voucherError, setVoucherError]         = useState('')
  const [voucherSuccess, setVoucherSuccess]     = useState('')

  // Merchant form
  const [showMerchantForm, setShowMerchantForm]       = useState(false)
  const [editingMerchant, setEditingMerchant]         = useState(null)
  const [merchantForm, setMerchantForm]               = useState(EMPTY_MERCHANT)
  const [merchantLogoFile, setMerchantLogoFile]       = useState(null)
  const [merchantLogoPreview, setMerchantLogoPreview] = useState(null)
  const [merchantLogoError, setMerchantLogoError]     = useState('')
  const [savingMerchant, setSavingMerchant]           = useState(false)
  const [merchantError, setMerchantError]             = useState('')
  const [merchantSuccess, setMerchantSuccess]         = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: vData } = await supabase.from('vouchers').select('*, merchants(id, name, logo_url, category)').order('created_at', { ascending: false })
      setVouchers(vData || [])
      const { data: mData } = await supabase.from('merchants').select('*').order('name')
      setMerchants(mData || [])
    } catch (e) { console.error('Vouchers load error:', e) }
    setLoading(false)
  }

  // ── Voucher handlers ──────────────────────────────────────────────────────

  function openNewVoucher() {
    setEditingVoucher(null); setVoucherForm(EMPTY_VOUCHER); setVoucherError(''); setVoucherSuccess(''); setShowVoucherForm(true)
  }

  function openEditVoucher(v) {
    setEditingVoucher(v)
    setVoucherForm({ title: v.title || '', description: v.description || '', merchant_id: v.merchant_id || '', discount_type: v.discount_type || 'percentage', discount_value: v.discount_value || '', min_balance_percentage: v.min_balance_percentage || '', expiry_offset_fraction: v.expiry_offset_fraction || '', terms_and_conditions: v.terms_and_conditions || '', is_active: v.is_active !== false })
    setVoucherError(''); setVoucherSuccess(''); setShowVoucherForm(true)
  }

  function voucherField(key, value) { setVoucherForm(prev => ({ ...prev, [key]: value })) }

  function validateVoucher() {
    if (!voucherForm.title.trim()) return 'Title is required.'
    if (!voucherForm.merchant_id) return 'Please select a merchant.'
    if (!voucherForm.discount_value || isNaN(Number(voucherForm.discount_value))) return 'Enter a valid discount value.'
    if (!voucherForm.min_balance_percentage || isNaN(Number(voucherForm.min_balance_percentage))) return 'Enter a valid minimum balance percentage.'
    if (!voucherForm.expiry_offset_fraction || isNaN(Number(voucherForm.expiry_offset_fraction))) return 'Enter a valid expiry offset (0.0 – 1.0).'
    const exp = Number(voucherForm.expiry_offset_fraction)
    if (exp < 0 || exp > 1) return 'Expiry offset must be between 0.0 and 1.0.'
    if (!voucherForm.terms_and_conditions.trim()) return 'Terms and conditions are required.'
    return null
  }

  async function saveVoucher() {
    const err = validateVoucher()
    if (err) { setVoucherError(err); return }
    setSavingVoucher(true); setVoucherError('')
    try {
      const payload = { title: voucherForm.title.trim(), description: voucherForm.description.trim(), merchant_id: voucherForm.merchant_id, discount_type: voucherForm.discount_type, discount_value: Number(voucherForm.discount_value), min_balance_percentage: Number(voucherForm.min_balance_percentage), expiry_offset_fraction: Number(voucherForm.expiry_offset_fraction), terms_and_conditions: voucherForm.terms_and_conditions.trim(), is_active: voucherForm.is_active }
      if (editingVoucher) { await supabase.from('vouchers').update(payload).eq('id', editingVoucher.id); setVoucherSuccess('Voucher updated successfully.') }
      else { await supabase.from('vouchers').insert(payload); setVoucherSuccess('Voucher created successfully.') }
      await loadAll(); setShowVoucherForm(false); setEditingVoucher(null)
      setTimeout(() => setVoucherSuccess(''), 4000)
    } catch (e) { console.error('Save voucher error:', e); setVoucherError('Something went wrong. Please try again.') }
    setSavingVoucher(false)
  }

  async function toggleVoucherActive(v) {
    await supabase.from('vouchers').update({ is_active: !v.is_active }).eq('id', v.id)
    setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, is_active: !x.is_active } : x))
  }

  // ── Merchant handlers ─────────────────────────────────────────────────────

  function openNewMerchant() {
    setEditingMerchant(null); setMerchantForm(EMPTY_MERCHANT); setMerchantLogoFile(null); setMerchantLogoPreview(null); setMerchantLogoError(''); setMerchantError(''); setMerchantSuccess(''); setShowMerchantForm(true)
  }

  function openEditMerchant(m) {
    setEditingMerchant(m); setMerchantForm({ name: m.name || '', category: m.category || '' }); setMerchantLogoFile(null); setMerchantLogoPreview(m.logo_url || null); setMerchantLogoError(''); setMerchantError(''); setMerchantSuccess(''); setShowMerchantForm(true)
  }

  function merchantField(key, value) { setMerchantForm(prev => ({ ...prev, [key]: value })) }

  function handleMerchantLogoSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setMerchantLogoError('')
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setMerchantLogoError('Logo must be PNG, JPEG or SVG.'); e.target.value = ''; return }
    if (file.size > 2 * 1024 * 1024) { setMerchantLogoError('Logo must be smaller than 2MB.'); e.target.value = ''; return }
    setMerchantLogoFile(file)
    const reader = new FileReader(); reader.onload = ev => setMerchantLogoPreview(ev.target.result); reader.readAsDataURL(file)
  }

  async function saveMerchant() {
    if (!merchantForm.name.trim()) { setMerchantError('Merchant name is required.'); return }
    setSavingMerchant(true); setMerchantError('')
    try {
      let logoUrl = editingMerchant?.logo_url || null
      if (merchantLogoFile) {
        const merchantId = editingMerchant?.id || crypto.randomUUID()
        const fileExt = merchantLogoFile.name.split('.').pop()
        const filePath = `merchants/${merchantId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('business-logos').upload(filePath, merchantLogoFile, { upsert: true })
        if (!uploadError) { const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(filePath); logoUrl = urlData.publicUrl }
        else { console.error('Merchant logo upload error:', uploadError) }
      }
      const payload = { name: merchantForm.name.trim(), logo_url: logoUrl, category: merchantForm.category.trim() || null }
      if (editingMerchant) { await supabase.from('merchants').update(payload).eq('id', editingMerchant.id); setMerchantSuccess('Merchant updated.') }
      else { await supabase.from('merchants').insert(payload); setMerchantSuccess('Merchant created.') }
      await loadAll(); setShowMerchantForm(false); setEditingMerchant(null); setMerchantLogoFile(null); setMerchantLogoPreview(null)
      setTimeout(() => setMerchantSuccess(''), 3000)
    } catch (e) { console.error('Save merchant error:', e); setMerchantError('Something went wrong. Please try again.') }
    setSavingMerchant(false)
  }

  async function toggleMerchantActive(m) {
    await supabase.from('merchants').update({ is_active: !m.is_active }).eq('id', m.id)
    setMerchants(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x))
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
          Vouchers available to all business clients
        </p>
        <button onClick={activeTab === 'vouchers' ? openNewVoucher : openNewMerchant} className="btn btn-primary btn-sm">
          <span className="icon-outlined icon-xs">add</span>
          {activeTab === 'vouchers' ? 'New voucher' : 'New merchant'}
        </button>
      </div>

      {/* Success toasts */}
      {voucherSuccess && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{voucherSuccess}</div>
        </div>
      )}
      {merchantSuccess && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{merchantSuccess}</div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {[
          { id: 'vouchers',  label: `Vouchers (${vouchers.length})`  },
          { id: 'merchants', label: `Merchants (${merchants.length})` },
        ].map((t, i) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setShowVoucherForm(false); setShowMerchantForm(false) }} style={{
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

      {/* ══════════════ VOUCHERS TAB ══════════════ */}
      {activeTab === 'vouchers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {vouchers.length === 0 ? (
              <EmptyPanel icon="confirmation_number" title="No vouchers yet" sub="Create vouchers that businesses can attach to their campaigns" action="Create first voucher" onAction={openNewVoucher} />
            ) : vouchers.map(v => (
              <div key={v.id} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', opacity: v.is_active ? 1 : 0.55, transition: 'opacity var(--transition-base)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                    {/* Merchant logo / icon */}
                    <div style={{ width: 40, height: 40, background: 'var(--color-bg)', border: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {v.merchants?.logo_url ? (
                        <img src={v.merchants.logo_url} alt={v.merchants.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      ) : (
                        <span className="icon-outlined" style={{ fontSize: 20, color: 'var(--color-grey-mid)' }}>confirmation_number</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                        <span className={`badge no-dot ${v.is_active ? 'badge-success' : 'badge-default'}`} style={{ flexShrink: 0 }}>
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                        {v.merchants?.name || 'No merchant'}
                        {v.description ? ` · ${v.description}` : ''}
                      </div>
                      {/* Meta pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', background: 'var(--color-yellow)', border: 'var(--border)', padding: '2px var(--space-2)' }}>
                          {v.discount_type === 'percentage' ? `${v.discount_value}% off` : `UGX ${Number(v.discount_value).toLocaleString()}`}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                          Min {v.min_balance_percentage}% of target
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                          Expires at {Math.round(Number(v.expiry_offset_fraction) * 100)}% through campaign
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <button onClick={() => toggleVoucherActive(v)} className={`btn btn-sm ${v.is_active ? 'btn-danger' : 'btn-success'}`}>
                      {v.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => openEditVoucher(v)} className="btn btn-sm btn-secondary">
                      <span className="icon-outlined icon-xs">edit</span>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form panel */}
          <div>
            {showVoucherForm ? (
              <FormPanel title={editingVoucher ? 'Edit voucher' : 'New voucher'} onClose={() => { setShowVoucherForm(false); setEditingVoucher(null) }}>
                {voucherError && (
                  <div className="alert alert-danger">
                    <span className="icon-outlined alert-icon">error_outline</span>
                    <div className="alert-content">{voucherError}</div>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Title <span className="required">*</span></label>
                  <input type="text" className="input" value={voucherForm.title} onChange={e => voucherField('title', e.target.value)} placeholder="e.g. 20% off at KFC" />
                </div>

                <div className="input-group">
                  <label className="input-label">Description</label>
                  <input type="text" className="input" value={voucherForm.description} onChange={e => voucherField('description', e.target.value)} placeholder="Short description" />
                </div>

                <div className="input-group">
                  <label className="input-label">Merchant <span className="required">*</span></label>
                  <select className="input" value={voucherForm.merchant_id} onChange={e => voucherField('merchant_id', e.target.value)}>
                    <option value="">Select merchant</option>
                    {merchants.filter(m => m.is_active !== false).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Discount type <span className="required">*</span></label>
                  <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
                    {[
                      { value: 'percentage', label: '% Percentage' },
                      { value: 'fixed',      label: 'Fixed amount' },
                    ].map((opt, i) => (
                      <button key={opt.value} onClick={() => voucherField('discount_type', opt.value)} style={{
                        flex: 1, padding: 'var(--space-2) var(--space-3)',
                        background: voucherForm.discount_type === opt.value ? 'var(--color-black)' : 'var(--color-white)',
                        color: voucherForm.discount_type === opt.value ? 'var(--color-white)' : 'var(--color-grey)',
                        border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
                        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', cursor: 'pointer',
                      }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">
                    Discount value {voucherForm.discount_type === 'percentage' ? '(%)' : '(UGX)'} <span className="required">*</span>
                  </label>
                  <input type="number" className="input" value={voucherForm.discount_value} onChange={e => voucherField('discount_value', e.target.value)}
                    placeholder={voucherForm.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 50000'} />
                </div>

                <div className="input-group">
                  <label className="input-label">Min balance to unlock (% of target) <span className="required">*</span></label>
                  <input type="number" className="input" value={voucherForm.min_balance_percentage} onChange={e => voucherField('min_balance_percentage', e.target.value)} placeholder="e.g. 25" />
                </div>

                <div className="input-group">
                  <label className="input-label">Expiry offset (0.0 – 1.0) <span className="required">*</span></label>
                  <input type="number" step="0.05" min="0" max="1" className="input" value={voucherForm.expiry_offset_fraction} onChange={e => voucherField('expiry_offset_fraction', e.target.value)} placeholder="e.g. 0.5" />
                  <span className="input-hint">0.0 = campaign start · 1.0 = campaign end date</span>
                </div>

                <div className="input-group">
                  <label className="input-label">Terms and conditions <span className="required">*</span></label>
                  <textarea className="input" value={voucherForm.terms_and_conditions} onChange={e => voucherField('terms_and_conditions', e.target.value)}
                    placeholder="Enter the terms and conditions…" rows={3} style={{ resize: 'none' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg)', border: 'var(--border)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>Active</span>
                  <div className="toggle" onClick={() => voucherField('is_active', !voucherForm.is_active)} style={{ cursor: 'pointer' }}>
                    <div className="toggle-track" style={{ background: voucherForm.is_active ? 'var(--color-primary)' : undefined }}>
                      <div className="toggle-thumb" style={{ transform: voucherForm.is_active ? 'translateX(20px)' : 'none' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button onClick={() => { setShowVoucherForm(false); setEditingVoucher(null) }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={saveVoucher} disabled={savingVoucher} className="btn btn-primary" style={{ flex: 1 }}>
                    {savingVoucher
                      ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                      : <><span className="icon-outlined icon-sm">save</span> {editingVoucher ? 'Update' : 'Create'}</>
                    }
                  </button>
                </div>
              </FormPanel>
            ) : (
              <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', textAlign: 'center' }}>
                <span className="icon-outlined" style={{ fontSize: 36, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>confirmation_number</span>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Voucher library</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-normal)' }}>
                  Vouchers created here are available to all business clients to attach to their campaigns.
                </div>
                <button onClick={openNewVoucher} className="btn btn-primary btn-full btn-sm">
                  <span className="icon-outlined icon-xs">add</span>
                  New voucher
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ MERCHANTS TAB ══════════════ */}
      {activeTab === 'merchants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {merchants.length === 0 ? (
              <EmptyPanel icon="storefront" title="No merchants yet" sub="Add merchants before creating vouchers" action="Add first merchant" onAction={openNewMerchant} />
            ) : merchants.map(m => (
              <div key={m.id} style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', opacity: m.is_active !== false ? 1 : 0.55, transition: 'opacity var(--transition-base)' }}>
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
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                    {m.category || 'No category'} · {vouchers.filter(v => v.merchant_id === m.id).length} vouchers
                  </div>
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
              <FormPanel title={editingMerchant ? 'Edit merchant' : 'New merchant'} onClose={() => { setShowMerchantForm(false); setEditingMerchant(null) }}>
                {merchantError && (
                  <div className="alert alert-danger">
                    <span className="icon-outlined alert-icon">error_outline</span>
                    <div className="alert-content">{merchantError}</div>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Merchant name <span className="required">*</span></label>
                  <input type="text" className="input" value={merchantForm.name} onChange={e => merchantField('name', e.target.value)} placeholder="e.g. KFC Uganda" />
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <input type="text" className="input" value={merchantForm.category} onChange={e => merchantField('category', e.target.value)} placeholder="e.g. Food & Dining" />
                </div>

                {/* Logo upload */}
                <div className="input-group">
                  <label className="input-label">Logo</label>
                  <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)', gap: 'var(--space-2)', border: merchantLogoError ? '2px dashed var(--color-red)' : '2px dashed var(--color-grey-light)', background: 'var(--color-bg)' }}>
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
                    <button onClick={() => { setMerchantLogoFile(null); setMerchantLogoPreview(null) }} className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }}>
                      <span className="icon-outlined icon-xs">close</span>
                      Remove logo
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button onClick={() => { setShowMerchantForm(false); setEditingMerchant(null) }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
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
                  Add merchants here before creating vouchers for them.
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
    </div>
  )
}