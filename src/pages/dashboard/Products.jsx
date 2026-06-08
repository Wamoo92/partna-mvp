import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

function generateProductCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'PRD-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatAmountInput(val) {
  const digits = val.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function Products({ admin, business }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)

  // Single product form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Bulk upload
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkParsed, setBulkParsed] = useState([])
  const [bulkErrors, setBulkErrors] = useState([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const fileInputRef = useRef()

  // Search / filter
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (business) loadProducts()
  }, [business])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function handleAddProduct() {
    setError('')
    const parsedPrice = parseInt(price.replace(/,/g, ''), 10)
    if (!name.trim()) { setError('Product name is required.'); return }
    if (!parsedPrice || parsedPrice < 1) { setError('Please enter a valid price.'); return }

    setSaving(true)
    try {
      // Generate unique product code
      let code = generateProductCode()
      // Ensure uniqueness (retry if collision)
      const { data: existing } = await supabase
        .from('products').select('id').eq('product_code', code)
      if (existing && existing.length > 0) code = generateProductCode()

      const { error: insertError } = await supabase.from('products').insert({
        business_id: business.id,
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        product_code: code,
        is_active: true,
      })

      if (insertError) throw insertError

      setSuccess('Product added successfully. Code: ' + code)
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

  // ── CSV template download ──
  function downloadTemplate() {
    const csv = 'product name,description (optional),price\nExample Product,A great product,150000\nAnother Product,,75000'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'partna_products_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── CSV parsing ──
  function handleBulkFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setBulkFile(file)
    setBulkErrors([])
    setBulkParsed([])
    setBulkResult(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setBulkErrors(['CSV file is empty or has no data rows.']); return }

      const rows = []
      const errors = []

      // Skip header row (index 0)
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const [pName, pDesc, pPrice] = cols
        const parsedPrice = parseInt((pPrice || '').replace(/[^0-9]/g, ''), 10)

        if (!pName) { errors.push(`Row ${i + 1}: Product name is required.`); continue }
        if (!parsedPrice || parsedPrice < 1) { errors.push(`Row ${i + 1}: Invalid price "${pPrice}".`); continue }

        rows.push({ name: pName, description: pDesc || null, price: parsedPrice })
      }

      setBulkParsed(rows)
      setBulkErrors(errors)
    }
    reader.readAsText(file)
  }

  async function handleBulkUpload() {
    if (bulkParsed.length === 0) return
    setBulkUploading(true)
    let imported = 0
    let failed = 0

    for (const row of bulkParsed) {
      try {
        let code = generateProductCode()
        const { data: existing } = await supabase
          .from('products').select('id').eq('product_code', code)
        if (existing && existing.length > 0) code = generateProductCode()

        const { error } = await supabase.from('products').insert({
          business_id: business.id,
          name: row.name,
          description: row.description || null,
          price: row.price,
          product_code: code,
          is_active: true,
        })

        if (error) { failed++; continue }
        imported++
      } catch (e) {
        failed++
      }
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
    <div className="flex flex-col gap-6">

      {/* Success message */}
      {success && (
        <div className="px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>
          ✓ {success}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search products or codes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm outline-none flex-1 max-w-xs"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.15)', color: '#333' }}
          />
          <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowBulkModal(true); setBulkFile(null); setBulkParsed([]); setBulkErrors([]); setBulkResult(null) }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: '#fff', color: PARTNA_PRIMARY, border: `1.5px solid rgba(27,79,114,0.2)` }}>
            📤 Bulk add
          </button>
          <button onClick={() => { setShowAddModal(true); setError(''); setName(''); setDescription(''); setPrice('') }}
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
            + Add product
          </button>
        </div>
      </div>

      {/* Products table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff' }}>
          <div className="text-4xl mb-3">🛍️</div>
          <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
            {searchQuery ? 'No products match your search' : 'No products yet'}
          </div>
          <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {searchQuery
              ? 'Try a different search term'
              : 'Add your first product to create savings campaigns for your customers'}
          </div>
          {!searchQuery && (
            <button onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
              Add first product
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="grid px-5 py-3 text-xs font-bold"
            style={{
              gridTemplateColumns: '2fr 3fr 1.5fr 1fr auto',
              color: 'rgba(0,0,0,0.35)',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              background: '#fafafa',
            }}>
            <span>Product</span>
            <span>Description</span>
            <span>Price</span>
            <span>Code</span>
            <span></span>
          </div>
          {filteredProducts.map((p, i) => (
            <div key={p.id} className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '2fr 3fr 1.5fr 1fr auto',
                borderBottom: i < filteredProducts.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}>
              <div className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{p.name}</div>
              <div className="text-xs truncate pr-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {p.description || '—'}
              </div>
              <div className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                {formatUGX(p.price)}
              </div>
              <div className="text-xs font-mono font-bold" style={{ color: PARTNA_GOLD }}>
                {p.product_code}
              </div>
              <button onClick={() => handleDeactivate(p.id)}
                className="text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD PRODUCT MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Add product</div>
              <button onClick={() => setShowAddModal(false)}
                className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Product name *
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Samsung Galaxy A55"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Description <span style={{ color: 'rgba(0,0,0,0.35)' }}>(optional)</span>
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={2} placeholder="Brief description of the product"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                  Price (UGX) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
                    style={{ color: 'rgba(0,0,0,0.35)' }}>UGX</span>
                  <input type="text" inputMode="numeric" value={price}
                    onChange={e => setPrice(formatAmountInput(e.target.value))}
                    placeholder="0"
                    className="w-full pl-14 pr-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#f0f2f5', border: 'none', color: '#333' }} />
                </div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                  This will be the savings target for customers
                </div>
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl mb-4 text-xs"
              style={{ background: 'rgba(27,79,114,0.06)', color: PARTNA_PRIMARY }}>
              A unique product code (e.g. <strong>PRD-A1B2C3</strong>) will be automatically generated.
            </div>

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl mb-4" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                Cancel
              </button>
              <button onClick={handleAddProduct} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: saving ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                {saving ? 'Adding...' : 'Add product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto"
            style={{ background: '#fff', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>Bulk add products</div>
              <button onClick={() => setShowBulkModal(false)}
                className="text-xl" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            {/* Template download */}
            <div className="px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: PARTNA_PRIMARY }}>
                CSV format required
              </div>
              <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Your CSV must have columns: <strong>product name</strong>, <strong>description (optional)</strong>, <strong>price</strong>
              </div>
              <button onClick={downloadTemplate}
                className="text-xs font-semibold underline" style={{ color: PARTNA_PRIMARY }}>
                Download CSV template
              </button>
            </div>

            {/* File upload area */}
            {!bulkResult && (
              <>
                <label className="cursor-pointer flex flex-col items-center justify-center rounded-xl py-8 mb-4"
                  style={{ border: '2px dashed rgba(27,79,114,0.25)', background: '#f8f9fa' }}>
                  <span className="text-2xl mb-2">📄</span>
                  <span className="text-sm font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    {bulkFile ? bulkFile.name : 'Click to upload CSV'}
                  </span>
                  <span className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {bulkFile ? `${bulkParsed.length} valid rows, ${bulkErrors.length} errors` : 'CSV files only'}
                  </span>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                    onChange={handleBulkFileSelect} />
                </label>

                {/* Parse errors */}
                {bulkErrors.length > 0 && (
                  <div className="rounded-xl px-4 py-3 mb-4"
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div className="text-xs font-bold mb-2" style={{ color: '#991B1B' }}>
                      {bulkErrors.length} error{bulkErrors.length !== 1 ? 's' : ''} found:
                    </div>
                    {bulkErrors.map((e, i) => (
                      <div key={i} className="text-xs" style={{ color: '#DC2626' }}>{e}</div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                {bulkParsed.length > 0 && (
                  <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="px-4 py-2 text-xs font-bold"
                      style={{ background: '#fafafa', color: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      PREVIEW — {bulkParsed.length} product{bulkParsed.length !== 1 ? 's' : ''} ready to import
                    </div>
                    {bulkParsed.slice(0, 5).map((row, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-2.5"
                        style={{ borderBottom: i < Math.min(bulkParsed.length, 5) - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>{row.name}</div>
                          {row.description && (
                            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.description}</div>
                          )}
                        </div>
                        <div className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                          {formatUGX(row.price)}
                        </div>
                      </div>
                    ))}
                    {bulkParsed.length > 5 && (
                      <div className="px-4 py-2 text-xs text-center" style={{ color: 'rgba(0,0,0,0.35)' }}>
                        + {bulkParsed.length - 5} more
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Result */}
            {bulkResult && (
              <div className="rounded-xl p-5 mb-4 text-center"
                style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm font-bold mb-1" style={{ color: '#16A34A' }}>Import complete</div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  {bulkResult.imported} product{bulkResult.imported !== 1 ? 's' : ''} imported successfully
                  {bulkResult.failed > 0 && ` · ${bulkResult.failed} failed`}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f0f2f5', color: PARTNA_PRIMARY }}>
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkResult && bulkParsed.length > 0 && (
                <button onClick={handleBulkUpload} disabled={bulkUploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: bulkUploading ? 'rgba(27,79,114,0.3)' : PARTNA_PRIMARY, color: '#fff' }}>
                  {bulkUploading ? 'Importing...' : `Import ${bulkParsed.length} product${bulkParsed.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}