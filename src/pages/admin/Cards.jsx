import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  if (!n) return 'UGX 0'
  if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return 'UGX ' + (n / 1000).toFixed(0) + 'K'
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
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
    active:       { color: C.green,    bg: C.bgGreen   },
    grace_period: { color: C.orange,   bg: C.bgOrange  },
    lapsed:       { color: C.red,      bg: C.bgRed     },
    cancelled:    { color: C.grayMid,  bg: C.grayLight },
    inactive:     { color: C.grayMid,  bg: C.grayLight },
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

function StatCard({ label, value, accentColor }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {accentColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />}
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

const selectStyle = { padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' }
const inputStyle  = { ...selectStyle, cursor: 'text' }
const btnPrimary  = { padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary= { ...btnPrimary, color: C.black, background: C.white, border: `1px solid ${C.grayLine}` }
const btnSuccess  = { ...btnPrimary, background: C.green, borderColor: C.green }
const btnGhost    = { padding: '7px 12px', fontSize: 12, fontWeight: 600, color: C.red, background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }

// ── Email helpers ──────────────────────────────────────────────────────────

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

function businessDispatchEmail({ customerName, businessName }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">A customer card is ready for collection</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        A physical Partna card for <strong>${customerName}</strong> has been dispatched and is on its way to <strong>${businessName}</strong>.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        When the customer visits to collect their card, ask them for their <strong>6-character collection code</strong> and verify their <strong>National ID</strong>. Then log in to your Partna dashboard and mark the card as delivered.
      </p>
      <div style="background: #F6F7EE; border: 1px solid #D7D8CB; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="font-size: 13px; font-weight: 600; color: #959687; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em;">Customer</p>
        <p style="font-size: 16px; font-weight: 600; color: #111; margin: 0;">${customerName}</p>
      </div>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

function customerDispatchEmail({ customerName, businessName, collectionCode }) {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <img src="https://www.partna.io/partna-logo.png" alt="Partna" style="height: 28px; margin-bottom: 28px;" />
      <h2 style="font-size: 20px; font-weight: 600; color: #111; margin: 0 0 12px;">Your card is ready for collection</h2>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px;">
        Hi ${customerName}, your physical Partna card is ready for collection at <strong>${businessName}</strong>.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 24px;">
        When you visit, please bring your <strong>National ID</strong> and quote the collection code below:
      </p>
      <div style="background: #111; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
        <p style="font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.45); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em;">Your collection code</p>
        <p style="font-family: monospace; font-size: 36px; font-weight: 700; color: #fff; margin: 0; letter-spacing: 0.2em;">${collectionCode}</p>
      </div>
      <p style="font-size: 14px; color: #959687; line-height: 1.6; margin: 0 0 24px;">
        This code is also visible in your Partna app under Card Details. Please keep it safe — you will need to show it when collecting your card.
      </p>
      <p style="font-size: 13px; color: #959687; margin: 0;">
        Powered by <a href="https://www.partna.io" style="color: #111; font-weight: 600;">Partna</a>
      </p>
    </div>
  `
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function Cards() {
  const [tab, setTab] = useState('subscriptions')

  // Subscriptions tab
  const [subscriptions, setSubscriptions]     = useState([])
  const [subRevenue, setSubRevenue]           = useState([])
  const [loadingSubs, setLoadingSubs]         = useState(true)
  const [subSearch, setSubSearch]             = useState('')
  const [subFilterStatus, setSubFilterStatus] = useState('')
  const [subFilterType, setSubFilterType]     = useState('')
  const [subFilterBiz, setSubFilterBiz]       = useState('')
  const [businesses, setBusinesses]           = useState([])

  // Physical cards tab
  const [physicalCards, setPhysicalCards]         = useState([])
  const [loadingPhysical, setLoadingPhysical]     = useState(true)
  const [physSearch, setPhysSearch]               = useState('')
  const [physFilterStatus, setPhysFilterStatus]   = useState('')
  const [physFilterBiz, setPhysFilterBiz]         = useState('')
  const [dispatchingId, setDispatchingId]         = useState(null)
  const [dispatchError, setDispatchError]         = useState('')
  const [dispatchSuccess, setDispatchSuccess]     = useState('')

  useEffect(() => { loadBusinesses(); loadSubscriptions(); loadPhysicalCards() }, [])

  async function loadBusinesses() {
    const { data } = await supabase.from('businesses').select('id, name').order('name')
    setBusinesses(data || [])
  }

  async function loadSubscriptions() {
    setLoadingSubs(true)
    try {
      const { data } = await supabase
        .from('card_subscriptions')
        .select('*, customers(id, first_name, last_name, email, phone), businesses(id, name)')
        .order('created_at', { ascending: false })
      setSubscriptions(data || [])

      // Load revenue per subscription
      const { data: txnData } = await supabase
        .from('card_subscription_transactions')
        .select('subscription_id, amount, status, type')
        .eq('status', 'completed')
      setSubRevenue(txnData || [])
    } catch (e) {
      console.error('Cards subscriptions load error:', e)
    }
    setLoadingSubs(false)
  }

  async function loadPhysicalCards() {
    setLoadingPhysical(true)
    try {
      const { data } = await supabase
        .from('card_subscriptions')
        .select('*, customers(id, first_name, last_name, email, phone, nin), businesses(id, name, email)')
        .not('physical_status', 'is', null)
        .order('physical_ordered_at', { ascending: false })
      setPhysicalCards(data || [])
    } catch (e) {
      console.error('Physical cards load error:', e)
    }
    setLoadingPhysical(false)
  }

  // ── Mark dispatched ────────────────────────────────────────────────────
  async function handleMarkDispatched(sub) {
    setDispatchingId(sub.id); setDispatchError(''); setDispatchSuccess('')
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('card_subscriptions')
        .update({ physical_status: 'dispatched', physical_dispatched_at: now, updated_at: now })
        .eq('id', sub.id)

      if (error) throw error

      const customerName = `${sub.customers?.first_name} ${sub.customers?.last_name}`
      const businessName = sub.businesses?.name || 'your institution'
      const collectionCode = sub.collection_code || '——'

      // Email to business admin
      if (sub.businesses?.email) {
        await sendEmail(
          sub.businesses.email,
          `Card ready for collection — ${customerName}`,
          businessDispatchEmail({ customerName, businessName })
        )
      }

      // Email to customer
      if (sub.customers?.email) {
        await sendEmail(
          sub.customers.email,
          'Your Partna card is ready for collection',
          customerDispatchEmail({ customerName, businessName, collectionCode })
        )
      }

      setDispatchSuccess(`Card marked as dispatched. Emails sent to ${businessName} and ${customerName}.`)
      await loadPhysicalCards()
    } catch (e) {
      console.error('Mark dispatched error:', e)
      setDispatchError('Failed to mark as dispatched. Please try again.')
    }
    setDispatchingId(null)
  }

  // ── Computed stats ─────────────────────────────────────────────────────
  const activeVirtual  = subscriptions.filter(s => s.card_type === 'virtual'  && s.status === 'active').length
  const activePhysical = subscriptions.filter(s => s.card_type === 'physical' && s.status === 'active').length
  const mrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0)
  const totalIssuingFees = subRevenue
    .filter(t => t.type === 'physical_issuing_fee')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  // Revenue per subscription lookup
  function getSubRevenue(subId) {
    return subRevenue
      .filter(t => t.subscription_id === subId)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }

  // ── Filters ────────────────────────────────────────────────────────────
  const filteredSubs = subscriptions.filter(s => {
    if (subFilterStatus && s.status !== subFilterStatus) return false
    if (subFilterType   && s.card_type !== subFilterType) return false
    if (subFilterBiz    && s.business_id !== subFilterBiz) return false
    if (subSearch) {
      const q = subSearch.toLowerCase()
      const name = `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase()
      if (!name.includes(q) && !s.businesses?.name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const filteredPhysical = physicalCards.filter(s => {
    if (physFilterStatus && s.physical_status !== physFilterStatus) return false
    if (physFilterBiz    && s.business_id !== physFilterBiz) return false
    if (physSearch) {
      const q = physSearch.toLowerCase()
      const name = `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase()
      if (!name.includes(q) && !s.businesses?.name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const pendingDispatch = physicalCards.filter(s => s.physical_status === 'ordered').length

  const TABS = [
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'physical',      label: `Physical cards${pendingDispatch > 0 ? ` (${pendingDispatch} pending)` : ''}` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: tab === t.id ? C.black : 'transparent', color: tab === t.id ? C.white : C.secondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          SUBSCRIPTIONS TAB
      ══════════════════════════════════════════════ */}
      {tab === 'subscriptions' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatCard label="Active virtual"    value={activeVirtual}          accentColor={C.green}  />
            <StatCard label="Active physical"   value={activePhysical}         accentColor={C.blue}   />
            <StatCard label="Monthly recurring" value={formatUGX(mrr)}         accentColor={C.green}  />
            <StatCard label="Issuing fees"      value={formatUGX(totalIssuingFees)} accentColor={C.orange} />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <input type="text" placeholder="Search by customer or business…" value={subSearch} onChange={e => setSubSearch(e.target.value)}
                style={{ ...inputStyle, width: '100%', paddingLeft: 12 }}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}
              />
            </div>
            <select style={selectStyle} value={subFilterBiz} onChange={e => setSubFilterBiz(e.target.value)}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select style={selectStyle} value={subFilterType} onChange={e => setSubFilterType(e.target.value)}>
              <option value="">All types</option>
              <option value="virtual">Virtual</option>
              <option value="physical">Physical</option>
            </select>
            <select style={selectStyle} value={subFilterStatus} onChange={e => setSubFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace period</option>
              <option value="lapsed">Lapsed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {(subSearch || subFilterBiz || subFilterType || subFilterStatus) && (
              <button onClick={() => { setSubSearch(''); setSubFilterBiz(''); setSubFilterType(''); setSubFilterStatus('') }} style={btnGhost}>Clear</button>
            )}
          </div>

          {/* Table */}
          {loadingSubs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                      {['Customer', 'Business', 'Type', 'Status', 'Activated', 'Next billing', 'Monthly fee', 'Total revenue'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No subscriptions found</td></tr>
                    ) : filteredSubs.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < filteredSubs.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{s.customers?.first_name} {s.customers?.last_name}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{s.customers?.phone}</p>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{s.businesses?.name || '—'}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <Badge label={s.card_type} color={s.card_type === 'physical' ? C.blue : C.green} bg={s.card_type === 'physical' ? C.bgBlue : C.bgGreen} />
                        </td>
                        <td style={{ padding: '11px 14px' }}>{statusBadge(s.status)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.virtual_activated_at)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.next_billing_date)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.black }}>
                          {formatUGX(s.monthly_fee)}<span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>/mo</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.green }}>{formatUGX(getSubRevenue(s.id))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
                Showing {filteredSubs.length} of {subscriptions.length} subscriptions
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          PHYSICAL CARDS TAB
      ══════════════════════════════════════════════ */}
      {tab === 'physical' && (
        <>
          {/* Pending dispatch alert */}
          {pendingDispatch > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>{pendingDispatch} card{pendingDispatch > 1 ? 's' : ''} awaiting dispatch</span>
              </div>
              <button onClick={() => setPhysFilterStatus('ordered')} style={{ ...btnPrimary, background: C.orange, borderColor: C.orange, padding: '6px 12px', fontSize: 12 }}>Show pending</button>
            </div>
          )}

          {/* Dispatch feedback */}
          {dispatchSuccess && (
            <div style={{ padding: '12px 16px', background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 10, fontSize: 13, fontWeight: 500, color: C.green }}>{dispatchSuccess}</div>
          )}
          {dispatchError && (
            <div style={{ padding: '12px 16px', background: C.bgRed, border: `1px solid ${C.red}`, borderRadius: 10, fontSize: 13, fontWeight: 500, color: C.red }}>{dispatchError}</div>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="Total ordered"    value={physicalCards.length}                                              accentColor={C.blue}   />
            <StatCard label="Awaiting dispatch" value={physicalCards.filter(s => s.physical_status === 'ordered').length}    accentColor={C.orange} />
            <StatCard label="Delivered"         value={physicalCards.filter(s => s.physical_status === 'delivered').length}  accentColor={C.green}  />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <input type="text" placeholder="Search by customer or business…" value={physSearch} onChange={e => setPhysSearch(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = C.grayLine}
              />
            </div>
            <select style={selectStyle} value={physFilterBiz} onChange={e => setPhysFilterBiz(e.target.value)}>
              <option value="">All businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select style={selectStyle} value={physFilterStatus} onChange={e => setPhysFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ordered">Ordered</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
            </select>
            {(physSearch || physFilterBiz || physFilterStatus) && (
              <button onClick={() => { setPhysSearch(''); setPhysFilterBiz(''); setPhysFilterStatus('') }} style={btnGhost}>Clear</button>
            )}
          </div>

          {/* Table */}
          {loadingPhysical ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                      {['Customer', 'NIN', 'Business', 'Collection code', 'Status', 'Ordered', 'Dispatched', 'Delivered', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPhysical.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', fontSize: 14, fontWeight: 500, color: C.secondary }}>No physical card orders found</td></tr>
                    ) : filteredPhysical.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < filteredPhysical.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: s.physical_status === 'ordered' ? C.bgOrange.replace(')', ', 0.25)').replace('rgb', 'rgba') : i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{s.customers?.first_name} {s.customers?.last_name}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>{s.customers?.phone}</p>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.black }}>{s.customers?.nin || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: C.secondary }}>{s.businesses?.name || '—'}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: C.black, letterSpacing: '0.1em' }}>{s.collection_code || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>{physicalStatusBadge(s.physical_status)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.physical_ordered_at)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.physical_dispatched_at)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>{formatDate(s.physical_delivered_at)}</td>
                        <td style={{ padding: '11px 14px' }}>
                          {s.physical_status === 'ordered' && (
                            <button
                              onClick={() => handleMarkDispatched(s)}
                              disabled={dispatchingId === s.id}
                              style={{ ...btnSuccess, padding: '6px 12px', fontSize: 12, opacity: dispatchingId === s.id ? 0.7 : 1 }}
                            >
                              {dispatchingId === s.id
                                ? <><div className="spinner spinner-sm spinner-light" /> Dispatching…</>
                                : '✓ Mark dispatched'
                              }
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.grayLine}`, fontSize: 12, fontWeight: 500, color: C.secondary }}>
                Showing {filteredPhysical.length} of {physicalCards.length} physical card orders
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}