import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MILESTONE_THRESHOLDS = [25, 50, 75, 100]
const NO_DEPOSIT_DAYS      = 14

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatUGX(n: number): string {
  return Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

// ── Send SMS via send-sms Edge Function ───────────────────────────────────
async function sendNudge({
  event,
  phone,
  customerId,
  vars,
}: {
  event: string
  phone: string
  customerId: string
  vars: Record<string, string>
}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error(`Nudge send error [${event}] for customer ${customerId}:`, e)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const now      = new Date()
  now.setHours(0, 0, 0, 0) // normalise to start of day for date comparisons

  const results = {
    milestone_nudges_sent:  [] as string[],
    deadline_7d_sent:       [] as string[],
    deadline_1d_sent:       [] as string[],
    complete_sent:          [] as string[],
    no_deposit_sent:        [] as string[],
    errors:                 [] as string[],
  }

  try {
    // ── Fetch all active campaigns with their business name ───────────────
    const { data: campaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, name, campaign_type, target_amount, target_date, business_id, businesses(name)')
      .eq('status', 'active')

    if (campError) {
      return new Response(JSON.stringify({ error: campError.message }), { status: 500, headers: CORS })
    }

    for (const campaign of (campaigns || [])) {
      try {
        const targetAmount   = Number(campaign.target_amount)
        const targetDate     = new Date(campaign.target_date)
        targetDate.setHours(0, 0, 0, 0)
        const daysToDeadline = daysBetween(now, targetDate)
        const isFeeCampaign  = campaign.campaign_type === 'education_fees'
        const businessName   = (campaign.businesses as any)?.name || 'Partna'

        // ── Fetch all customers enrolled in this campaign ─────────────────
        // Join: customers → wallets → customer_campaigns (for milestones_notified)
        // Also fetch last transaction date for missed payment check
        const { data: enrollments, error: enrollError } = await supabase
          .from('customer_campaigns')
          .select(`
            id,
            milestones_notified,
            customers (
              id,
              first_name,
              phone,
              wallets ( balance ),
              transactions ( created_at, type )
            )
          `)
          .eq('campaign_id', campaign.id)

        if (enrollError) {
          results.errors.push(`Campaign ${campaign.id} enrollment fetch error: ${enrollError.message}`)
          continue
        }

        for (const enrollment of (enrollments || [])) {
          try {
            const customer    = (enrollment.customers as any)
            if (!customer?.phone) continue

            const customerId  = customer.id
            const firstName   = customer.first_name || 'there'
            const phone       = customer.phone
            const balance     = Number(customer.wallets?.[0]?.balance || 0)
            const percentage  = targetAmount > 0 ? Math.floor((balance / targetAmount) * 100) : 0
            const amountRemaining = Math.max(targetAmount - balance, 0)
            const milestones  = Array.isArray(enrollment.milestones_notified)
              ? enrollment.milestones_notified
              : []

            const commonVars = {
              name:             firstName,
              business_name:    businessName,
              campaign:         campaign.name,
              percentage:       String(percentage),
              amount_remaining: formatUGX(amountRemaining),
            }

            // ══════════════════════════════════════════════════════════════
            // CHECK 1 — Milestone nudges (25, 50, 75, 100)
            // ══════════════════════════════════════════════════════════════
            const newMilestones: number[] = []

            for (const threshold of MILESTONE_THRESHOLDS) {
              if (percentage >= threshold && !milestones.includes(threshold)) {
                // 100% gets the campaign_complete SMS, not a milestone SMS
                if (threshold === 100) {
                  await sendNudge({
                    event:      'campaign_complete',
                    phone,
                    customerId,
                    vars:       commonVars,
                  })
                  results.complete_sent.push(customerId)
                } else {
                  const milestoneEvent = isFeeCampaign
                    ? 'campaign_milestone_fees'
                    : 'campaign_milestone_savings'

                  await sendNudge({
                    event:      milestoneEvent,
                    phone,
                    customerId,
                    vars:       commonVars,
                  })
                  results.milestone_nudges_sent.push(`${customerId}:${threshold}%`)
                }
                newMilestones.push(threshold)
              }
            }

            // Update milestones_notified if any new ones fired
            if (newMilestones.length > 0) {
              const updatedMilestones = [...milestones, ...newMilestones]
              await supabase
                .from('customer_campaigns')
                .update({ milestones_notified: updatedMilestones })
                .eq('id', enrollment.id)
            }

            // Skip deadline and missed payment checks if already at 100%
            if (percentage >= 100) continue

            // ══════════════════════════════════════════════════════════════
            // CHECK 2 — Deadline warning 7 days
            // ══════════════════════════════════════════════════════════════
            if (daysToDeadline === 7) {
              await sendNudge({
                event:      'campaign_deadline_7d',
                phone,
                customerId,
                vars:       commonVars,
              })
              results.deadline_7d_sent.push(customerId)
            }

            // ══════════════════════════════════════════════════════════════
            // CHECK 3 — Deadline warning 1 day
            // ══════════════════════════════════════════════════════════════
            if (daysToDeadline === 1) {
              await sendNudge({
                event:      'campaign_deadline_1d',
                phone,
                customerId,
                vars:       commonVars,
              })
              results.deadline_1d_sent.push(customerId)
            }

            // ══════════════════════════════════════════════════════════════
            // CHECK 4 — Missed payment nudge (no deposit in last 14 days)
            // Only fires if the campaign deadline is still in the future
            // ══════════════════════════════════════════════════════════════
            if (daysToDeadline > 0) {
              const transactions = customer.transactions || []
              const deposits     = transactions.filter((t: any) =>
                t.type === 'deposit' || t.type === 'payment'
              )

              // Find the most recent deposit/payment date
              const lastDepositDate = deposits.length > 0
                ? new Date(Math.max(...deposits.map((t: any) => new Date(t.created_at).getTime())))
                : null

              const daysSinceLastDeposit = lastDepositDate
                ? daysBetween(lastDepositDate, now)
                : null

              // Fire nudge if: no deposits ever, or last deposit was 14+ days ago
              const shouldNudge = daysSinceLastDeposit === null
                ? false // never made a deposit — they may have just enrolled, skip
                : daysSinceLastDeposit >= NO_DEPOSIT_DAYS

              if (shouldNudge) {
                await sendNudge({
                  event:      'campaign_no_deposit',
                  phone,
                  customerId,
                  vars: {
                    ...commonVars,
                    days: String(daysSinceLastDeposit),
                  },
                })
                results.no_deposit_sent.push(customerId)
              }
            }

          } catch (customerErr) {
            results.errors.push(`Customer error in campaign ${campaign.id}: ${customerErr}`)
          }
        }

      } catch (campaignErr) {
        results.errors.push(`Campaign error ${campaign.id}: ${campaignErr}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ran_at:  new Date().toISOString(),
      results,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('process-campaign-nudges error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error', results }), {
      status: 500,
      headers: CORS,
    })
  }
})