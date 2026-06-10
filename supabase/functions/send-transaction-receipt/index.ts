import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const AT_API_KEY = Deno.env.get('AT_API_KEY')!
const AT_USERNAME = Deno.env.get('AT_USERNAME')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const body = await req.json()
    const record = body.record

    if (!record) {
      return new Response(JSON.stringify({ error: 'No record in payload' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ── Fetch customer ──
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', record.customer_id)
      .maybeSingle()

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404 })
    }

    // ── Fetch campaign ──
    let campaign = null
    if (record.campaign_id) {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', record.campaign_id)
        .maybeSingle()
      campaign = data
    }

    // ── Fetch business ──
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', customer.business_id)
      .maybeSingle()

    // ── Fetch admin (created_by — the business owner) ──
    const { data: admin } = await supabase
      .from('business_admins')
      .select('full_name, job_title, role')
      .eq('business_id', customer.business_id)
      .eq('role', 'owner')
      .maybeSingle()

    // ── Fetch wallet for new balance ──
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('customer_id', customer.id)
      .maybeSingle()

    // ── Fetch transaction fees if any ──
    const { data: fees } = await supabase
      .from('transaction_fees')
      .select('*')
      .eq('transaction_id', record.id)
      .maybeSingle()

    const balance = wallet ? Number(wallet.balance) : 0
    const amount = Number(record.amount)
    const txnType = record.type // 'deposit' | 'payment' | 'withdrawal'
    const reference = record.reference || record.id
    const campaignName = campaign?.name || 'Savings Campaign'
    const businessName = business?.name || 'Partna'
    const businessEmail = business?.admin_email || ''
    const businessPhone = business?.phone || ''
    const businessAddress = business?.address || ''
    const businessLogo = business?.logo_url || ''
    const adminName = admin?.full_name || 'Account Administrator'
    const adminTitle = admin?.job_title || admin?.role || 'Administrator'
    const customerName = `${customer.first_name} ${customer.last_name}`
    const customerPhone = customer.phone || ''

    function formatUGX(n: number) {
      return 'UGX ' + n.toLocaleString('en-UG', { maximumFractionDigits: 0 })
    }

    function formatDateTime(d: string) {
      return new Date(d).toLocaleString('en-UG', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Africa/Kampala',
      })
    }

    // ── Transaction label ──
    function txLabel() {
      if (txnType === 'deposit') return 'Deposit'
      if (txnType === 'payment') return 'Fee Payment'
      if (txnType === 'withdrawal') return 'Withdrawal'
      return 'Transaction'
    }

    // ── Build email HTML ──
    const totalFees = fees ? Number(fees.total_fees) : 0
    const netAmount = fees ? Number(fees.net_amount) : amount

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt — ${reference}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${business?.primary_color || '#1B4F72'}; padding: 28px 32px; display: flex; align-items: center; gap: 16px; }
    .header img { width: 48px; height: 48px; object-fit: contain; }
    .header-text { color: #fff; }
    .header-text h1 { font-size: 18px; font-weight: 700; }
    .header-text p { font-size: 12px; opacity: 0.7; margin-top: 2px; }
    .body { padding: 32px; }
    .receipt-title { font-size: 22px; font-weight: 800; color: ${business?.primary_color || '#1B4F72'}; margin-bottom: 4px; }
    .receipt-ref { font-size: 12px; color: #999; font-family: monospace; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f2f5; }
    .row:last-child { border-bottom: none; }
    .row-label { font-size: 13px; color: #888; }
    .row-value { font-size: 13px; font-weight: 600; color: ${business?.primary_color || '#1B4F72'}; text-align: right; }
    .row-value.green { color: #16A34A; }
    .row-value.red { color: #DC2626; }
    .row-value.amber { color: #D97706; }
    .divider { height: 1px; background: #f0f2f5; margin: 16px 0; }
    .amount-box { background: ${business?.primary_color || '#1B4F72'}; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .amount-box .label { font-size: 12px; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
    .amount-box .amount { font-size: 28px; font-weight: 800; color: #fff; }
    .sent-to { background: #f8f9fa; border-radius: 12px; padding: 16px 20px; margin: 24px 0; }
    .sent-to .st-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .sent-to .st-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .sent-to .st-key { font-size: 12px; color: #888; }
    .sent-to .st-val { font-size: 12px; font-weight: 600; color: #333; }
    .footer { background: #f8f9fa; padding: 20px 32px; border-top: 1px solid #eee; }
    .footer p { font-size: 11px; color: #aaa; margin-bottom: 4px; }
    .footer .biz-details { font-size: 12px; color: #666; line-height: 1.6; }
    @media print {
      body { background: #fff; }
      .wrapper { box-shadow: none; margin: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${businessLogo ? `<img src="${businessLogo}" alt="${businessName}" />` : ''}
      <div class="header-text">
        <h1>${businessName}</h1>
        <p>Savings Program — Powered by Partna</p>
      </div>
    </div>

    <div class="body">
      <div class="receipt-title">Receipt</div>
      <div class="receipt-ref">Ref: ${reference}</div>

      <div class="amount-box">
        <div class="label">${txLabel()} amount</div>
        <div class="amount">${formatUGX(amount)}</div>
      </div>

      <div class="row">
        <span class="row-label">Transaction type</span>
        <span class="row-value">${txLabel()}</span>
      </div>
      <div class="row">
        <span class="row-label">Reference</span>
        <span class="row-value" style="font-family:monospace">${reference}</span>
      </div>
      <div class="row">
        <span class="row-label">Date &amp; time</span>
        <span class="row-value">${formatDateTime(record.created_at)}</span>
      </div>
      <div class="row">
        <span class="row-label">Campaign</span>
        <span class="row-value">${campaignName}</span>
      </div>
      <div class="row">
        <span class="row-label">Amount</span>
        <span class="row-value">${formatUGX(amount)}</span>
      </div>
      ${totalFees > 0 ? `
      <div class="row">
        <span class="row-label">Fees</span>
        <span class="row-value red">− ${formatUGX(totalFees)}</span>
      </div>
      <div class="row">
        <span class="row-label">Net amount</span>
        <span class="row-value green">${formatUGX(netAmount)}</span>
      </div>
      ` : ''}
      <div class="row">
        <span class="row-label">Savings balance</span>
        <span class="row-value green">${formatUGX(balance)}</span>
      </div>
      <div class="row">
        <span class="row-label">Status</span>
        <span class="row-value ${record.status === 'completed' ? 'green' : 'amber'}">
          ${record.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
        </span>
      </div>

      <div class="sent-to">
        <div class="st-label">Transaction details</div>
        <div class="st-row">
          <span class="st-key">Sent to</span>
          <span class="st-val">${customerName}</span>
        </div>
        <div class="st-row">
          <span class="st-key">Created by</span>
          <span class="st-val">${adminName}, ${adminTitle}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p style="font-weight:600; color:#555; margin-bottom:8px;">${businessName}</p>
      <div class="biz-details">
        ${businessEmail ? `📧 ${businessEmail}<br>` : ''}
        ${businessPhone ? `📞 ${businessPhone}<br>` : ''}
        ${businessAddress ? `📍 ${businessAddress}` : ''}
      </div>
      <p style="margin-top:12px;">This is an automated receipt from ${businessName} Savings Program, powered by Partna.</p>
    </div>
  </div>
</body>
</html>`

    // ── Send email via Resend ──
    const emailSubject = `Receipt: ${txLabel()} of ${formatUGX(amount)} — ${reference}`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${businessName} <receipts@partna.io>`,
        to: [customer.email],
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    const emailResult = await emailRes.json()

    // ── Build SMS message ──
    let smsMessage = ''
    if (txnType === 'deposit') {
      smsMessage = `Hello ${customer.first_name}, you have deposited ${formatUGX(amount)} to ${campaignName}. Reference: ${reference}. Your savings balance is ${formatUGX(balance)}. Thank you for saving with ${businessName}!`
    } else if (txnType === 'withdrawal' && record.status === 'pending') {
      smsMessage = `Hello ${customer.first_name}, your withdrawal request of ${formatUGX(amount)} from ${campaignName} is being processed. Reference: ${reference}. Withdrawals take 1-2 working days. You will be notified when complete.`
    } else if (txnType === 'withdrawal' && record.status === 'completed') {
      smsMessage = `Hello ${customer.first_name}, your withdrawal of ${formatUGX(amount)} from ${campaignName} has been processed. Reference: ${reference}. Your savings balance is ${formatUGX(balance)}. Thank you for saving with ${businessName}!`
    } else if (txnType === 'payment') {
      smsMessage = `Hello ${customer.first_name}, you have paid ${formatUGX(amount)} to ${campaignName}. Reference: ${reference}. Your savings balance is ${formatUGX(balance)}. Thank you for saving with ${businessName}!`
    }

    // ── Send SMS via Africa's Talking ──
    let smsResult = null
    if (smsMessage && customerPhone) {
      const atEndpoint = AT_USERNAME === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging'

      const smsBody = new URLSearchParams({
        username: AT_USERNAME,
        to: customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`,
        message: smsMessage,
      })

      const smsRes = await fetch(atEndpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': AT_API_KEY,
        },
        body: smsBody.toString(),
      })

      smsResult = await smsRes.json()
    }

    return new Response(JSON.stringify({
      success: true,
      email: emailResult,
      sms: smsResult,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})