import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function generateProductCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'PRD-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}
function formatUGX(n) { return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 }) }
function formatAmountInput(val) { return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  labelBg:  '#E4E5DD',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  grayLight:'#ECECEC',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
  orange:   '#EF8354',
  bgOrange: '#F8F0E4',
  blue:     '#85A0C5',
}

const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }
const btnPrimary = { padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnDanger    = { ...btnPrimary, background: C.red, borderColor: C.red }

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, footer, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: wide ? 520 : 440, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, padding: 4, lineHeight: 1, fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

export default function Products({
 admin, business }) {
  useEffect(() => { document.title = 'Products - Partna' }, [])

  const [products, setProducts]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [success, setSuccess]             = useState('')

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const [bulkFile, setBulkFile]           = useState(null)
  const [bulkParsed, setBulkParsed]       = useState([])
  const [bulkErrors, setBulkErrors]       = useState([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult]       = useState(null)
  const fileInputRef = useRef()

  useEffect(() => { if (business) loadProducts() }, [business])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('business_id', business.id).eq('is_active', true).order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function handleAddProduct() {
    setError('')
    const parsedPrice = parseInt(price.replace(/,/g, ''), 10)
    if (!name.trim())                    { setError('Product name is required.'); return }
    if (!parsedPrice || parsedPrice < 1) { setError('Please enter a valid price.'); return }
    setSaving(true)
    try {
      let code = generateProductCode()
      const { data: existing } = await supabase.from('products').select('id').eq('product_code', code)
      if (existing?.length > 0) code = generateProductCode()
      const { error: insertError } = await supabase.from('products').insert({ business_id: business.id, name: name.trim(), description: description.trim() || null, price: parsedPrice, product_code: code, is_active: true })
      if (insertError) throw insertError
      setSuccess('Product added — code: ' + code); setName(''); setDescription(''); setPrice(''); setShowAddModal(false)
      await loadProducts(); setTimeout(() => setSuccess(''), 4000)
    } catch (e) { setError('Could not add product. Please try again.') }
    setSaving(false)
  }

  async function handleDeactivate(productId) {
    await supabase.from('products').update({ is_active: false }).eq('id', productId)
    await loadProducts()
  }

  function downloadTemplate() {
    const csv = 'product name,description (optional),price\nExample Product,A great product,150000\nAnother Product,,75000'
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'partna_products_template.csv'; a.click()
  }

  function handleBulkFileSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setBulkFile(file); setBulkErrors([]); setBulkParsed([]); setBulkResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setBulkErrors(['CSV file is empty or has no data rows.']); return }
      const rows = []; const errors = []
      for (let i = 1; i < lines.length; i++) {
        const [pName, pDesc, pPrice] = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const parsedPrice = parseInt((pPrice || '').replace(/[^0-9]/g, ''), 10)
        if (!pName)                         { errors.push(`Row ${i + 1}: Product name is required.`); continue }
        if (!parsedPrice || parsedPrice < 1) { errors.push(`Row ${i + 1}: Invalid price "${pPrice}".`); continue }
        rows.push({ name: pName, description: pDesc || null, price: parsedPrice })
      }
      setBulkParsed(rows); setBulkErrors(errors)
    }
    reader.readAsText(file)
  }

  async function handleBulkUpload() {
    if (bulkParsed.length === 0) return
    setBulkUploading(true); let imported = 0; let failed = 0
    for (const row of bulkParsed) {
      try {
        let code = generateProductCode()
        const { data: existing } = await supabase.from('products').select('id').eq('product_code', code)
        if (existing?.length > 0) code = generateProductCode()
        const { error } = await supabase.from('products').insert({ business_id: business.id, name: row.name, description: row.description || null, price: row.price, product_code: code, is_active: true })
        if (error) { failed++; continue }; imported++
      } catch { failed++ }
    }
    setBulkResult({ imported, failed }); setBulkUploading(false); await loadProducts()
  }

  // ─────────────────────────────────────────────────────────────────────────

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.product_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Success toast */}
      {success && (
        <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.green }}>{success}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input style={{ ...inputStyle, paddingLeft: 30 }} type="text" placeholder="Search products or codes…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 16 }}>✕</button>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowBulkModal(true); setBulkFile(null); setBulkParsed([]); setBulkErrors([]); setBulkResult(null) }} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}
            onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'} onMouseLeave={e => e.currentTarget.style.background = C.white}>
            Bulk add
          </button>
          <button onClick={() => { setShowAddModal(true); setError(''); setName(''); setDescription(''); setPrice('') }} style={btnPrimary}>
            + Add product
          </button>
        </div>
      </div>

      {/* Products table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{searchQuery ? 'No products match your search' : 'No products yet'}</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>{searchQuery ? 'Try a different search term.' : 'Add your first product to create savings campaigns for your customers.'}</p>
          {!searchQuery && <button onClick={() => setShowAddModal(true)} style={{ ...btnPrimary, marginTop: 4 }}>+ Add first product</button>}
        </div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                  {['Product', 'Description', 'Price', 'Code', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < filteredProducts.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.black }}>{p.name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: p.description ? C.secondary : C.grayMid, fontStyle: p.description ? 'normal' : 'italic' }}>{p.description || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.black, whiteSpace: 'nowrap' }}>{formatUGX(p.price)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.white, background: C.black, borderRadius: 6, padding: '3px 8px', letterSpacing: '0.06em' }}>{p.product_code}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => handleDeactivate(p.id)} style={{ ...btnDanger, padding: '5px 10px', fontSize: 12 }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADD PRODUCT MODAL ── */}
      {showAddModal && (
        <Modal title="Add product" onClose={() => setShowAddModal(false)}
          footer={<>
            <button onClick={() => setShowAddModal(false)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleAddProduct} disabled={saving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: saving ? 0.75 : 1 }}>
              {saving ? <><div className="spinner spinner-sm spinner-light" /> Adding…</> : '+ Add product'}
            </button>
          </>}>
          <div>
            <label style={labelStyle}>Product name *</label>
            <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Samsung Galaxy A55"
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          </div>
          <div>
            <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: C.grayMid }}>(optional)</span></label>
            <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the product"
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          </div>
          <div>
            <label style={labelStyle}>Price (UGX) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: C.secondary, pointerEvents: 'none' }}>UGX</span>
              <input style={{ ...inputStyle, paddingLeft: 52 }} type="text" inputMode="numeric" value={price} onChange={e => setPrice(formatAmountInput(e.target.value))} placeholder="0"
                onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>This will be the savings target for customers.</p>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>
            A unique product code (e.g. <strong style={{ color: C.black, fontFamily: 'monospace' }}>PRD-A1B2C3</strong>) will be automatically generated.
          </div>
          {error && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{error}</div>}
        </Modal>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {showBulkModal && (
        <Modal title="Bulk add products" onClose={() => setShowBulkModal(false)} wide
          footer={<>
            <button onClick={() => setShowBulkModal(false)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>{bulkResult ? 'Close' : 'Cancel'}</button>
            {!bulkResult && bulkParsed.length > 0 && (
              <button onClick={handleBulkUpload} disabled={bulkUploading} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: bulkUploading ? 0.75 : 1 }}>
                {bulkUploading ? <><div className="spinner spinner-sm spinner-light" /> Importing…</> : `Import ${bulkParsed.length} product${bulkParsed.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </>}>

          {/* Format info */}
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
            Columns required: <strong style={{ color: C.black }}>product name</strong>, <strong style={{ color: C.black }}>description (optional)</strong>, <strong style={{ color: C.black }}>price</strong>
            <br />
            <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', padding: 0, marginTop: 5, fontSize: 12, fontWeight: 600, color: C.black, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Download CSV template
            </button>
          </div>

          {!bulkResult && (
            <>
              {/* Drop zone */}
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 20px', border: `2px dashed ${bulkFile ? C.green : C.grayLine}`, borderRadius: 10, background: bulkFile ? C.bgGreen : C.bg, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: bulkFile ? C.green : C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bulkFile
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  }
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 3px' }}>{bulkFile ? bulkFile.name : 'Click to upload CSV'}</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{bulkFile ? `${bulkParsed.length} valid rows · ${bulkErrors.length} errors` : 'CSV files only'}</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleBulkFileSelect} />
              </label>

              {/* Parse errors */}
              {bulkErrors.length > 0 && (
                <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.red, margin: '0 0 6px' }}>{bulkErrors.length} error{bulkErrors.length !== 1 ? 's' : ''} found</p>
                  {bulkErrors.map((e, i) => <p key={i} style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '2px 0' }}>{e}</p>)}
                </div>
              )}

              {/* Preview */}
              {bulkParsed.length > 0 && (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: C.black, borderBottom: `1px solid ${C.grayLine}` }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preview — {bulkParsed.length} product{bulkParsed.length !== 1 ? 's' : ''} ready to import</p>
                  </div>
                  {bulkParsed.slice(0, 5).map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < Math.min(bulkParsed.length, 5) - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{row.name}</p>
                        {row.description && <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{row.description}</p>}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0, flexShrink: 0, marginLeft: 16 }}>{formatUGX(row.price)}</p>
                    </div>
                  ))}
                  {bulkParsed.length > 5 && (
                    <div style={{ padding: '8px 14px', background: C.bg, textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.secondary }}>+ {bulkParsed.length - 5} more</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Result */}
          {bulkResult && (
            <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>Import complete</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>
                <strong style={{ color: C.black }}>{bulkResult.imported}</strong> product{bulkResult.imported !== 1 ? 's' : ''} imported successfully
                {bulkResult.failed > 0 && ` · ${bulkResult.failed} failed`}
              </p>
            </div>
          )}
        </Modal>
      )}

    </div>
  )
}