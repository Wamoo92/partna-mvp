import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function downloadTemplate() {
  const csv = [['first_name','last_name','school_student_id','year_group','stream'],['Sarah','Nakato','ADM-001','S3','Arts'],['David','Okello','ADM-002','S4','Science']].map(r => r.join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'partna-student-import-template.csv'; a.click()
}

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

const inputStyle   = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle   = { display: 'block', fontSize: 13, fontWeight: 600, color: C.black, marginBottom: 5 }
const hintStyle    = { fontSize: 11, fontWeight: 500, color: C.grayMid, marginTop: 4 }
const btnPrimary   = { padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }

function Modal({ title, onClose, footer, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

// ── Import result modal — unchanged ────────────────────────────────────────
function ImportResultModal({ result, onClose }) {
  if (!result) return null
  const hasErrors = result.failedRows > 0
  return (
    <Modal title={hasErrors ? 'Import completed with errors' : 'Import successful'} onClose={onClose}
      footer={<button onClick={onClose} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '10px' }}>Done</button>}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden' }}>
        {[
          { label: 'Total rows', value: result.totalRows,    color: C.black },
          { label: 'Imported',   value: result.importedRows, color: C.green },
          { label: 'Failed',     value: result.failedRows,   color: result.failedRows > 0 ? C.red : C.grayMid },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < 2 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: row.color }}>{row.value}</span>
          </div>
        ))}
      </div>
      {hasErrors && result.errors?.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Failed rows</p>
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
            {result.errors.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 14px', borderBottom: i < result.errors.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.secondary, flexShrink: 0 }}>Row {e.row}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.red }}>{e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Students({ admin, business }) {
  const [students, setStudents]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterYear, setFilterYear]     = useState('')
  const [filterActive, setFilterActive] = useState('active')
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef                         = useRef(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm]           = useState({ first_name: '', last_name: '', school_student_id: '', year_group: '', stream: '' })
  const [addError, setAddError]         = useState('')
  const [addSaving, setAddSaving]       = useState(false)

  useEffect(() => { if (business) loadStudents() }, [business])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadStudents() {
    setLoading(true)
    try {
      const { data } = await supabase.from('students').select('*, customer_campaigns(id, status, customers(first_name, last_name, phone))').eq('business_id', business.id).order('last_name', { ascending: true })
      setStudents(data || [])
    } catch (e) { console.error('Load students error:', e) }
    setLoading(false)
  }

  const yearGroups = [...new Set(students.map(s => s.year_group).filter(Boolean))].sort()

  const filtered = students.filter(s => {
    if (filterActive === 'active'   && !s.is_active) return false
    if (filterActive === 'inactive' &&  s.is_active) return false
    if (filterYear && s.year_group !== filterYear)   return false
    if (search) { const q = search.toLowerCase(); if (!s.first_name?.toLowerCase().includes(q) && !s.last_name?.toLowerCase().includes(q) && !s.partna_student_id?.toLowerCase().includes(q) && !s.school_student_id?.toLowerCase().includes(q)) return false }
    return true
  })

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    setImporting(true)
    try {
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = ev => resolve(ev.target.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file) })
      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ businessId: business.id, importedBy: admin?.id || null, fileName: file.name, csvContent: base64 }) })
      const data = await res.json(); setImportResult(data); await loadStudents()
    } catch (err) { console.error('Import error:', err); setImportResult({ success: false, error: 'Import failed. Please try again.' }) }
    setImporting(false)
  }

  async function handleAddStudent() {
    setAddError('')
    if (!addForm.first_name.trim()) { setAddError('First name is required.'); return }
    if (!addForm.last_name.trim())  { setAddError('Last name is required.'); return }
    setAddSaving(true)
    try {
      const { error } = await supabase.from('students').insert({ business_id: business.id, partna_student_id: '', first_name: addForm.first_name.trim(), last_name: addForm.last_name.trim(), school_student_id: addForm.school_student_id.trim() || null, year_group: addForm.year_group.trim() || null, stream: addForm.stream.trim() || null })
      if (error) { setAddError(error.code === '23505' ? 'A student with this ID already exists.' : 'Could not add student. Please try again.'); setAddSaving(false); return }
      setShowAddModal(false); setAddForm({ first_name: '', last_name: '', school_student_id: '', year_group: '', stream: '' }); await loadStudents()
    } catch (e) { setAddError('Something went wrong. Please try again.') }
    setAddSaving(false)
  }

  async function handleToggleActive(student) {
    try {
      await supabase.from('students').update({ is_active: !student.is_active }).eq('id', student.id)
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_active: !s.is_active } : s))
    } catch (e) { console.error('Toggle active error:', e) }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const activeCount   = students.filter(s =>  s.is_active).length
  const inactiveCount = students.filter(s => !s.is_active).length
  const noStudents    = !loading && students.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}

      {/* Add student modal */}
      {showAddModal && (
        <Modal title="Add student" onClose={() => { setShowAddModal(false); setAddError('') }}
          footer={<>
            <button onClick={() => { setShowAddModal(false); setAddError('') }} style={{ ...btnSecondary, flex: 1, justifyContent: 'center', padding: '10px' }}>Cancel</button>
            <button onClick={handleAddStudent} disabled={addSaving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '10px', opacity: addSaving ? 0.75 : 1 }}>
              {addSaving ? <><div className="spinner spinner-sm spinner-light" /> Saving…</> : 'Add student'}
            </button>
          </>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'First name *', key: 'first_name' },
              { label: 'Last name *',  key: 'last_name'  },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="text" value={addForm[f.key]} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>School student ID / Admission number</label>
            <input style={inputStyle} type="text" value={addForm.school_student_id} placeholder="e.g. ADM-001" onChange={e => setAddForm(p => ({ ...p, school_student_id: e.target.value }))}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            <p style={hintStyle}>Your school's own ID for this student. Leave blank if not applicable.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Year group / Class', key: 'year_group', placeholder: 'e.g. S3, P6, Form 4' },
              { label: 'Stream / Section',   key: 'stream',     placeholder: 'e.g. Arts, Science, A' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="text" value={addForm[f.key]} placeholder={f.placeholder} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
              </div>
            ))}
          </div>
          {addError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{addError}</div>}
        </Modal>
      )}

      {/* ── ACTION REQUIRED BANNER — shown when no students added yet ── */}
      {noStudents && (
        <div style={{ background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.red, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              Add students before parents can enrol
            </p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.red, margin: '0 0 14px', lineHeight: '150%', opacity: 0.85 }}>
              When a parent visits your portal and tries to link their child to a campaign, they must find their child in your student register. If no students have been added, the parent will hit a dead end and cannot enrol. Add your students first — then launch your campaign.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={downloadTemplate}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.red, background: C.white, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                ↓ Download CSV template
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.red, background: C.white, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                ↑ Import CSV
              </button>
              <button
                onClick={() => { setShowAddModal(true); setAddError('') }}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.red, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                + Add student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 600, color: C.green, margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.5px' }}>{activeCount}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active students</p>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 600, color: C.grayMid, margin: '0 0 2px', lineHeight: 1, letterSpacing: '-0.5px' }}>{inactiveCount}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inactive students</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" accept=".csv" ref={fileRef} onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={downloadTemplate} style={{ ...btnSecondary, padding: '7px 12px', fontSize: 12 }}
            onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'} onMouseLeave={e => e.currentTarget.style.background = C.white}>
            ↓ CSV template
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ ...btnSecondary, padding: '7px 12px', fontSize: 12, opacity: importing ? 0.75 : 1 }}
            onMouseEnter={e => { if (!importing) e.currentTarget.style.background = '#ECEDE1' }} onMouseLeave={e => e.currentTarget.style.background = C.white}>
            {importing ? <><div className="spinner spinner-sm" /> Importing…</> : '↑ Import CSV'}
          </button>
          <button onClick={() => { setShowAddModal(true); setAddError('') }} style={btnPrimary}>+ Add student</button>
        </div>
      </div>

      {/* Info banner — unchanged */}
      <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
        Download the CSV template to see the required format. Required columns are <strong style={{ color: C.black }}>first_name</strong> and <strong style={{ color: C.black }}>last_name</strong>.
        Optional: school_student_id, year_group, stream. Each student is automatically assigned a unique Partna Student ID (PTN-ST-XXXXX).
      </div>

      {/* ── Filters — unchanged ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input style={{ ...inputStyle, paddingLeft: 30 }} type="text" placeholder="Search by name, Partna ID, or school ID…" value={search} onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 16 }}>✕</button>}
        </div>
        <select style={{ ...inputStyle, width: 'auto', minWidth: 140 }} value={filterYear} onChange={e => setFilterYear(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
          <option value="">All year groups</option>
          {yearGroups.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4 }}>
          {[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }].map(f => (
            <button key={f.value} onClick={() => setFilterActive(f.value)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: filterActive === f.value ? C.black : 'transparent', color: filterActive === f.value ? C.white : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table / empty states — unchanged ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
      ) : students.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>No students yet</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, maxWidth: 360 }}>
            Import your full student register using the CSV template for the fastest setup, or add students one by one.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={downloadTemplate} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 13 }}>↓ Download template</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 13 }}>↑ Import CSV</button>
            <button onClick={() => { setShowAddModal(true); setAddError('') }} style={{ ...btnPrimary, padding: '9px 16px', fontSize: 13 }}>+ Add student</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary }}>
          No students match your search or filters.
        </div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                  {['Student', 'Partna ID', 'School ID', 'Year group', 'Stream', 'Enrolled parent', 'Added', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => {
                  const parent = student.customer_campaigns?.find(cc => cc.status === 'active')?.customers
                  return (
                    <tr key={student.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg, opacity: student.is_active ? 1 : 0.6 }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.black }}>{student.first_name} {student.last_name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: C.green }}>{student.partna_student_id}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: C.secondary }}>{student.school_student_id || '—'}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{student.year_group || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{student.stream || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {parent ? (
                          <>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{parent.first_name} {parent.last_name}</p>
                            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{parent.phone}</p>
                          </>
                        ) : <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, fontStyle: 'italic' }}>No parent enrolled</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
                        {student.imported_at ? formatDateTime(student.imported_at) + ' (imported)' : formatDateTime(student.created_at)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {student.is_active
                          ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,   borderRadius: 6, padding: '3px 8px' }}>Active</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: C.grayMid, background: C.grayLight, borderRadius: 6, padding: '3px 8px' }}>Inactive</span>
                        }
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => handleToggleActive(student)} style={{ ...(student.is_active ? { ...btnSecondary, fontSize: 12, padding: '5px 10px' } : { ...btnPrimary, fontSize: 12, padding: '5px 10px' }), whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { if (student.is_active) e.currentTarget.style.background = '#ECEDE1' }} onMouseLeave={e => { if (student.is_active) e.currentTarget.style.background = C.white }}>
                          {student.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
            Showing {filtered.length} of {students.length} students
          </div>
        </div>
      )}
    </div>
  )
}