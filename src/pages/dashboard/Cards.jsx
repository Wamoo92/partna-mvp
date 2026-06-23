import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
  bgBlue:    'rgba(133,160,197,0.12)',
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
      {label}
    </span>
  )
}

function statusBadge(status) {
  const map = {
    active:       { color: C.green,   bg: C.bgGreen   },
    grace_period: { color: C.orange,  bg: C.bgOrange  },
    lapsed:       { color: C.red,     bg: C.bgRed     },
    cancelled:    { color: C.grayMid, bg: C.grayLight },
  }
  const s = map[status] || { color: C.grayMid, bg: C.grayLight }
  return <Badge label={status?.replace('_', ' ') || '—'} color={s.color} bg={s.bg} />
}

function physicalStatusBadge(status) {
  const map = {
    ordered:    { color: C.orange, bg: C.bgOrange },
    dispatched: { color: C.blue,   bg: C.bgBlue   },
    delivered:  { color: C.green,  bg: C.bgGreen  },
  }
  const s = map[status] || { color: C.grayMid, bg: C.grayLight }
  return <Badge label={status || '—'} color={s.color} bg={s.bg} />
}

async function sendEmail(to, subject, html) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-admin-email`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    })
  } catch (e) {
    console.error('Email send error (non-critical):', e)
  }
}

function customerDeliveryEmail({ customerName, businessName }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">Your card is now active</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your physical Partna card has been delivered and is now active.
        Your monthly subscription of <strong>UGX 10,000</strong> will be deducted from your savings wallet each month starting today.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        You can view your card details, cashback rewards, and merchant offers in your Partna portal at
        <a href="https://www.partna.io" style="color: #111; font-weight: 600;">www.partna.io</a>.
      </p>
      <div style="background: #E4F8EC; border: 1px solid #59886D; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="font-size: 14px; font-weight: 600; color: #59886D; margin: 0;">
          ✓ Card active · UGX 10,000/month · Cashback rewards enabled
        </p>
      </div>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function Cards({
 admin, business }) {
  useEffect(() => { document.title = 'Cards - Partna' }, [])


  // Code lookup
  const [code, setCode]                   = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult]   = useState(null)
  const [lookupError, setLookupError]     = useState('')
  const [delivering, setDelivering]       = useState(false)
  const [deliverError, setDeliverError]   = useState('')
  const [deliverSuccess, setDeliverSuccess] = useState('')

  // Subscriptions list
  const [subscriptions, setSubscriptions]   = useState([])
  const [loadingSubs, setLoadingSubs]       = useState(true)
  const [subSearch, setSubSearch]           = useState('')
  const [subFilterStatus, setSubFilterStatus] = useState('')
  const [subFilterType, setSubFilterType]   = useState('')

  useEffect(() => { if (business) loadSubscriptions() }, [business])

  async function loadSubscriptions() {
    setLoadingSubs(true)
    try {
      const { data } = await supabase
        .from('card_subscriptions')
        .select('*, customers(id, first_name, last_name, phone, email, nin)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
      setSubscriptions(data || [])
    } catch (e) {
      console.error('Dashboard cards load error:', e)
    }
    setLoadingSubs(false)
  }

  // ── Collection code lookup ─────────────────────────────────────────────
  async function handleLookup() {
    const cleanCode = code.trim().toUpperCase()
    if (cleanCode.length !== 6) { setLookupError('Please enter a valid 6-character collection code.'); return }
    setLookupLoading(true); setLookupError(''); setLookupResult(null); setDeliverSuccess(''); setDeliverError('')
    try {
      const { data, error } = await supabase
        .from('card_subscriptions')
        .select('*, customers(id, first_name, last_name, phone, email, nin)')
        .eq('collection_code', cleanCode)
        .eq('business_id', business.id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        setLookupError('No card found with that code. Please check the code and try again.')
      } else if (data.physical_status === 'delivered') {
        setLookupError('This card has already been marked as delivered.')
      } else if (data.physical_status === 'ordered') {
        setLookupError('This card has not been dispatched yet. Please contact Partna support.')
      } else {
        setLookupResult(data)
      }
    } catch (e) {
      console.error('Code lookup error:', e)
      setLookupError('Something went wrong. Please try again.')
    }
    setLookupLoading(false)
  }

  // ── Mark as delivered ──────────────────────────────────────────────────
  async function handleMarkDelivered() {
    if (!lookupResult) return
    setDelivering(true); setDeliverError('')
    try {
      const now              = new Date()
      const nextBilling      = new Date(now)
      nextBilling.setMonth(nextBilling.getMonth() + 1)
      const nextBillingDate  = nextBilling.toISOString().slice(0, 10)
      const deliveryDate     = now.toISOString().slice(0, 10)

      const { error } = await supabase
        .from('card_subscriptions')
        .update({
          physical_status:          'delivered',
          physical_delivered_at:    now.toISOString(),
          physical_billing_start_date: deliveryDate,
          card_type:                'physical',
          monthly_fee:              10000,
          next_billing_date:        nextBillingDate,
          last_billed_at:           now.toISOString(),
          updated_at:               now.toISOString(),
        })
        .eq('id', lookupResult.id)

      if (error) throw error

      // Send confirmation email to customer
      const customerName = `${lookupResult.customers?.first_name} ${lookupResult.customers?.last_name}`
      if (lookupResult.customers?.email) {
        await sendEmail(
          lookupResult.customers.email,
          'Your Partna card is now active',
          customerDeliveryEmail({ customerName, businessName: business.name })
        )
      }

      setDeliverSuccess(`Card delivered to ${customerName}. Subscription upgraded to UGX 10,000/month from today.`)
      setLookupResult(null)
      setCode('')
      await loadSubscriptions()
    } catch (e) {
      console.error('Mark delivered error:', e)
      setDeliverError('Failed to mark as delivered. Please try again.')
    }
    setDelivering(false)
  }

  // ── Filters ────────────────────────────────────────────────────────────
  const filteredSubs = subscriptions.filter(s => {
    if (subFilterStatus && s.status !== subFilterStatus) return false
    if (subFilterType   && s.card_type !== subFilterType) return false
    if (subSearch) {
      const q    = subSearch.toLowerCase()
      const name = `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase()
      if (!name.includes(q) && !(s.customers?.phone || '').includes(q)) return false
    }
    return true
  })

  const pendingDelivery = subscriptions.filter(s => s.physical_status === 'dispatched').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══════════════════════════════════════════════
          SECTION 1 — COLLECTION CODE LOOKUP
      ══════════════════════════════════════════════ */}
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.grayLine}`, background: C.black }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.white, margin: '0 0 2px', letterSpacing: '-0.4px' }}>Card collection</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Enter the customer's 6-character code to confirm collection and activate their card
          </p>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Code input */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                  setLookupError('')
                  setLookupResult(null)
                  setDeliverSuccess('')
                }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="Enter 6-character code e.g. K7X2M9"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: C.black,
                  background: C.bg,
                  border: `1.5px solid ${lookupError ? C.red : C.grayLine}`,
                  borderRadius: 10,
                  outline: 'none',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = lookupError ? C.red : C.grayLine}
              />
              {lookupError && (
                <p style={{ fontSize: 13, fontWeight: 500, color: C.red, margin: '6px 0 0' }}>{lookupError}</p>
              )}
            </div>
            <button
              onClick={handleLookup}
              disabled={lookupLoading || code.length !== 6}
              style={{
                padding: '14px 24px', fontSize: 14, fontWeight: 600,
                color: C.white, background: code.length === 6 ? C.black : C.grayMid,
                border: 'none', borderRadius: 10, cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                transition: 'opacity 0.15s', opacity: lookupLoading ? 0.7 : 1,
              }}
            >
              {lookupLoading ? <><div className="spinner spinner-sm spinner-light" /> Looking up…</> : 'Find customer'}
            </button>
          </div>

          {/* Deliver success message */}
          {deliverSuccess && (
            <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{deliverSuccess}</span>
            </div>
          )}

          {/* Lookup result */}
          {lookupResult && (
            <div style={{ border: `1.5px solid ${C.black}`, borderRadius: 10, overflow: 'hidden' }}>

              {/* Customer info */}
              <div style={{ padding: '16px 18px', background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer found — verify ID before confirming</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Full name', value: `${lookupResult.customers?.first_name} ${lookupResult.customers?.last_name}` },
                    { label: 'National ID (NIN)', value: lookupResult.customers?.nin || '—', mono: true },
                    { label: 'Phone', value: lookupResult.customers?.phone || '—' },
                    { label: 'Collection code', value: lookupResult.collection_code, mono: true },
                  ].map((row, i) => (
                    <div key={i}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: C.secondary, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</p>
                      <p style={{ fontSize: row.mono ? 16 : 15, fontWeight: 700, color: C.black, margin: 0, fontFamily: row.mono ? 'monospace' : 'inherit', letterSpacing: row.mono ? '0.08em' : 0 }}>{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div style={{ padding: '12px 18px', background: C.bgOrange, borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>
                  Verify the customer's National ID matches the NIN above before marking as delivered.
                </span>
              </div>

              {/* Actions */}
              <div style={{ padding: '14px 18px', display: 'flex', gap: 10, background: C.white }}>
                <button
                  onClick={() => { setLookupResult(null); setCode(''); setDeliverError('') }}
                  style={{ flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkDelivered}
                  disabled={delivering}
                  style={{ flex: 2, padding: '11px', fontSize: 14, fontWeight: 600, color: C.white, background: C.green, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: delivering ? 0.7 : 1 }}
                >
                  {delivering
                    ? <><div className="spinner spinner-sm spinner-light" /> Confirming…</>
                    : <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        ID verified — mark card as delivered
                      </>
                  }
                </button>
              </div>

              {deliverError && (
                <div style={{ padding: '10px 18px', background: C.bgRed, borderTop: `1px solid ${C.red}` }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>{deliverError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 2 — CARDS AWAITING DELIVERY
      ══════════════════════════════════════════════ */}
      {pendingDelivery > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bgBlue, border: `1px solid ${C.blue}`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>
              {pendingDelivery} card{pendingDelivery > 1 ? 's' : ''} dispatched and awaiting collection
            </span>
          </div>
          <button
            onClick={() => setSubFilterStatus('active')}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.white, background: C.blue, border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            View all
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SECTION 3 — ALL CARD SUBSCRIPTIONS
      ══════════════════════════════════════════════ */}
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 2px', letterSpacing: '-0.4px' }}>Customer cards</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{subscriptions.length} card subscription{subscriptions.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13, border: `1px solid ${C.grayLine}`, borderRadius: 8, background: C.bg, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', color: C.black, width: 200 }}
              onFocus={e => e.target.style.borderColor = C.black}
              onBlur={e => e.target.style.borderColor = C.grayLine}
            />
            <select
              value={subFilterType}
              onChange={e => setSubFilterType(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13, border: `1px solid ${C.grayLine}`, borderRadius: 8, background: C.white, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', color: C.black }}
            >
              <option value="">All types</option>
              <option value="virtual">Virtual</option>
              <option value="physical">Physical</option>
            </select>
            <select
              value={subFilterStatus}
              onChange={e => setSubFilterStatus(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 13, border: `1px solid ${C.grayLine}`, borderRadius: 8, background: C.white, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', color: C.black }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace period</option>
              <option value="lapsed">Lapsed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loadingSubs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : filteredSubs.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              {subscriptions.length === 0 ? 'No customers have activated a card yet.' : 'No results match your filters.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                  {['Customer', 'Card type', 'Status', 'Physical card', 'Activated', 'Next billing', 'Monthly fee'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < filteredSubs.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{s.customers?.first_name} {s.customers?.last_name}</p>
                      <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{s.customers?.phone}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge label={s.card_type} color={s.card_type === 'physical' ? C.blue : C.green} bg={s.card_type === 'physical' ? C.bgBlue : C.bgGreen} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>{statusBadge(s.status)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.physical_status ? physicalStatusBadge(s.physical_status) : <span style={{ fontSize: 12, color: C.grayMid }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.virtual_activated_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.next_billing_date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.black }}>
                      {formatUGX(s.monthly_fee)}<span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>/mo</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
          Showing {filteredSubs.length} of {subscriptions.length} subscriptions
        </div>
      </div>

    </div>
  )
}