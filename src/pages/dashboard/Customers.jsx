import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function txAccent(type) {
  switch (type) {
    case 'deposit':    return 'var(--color-green)'
    case 'withdrawal': return 'var(--color-yellow)'
    case 'payment':    return 'var(--color-primary)'
    default:           return 'var(--color-grey-light)'
  }
}

function txIcon(type) {
  switch (type) {
    case 'deposit':    return 'south'
    case 'withdrawal': return 'north'
    case 'payment':    return 'north'
    default:           return 'swap_vert'
  }
}

function txAmountColor(type) {
  return type === 'deposit' ? '#2D8B45' : '#C0392B'
}

export default function Customers({ admin, business }) {
  const [customers, setCustomers]     = useState([])
  const [wallets, setWallets]         = useState({})
  const [campaigns, setCampaigns]     = useState({})
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [kycFilter, setKycFilter]     = useState('all')
  const [riskFilter, setRiskFilter]   = useState('all')
  const [selected, setSelected]       = useState(null)
  const [customerTxns, setCustomerTxns] = useState([])
  const [txnLoading, setTxnLoading]   = useState(false)

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers').select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      if (!customerData?.length) { setCustomers([]); setLoading(false); return }
      setCustomers(customerData)

      const ids = customerData.map(c => c.id)

      const { data: walletData } = await supabase.from('wallets').select('*').in('customer_id', ids)
      const walletMap = {}
      walletData?.forEach(w => { walletMap[w.customer_id] = w })
      setWallets(walletMap)

      const campaignIds = [...new Set(customerData.map(c => c.campaign_id).filter(Boolean))]
      if (campaignIds.length > 0) {
        const { data: campaignData } = await supabase
          .from('campaigns').select('id, name, target_amount').in('id', campaignIds)
        const campaignMap = {}
        campaignData?.forEach(c => { campaignMap[c.id] = c })
        setCampaigns(campaignMap)
      }
    } catch (e) {
      console.error('Customers load error:', e)
    }
    setLoading(false)
  }

  async function loadCustomerTxns(customerId) {
    setTxnLoading(true)
    const { data } = await supabase
      .from('transactions').select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }).limit(20)
    setCustomerTxns(data || [])
    setTxnLoading(false)
  }

  function isAtRisk(customer) {
    if (customer.registration_status !== 'complete') return false
    const wallet = wallets[customer.id]
    if (!wallet) return true
    return Number(wallet.balance) === 0
  }

  function pct(customer) {
    const wallet   = wallets[customer.id]
    const campaign = campaigns[customer.campaign_id]
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

  return (
    <div style={{ display: 'flex', gap: 'var(--space-5)', height: '100%', alignItems: 'flex-start' }}>

      {/* ── Customer list ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>

        {/* Filter bar */}
        <div style={{
          background: 'var(--color-white)',
          border: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
        }}>
          <div className="search-wrapper" style={{ flex: 1, minWidth: 180 }}>
            <span className="icon-outlined search-icon">search</span>
            <input
              type="text"
              className="input search-input"
              placeholder="Search by name, phone or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>
                <span className="icon-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>

          <select className="input" value={kycFilter} onChange={e => setKycFilter(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
            <option value="all">All KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>

          <select className="input" value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
            <option value="all">All customers</option>
            <option value="at_risk">At risk</option>
            <option value="not_at_risk">Not at risk</option>
          </select>

          <span style={{
            padding: '6px var(--space-3)',
            background: 'var(--color-bg)',
            border: 'var(--border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-wide)',
            color: 'var(--color-grey)',
            whiteSpace: 'nowrap',
          }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
            <div className="spinner spinner-lg spinner-purple" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-16)', textAlign: 'center' }}>
            <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
              group
            </span>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
              {customers.length === 0 ? 'No customers yet' : 'No customers match your filters'}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              {customers.length === 0
                ? 'Customers will appear here once they register via your portal.'
                : 'Try adjusting your search or filters.'}
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>KYC</th>
                  <th>Balance</th>
                  <th>Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const wallet    = wallets[c.id]
                  const balance   = wallet ? Number(wallet.balance) : 0
                  const progress  = pct(c)
                  const atRisk    = isAtRisk(c)
                  const isSelected = selected?.id === c.id

                  return (
                    <tr
                      key={c.id}
                      onClick={() => { setSelected(c); loadCustomerTxns(c.id) }}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(174,122,255,0.06)' : undefined,
                        borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                      }}
                    >
                      {/* Name + risk */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{
                            width: 32, height: 32,
                            background: isSelected ? 'var(--color-primary)' : 'var(--color-black)',
                            border: 'var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                            color: isSelected ? 'var(--color-black)' : 'var(--color-primary)',
                            flexShrink: 0, letterSpacing: 'var(--tracking-tight)',
                          }}>
                            {c.first_name?.[0]}{c.last_name?.[0]}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                              {c.first_name} {c.last_name}
                              {atRisk && (
                                <span className="badge badge-danger no-dot" style={{ fontSize: 9 }}>At risk</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-grey)', fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', marginTop: 1 }}>
                              {c.draw_code || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div style={{ fontSize: 'var(--text-sm)' }}>{c.phone}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-grey)', marginTop: 1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </div>
                      </td>

                      {/* KYC */}
                      <td>
                        <span className={`badge no-dot ${c.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                          {c.kyc_status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                      </td>

                      {/* Balance */}
                      <td style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                        {formatUGX(balance)}
                      </td>

                      {/* Progress */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div className="progress-bar-track" style={{ flex: 1, height: 8 }}>
                            <div className="progress-bar-fill" style={{
                              width: `${progress}%`,
                              background: progress >= 75 ? 'var(--color-green)' : progress >= 50 ? 'var(--color-yellow)' : 'var(--color-primary)',
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap' }}>
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-grey)', marginTop: 2 }}>
                          {formatDate(c.created_at)}
                        </div>
                      </td>

                      {/* Arrow */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="icon-outlined" style={{ fontSize: 18, color: isSelected ? 'var(--color-primary)' : 'var(--color-grey-mid)' }}>
                          chevron_right
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div style={{
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          position: 'sticky',
          top: 'var(--space-4)',
        }}>

          {/* Customer info card */}
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              background: 'var(--color-black)',
              borderBottom: 'var(--border)',
              padding: 'var(--space-4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                Customer details
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <span className="icon-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>close</span>
              </button>
            </div>

            {/* Avatar + name */}
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: 'var(--border)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <div style={{
                width: 44, height: 44,
                background: 'var(--color-primary)',
                border: '2px solid var(--color-black)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'var(--weight-black)', fontSize: 'var(--text-base)',
                color: 'var(--color-black)', flexShrink: 0,
              }}>
                {selected.first_name?.[0]}{selected.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)' }}>
                  {selected.first_name} {selected.last_name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                  {selected.phone}
                </div>
              </div>
            </div>

            {/* Details rows */}
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
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: i < arr.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)' }}>{row.label}</span>
                {row.kyc ? (
                  <span className={`badge no-dot ${selected.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                    {row.value}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                    fontFamily: row.mono ? 'monospace' : 'inherit',
                    color: 'var(--color-black)',
                  }}>
                    {row.value}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Transaction history card */}
          <div style={{ background: 'var(--color-white)', border: 'var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{
              background: 'var(--color-black)',
              borderBottom: 'var(--border)',
              padding: 'var(--space-3) var(--space-4)',
            }}>
              <span style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                Transaction history
              </span>
            </div>

            {txnLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
                <div className="spinner spinner-purple" />
              </div>
            ) : customerTxns.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                No transactions yet
              </div>
            ) : (
              customerTxns.map((txn, i) => (
                <div key={txn.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: i < customerTxns.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                  background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: 24, height: 24,
                      background: txAccent(txn.type),
                      border: 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span className="icon-outlined" style={{ fontSize: 12, color: 'var(--color-black)' }}>
                        {txIcon(txn.type)}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)', textTransform: 'capitalize' }}>
                        {txn.type === 'payment' ? 'Fee payment' : txn.type}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-grey)' }}>
                        {formatDate(txn.created_at)}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: txAmountColor(txn.type) }}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}