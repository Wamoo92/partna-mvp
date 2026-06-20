import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return 'RNW-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

async function sendSMS(supabase: any, customerId: string, phone: string, event: string, vars: Record<string, string>) {
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
    console.error('SMS send error (non-critical):', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const now      = new Date()
  const today    = now.toISOString().slice(0, 10)

  const results = {
    billed:         [] as string[],
    billing_failed: [] as string[],
    grace_day1:     [] as string[],
    grace_day5:     [] as string[],
    lapsed:         [] as string[],
    errors:         [] as string[],
  }

  try {

    // ══════════════════════════════════════════════════════════════════════
    // JOB 1 — Bill active subscriptions due today
    // ══════════════════════════════════════════════════════════════════════

    const { data: dueSubs, error: dueError } = await supabase
      .from('card_subscriptions')
      .select('*, customers(id, first_name, last_name, phone, email), businesses(name)')
      .eq('status', 'active')
      .lte('next_billing_date', today)

    if (dueError) {
      results.errors.push(`Failed to fetch due subscriptions: ${dueError.message}`)
    } else {
      for (const sub of (dueSubs || [])) {
        try {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('id', sub.wallet_id)
            .maybeSingle()

          if (!wallet) {
            results.errors.push(`Wallet not found for subscription ${sub.id}`)
            continue
          }

          const fee          = Number(sub.monthly_fee)
          const businessName = sub.businesses?.name || 'Partna'

          if (Number(wallet.balance) >= fee) {
            // ── Sufficient balance — deduct and renew ──────────────────
            const newBalance  = Number(wallet.balance) - fee
            const nextBilling = new Date(now)
            nextBilling.setMonth(nextBilling.getMonth() + 1)
            const nextBillingDate = nextBilling.toISOString().slice(0, 10)

            await supabase.from('wallets').update({
              balance:    newBalance,
              updated_at: now.toISOString(),
            }).eq('id', wallet.id)

            await supabase.from('card_subscriptions').update({
              last_billed_at:          now.toISOString(),
              next_billing_date:       nextBillingDate,
              last_billing_failed_at:  null,
              grace_period_started_at: null,
              grace_sms_day1_sent:     false,
              grace_sms_day5_sent:     false,
              updated_at:              now.toISOString(),
            }).eq('id', sub.id)

            await supabase.from('card_subscription_transactions').insert({
              customer_id:     sub.customer_id,
              wallet_id:       sub.wallet_id,
              subscription_id: sub.id,
              type:            'monthly_subscription_fee',
              amount:          fee,
              status:          'completed',
              reference:       generateReference(),
              notes:           `Monthly ${sub.card_type} card subscription renewal`,
            })

            results.billed.push(sub.id)

          } else {
            // ── Insufficient balance — enter grace period ───────────────
            await supabase.from('card_subscriptions').update({
              status:                  'grace_period',
              grace_period_started_at: now.toISOString(),
              last_billing_failed_at:  now.toISOString(),
              grace_sms_day1_sent:     false,
              grace_sms_day5_sent:     false,
              updated_at:              now.toISOString(),
            }).eq('id', sub.id)

            await supabase.from('card_subscription_transactions').insert({
              customer_id:     sub.customer_id,
              wallet_id:       sub.wallet_id,
              subscription_id: sub.id,
              type:            'monthly_subscription_fee',
              amount:          fee,
              status:          'failed',
              reference:       generateReference(),
              notes:           `Monthly renewal failed — insufficient balance. Grace period started.`,
            })

            // Send day 1 grace SMS immediately
            if (sub.customers?.phone) {
              await sendSMS(supabase, sub.customer_id, sub.customers.phone, 'card_grace_day1', {
                name:          sub.customers.first_name,
                amount:        fee.toLocaleString(),
                business_name: businessName,
              })

              await supabase.from('card_subscriptions').update({
                grace_sms_day1_sent: true,
                updated_at:          now.toISOString(),
              }).eq('id', sub.id)

              results.grace_day1.push(sub.id)
            }

            results.billing_failed.push(sub.id)
          }

        } catch (subErr) {
          results.errors.push(`Error processing subscription ${sub.id}: ${subErr}`)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // JOB 2 — Send day 5 grace SMS to subscriptions in grace for 5+ days
    // ══════════════════════════════════════════════════════════════════════

    const { data: graceSubs, error: graceError } = await supabase
      .from('card_subscriptions')
      .select('*, customers(id, first_name, last_name, phone), businesses(name)')
      .eq('status', 'grace_period')
      .eq('grace_sms_day5_sent', false)

    if (graceError) {
      results.errors.push(`Failed to fetch grace period subscriptions: ${graceError.message}`)
    } else {
      for (const sub of (graceSubs || [])) {
        try {
          if (!sub.grace_period_started_at) continue
          const graceStart  = new Date(sub.grace_period_started_at)
          const daysInGrace = daysBetween(graceStart, now)

          if (daysInGrace >= 5) {
            if (sub.customers?.phone) {
              await sendSMS(supabase, sub.customer_id, sub.customers.phone, 'card_grace_day5', {
                name:          sub.customers.first_name,
                amount:        Number(sub.monthly_fee).toLocaleString(),
                days:          '2',
                business_name: sub.businesses?.name || 'Partna',
              })

              await supabase.from('card_subscriptions').update({
                grace_sms_day5_sent: true,
                updated_at:          now.toISOString(),
              }).eq('id', sub.id)

              results.grace_day5.push(sub.id)
            }
          }

        } catch (subErr) {
          results.errors.push(`Error sending day 5 SMS for subscription ${sub.id}: ${subErr}`)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // JOB 3 — Lapse subscriptions in grace period for 7+ days
    // ══════════════════════════════════════════════════════════════════════

    const { data: lapseSubs, error: lapseError } = await supabase
      .from('card_subscriptions')
      .select('*, customers(id, first_name, last_name, phone)')
      .eq('status', 'grace_period')

    if (lapseError) {
      results.errors.push(`Failed to fetch grace period subscriptions for lapse check: ${lapseError.message}`)
    } else {
      for (const sub of (lapseSubs || [])) {
        try {
          if (!sub.grace_period_started_at) continue
          const graceStart  = new Date(sub.grace_period_started_at)
          const daysInGrace = daysBetween(graceStart, now)

          if (daysInGrace >= 7) {
            await supabase.from('card_subscriptions').update({
              status:     'lapsed',
              updated_at: now.toISOString(),
            }).eq('id', sub.id)

            results.lapsed.push(sub.id)
          }

        } catch (subErr) {
          results.errors.push(`Error lapsing subscription ${sub.id}: ${subErr}`)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // JOB 4 — Retry billing for grace period subscriptions that now have
    // sufficient balance (customer deposited during grace period)
    // ══════════════════════════════════════════════════════════════════════

    const { data: retryGraceSubs, error: retryError } = await supabase
      .from('card_subscriptions')
      .select('*, customers(id, first_name, last_name, phone), businesses(name)')
      .eq('status', 'grace_period')

    if (retryError) {
      results.errors.push(`Failed to fetch subscriptions for grace retry: ${retryError.message}`)
    } else {
      for (const sub of (retryGraceSubs || [])) {
        try {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('id', sub.wallet_id)
            .maybeSingle()

          if (!wallet) continue

          const fee = Number(sub.monthly_fee)

          if (Number(wallet.balance) >= fee) {
            // Balance is now sufficient — reinstate
            const newBalance  = Number(wallet.balance) - fee
            const nextBilling = new Date(now)
            nextBilling.setMonth(nextBilling.getMonth() + 1)
            const nextBillingDate = nextBilling.toISOString().slice(0, 10)

            await supabase.from('wallets').update({
              balance:    newBalance,
              updated_at: now.toISOString(),
            }).eq('id', wallet.id)

            await supabase.from('card_subscriptions').update({
              status:                  'active',
              last_billed_at:          now.toISOString(),
              next_billing_date:       nextBillingDate,
              grace_period_started_at: null,
              last_billing_failed_at:  null,
              grace_sms_day1_sent:     false,
              grace_sms_day5_sent:     false,
              updated_at:              now.toISOString(),
            }).eq('id', sub.id)

            await supabase.from('card_subscription_transactions').insert({
              customer_id:     sub.customer_id,
              wallet_id:       sub.wallet_id,
              subscription_id: sub.id,
              type:            'monthly_subscription_fee',
              amount:          fee,
              status:          'completed',
              reference:       generateReference(),
              notes:           `Monthly renewal — reinstated after grace period`,
            })

            results.billed.push(`${sub.id} (grace retry)`)
          }

        } catch (subErr) {
          results.errors.push(`Error retrying grace period subscription ${sub.id}: ${subErr}`)
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date:    today,
      results,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('process-card-subscriptions error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error', results }), { status: 500, headers: CORS })
  }
})