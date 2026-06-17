import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin':  'https://www.partna.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { studentId, campaignId } = await req.json()

    if (!studentId || !campaignId) {
      return new Response(JSON.stringify({ error: 'Missing studentId or campaignId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Fetch campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('target_amount, minimum_payment, minimum_registration_amount, fee_type, name, target_date, status, late_payment_fee')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get total paid to date for this student/campaign
    const { data: totalPaid } = await supabase.rpc('get_student_payment_total', {
      p_student_id:  studentId,
      p_campaign_id: campaignId,
    })

    const paid       = Number(totalPaid || 0)
    const target     = Number(campaign.target_amount || 0)
    const minReg     = Number(campaign.minimum_registration_amount || 0)
    const minPayment = Number(campaign.minimum_payment || 0)
    const outstanding = Math.max(0, target - paid)
    const isLate     = campaign.target_date && new Date(campaign.target_date) < new Date()

    // Minimum registration progress
    const registrationMet        = minReg > 0 && paid >= minReg
    const registrationOutstanding = Math.max(0, minReg - paid)

    // Fetch student details
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, partna_student_id, school_student_id, year_group')
      .eq('id', studentId)
      .maybeSingle()

    // Fetch payment history for this student/campaign
    const { data: payments } = await supabase
      .from('transactions')
      .select('amount, gross_amount, created_at, reference, status, type')
      .eq('student_id', studentId)
      .eq('campaign_id', campaignId)
      .in('type', ['fee_payment', 'late_fee_payment', 'payment'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20)

    return new Response(JSON.stringify({
      student: {
        id:               studentId,
        partnaStudentId:  student?.partna_student_id,
        schoolStudentId:  student?.school_student_id,
        name:             student ? `${student.first_name} ${student.last_name}` : null,
        yearGroup:        student?.year_group,
      },
      campaign: {
        id:              campaignId,
        name:            campaign.name,
        feeType:         campaign.fee_type,
        targetAmount:    target,
        targetDate:      campaign.target_date,
        status:          campaign.status,
        isLate,
        lateFee:         isLate ? Number(campaign.late_payment_fee || 1000) : 0,
      },
      payments: {
        totalPaid:                   paid,
        outstanding,
        percentagePaid:              target > 0 ? Math.round((paid / target) * 100) : 0,
        minimumPaymentRequired:      minPayment,
        minimumRegistrationAmount:   minReg,
        registrationMet,
        registrationOutstanding,
        history:                     payments || [],
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('get-student-balance error:', err)
    return new Response(JSON.stringify({ error: 'Could not retrieve student balance' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})