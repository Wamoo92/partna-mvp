import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('origin') || ''
  const allowed = (
    origin === 'https://www.partna.io' ||
    origin === 'https://partna.io'     ||
    origin.endsWith('.partna.io')      ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:3000'
  )
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://www.partna.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
const json = (data: unknown, req: Request, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

// Pre-enrolment student lookup. The portal needs to resolve a single student by
// ID (or exact name + year) BEFORE the parent is enrolled. RLS on `students`
// only lets a customer read a student they are ALREADY enrolled with
// (students_select_for_customers), so the lookup must run server-side with the
// service role. Returns ONLY the single matched student's minimal fields —
// never a bulk read of the table.
const STUDENT_FIELDS = 'id, first_name, last_name, partna_student_id, school_student_id, year_group'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const body = await req.json()
    const businessId = String(body.businessId || '').trim()
    const mode       = body.mode === 'name' ? 'name' : 'id'
    if (!businessId) return json({ found: false }, req)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    let student: Record<string, unknown> | null = null

    if (mode === 'id') {
      const val = String(body.studentId || '').trim()
      if (!val) return json({ found: false }, req)

      // Match on partna_student_id (case-insensitive) first, then school_student_id.
      const byPartna = await supabase
        .from('students')
        .select(STUDENT_FIELDS)
        .eq('business_id', businessId)
        .eq('is_active', true)
        .eq('partna_student_id', val.toUpperCase())
        .maybeSingle()
      student = byPartna.data

      if (!student) {
        const bySchool = await supabase
          .from('students')
          .select(STUDENT_FIELDS)
          .eq('business_id', businessId)
          .eq('is_active', true)
          .eq('school_student_id', val)
          .maybeSingle()
        student = bySchool.data
      }
    } else {
      const first = String(body.firstName || '').trim()
      const last  = String(body.lastName  || '').trim()
      const year  = String(body.yearGroup || '').trim()
      if (!first || !last || !year) return json({ found: false }, req)

      const res = await supabase
        .from('students')
        .select(STUDENT_FIELDS)
        .eq('business_id', businessId)
        .eq('is_active', true)
        .ilike('first_name', first)
        .ilike('last_name', last)
        .ilike('year_group', year)
        .maybeSingle()
      student = res.data
    }

    if (!student) return json({ found: false }, req)
    return json({ found: true, student }, req)

  } catch (e) {
    console.error('lookup-student error:', e)
    return json({ found: false }, req, 500)
  }
})
