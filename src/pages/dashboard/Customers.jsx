import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers — unchanged ────────────────────────────────────────────────────
function formatUGX(n) { return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 }) }
function formatDate(d) { return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) }
function txAmountColor(type) { return type === 'deposit' ? '#59886D' : '#CC3939' }
function txIconBg(type) {
  if (type === 'deposit')    return { bg: '#E4F8EC', color: '#59886D' }
  if (type === 'withdrawal') return { bg: '#F8E4E4', color: '#CC3939' }
  return { bg: '#F8F0E4', color: '#EF8354' }
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  accent:   '#ECEDE1',
  labelBg:  '#E4E5DD',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  grayLight:'#ECECEC',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
  orange:   '#EF8354',
  bgOrange: '#F8F0E4',
  blue:     '#85A0C5',
}

const inputStyle = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 8, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }

export default function Customers({ admin, business }) {
  const [customers, setCustomers]       = useState([])
  const [wallets, setWallets]           = useState({})
  const [campaigns, setCampaigns]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [kycFilter, setKycFilter]       = useState('all')
  const [riskFilter, setRiskFilter]     = useState('all')
  const [selected, setSelected]         = useState(null)
  const [customerTxns, setCustomerTxns] = useState([])
  const [txnLoading, setTxnLoading]     = useState(false)

  useEffect(() => { if (business) loadData() }, [business])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase.from('customers').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
      if (!customerData?.length) { setCustomers([]); setLoading(false); return }
      setCustomers(customerData)
      const ids = customerData.map(c => c.id)
      const { data: walletData } = await supabase.from('wallets').select('*').in('customer_id', ids)
      const walletMap = {}; walletData?.forEach(w => { walletMap[w.customer_id] = w }); setWallets(walletMap)
      const campaignIds = [...new Set(customerData.map(c => c.campaign_id).filter(Boolean))]
      if (campaignIds.length > 0) {
        const { data: campaignData } = await supabase.from('campaigns').select('id, name, target_amount').in('id', campaignIds)
        const campaignMap = {}; campaignData?.forEach(c => { campaignMap[c.id] = c }); setCampaigns(campaignMap)
      }
    } catch (e) { console.error('Customers load error:', e) }
    setLoading(false)
  }

  async function loadCustomerTxns(customerId) {
    setTxnLoading(true)
    const { data } = await supabase.from('transactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20)
    setCustomerTxns(data || []); setTxnLoading(false)
  }

  function isAtRisk(customer) {
    if (customer.registration_status !== 'complete') return false
    const wallet = wallets[customer.id]; if (!wallet) return true
    return Number(wallet.balance) === 0
  }

  function pct(customer) {
    const wallet = wallets[customer.id]; const campaign = campaigns[customer.campaign_id]
    if (!wallet || !campaign) return 0
    return Math.min((Number(wallet.balance) / Number(campaign.target_amount)) * 100, 100)
  }

  const filtered = customers.filter(c => {
    const name = `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (kycFilter !== 'all' && c.kyc_status !== kycFilter) return false
    if (riskFilter === 'at_risk'     && !isAtRisk(c)) return false
    if (riskFilter === 'not_at_risk' &&  isAtRisk(c)) return false
    return true
  })

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Customer list ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

        {/* Filter bar */}
        <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input style={{ ...inputStyle, paddingLeft: 30 }} type="text" placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 16 }}>✕</button>}
          </div>
          <select style={{ ...inputStyle, width: 'auto', minWidth: 120 }} value={kycFilter} onChange={e => setKycFilter(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
            <option value="all">All KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>
          <select style={{ ...inputStyle, width: 'auto', minWidth: 140 }} value={riskFilter} onChange={e => setRiskFilter(e.target.value)} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine}>
            <option value="all">All customers</option>
            <option value="at_risk">At risk</option>
            <option value="not_at_risk">Not at risk</option>
          </select>
          <span style={{ padding: '5px 10px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 7, fontSize: 12, fontWeight: 500, color: C.secondary, whiteSpace: 'nowrap' }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>{customers.length === 0 ? 'No customers yet' : 'No customers match your filters'}</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>{customers.length === 0 ? 'Customers will appear here once they register via your portal.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.grayLine}` }}>
                    {['Customer', 'Contact', 'KYC', 'Balance', 'Progress', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const wallet     = wallets[c.id]
                    const balance    = wallet ? Number(wallet.balance) : 0
                    const progress   = pct(c)
                    const atRisk     = isAtRisk(c)
                    const isSelected = selected?.id === c.id
                    const barColor   = progress >= 75 ? C.green : progress >= 50 ? C.orange : C.blue
                    return (
                      <tr key={c.id} onClick={() => { setSelected(c); loadCustomerTxns(c.id) }}
                        style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: isSelected ? 'rgba(133,160,197,0.07)' : i % 2 === 0 ? C.white : C.bg, cursor: 'pointer', borderLeft: `3px solid ${isSelected ? C.black : 'transparent'}`, transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.accent }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? C.white : C.bg }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? C.black : C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: isSelected ? C.white : C.black, flexShrink: 0 }}>
                              {c.first_name?.[0]}{c.last_name?.[0]}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{c.first_name} {c.last_name}</span>
                                {atRisk && <span style={{ fontSize: 10, fontWeight: 600, color: C.red, background: C.bgRed, borderRadius: 5, padding: '2px 6px' }}>At risk</span>}
                              </div>
                              <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, fontFamily: 'monospace', margin: '1px 0 0' }}>{c.draw_code || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: C.black, margin: '0 0 2px' }}>{c.phone}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</p>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.kyc_status === 'verified'
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green,  background: C.bgGreen,  borderRadius: 6, padding: '3px 8px' }}>Verified</span>
                            : <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.bgOrange, borderRadius: 6, padding: '3px 8px' }}>Pending</span>
                          }
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: C.black, whiteSpace: 'nowrap' }}>{formatUGX(balance)}</td>
                        <td style={{ padding: '12px 14px', minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <div style={{ flex: 1, height: 5, background: C.grayLine, borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${progress}%`, background: barColor, borderRadius: 999 }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.secondary, whiteSpace: 'nowrap' }}>{progress.toFixed(0)}%</span>
                          </div>
                          <p style={{ fontSize: 10, fontWeight: 500, color: C.grayMid, margin: 0 }}>{formatDate(c.created_at)}</p>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSelected ? C.black : C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div style={{ width: 296, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>

          {/* Customer info card */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.grayLine}` }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Customer details</p>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayMid, fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            {/* Avatar */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: C.black, flexShrink: 0 }}>
                {selected.first_name?.[0]}{selected.last_name?.[0]}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{selected.first_name} {selected.last_name}</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{selected.phone}</p>
              </div>
            </div>
            {/* Info rows */}
            {[
              { label: 'Email',           value: selected.email },
              { label: 'NIN',             value: selected.nin ? '••••' + selected.nin.slice(-4) : 'Not provided' },
              { label: 'Draw code',       value: selected.draw_code || '—', mono: true },
              { label: 'KYC status',      value: selected.kyc_status === 'verified' ? 'Verified' : 'Pending', kyc: true },
              { label: 'Payment network', value: selected.payment_network === 'mtn' ? 'MTN MoMo' : selected.payment_network === 'airtel' ? 'Airtel Money' : 'Not set' },
              { label: 'Balance',         value: formatUGX(wallets[selected.id] ? Number(wallets[selected.id].balance) : 0) },
              { label: 'Progress',        value: pct(selected).toFixed(1) + '%' },
              { label: 'Registered',      value: formatDate(selected.created_at) },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>{row.label}</span>
                {row.kyc ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: selected.kyc_status === 'verified' ? C.green : C.orange, background: selected.kyc_status === 'verified' ? C.bgGreen : C.bgOrange, borderRadius: 6, padding: '2px 8px' }}>{row.value}</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.black, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Transaction history */}
          <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.grayLine}` }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: 0 }}>Transaction history</p>
            </div>
            {txnLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
            ) : customerTxns.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 13, fontWeight: 500, color: C.secondary }}>No transactions yet</div>
            ) : customerTxns.map((txn, i) => {
              const { bg, color } = txIconBg(txn.type)
              return (
                <div key={txn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < customerTxns.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {txn.type === 'deposit' ? <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> : <><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></>}
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 1px', textTransform: 'capitalize' }}>{txn.type === 'payment' ? 'Fee payment' : txn.type}</p>
                      <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0 }}>{formatDate(txn.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: txAmountColor(txn.type) }}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}