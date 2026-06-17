import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const PARTNER_ID   = Deno.env.get('SMILEID_PARTNER_ID')!
const API_KEY      = Deno.env.get('SMILEID_API_KEY')!
const IS_LIVE      = Deno.env.get('SMILEID_ENV') === 'production'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SMILEID_URL  = IS_LIVE
  ? 'https://api.smileidentity.com/v1/id_verification'
  : 'https://testapi.smileidentity.com/v1/id_verification'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.partna.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiter — 5 KYC attempts per customer per hour
const kycRateMap = new Map<string, { count: number; resetAt: number }>()
const KYC_LIMIT  = 5
const KYC_WINDOW = 60 * 60 * 1000

function isKycRateLimited(customerId: string): boolean {
  const now   = Date.now()
  const entry = kycRateMap.get(customerId)
  if (!entry || now > entry.resetAt) {
    kycRateMap.set(customerId, { count: 1, resetAt: now + KYC_WINDOW })
    return false
  }
  if (entry.count >= KYC_LIMIT) return true
  entry.count++
  return false
}

async function generateSignature(timestamp: string): Promise<string> {
  const encoder   = new TextEncoder()
  const keyData   = encoder.encode(API_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const message         = encoder.encode(timestamp + PARTNER_ID + 'sid_request')
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, message)
  return base64Encode(new Uint8Array(signatureBuffer))
}

function isValidUgandaNIN(nin: string): boolean {
  return /^(CM|CF)[A-Z0-9]{12}$/.test(nin)
}

async function sendSMS(customerId: string, phone: string, event: string, vars: Record<string, string> = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error('SMS send error (non-critical):', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { customerId, nin, firstName, lastName, dob } = await req.json()

    if (!customerId || !nin) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanNIN = nin.toUpperCase().trim()

    if (!isValidUgandaNIN(cleanNIN)) {
      return new Response(JSON.stringify({
        verified: false, notFound: false, unavailable: false,
        error: 'Invalid NIN format. Uganda NIDs start with CM or CF followed by 12 characters.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (isKycRateLimited(customerId)) {
      return new Response(JSON.stringify({
        error: 'Too many verification attempts. Please try again in an hour.',
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const timestamp = new Date().toISOString()
    const signature = await generateSignature(timestamp)

    const smileRes = await fetch(SMILEID_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: PARTNER_ID, source_sdk: 'rest_api', source_sdk_version: '1.0.0',
        signature, timestamp, country: 'UG', id_type: 'NATIONAL_ID',
        id_number: cleanNIN, first_name: firstName || '', last_name: lastName || '', dob: dob || '',
        partner_params: { job_type: '5', job_id: `kyc-${customerId}-${Date.now()}`, user_id: customerId },
      }),
    })

    const smileData = await smileRes.json()
    const verified    = smileData.Actions?.Verify_ID_Number === 'Verified' && smileData.ResultCode === '1012'
    const notFound    = smileData.ResultCode === '1013'
    const unavailable = smileData.ResultCode === '1015'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (verified) {
      await supabase.from('customers').update({
        nin:               cleanNIN,
        kyc_status:        'verified',
        kyc_verified_name: smileData.FullName || null,
        kyc_verified_at:   new Date().toISOString(),
        kyc_smile_job_id:  smileData.SmileJobID || null,
      }).eq('id', customerId)
    } else {
      await supabase.from('customers').update({
        nin: cleanNIN, kyc_status: 'failed',
      }).eq('id', customerId)
    }

    await supabase.from('kyc_submissions').insert({
      customer_id:  customerId,
      status:       verified ? 'verified' : 'failed',
      smile_job_id: smileData.SmileJobID || null,
      result_code:  smileData.ResultCode  || null,
      result_text:  smileData.ResultText  || null,
    })

    // Send KYC result SMS
    const { data: customer } = await supabase
      .from('customers')
      .select('phone, first_name')
      .eq('id', customerId)
      .maybeSingle()

    if (customer?.phone) {
      if (verified) {
        await sendSMS(customerId, customer.phone, 'kyc_verified', {
          name: customer.first_name || firstName || '',
        })
      } else if (!unavailable) {
        // Only send failure SMS if NIRA was reachable — not if service was down
        await sendSMS(customerId, customer.phone, 'kyc_failed', {})
      }
    }

    return new Response(JSON.stringify({
      verified, notFound, unavailable,
      resultText:   smileData.ResultText || null,
      smileJobId:   smileData.SmileJobID || null,
      verifiedName: smileData.FullName   || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('smileid-verify error:', err)
    return new Response(JSON.stringify({ error: 'Verification service error. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})