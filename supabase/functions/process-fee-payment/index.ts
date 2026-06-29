import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

// ── Rate limiter — 20 payment attempts per customer per hour ──────────────
const rateMap = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(customerId: string): boolean {
  const now   = Date.now()
  const entry = rateMap.get(customerId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(customerId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 20) return true
  entry.count++
  return false
}

function formatUGX(n: number): string {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'FEE-'
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

async function sendSMS(
  customerId: string,
  phone: string,
  event: string,
  vars: Record<string, string>
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error('SMS send error (non-critical):', e)
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const {
      customerId,    // UUID of the paying parent
      walletId,      // UUID of the parent's wallet
      campaignId,    // UUID of the campaign
      studentId,     // UUID of the student being paid for
      amount,        // Amount the parent wants to pay (UGX)
    } = await req.json()

    // ── Input validation ─────────────────────────────────────────────────
    if (!customerId || !walletId || !campaignId || !studentId || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const paymentAmount = Number(amount)
    if (isNaN(paymentAmount) || paymentAmount < 1000) {
      return new Response(JSON.stringify({ error: 'Invalid payment amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Authenticate the caller (E-3 fix) ─────────────────────────────────
    // The request must carry the paying customer's own access token, not the
    // anon key. We validate it and confirm the caller owns BOTH the customerId
    // and the walletId before any money moves.
    const authHeader = req.headers.get('Authorization') || ''
    const jwt        = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    const authUser = userData?.user
    if (userErr || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The customerId must map to a customers row owned by this auth user.
    const { data: ownerRow } = await supabase
      .from('customers')
      .select('id, auth_user_id')
      .eq('id', customerId)
      .maybeSingle()
    if (!ownerRow || ownerRow.auth_user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The walletId must belong to that same customer.
    const { data: ownedWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('id', walletId)
      .eq('customer_id', customerId)
      .maybeSingle()
    if (!ownedWallet) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Rate limit ───────────────────────────────────────────────────────
    if (isRateLimited(customerId)) {
      return new Response(JSON.stringify({ error: 'Too many payment attempts. Please try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch campaign ───────────────────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('*, businesses(id, name, business_wallets(id, balance))')
      .eq('id', campaignId)
      .maybeSingle()

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Maximum payment guard (E-3 sanity check) ─────────────────────────
    // A single fee payment can never exceed the campaign's total fees.
    const campaignTarget = Number(campaign.target_amount || 0)
    if (campaignTarget > 0 && paymentAmount > campaignTarget) {
      return new Response(JSON.stringify({
        error: `Payment exceeds the total fees of ${formatUGX(campaignTarget)}.`,
        blocked: true,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Minimum payment check ────────────────────────────────────────────
    // Uses existing minimum_payment column on campaigns
    const minPayment = Number(campaign.minimum_payment || 0)
    if (minPayment > 0 && paymentAmount < minPayment) {
      return new Response(JSON.stringify({
        error: `Payment is below the minimum required amount of ${formatUGX(minPayment)}.`,
        minimum_payment: minPayment,
        blocked: true,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch customer wallet ─────────────────────────────────────────────
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .maybeSingle()

    if (walletErr || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const walletBalance = Number(wallet.balance)
    if (walletBalance < paymentAmount) {
      return new Response(JSON.stringify({
        error: `Insufficient balance. Your wallet has ${formatUGX(walletBalance)}.`,
        balance: walletBalance,
        blocked: true,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Calculate MDR ─────────────────────────────────────────────────────
    const { data: mdrResult } = await supabase.rpc('calculate_mdr', {
      payment_amount:  paymentAmount,
      campaign_status: campaign.status,
      campaign_date:   campaign.target_date,
    })

    const mdr = mdrResult?.[0] || { mdr_rate: 0.75, mdr_amount: 0, net_to_school: paymentAmount }
    const netToSchool = Number(mdr.net_to_school)
    const mdrAmount   = Number(mdr.mdr_amount)
    const mdrRate     = Number(mdr.mdr_rate)

    // ── Late fee check ────────────────────────────────────────────────────
    const isLate        = campaign.target_date && new Date(campaign.target_date) < new Date()
    const lateFeeAmount = isLate ? Number(campaign.late_payment_fee || 1000) : 0

    // ── Fetch (or auto-provision) the school's business wallet ────────────
    // A business may not have a wallet row yet (newly onboarded schools), which
    // previously failed EVERY fee payment with "School wallet not found". Create
    // one on first payment so the credit can proceed.
    const bizId = campaign.business_id || campaign.businesses?.id
    let businessWallet = campaign.businesses?.business_wallets?.[0]
    if (!businessWallet) {
      const { data: existing } = await supabase
        .from('business_wallets').select('id, balance').eq('business_id', bizId).maybeSingle()
      if (existing) {
        businessWallet = existing
      } else {
        const { data: created, error: createErr } = await supabase
          .from('business_wallets').insert({ business_id: bizId, balance: 0 }).select('id, balance').single()
        if (createErr || !created) {
          // A concurrent payment may have created it — re-select.
          const { data: reselect } = await supabase
            .from('business_wallets').select('id, balance').eq('business_id', bizId).maybeSingle()
          businessWallet = reselect || null
        } else {
          businessWallet = created
        }
      }
    }
    if (!businessWallet) {
      console.error('process-fee-payment: could not provision business wallet for', bizId)
      return new Response(JSON.stringify({ error: 'School wallet could not be set up. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch student details ─────────────────────────────────────────────
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, partna_student_id, year_group')
      .eq('id', studentId)
      .maybeSingle()

    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : 'Unknown Student'

    // ── Fetch customer details for SMS ────────────────────────────────────
    const { data: customer } = await supabase
      .from('customers')
      .select('phone, first_name')
      .eq('id', customerId)
      .maybeSingle()

    const reference = generateReference()

    // ── ATOMIC PAYMENT — debit parent, credit school ──────────────────────
    // Step A: Debit parent wallet
    const newParentBalance = walletBalance - paymentAmount

    const { error: debitErr } = await supabase
      .from('wallets')
      .update({ balance: newParentBalance, updated_at: new Date().toISOString() })
      .eq('id', walletId)
      .eq('balance', walletBalance) // Optimistic lock — only update if balance unchanged

    if (debitErr) {
      return new Response(JSON.stringify({
        error: 'Payment failed — wallet balance changed during processing. Please try again.',
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step B: Credit school wallet (net of MDR)
    const newSchoolBalance = Number(businessWallet.balance) + netToSchool

    const { error: creditErr } = await supabase
      .from('business_wallets')
      .update({ balance: newSchoolBalance })
      .eq('id', businessWallet.id)

    if (creditErr) {
      // ROLLBACK: restore parent wallet balance
      await supabase
        .from('wallets')
        .update({ balance: walletBalance, updated_at: new Date().toISOString() })
        .eq('id', walletId)

      console.error('School wallet credit failed, parent wallet rolled back:', creditErr)
      return new Response(JSON.stringify({
        error: 'Payment failed during processing. Your balance has been restored. Please try again.',
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step C: Record transaction
    const { error: txnErr } = await supabase.from('transactions').insert({
      customer_id:      customerId,
      wallet_id:        walletId,
      campaign_id:      campaignId,
      student_id:       studentId,
      type:             isLate ? 'late_fee_payment' : 'fee_payment',
      amount:           paymentAmount,
      gross_amount:     paymentAmount,
      net_to_school:    netToSchool,
      mdr_rate:         mdrRate,
      mdr_amount:       mdrAmount,
      late_fee_charged: lateFeeAmount,
      fee_type:         campaign.fee_type || null,
      status:           'completed',
      reference,
      notes: `Fee payment for ${studentName} — ${campaign.name}`,
    })

    if (txnErr) {
      console.error('Transaction record failed (payment already processed):', txnErr)
      // Payment is done — don't rollback, just log the error
    }

    // Step D: Record MDR as Partna revenue in transaction_fees
    await supabase.from('transaction_fees').insert({
      customer_id: customerId,
      fee_type:    'mdr',
      charged_to:  'business',
      partna_fee:  mdrAmount,
      carrier_fee: 0,
      tax:         0,
      total_fees:  mdrAmount,
      net_amount:  netToSchool,
    })

    // Step E: Calculate total paid to date for this student/campaign.
    // The payment transaction was already inserted in Step C, so the RPC total
    // already includes it — do NOT add paymentAmount again (that double-counted
    // the total shown on the success screen and in the confirmation SMS).
    const { data: totalData } = await supabase.rpc('get_student_payment_total', {
      p_student_id:  studentId,
      p_campaign_id: campaignId,
    })
    const totalPaid = Number(totalData || 0)

    // ── Check if minimum registration amount is now met ───────────────────
    const minReg = Number(campaign.minimum_registration_amount || 0)
    const registrationMet = minReg > 0 && totalPaid >= minReg

    // ── Send SMS confirmations ────────────────────────────────────────────
    if (customer?.phone) {
      sendSMS(customerId, customer.phone, 'fee_payment_confirmed', {
        amount:       formatUGX(paymentAmount),
        student_name: studentName,
        fee_type:     campaign.fee_type || 'fees',
        campaign:     campaign.name,
        total_paid:   formatUGX(totalPaid),
        reference,
      })
    }

    return new Response(JSON.stringify({
      success:          true,
      reference,
      paymentAmount,
      netToSchool,
      mdrAmount,
      mdrRate,
      lateFeeCharged:   lateFeeAmount,
      newParentBalance,
      totalPaidToDate:  totalPaid,
      registrationMet,
      minimumRegistrationAmount: minReg,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('process-fee-payment error:', err)
    return new Response(JSON.stringify({ error: 'Payment processing failed. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})