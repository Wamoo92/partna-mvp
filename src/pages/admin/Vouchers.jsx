import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const EMPTY_VOUCHER = {
  title: '',
  description: '',
  merchant_id: '',
  discount_type: 'percentage',
  discount_value: '',
  min_balance_percentage: '',
  expiry_offset_fraction: '',
  terms_and_conditions: '',
  is_active: true,
}

const EMPTY_MERCHANT = {
  name: '',
  category: '',
}

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([])
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vouchers')

  // Voucher form
  const [showVoucherForm, setShowVoucherForm] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [voucherForm, setVoucherForm] = useState(EMPTY_VOUCHER)
  const [savingVoucher, setSavingVoucher] = useState(false)
  const [voucherError, setVoucherError] = useState('')
  const [voucherSuccess, setVoucherSuccess] = useState('')

  // Merchant form
  const [showMerchantForm, setShowMerchantForm] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState(null)
  const [merchantForm, setMerchantForm] = useState(EMPTY_MERCHANT)
  const [merchantLogoFile, setMerchantLogoFile] = useState(null)
  const [merchantLogoPreview, setMerchantLogoPreview] = useState(null)
  const [merchantLogoError, setMerchantLogoError] = useState('')
  const [savingMerchant, setSavingMerchant] = useState(false)
  const [merchantError, setMerchantError] = useState('')
  const [merchantSuccess, setMerchantSuccess] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: vData } = await supabase
        .from('vouchers')
        .select('*, merchants(id, name, logo_url, category)')
        .order('created_at', { ascending: false })
      setVouchers(vData || [])

      const { data: mData } = await supabase
        .from('merchants')
        .select('*')
        .order('name')
      setMerchants(mData || [])
    } catch (e) {
      console.error('Vouchers load error:', e)
    }
    setLoading(false)
  }

  // ── Voucher handlers ──

  function openNewVoucher() {
    setEditingVoucher(null)
    setVoucherForm(EMPTY_VOUCHER)
    setVoucherError('')
    setVoucherSuccess('')
    setShowVoucherForm(true)
  }

  function openEditVoucher(v) {
    setEditingVoucher(v)
    setVoucherForm({
      title: v.title || '',
      description: v.description || '',
      merchant_id: v.merchant_id || '',
      discount_type: v.discount_type || 'percentage',
      discount_value: v.discount_value || '',
      min_balance_percentage: v.min_balance_percentage || '',
      expiry_offset_fraction: v.expiry_offset_fraction || '',
      terms_and_conditions: v.terms_and_conditions || '',
      is_active: v.is_active !== false,
    })
    setVoucherError('')
    setVoucherSuccess('')
    setShowVoucherForm(true)
  }

  function voucherField(key, value) {
    setVoucherForm(prev => ({ ...prev, [key]: value }))
  }

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
    setSavingVoucher(true)
    setVoucherError('')
    try {
      const payload = {
        title: voucherForm.title.trim(),
        description: voucherForm.description.trim(),
        merchant_id: voucherForm.merchant_id,
        discount_type: voucherForm.discount_type,
        discount_value: Number(voucherForm.discount_value),
        min_balance_percentage: Number(voucherForm.min_balance_percentage),
        expiry_offset_fraction: Number(voucherForm.expiry_offset_fraction),
        terms_and_conditions: voucherForm.terms_and_conditions.trim(),
        is_active: voucherForm.is_active,
      }

      if (editingVoucher) {
        await supabase.from('vouchers').update(payload).eq('id', editingVoucher.id)
        setVoucherSuccess('Voucher updated successfully.')
      } else {
        await supabase.from('vouchers').insert(payload)
        setVoucherSuccess('Voucher created successfully.')
      }

      await loadAll()
      setShowVoucherForm(false)
      setEditingVoucher(null)
      setTimeout(() => setVoucherSuccess(''), 4000)
    } catch (e) {
      console.error('Save voucher error:', e)
      setVoucherError('Something went wrong. Please try again.')
    }
    setSavingVoucher(false)
  }

  async function toggleVoucherActive(v) {
    await supabase.from('vouchers').update({ is_active: !v.is_active }).eq('id', v.id)
    setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, is_active: !x.is_active } : x))
  }

  // ── Merchant handlers ──

  function openNewMerchant() {
    setEditingMerchant(null)
    setMerchantForm(EMPTY_MERCHANT)
    setMerchantLogoFile(null)
    setMerchantLogoPreview(null)
    setMerchantLogoError('')
    setMerchantError('')
    setMerchantSuccess('')
    setShowMerchantForm(true)
  }

  function openEditMerchant(m) {
    setEditingMerchant(m)
    setMerchantForm({ name: m.name || '', category: m.category || '' })
    setMerchantLogoFile(null)
    setMerchantLogoPreview(m.logo_url || null)
    setMerchantLogoError('')
    setMerchantError('')
    setMerchantSuccess('')
    setShowMerchantForm(true)
  }

  function merchantField(key, value) {
    setMerchantForm(prev => ({ ...prev, [key]: value }))
  }

  function handleMerchantLogoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setMerchantLogoError('')

    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
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

      // Upload new logo if selected
      if (merchantLogoFile) {
        const merchantId = editingMerchant?.id || crypto.randomUUID()
        const fileExt = merchantLogoFile.name.split('.').pop()
        const filePath = `merchants/${merchantId}/logo.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('business-logos')
          .upload(filePath, merchantLogoFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('business-logos')
            .getPublicUrl(filePath)
          logoUrl = urlData.publicUrl
        } else {
          console.error('Merchant logo upload error:', uploadError)
        }
      }

      const payload = {
        name: merchantForm.name.trim(),
        logo_url: logoUrl,
        category: merchantForm.category.trim() || null,
      }

      if (editingMerchant) {
        await supabase.from('merchants').update(payload).eq('id', editingMerchant.id)
        setMerchantSuccess('Merchant updated.')
      } else {
        await supabase.from('merchants').insert(payload)
        setMerchantSuccess('Merchant created.')
      }

      await loadAll()
      setShowMerchantForm(false)
      setEditingMerchant(null)
      setMerchantLogoFile(null)
      setMerchantLogoPreview(null)
      setTimeout(() => setMerchantSuccess(''), 3000)
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: ADMIN_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: ADMIN_PRIMARY }}>Vouchers</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
            Create and manage the voucher library available to business clients
          </div>
        </div>
        <button
          onClick={activeTab === 'vouchers' ? openNewVoucher : openNewMerchant}
          className="text-xs font-bold px-4 py-2.5 rounded-xl"
          style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
          + {activeTab === 'vouchers' ? 'New voucher' : 'New merchant'}
        </button>
      </div>

      {voucherSuccess && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
          ✓ {voucherSuccess}
        </div>
      )}
      {merchantSuccess && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
          ✓ {merchantSuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#fff', width: 'fit-content' }}>
        {['vouchers', 'merchants'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShowVoucherForm(false); setShowMerchantForm(false) }}
            className="px-6 py-2 rounded-lg text-xs font-semibold capitalize"
            style={{
              background: activeTab === tab ? ADMIN_PRIMARY : 'transparent',
              color: activeTab === tab ? '#fff' : 'rgba(0,0,0,0.4)',
            }}>
            {tab === 'vouchers' ? `Vouchers (${vouchers.length})` : `Merchants (${merchants.length})`}
          </button>
        ))}
      </div>

      {/* ── VOUCHERS TAB ── */}
      {activeTab === 'vouchers' && (
        <div className="grid grid-cols-3 gap-5" style={{ alignItems: 'start' }}>

          {/* Voucher list */}
          <div className="col-span-2 flex flex-col gap-3">
            {vouchers.length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
                <div className="text-3xl mb-3">🎫</div>
                <div className="text-sm font-bold mb-1" style={{ color: ADMIN_PRIMARY }}>No vouchers yet</div>
                <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Create vouchers that businesses can attach to their campaigns
                </div>
                <button onClick={openNewVoucher}
                  className="text-xs font-bold px-4 py-2.5 rounded-xl"
                  style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                  Create first voucher
                </button>
              </div>
            ) : vouchers.map(v => (
              <div key={v.id} className="rounded-2xl p-4" style={{ background: '#fff', opacity: v.is_active ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: '#f0f2f5' }}>
                      {v.merchants?.logo_url ? (
                        <img src={v.merchants.logo_url} alt={v.merchants.name}
                          className="w-9 h-9 object-contain" />
                      ) : (
                        <span className="text-xl">🎫</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="text-sm font-bold truncate" style={{ color: ADMIN_PRIMARY }}>
                          {v.title}
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: v.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                            color: v.is_active ? '#16A34A' : 'rgba(0,0,0,0.4)',
                          }}>
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        {v.merchants?.name || 'No merchant'} · {v.description}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Discount: <span className="font-semibold" style={{ color: ADMIN_PRIMARY }}>
                            {v.discount_type === 'percentage' ? `${v.discount_value}%` : `UGX ${Number(v.discount_value).toLocaleString()}`}
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Min balance: <span className="font-semibold" style={{ color: ADMIN_PRIMARY }}>
                            {v.min_balance_percentage}% of target
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Expires at: <span className="font-semibold" style={{ color: ADMIN_PRIMARY }}>
                            {Math.round(Number(v.expiry_offset_fraction) * 100)}% through campaign
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleVoucherActive(v)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{
                        background: v.is_active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
                        color: v.is_active ? '#DC2626' : '#16A34A',
                      }}>
                      {v.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => openEditVoucher(v)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher form panel */}
          <div className="col-span-1">
            {showVoucherForm ? (
              <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#fff' }}>
                <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
                  {editingVoucher ? 'Edit Voucher' : 'New Voucher'}
                </div>

                {voucherError && (
                  <div className="text-xs px-3 py-2 rounded-xl"
                    style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {voucherError}
                  </div>
                )}

                {[
                  { label: 'Title *', key: 'title', placeholder: 'e.g. 20% off at KFC' },
                  { label: 'Description', key: 'description', placeholder: 'Short description' },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>{f.label}</label>
                    <input type="text" value={voucherForm[f.key]}
                      onChange={e => voucherField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                      style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  </div>
                ))}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Merchant *</label>
                  <select value={voucherForm.merchant_id}
                    onChange={e => voucherField('merchant_id', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }}>
                    <option value="">Select merchant</option>
                    {merchants.filter(m => m.is_active !== false).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Discount type *</label>
                  <div className="flex gap-2">
                    {['percentage', 'fixed'].map(type => (
                      <button key={type} onClick={() => voucherField('discount_type', type)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold"
                        style={{
                          background: voucherForm.discount_type === type ? ADMIN_PRIMARY : '#f0f2f5',
                          color: voucherForm.discount_type === type ? '#fff' : 'rgba(0,0,0,0.5)',
                        }}>
                        {type === 'percentage' ? '% Percentage' : 'Fixed amount'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    Discount value * {voucherForm.discount_type === 'percentage' ? '(%)' : '(UGX)'}
                  </label>
                  <input type="number" value={voucherForm.discount_value}
                    onChange={e => voucherField('discount_value', e.target.value)}
                    placeholder={voucherForm.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 50000'}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    Min balance to unlock (% of target) *
                  </label>
                  <input type="number" value={voucherForm.min_balance_percentage}
                    onChange={e => voucherField('min_balance_percentage', e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    Expiry offset (0.0 – 1.0) *
                  </label>
                  <input type="number" step="0.05" min="0" max="1"
                    value={voucherForm.expiry_offset_fraction}
                    onChange={e => voucherField('expiry_offset_fraction', e.target.value)}
                    placeholder="e.g. 0.5"
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    0.0 = campaign start · 1.0 = campaign end date
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>
                    Terms and conditions *
                  </label>
                  <textarea value={voucherForm.terms_and_conditions}
                    onChange={e => voucherField('terms_and_conditions', e.target.value)}
                    placeholder="Enter the terms and conditions..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Active</label>
                  <button onClick={() => voucherField('is_active', !voucherForm.is_active)}
                    className="w-12 h-6 rounded-full transition-all flex items-center px-1"
                    style={{ background: voucherForm.is_active ? '#16A34A' : 'rgba(0,0,0,0.15)' }}>
                    <div className="w-4 h-4 rounded-full bg-white transition-all"
                      style={{ transform: voucherForm.is_active ? 'translateX(24px)' : 'translateX(0)' }} />
                  </button>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setShowVoucherForm(false); setEditingVoucher(null) }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                    Cancel
                  </button>
                  <button onClick={saveVoucher} disabled={savingVoucher}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: savingVoucher ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
                    {savingVoucher ? 'Saving...' : editingVoucher ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: '#fff' }}>
                <div className="text-2xl mb-2">🎫</div>
                <div className="text-xs font-semibold mb-1" style={{ color: ADMIN_PRIMARY }}>Voucher library</div>
                <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Vouchers created here are available to all business clients to attach to their campaigns.
                </div>
                <button onClick={openNewVoucher}
                  className="w-full py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                  + New voucher
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MERCHANTS TAB ── */}
      {activeTab === 'merchants' && (
        <div className="grid grid-cols-3 gap-5" style={{ alignItems: 'start' }}>

          {/* Merchant list */}
          <div className="col-span-2 flex flex-col gap-3">
            {merchants.length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
                <div className="text-3xl mb-3">🏪</div>
                <div className="text-sm font-bold mb-1" style={{ color: ADMIN_PRIMARY }}>No merchants yet</div>
                <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Add merchants before creating vouchers
                </div>
                <button onClick={openNewMerchant}
                  className="text-xs font-bold px-4 py-2.5 rounded-xl"
                  style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                  Add first merchant
                </button>
              </div>
            ) : merchants.map(m => (
              <div key={m.id} className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: '#fff', opacity: m.is_active !== false ? 1 : 0.6 }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: '#f0f2f5' }}>
                  {m.logo_url ? (
                    <img src={m.logo_url} alt={m.name} className="w-10 h-10 object-contain"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                  ) : null}
                  <span className="text-xl" style={{ display: m.logo_url ? 'none' : 'flex' }}>🏪</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>{m.name}</div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: m.is_active !== false ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.06)',
                        color: m.is_active !== false ? '#16A34A' : 'rgba(0,0,0,0.4)',
                      }}>
                      {m.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {m.category || 'No category'} · {vouchers.filter(v => v.merchant_id === m.id).length} vouchers
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleMerchantActive(m)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: m.is_active !== false ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
                      color: m.is_active !== false ? '#DC2626' : '#16A34A',
                    }}>
                    {m.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEditMerchant(m)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merchant form panel */}
          <div className="col-span-1">
            {showMerchantForm ? (
              <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#fff' }}>
                <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
                  {editingMerchant ? 'Edit Merchant' : 'New Merchant'}
                </div>

                {merchantError && (
                  <div className="text-xs px-3 py-2 rounded-xl"
                    style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {merchantError}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Merchant name *</label>
                  <input type="text" value={merchantForm.name}
                    onChange={e => merchantField('name', e.target.value)}
                    placeholder="e.g. KFC Uganda"
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Category</label>
                  <input type="text" value={merchantForm.category}
                    onChange={e => merchantField('category', e.target.value)}
                    placeholder="e.g. Food & Dining"
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>

                {/* Logo upload */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: ADMIN_PRIMARY }}>Logo</label>
                  <label className="cursor-pointer flex flex-col items-center justify-center rounded-xl py-4 gap-2"
                    style={{
                      border: merchantLogoError ? '2px dashed #DC2626' : '2px dashed rgba(27,79,114,0.2)',
                      background: '#f8f9fa',
                    }}>
                    {merchantLogoPreview ? (
                      <img src={merchantLogoPreview} alt="Logo preview"
                        className="w-14 h-14 object-contain rounded-lg" />
                    ) : (
                      <>
                        <span className="text-2xl">🏪</span>
                        <span className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          Upload logo
                        </span>
                      </>
                    )}
                    <input type="file" accept=".png,.jpg,.jpeg,.svg"
                      className="hidden" onChange={handleMerchantLogoSelect} />
                  </label>
                  {merchantLogoError ? (
                    <div className="text-xs" style={{ color: '#DC2626' }}>{merchantLogoError}</div>
                  ) : (
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                      PNG, JPEG or SVG · Max 2MB
                    </div>
                  )}
                  {merchantLogoPreview && (
                    <button
                      onClick={() => { setMerchantLogoFile(null); setMerchantLogoPreview(null) }}
                      className="text-xs font-semibold self-start px-2 py-1 rounded-lg"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      Remove logo
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setShowMerchantForm(false); setEditingMerchant(null) }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: '#f0f2f5', color: 'rgba(0,0,0,0.5)' }}>
                    Cancel
                  </button>
                  <button onClick={saveMerchant} disabled={savingMerchant}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: savingMerchant ? 'rgba(27,79,114,0.4)' : ADMIN_PRIMARY, color: '#fff' }}>
                    {savingMerchant ? 'Saving...' : editingMerchant ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: '#fff' }}>
                <div className="text-2xl mb-2">🏪</div>
                <div className="text-xs font-semibold mb-1" style={{ color: ADMIN_PRIMARY }}>Merchant directory</div>
                <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Add merchants here before creating vouchers for them.
                </div>
                <button onClick={openNewMerchant}
                  className="w-full py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: ADMIN_PRIMARY, color: '#fff' }}>
                  + Add merchant
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}