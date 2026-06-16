import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const PARTNER_ID  = Deno.env.get('SMILEID_PARTNER_ID')!
const API_KEY     = Deno.env.get('SMILEID_API_KEY')!
const IS_LIVE     = Deno.env.get('SMILEID_ENV') === 'production'

const SMILEID_URL = IS_LIVE
  ? 'https://api.smileidentity.com/v1/id_verification'
  : 'https://testapi.smileidentity.com/v1/id_verification'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate HMAC-SHA256 signature as required by SmileID
async function generateSignature(timestamp: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(API_KEY)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // SmileID signature = HMAC-SHA256(timestamp + partner_id + "sid_request")
  const message = encoder.encode(timestamp + PARTNER_ID + 'sid_request')
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, message)
  return base64Encode(new Uint8Array(signatureBuffer))
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

    const timestamp = new Date().toISOString()
    const signature = await generateSignature(timestamp)

    // Call SmileID Enhanced KYC — synchronous endpoint
    const smileRes = await fetch(SMILEID_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id:         PARTNER_ID,
        source_sdk:         'rest_api',
        source_sdk_version: '1.0.0',
        signature,
        timestamp,
        country:            'UG',           // Uganda
        id_type:            'NATIONAL_ID',  // Uganda National ID
        id_number:          nin.toUpperCase().trim(),
        first_name:         firstName || '',
        last_name:          lastName  || '',
        dob:                dob        || '', // format: YYYY-MM-DD
        partner_params: {
          job_type: '5',                    // Enhanced KYC job type
          job_id:   `kyc-${customerId}-${Date.now()}`,
          user_id:  customerId,
        },
      }),
    })

    const smileData = await smileRes.json()
    console.log('SmileID response:', JSON.stringify(smileData))

    // Evaluate result
    const verified = (
      smileData.Actions?.Verify_ID_Number === 'Verified' &&
      smileData.ResultCode === '1012'
    )

    const notFound   = smileData.ResultCode === '1013'
    const unavailable = smileData.ResultCode === '1015'

    // Update customer record in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (verified) {
      await supabase
        .from('customers')
        .update({
          nin:        nin.toUpperCase().trim(),
          kyc_status: 'verified',
          // Store name returned by NIRA for cross-checking
          kyc_verified_name: smileData.FullName || null,
          kyc_verified_at:   new Date().toISOString(),
          kyc_smile_job_id:  smileData.SmileJobID || null,
        })
        .eq('id', customerId)
    } else {
      // Store the NIN even if not verified so customer doesn't have to re-enter
      await supabase
        .from('customers')
        .update({
          nin:        nin.toUpperCase().trim(),
          kyc_status: 'failed',
        })
        .eq('id', customerId)
    }

    // Log the KYC attempt
    await supabase.from('kyc_submissions').insert({
      customer_id:    customerId,
      status:         verified ? 'verified' : 'failed',
      smile_job_id:   smileData.SmileJobID  || null,
      result_code:    smileData.ResultCode   || null,
      result_text:    smileData.ResultText   || null,
    })

    return new Response(JSON.stringify({
      verified,
      notFound,
      unavailable,
      resultText:   smileData.ResultText   || null,
      smileJobId:   smileData.SmileJobID   || null,
      verifiedName: smileData.FullName     || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('smileid-verify error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})