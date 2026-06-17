import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin':  'https://www.partna.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Expected CSV columns (case-insensitive) ───────────────────────────────
// Required: first_name, last_name
// Optional: school_student_id, year_group, stream

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/)
  return lines.map(line => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      businessId,
      importedBy,   // business_admin id
      fileName,
      csvContent,   // raw CSV text — base64 encoded
    } = await req.json()

    if (!businessId || !csvContent) {
      return new Response(JSON.stringify({ error: 'Missing businessId or csvContent' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Decode base64 CSV
    const decoded = atob(csvContent)
    const rows    = parseCSV(decoded)

    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: 'CSV must have a header row and at least one data row' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Parse headers
    const headers = rows[0].map(normaliseHeader)
    const dataRows = rows.slice(1).filter(r => r.some(cell => cell !== ''))

    const hasFirstName = headers.includes('first_name') || headers.includes('firstname')
    const hasLastName  = headers.includes('last_name')  || headers.includes('lastname')

    if (!hasFirstName || !hasLastName) {
      return new Response(JSON.stringify({
        error: 'CSV must have first_name and last_name columns',
        detected_headers: headers,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Helper to get cell value by multiple possible column names
    function getCell(row: string[], ...keys: string[]): string {
      for (const key of keys) {
        const idx = headers.indexOf(key)
        if (idx !== -1 && row[idx]) return row[idx].trim()
      }
      return ''
    }

    // Create import job record
    const { data: importJob, error: importErr } = await supabase
      .from('student_imports')
      .insert({
        business_id:   businessId,
        imported_by:   importedBy || null,
        file_name:     fileName || 'upload.csv',
        total_rows:    dataRows.length,
        status:        'processing',
      })
      .select()
      .single()

    if (importErr || !importJob) {
      return new Response(JSON.stringify({ error: 'Could not create import job' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process rows
    const errors: { row: number; error: string }[] = []
    let importedCount = 0

    for (let i = 0; i < dataRows.length; i++) {
      const row       = dataRows[i]
      const rowNumber = i + 2 // 1-based, accounting for header row

      const firstName       = getCell(row, 'first_name', 'firstname', 'given_name')
      const lastName        = getCell(row, 'last_name',  'lastname',  'surname', 'family_name')
      const schoolStudentId = getCell(row, 'school_student_id', 'student_id', 'admission_number', 'reg_number')
      const yearGroup       = getCell(row, 'year_group', 'class', 'year', 'form', 'level')
      const stream          = getCell(row, 'stream', 'section', 'division')

      if (!firstName) { errors.push({ row: rowNumber, error: 'Missing first name' }); continue }
      if (!lastName)  { errors.push({ row: rowNumber, error: 'Missing last name' });  continue }

      const { error: insertErr } = await supabase.from('students').insert({
        business_id:       businessId,
        partna_student_id: '',   // trigger will generate this
        school_student_id: schoolStudentId || null,
        first_name:        firstName,
        last_name:         lastName,
        year_group:        yearGroup || null,
        stream:            stream    || null,
        imported_at:       new Date().toISOString(),
      })

      if (insertErr) {
        // Check for duplicate school_student_id
        if (insertErr.code === '23505') {
          errors.push({ row: rowNumber, error: `Student ID ${schoolStudentId} already exists` })
        } else {
          errors.push({ row: rowNumber, error: insertErr.message })
        }
      } else {
        importedCount++
      }
    }

    // Update import job with results
    await supabase.from('student_imports').update({
      imported_rows: importedCount,
      failed_rows:   errors.length,
      errors:        errors.length > 0 ? errors : null,
      status:        'complete',
      completed_at:  new Date().toISOString(),
    }).eq('id', importJob.id)

    return new Response(JSON.stringify({
      success:       true,
      importId:      importJob.id,
      totalRows:     dataRows.length,
      importedRows:  importedCount,
      failedRows:    errors.length,
      errors:        errors.slice(0, 50), // return first 50 errors max
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('import-students error:', err)
    return new Response(JSON.stringify({ error: 'Import failed. Please check your file and try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})