import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── CSV template download ──────────────────────────────────────────────────
function downloadTemplate() {
  const csv = [
    ['first_name', 'last_name', 'school_student_id', 'year_group', 'stream'],
    ['Sarah',      'Nakato',    'ADM-001',            'S3',         'Arts'],
    ['David',      'Okello',    'ADM-002',            'S4',         'Science'],
  ].map(r => r.join(',')).join('\n')

  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'partna-student-import-template.csv'
  a.click()
}

// ── Import result modal ────────────────────────────────────────────────────
function ImportResultModal({ result, onClose }) {
  if (!result) return null
  const hasErrors = result.failedRows > 0

  return (
    <div className="modal-backdrop">
      <div className="modal modal-sm">
        <div className="modal-header" style={{ background: hasErrors ? '#8A6700' : '#2D8B45' }}>
          <span className="modal-title">
            {hasErrors ? 'Import completed with errors' : 'Import successful'}
          </span>
          <button onClick={onClose} className="modal-close">
            <span className="icon-outlined icon-sm">close</span>
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Summary */}
          <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
            {[
              { label: 'Total rows',     value: result.totalRows },
              { label: 'Imported',       value: result.importedRows, color: '#2D8B45' },
              { label: 'Failed',         value: result.failedRows,   color: result.failedRows > 0 ? '#C0392B' : undefined },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: row.color || 'var(--color-black)' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Errors */}
          {hasErrors && result.errors?.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
                Failed rows
              </div>
              <div style={{ border: 'var(--border)', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                    padding: 'var(--space-2) var(--space-3)',
                    borderBottom: i < result.errors.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                  }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-grey)', flexShrink: 0 }}>
                      Row {e.row}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: '#C0392B' }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Students({ admin, business }) {
  const [students, setStudents]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterYear, setFilterYear]   = useState('')
  const [filterActive, setFilterActive] = useState('active')

  // Import state
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef                       = useRef(null)

  // Add single student state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm]         = useState({ first_name: '', last_name: '', school_student_id: '', year_group: '', stream: '' })
  const [addError, setAddError]       = useState('')
  const [addSaving, setAddSaving]     = useState(false)

  useEffect(() => { if (business) loadStudents() }, [business])

  async function loadStudents() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('students')
        .select('*, customer_campaigns(id, status, customers(first_name, last_name, phone))')
        .eq('business_id', business.id)
        .order('last_name', { ascending: true })
      setStudents(data || [])
    } catch (e) {
      console.error('Load students error:', e)
    }
    setLoading(false)
  }

  // Unique year groups for filter dropdown
  const yearGroups = [...new Set(students.map(s => s.year_group).filter(Boolean))].sort()

  // Filtered students
  const filtered = students.filter(s => {
    if (filterActive === 'active'   && !s.is_active) return false
    if (filterActive === 'inactive' &&  s.is_active) return false
    if (filterYear && s.year_group !== filterYear)   return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !s.first_name?.toLowerCase().includes(q) &&
        !s.last_name?.toLowerCase().includes(q) &&
        !s.partna_student_id?.toLowerCase().includes(q) &&
        !s.school_student_id?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── CSV import ──────────────────────────────────────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so same file can be re-selected

    setImporting(true)
    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-students`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          businessId:  business.id,
          importedBy:  admin?.id || null,
          fileName:    file.name,
          csvContent:  base64,
        }),
      })

      const data = await res.json()
      setImportResult(data)
      await loadStudents()
    } catch (err) {
      console.error('Import error:', err)
      setImportResult({ success: false, error: 'Import failed. Please try again.' })
    }
    setImporting(false)
  }

  // ── Add single student ──────────────────────────────────────────────────
  async function handleAddStudent() {
    setAddError('')
    if (!addForm.first_name.trim()) { setAddError('First name is required.'); return }
    if (!addForm.last_name.trim())  { setAddError('Last name is required.'); return }

    setAddSaving(true)
    try {
      const { error } = await supabase.from('students').insert({
        business_id:       business.id,
        partna_student_id: '',
        first_name:        addForm.first_name.trim(),
        last_name:         addForm.last_name.trim(),
        school_student_id: addForm.school_student_id.trim() || null,
        year_group:        addForm.year_group.trim() || null,
        stream:            addForm.stream.trim() || null,
      })
      if (error) {
        if (error.code === '23505') {
          setAddError('A student with this ID already exists.')
        } else {
          setAddError('Could not add student. Please try again.')
        }
        setAddSaving(false)
        return
      }
      setShowAddModal(false)
      setAddForm({ first_name: '', last_name: '', school_student_id: '', year_group: '', stream: '' })
      await loadStudents()
    } catch (e) {
      setAddError('Something went wrong. Please try again.')
    }
    setAddSaving(false)
  }

  // ── Toggle student active status ────────────────────────────────────────
  async function handleToggleActive(student) {
    try {
      await supabase.from('students')
        .update({ is_active: !student.is_active })
        .eq('id', student.id)
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_active: !s.is_active } : s))
    } catch (e) {
      console.error('Toggle active error:', e)
    }
  }

  const activeCount   = students.filter(s => s.is_active).length
  const inactiveCount = students.filter(s => !s.is_active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* ── Import result modal ── */}
      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}

      {/* ── Add student modal ── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <span className="modal-title">Add student</span>
              <button onClick={() => { setShowAddModal(false); setAddError('') }} className="modal-close">
                <span className="icon-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group">
                  <label className="input-label">First name <span className="required">*</span></label>
                  <input type="text" className="input" value={addForm.first_name}
                    onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Last name <span className="required">*</span></label>
                  <input type="text" className="input" value={addForm.last_name}
                    onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">School student ID / Admission number</label>
                <input type="text" className="input" value={addForm.school_student_id}
                  onChange={e => setAddForm(f => ({ ...f, school_student_id: e.target.value }))}
                  placeholder="e.g. ADM-001" />
                <span className="input-hint">Your school's own ID for this student. Leave blank if not applicable.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group">
                  <label className="input-label">Year group / Class</label>
                  <input type="text" className="input" value={addForm.year_group}
                    onChange={e => setAddForm(f => ({ ...f, year_group: e.target.value }))}
                    placeholder="e.g. S3, P6, Form 4" />
                </div>
                <div className="input-group">
                  <label className="input-label">Stream / Section</label>
                  <input type="text" className="input" value={addForm.stream}
                    onChange={e => setAddForm(f => ({ ...f, stream: e.target.value }))}
                    placeholder="e.g. Arts, Science, A" />
                </div>
              </div>
              {addError && (
                <div className="alert alert-danger">
                  <span className="icon-outlined alert-icon">error_outline</span>
                  <div className="alert-content">{addError}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowAddModal(false); setAddError('') }} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleAddStudent} disabled={addSaving} className="btn btn-primary" style={{ flex: 1 }}>
                {addSaving
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Saving…</>
                  : <><span className="icon-outlined icon-sm">person_add</span> Add student</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          {[
            { label: 'Active students',   value: activeCount,   color: 'var(--color-green)'   },
            { label: 'Inactive students', value: inactiveCount, color: 'var(--color-grey-mid)' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {/* Hidden file input */}
          <input
            type="file"
            accept=".csv"
            ref={fileRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button onClick={downloadTemplate} className="btn btn-secondary btn-sm">
            <span className="icon-outlined icon-xs">download</span>
            CSV template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn btn-secondary btn-sm"
          >
            {importing
              ? <><div className="spinner spinner-sm" /> Importing…</>
              : <><span className="icon-outlined icon-xs">upload</span> Import CSV</>
            }
          </button>
          <button onClick={() => { setShowAddModal(true); setAddError('') }} className="btn btn-primary btn-sm">
            <span className="icon-outlined icon-xs">person_add</span>
            Add student
          </button>
        </div>
      </div>

      {/* ── Import info banner ── */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-white)', border: 'var(--border)',
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
      }}>
        <span className="icon-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>info</span>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)' }}>
          Download the CSV template to see the required format. Required columns are <strong style={{ color: 'var(--color-black)' }}>first_name</strong> and <strong style={{ color: 'var(--color-black)' }}>last_name</strong>.
          Optional: school_student_id, year_group, stream. Each student is automatically assigned a unique Partna Student ID (PTN-ST-XXXXX).
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 220 }}>
          <span className="icon-outlined search-icon">search</span>
          <input
            type="text" className="input search-input"
            placeholder="Search by name, Partna ID, or school ID…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <span className="icon-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>
        <select className="input" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">All year groups</option>
          {yearGroups.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', border: 'var(--border)', overflow: 'hidden' }}>
          {[
            { value: 'all',      label: 'All'      },
            { value: 'active',   label: 'Active'   },
            { value: 'inactive', label: 'Inactive' },
          ].map((f, i) => (
            <button key={f.value} onClick={() => setFilterActive(f.value)} style={{
              padding: 'var(--space-2) var(--space-3)',
              background: filterActive === f.value ? 'var(--color-black)' : 'var(--color-white)',
              border: 'none', borderLeft: i > 0 ? '1.5px solid var(--color-grey-light)' : 'none',
              cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
              color: filterActive === f.value ? 'var(--color-white)' : 'var(--color-grey)',
              letterSpacing: 'var(--tracking-wide)',
            }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20)' }}>
          <div className="spinner spinner-lg spinner-purple" />
        </div>
      ) : students.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-16)', textAlign: 'center' }}>
          <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>school</span>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>No students yet</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-5)', maxWidth: 380, margin: '0 auto var(--space-5)' }}>
            Import your student register using the CSV template, or add students one by one.
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button onClick={downloadTemplate} className="btn btn-secondary">
              <span className="icon-outlined icon-sm">download</span>
              Download template
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn btn-primary">
              <span className="icon-outlined icon-sm">upload</span>
              Import CSV
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--color-white)', border: 'var(--border)', padding: 'var(--space-10)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
          No students match your search or filters.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Partna ID</th>
                <th>School ID</th>
                <th>Year group</th>
                <th>Stream</th>
                <th>Enrolled parent</th>
                <th>Added</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(student => {
                // Find active parent enrollment for this student
                const activeEnrollment = student.customer_campaigns?.find(cc => cc.status === 'active')
                const parent           = activeEnrollment?.customers

                return (
                  <tr key={student.id} style={{ opacity: student.is_active ? 1 : 0.6 }}>
                    <td>
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                        {student.first_name} {student.last_name}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>
                        {student.partna_student_id}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                        {student.school_student_id || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      {student.year_group || '—'}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      {student.stream || '—'}
                    </td>
                    <td>
                      {parent ? (
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                            {parent.first_name} {parent.last_name}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
                            {parent.phone}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey-mid)', fontStyle: 'italic' }}>
                          No parent enrolled
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      {student.imported_at
                        ? formatDateTime(student.imported_at) + ' (imported)'
                        : formatDateTime(student.created_at)}
                    </td>
                    <td>
                      <span className={`badge no-dot ${student.is_active ? 'badge-success' : 'badge-default'}`}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(student)}
                        className={`btn btn-sm ${student.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {student.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border)', fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>
            Showing {filtered.length} of {students.length} students
          </div>
        </div>
      )}
    </div>
  )
}