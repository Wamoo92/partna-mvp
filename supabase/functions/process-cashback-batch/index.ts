import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET  = Deno.env.get('CRON_SECRET') || ''

// Subdomain-aware CORS (consistent with the rest of the platform).
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// This function is for the scheduler only. It must present the shared cron secret
// in the X-Cron-Secret header (the anon key is NOT sufficient — it is public).
function isAuthorizedCron(req: Request): boolean {
  const provided = req.headers.get('X-Cron-Secret') || ''
  return CRON_SECRET.length > 0 && provided === CRON_SECRET
}

// ── Tier thresholds (fetched fresh from DB each run) ──────────────────────
// Defined in cashback_tiers table — admin can adjust via Rewards page

// ── Qualifying payment types for 90-day Platinum retention ───────────────
const PAYMENT_TYPES = ['fee_payment', 'late_fee_payment', 'payment']

// ── Qualifying progress types (deposits + payments) ───────────────────────
const PROGRESS_TYPES = ['fee_payment', 'late_fee_payment', 'payment', 'deposit']

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Fail closed: only the scheduler (with the cron secret) may run this.
  if (!isAuthorizedCron(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const now      = new Date()
  const today    = now.toISOString()

  console.log(`[process-cashback-batch] Starting run at ${today}`)

  try {
    // ── 1. Load cashback tiers from DB ──────────────────────────────────
    const { data: tiers, error: tierErr } = await supabase
      .from('cashback_tiers')
      .select('*')
      .order('min_percentage', { ascending: false }) // highest first for matching

    if (tierErr || !tiers?.length) {
      console.error('Could not load cashback tiers:', tierErr)
      return new Response(JSON.stringify({ error: 'Could not load tiers' }), { status: 500 })
    }

    console.log(`[process-cashback-batch] Loaded ${tiers.length} tiers`)

    // ── 2. Load all active enrollments with campaign target ──────────────
    const { data: enrollments, error: enrollErr } = await supabase
      .from('customer_campaigns')
      .select(`
        id,
        customer_id,
        campaign_id,
        wallet_id,
        tier,
        tier_expires_at,
        campaigns (
          target_amount,
          status
        )
      `)
      .eq('status', 'active')

    if (enrollErr) {
      console.error('Could not load enrollments:', enrollErr)
      return new Response(JSON.stringify({ error: 'Could not load enrollments' }), { status: 500 })
    }

    console.log(`[process-cashback-batch] Processing ${enrollments?.length || 0} enrollments`)

    let tiersUpdated   = 0
    let cashbackCredited = 0

    for (const enrollment of enrollments || []) {
      const target = Number(enrollment.campaigns?.target_amount || 0)
      if (target <= 0) continue

      // ── 3. Calculate total progress (deposits + payments) ────────────
      const { data: progressData } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('customer_id', enrollment.customer_id)
        .eq('campaign_id', enrollment.campaign_id)
        .eq('status', 'completed')
        .in('type', PROGRESS_TYPES)

      const totalProgress = (progressData || []).reduce((sum, t) => sum + Number(t.amount), 0)
      const progressPct   = Math.min((totalProgress / target) * 100, 100)

      // ── 4. Calculate total qualifying payments (for Platinum retention) ─
      const totalPayments = (progressData || [])
        .filter(t => PAYMENT_TYPES.includes(t.type))
        .reduce((sum, t) => sum + Number(t.amount), 0)
      const paymentPct = Math.min((totalPayments / target) * 100, 100)

      // ── 5. Determine correct tier ────────────────────────────────────
      // Check if still within 90-day Platinum retention window
      const withinRetentionWindow =
        enrollment.tier === 'platinum' &&
        enrollment.tier_expires_at &&
        new Date(enrollment.tier_expires_at) > now

      let newTier: string
      let newTierExpiresAt: string | null = enrollment.tier_expires_at || null

      if (withinRetentionWindow) {
        // Still in retention window — keep Platinum regardless of current progress
        newTier = 'platinum'
      } else {
        // Match against tier thresholds (tiers sorted highest first)
        const matchedTier = tiers.find(t => progressPct >= Number(t.min_percentage))
        newTier = matchedTier ? matchedTier.name.toLowerCase() : 'none'

        // If just reached Platinum via qualifying payments — set 90-day retention
        if (
          newTier === 'platinum' &&
          paymentPct >= 100 &&
          enrollment.tier !== 'platinum'
        ) {
          const expiresAt = new Date(now)
          expiresAt.setDate(expiresAt.getDate() + 90)
          newTierExpiresAt = expiresAt.toISOString()
          console.log(`[process-cashback-batch] Platinum retention set for enrollment ${enrollment.id} — expires ${newTierExpiresAt}`)
        }

        // If Platinum reached via deposit only (no qualifying payments) —
        // no retention window, tier_expires_at stays null
        if (newTier === 'platinum' && paymentPct < 100) {
          newTierExpiresAt = null
        }
      }

      // ── 6. Update tier if changed ────────────────────────────────────
      const tierChanged       = newTier !== (enrollment.tier || 'none')
      const expiryChanged     = newTierExpiresAt !== enrollment.tier_expires_at

      if (tierChanged || expiryChanged) {
        const updatePayload: Record<string, unknown> = { tier: newTier }
        if (tierChanged && newTier !== 'none') {
          updatePayload.tier_unlocked_at = today
        }
        if (expiryChanged) {
          updatePayload.tier_expires_at = newTierExpiresAt
        }

        const { error: updateErr } = await supabase
          .from('customer_campaigns')
          .update(updatePayload)
          .eq('id', enrollment.id)

        if (updateErr) {
          console.error(`Failed to update tier for enrollment ${enrollment.id}:`, updateErr)
        } else {
          tiersUpdated++
          console.log(`[process-cashback-batch] Enrollment ${enrollment.id}: ${enrollment.tier || 'none'} → ${newTier}`)
        }
      }

      // ── 7. Credit pending cashback transactions ──────────────────────
      // These are created when a customer spends at a Partna merchant.
      // Until real card transactions exist this section will find nothing
      // but is ready for when merchant spend data flows in.
      const { data: pendingCashback } = await supabase
        .from('transactions')
        .select('id, amount, wallet_id')
        .eq('customer_id', enrollment.customer_id)
        .eq('campaign_id', enrollment.campaign_id)
        .eq('type', 'cashback')
        .eq('status', 'pending')
        .lte('created_at', today)

      for (const cb of pendingCashback || []) {
        // Idempotency: atomically CLAIM the cashback row first by flipping
        // pending → completed, guarded by status='pending'. Only the run that
        // actually flips the row (claimed.length === 1) proceeds to credit, so a
        // re-run or a partial-failure replay can never credit the same row twice.
        const { data: claimed, error: claimErr } = await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('id', cb.id)
          .eq('status', 'pending')
          .select('id')

        if (claimErr || !claimed || claimed.length === 0) continue // already claimed elsewhere

        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', cb.wallet_id)
          .maybeSingle()

        if (!wallet) {
          // Can't credit — release the claim so it is retried next run.
          await supabase.from('transactions').update({ status: 'pending' }).eq('id', cb.id)
          continue
        }

        const newBalance = Number(wallet.balance) + Number(cb.amount)
        const { error: walletErr } = await supabase
          .from('wallets')
          .update({ balance: newBalance })
          .eq('id', cb.wallet_id)

        if (walletErr) {
          console.error(`Failed to credit cashback wallet for transaction ${cb.id}:`, walletErr)
          // Release the claim so the credit is retried on the next run.
          await supabase.from('transactions').update({ status: 'pending' }).eq('id', cb.id)
          continue
        }

        cashbackCredited++
        console.log(`[process-cashback-batch] Cashback credited: transaction ${cb.id}, amount ${cb.amount}`)
      }
    }

    const summary = {
      success:          true,
      enrollmentsProcessed: enrollments?.length || 0,
      tiersUpdated,
      cashbackCredited,
      ranAt: today,
    }

    console.log('[process-cashback-batch] Complete:', summary)

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[process-cashback-batch] Fatal error:', err)
    return new Response(JSON.stringify({ error: 'Batch processing failed', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})