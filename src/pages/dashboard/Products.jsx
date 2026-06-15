import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function generateProductCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'PRD-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function Products({ admin, business }) {
  const [products, setProducts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [success, setSuccess]         = useState('')

  // Single product form
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Bulk upload
  const [bulkFile, setBulkFile]           = useState(null)
  const [bulkParsed, setBulkParsed]       = useState([])
  const [bulkErrors, setBulkErrors]       = useState([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult]       = useState(null)
  const fileInputRef = useRef()

  useEffect(() => { if (business) loadProducts() }, [business])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products').select('*')
      .eq('business_id', business.id).eq('is_active', true)
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function handleAddProduct() {
    setError('')
    const parsedPrice = parseInt(price.replace(/,/g, ''), 10)
    if (!name.trim())                 { setError('Product name is required.'); return }
    if (!parsedPrice || parsedPrice < 1) { setError('Please enter a valid price.'); return }

    setSaving(true)
    try {
      let code = generateProductCode()
      const { data: existing } = await supabase.from('products').select('id').eq('product_code', code)
      if (existing?.length > 0) code = generateProductCode()

      const { error: insertError } = await supabase.from('products').insert({
        business_id: business.id, name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice, product_code: code, is_active: true,
      })
      if (insertError) throw insertError

      setSuccess('Product added — code: ' + code)
      setName(''); setDescription(''); setPrice('')
      setShowAddModal(false)
      await loadProducts()
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError('Could not add product. Please try again.')
    }
    setSaving(false)
  }

  async function handleDeactivate(productId) {
    await supabase.from('products').update({ is_active: false }).eq('id', productId)
    await loadProducts()
  }

  function downloadTemplate() {
    const csv = 'product name,description (optional),price\nExample Product,A great product,150000\nAnother Product,,75000'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'partna_products_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleBulkFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setBulkFile(file); setBulkErrors([]); setBulkParsed([]); setBulkResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setBulkErrors(['CSV file is empty or has no data rows.']); return }

      const rows = []; const errors = []
      for (let i = 1; i < lines.length; i++) {
        const [pName, pDesc, pPrice] = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const parsedPrice = parseInt((pPrice || '').replace(/[^0-9]/g, ''), 10)
        if (!pName)                        { errors.push(`Row ${i + 1}: Product name is required.`); continue }
        if (!parsedPrice || parsedPrice < 1) { errors.push(`Row ${i + 1}: Invalid price "${pPrice}".`); continue }
        rows.push({ name: pName, description: pDesc || null, price: parsedPrice })
      }
      setBulkParsed(rows); setBulkErrors(errors)
    }
    reader.readAsText(file)
  }

  async function handleBulkUpload() {
    if (bulkParsed.length === 0) return
    setBulkUploading(true)
    let imported = 0; let failed = 0

    for (const row of bulkParsed) {
      try {
        let code = generateProductCode()
        const { data: existing } = await supabase.from('products').select('id').eq('product_code', code)
        if (existing?.length > 0) code = generateProductCode()
        const { error } = await supabase.from('products').insert({
          business_id: business.id, name: row.name,
          description: row.description || null,
          price: row.price, product_code: code, is_active: true,
        })
        if (error) { failed++; continue }
        imported++
      } catch { failed++ }
    }

    setBulkResult({ imported, failed })
    setBulkUploading(false)
    await loadProducts()
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.product_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── Success toast ── */}
      {success && (
        <div className="alert alert-success">
          <span className="icon-outlined alert-icon">check_circle</span>
          <div className="alert-content">{success}</div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
          <div className="search-wrapper" style={{ maxWidth: 320 }}>
            <span className="icon-outlined search-icon">search</span>
            <input
              type="text"
              className="input search-input"
              placeholder="Search products or codes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>
                <span className="icon-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
            color: 'var(--color-grey)',
          }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={() => { setShowBulkModal(true); setBulkFile(null); setBulkParsed([]); setBulkErrors([]); setBulkResult(null) }}
            className="btn btn-secondary btn-sm"
          >
            <span className="icon-outlined icon-xs">upload</span>
            Bulk add
          </button>
          <button
            onClick={() => { setShowAddModal(true); setError(''); setName(''); setDescription(''); setPrice('') }}
            className="btn btn-primary"
          >
            <span className="icon-outlined icon-sm">add</span>
            Add product
          </button>
        </div>
      </div>

      {/* ── Products table ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div className="spinner spinner-lg spinner-purple" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
            inventory_2
          </span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {searchQuery ? 'No products match your search' : 'No products yet'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-5)' }}>
            {searchQuery
              ? 'Try a different search term.'
              : 'Add your first product to create savings campaigns for your customers.'}
          </div>
          {!searchQuery && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-lg">
              <span className="icon-outlined icon-sm">add</span>
              Add first product
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Description</th>
                <th>Price</th>
                <th>Code</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 'var(--weight-semibold)' }}>{p.name}</td>
                  <td>
                    <span style={{ color: 'var(--color-grey)', fontStyle: p.description ? 'normal' : 'italic' }}>
                      {p.description || '—'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 'var(--weight-bold)' }}>{formatUGX(p.price)}</td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 'var(--weight-black)',
                      fontSize: 'var(--text-xs)',
                      background: 'var(--color-black)',
                      color: 'var(--color-primary)',
                      padding: '3px var(--space-3)',
                      border: 'var(--border)',
                      letterSpacing: '0.08em',
                    }}>
                      {p.product_code}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleDeactivate(p.id)} className="btn btn-sm btn-danger">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD PRODUCT MODAL ── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Add product</span>
              <button onClick={() => setShowAddModal(false)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              <div className="input-group">
                <label className="input-label">Product name <span className="required">*</span></label>
                <input type="text" className="input" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Samsung Galaxy A55" />
              </div>

              <div className="input-group">
                <label className="input-label">
                  Description{' '}
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 'var(--weight-regular)', color: 'var(--color-grey)' }}>
                    (optional)
                  </span>
                </label>
                <textarea className="input" value={description} onChange={e => setDescription(e.target.value)}
                  rows={2} placeholder="Brief description of the product" />
              </div>

              <div className="input-group">
                <label className="input-label">Price (UGX) <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span style={{
                    position: 'absolute', left: 'var(--space-4)',
                    fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-grey)', pointerEvents: 'none', zIndex: 1,
                  }}>UGX</span>
                  <input type="text" inputMode="numeric" className="input" value={price}
                    onChange={e => setPrice(formatAmountInput(e.target.value))}
                    placeholder="0" style={{ paddingLeft: 56 }} />
                </div>
                <span className="input-hint">This will be the savings target for customers.</span>
              </div>

              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">info</span>
                <div className="alert-content">
                  A unique product code (e.g. <strong>PRD-A1B2C3</strong>) will be automatically generated.
                </div>
              </div>

              {error && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{error}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleAddProduct} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                {saving
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Adding…</>
                  : <><span className="icon-outlined icon-sm">add</span> Add product</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {showBulkModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">Bulk add products</span>
              <button onClick={() => setShowBulkModal(false)} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: '65vh', overflowY: 'auto' }}>

              {/* CSV format info */}
              <div className="alert alert-info">
                <span className="icon-outlined alert-icon">table_chart</span>
                <div className="alert-content">
                  <div className="alert-title">CSV format required</div>
                  Columns: <strong>product name</strong>, <strong>description (optional)</strong>, <strong>price</strong>
                  <br />
                  <button onClick={downloadTemplate} style={{
                    background: 'none', border: 'none', padding: 0, marginTop: 'var(--space-1)',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                    color: 'var(--color-black)', cursor: 'pointer',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                    Download CSV template
                  </button>
                </div>
              </div>

              {!bulkResult && (
                <>
                  {/* Drop zone */}
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-8)',
                    border: bulkFile ? 'var(--border-thick)' : '2px dashed var(--color-grey-mid)',
                    background: bulkFile ? 'var(--color-bg)' : 'var(--color-white)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                  }}>
                    <div style={{
                      width: 48, height: 48,
                      background: bulkFile ? 'var(--color-green)' : 'var(--color-grey-light)',
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 24 }}>
                        {bulkFile ? 'check' : 'upload_file'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                        {bulkFile ? bulkFile.name : 'Click to upload CSV'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                        {bulkFile
                          ? `${bulkParsed.length} valid rows · ${bulkErrors.length} errors`
                          : 'CSV files only'}
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
                      onChange={handleBulkFileSelect} />
                  </label>

                  {/* Parse errors */}
                  {bulkErrors.length > 0 && (
                    <div className="alert alert-danger">
                      <span className="icon-outlined alert-icon">error_outline</span>
                      <div className="alert-content">
                        <div className="alert-title">{bulkErrors.length} error{bulkErrors.length !== 1 ? 's' : ''} found</div>
                        {bulkErrors.map((e, i) => (
                          <div key={i} style={{ marginTop: 2 }}>{e}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {bulkParsed.length > 0 && (
                    <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'var(--color-black)',
                        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)',
                        letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase',
                        color: 'var(--color-white)',
                      }}>
                        Preview — {bulkParsed.length} product{bulkParsed.length !== 1 ? 's' : ''} ready to import
                      </div>
                      {bulkParsed.slice(0, 5).map((row, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: 'var(--space-3) var(--space-4)',
                          borderBottom: i < Math.min(bulkParsed.length, 5) - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                          background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                        }}>
                          <div>
                            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{row.name}</div>
                            {row.description && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>{row.description}</div>
                            )}
                          </div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', flexShrink: 0, marginLeft: 'var(--space-4)' }}>
                            {formatUGX(row.price)}
                          </div>
                        </div>
                      ))}
                      {bulkParsed.length > 5 && (
                        <div style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)', textAlign: 'center', background: 'var(--color-bg)' }}>
                          + {bulkParsed.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Result */}
              {bulkResult && (
                <div style={{ background: 'var(--color-green)', border: 'var(--border)', padding: 'var(--space-6)', textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56, background: 'var(--color-black)', border: 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto var(--space-3)',
                  }}>
                    <span className="icon-outlined" style={{ fontSize: 28, color: 'var(--color-white)' }}>check</span>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                    Import complete
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(0,0,0,0.6)' }}>
                    <strong>{bulkResult.imported}</strong> product{bulkResult.imported !== 1 ? 's' : ''} imported successfully
                    {bulkResult.failed > 0 && ` · ${bulkResult.failed} failed`}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowBulkModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkResult && bulkParsed.length > 0 && (
                <button onClick={handleBulkUpload} disabled={bulkUploading} className="btn btn-primary" style={{ flex: 1 }}>
                  {bulkUploading
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Importing…</>
                    : <><span className="icon-outlined icon-sm">upload</span> Import {bulkParsed.length} product{bulkParsed.length !== 1 ? 's' : ''}</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}