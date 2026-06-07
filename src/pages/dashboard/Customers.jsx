import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

export default function Customers({ admin, business }) {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [wallets, setWallets] = useState({})
  const [campaigns, setCampaigns] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kycFilter, setKycFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [customerTxns, setCustomerTxns] = useState([])
  const [txnLoading, setTxnLoading] = useState(false)

  useEffect(() => {
    if (business) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      if (!customerData || customerData.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }

      setCustomers(customerData)

      const ids = customerData.map(c => c.id)

      // Wallets
      const { data: walletData } = await supabase
        .from('wallets').select('*').in('customer_id', ids)
      const walletMap = {}
      walletData?.forEach(w => { walletMap[w.customer_id] = w })
      setWallets(walletMap)

      // Campaigns
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
      .from('transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setCustomerTxns(data || [])
    setTxnLoading(false)
  }

  function isAtRisk(customer) {
    // At risk: no deposit in 30+ days and has registered
    if (customer.registration_status !== 'complete') return false
    const wallet = wallets[customer.id]
    if (!wallet) return true
    // Check last deposit date — simplified: flag if balance is 0
    return Number(wallet.balance) === 0
  }

  function pct(customer) {
    const wallet = wallets[customer.id]
    const campaign = campaigns[customer.campaign_id]
    if (!wallet || !campaign) return 0
    return Math.min((Number(wallet.balance) / Number(campaign.target_amount)) * 100, 100)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-UG', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  function txIcon(type) {
    return type === 'deposit' ? '↓' : '↑'
  }

  function txColor(type) {
    return type === 'deposit' ? '#16A34A' : '#DC2626'
  }

  // Filtered customers
  const filtered = customers.filter(c => {
    const name = `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (kycFilter !== 'all' && c.kyc_status !== kycFilter) return false
    if (riskFilter === 'at_risk' && !isAtRisk(c)) return false
    if (riskFilter === 'not_at_risk' && isAtRisk(c)) return false
    return true
  })

  return (
    <div className="flex gap-6 h-full">

      {/* Customer list */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Filters */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#fff' }}>
          <input
            type="text"
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#f0f2f5', border: 'none', color: '#333' }}
          />
          <select value={kycFilter} onChange={e => setKycFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none font-semibold"
            style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }}>
            <option value="all">All KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none font-semibold"
            style={{ background: '#f0f2f5', border: 'none', color: PARTNA_PRIMARY }}>
            <option value="all">All customers</option>
            <option value="at_risk">At risk</option>
            <option value="not_at_risk">Not at risk</option>
          </select>
          <div className="text-xs font-semibold px-3 py-2 rounded-xl"
            style={{ background: 'rgba(27,79,114,0.08)', color: PARTNA_PRIMARY }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          {/* Header */}
          <div className="grid px-4 py-3 text-xs font-bold"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.5fr',
              color: 'rgba(0,0,0,0.35)',
              borderBottom: '1px solid rgba(0,0,0,0.06)'
            }}>
            <span>Customer</span>
            <span>Contact</span>
            <span>KYC</span>
            <span>Balance</span>
            <span>Progress</span>
            <span></span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 rounded-full animate-spin"
                style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm font-semibold mb-1" style={{ color: PARTNA_PRIMARY }}>
                {customers.length === 0 ? 'No customers yet' : 'No customers match your filters'}
              </div>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {customers.length === 0
                  ? 'Customers will appear here once they register via your portal'
                  : 'Try adjusting your search or filters'}
              </div>
            </div>
          ) : (
            filtered.map((c, i) => {
              const wallet = wallets[c.id]
              const balance = wallet ? Number(wallet.balance) : 0
              const progress = pct(c)
              const atRisk = isAtRisk(c)
              const isSelected = selected?.id === c.id

              return (
                <div key={c.id}
                  className="grid items-center px-4 py-3 cursor-pointer transition-all"
                  style={{
                    gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.5fr',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    background: isSelected ? 'rgba(27,79,114,0.04)' : 'transparent',
                  }}
                  onClick={() => {
                    setSelected(c)
                    loadCustomerTxns(c.id)
                  }}>

                  {/* Name + risk */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(27,79,114,0.1)', color: PARTNA_PRIMARY }}>
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: '#333' }}>
                        {c.first_name} {c.last_name}
                        {atRisk && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '9px' }}>
                            AT RISK
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                        {c.draw_code || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <div className="text-xs" style={{ color: '#333' }}>{c.phone}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(0,0,0,0.4)', fontSize: '10px' }}>
                      {c.email}
                    </div>
                  </div>

                  {/* KYC */}
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: c.kyc_status === 'verified'
                          ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                        color: c.kyc_status === 'verified' ? '#16A34A' : '#D97706',
                      }}>
                      {c.kyc_status === 'verified' ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </div>

                  {/* Balance */}
                  <div className="text-xs font-semibold" style={{ color: PARTNA_PRIMARY }}>
                    {formatUGX(balance)}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(27,79,114,0.1)' }}>
                        <div className="h-1.5 rounded-full"
                          style={{
                            width: `${progress}%`,
                            background: progress >= 75 ? '#16A34A' : PARTNA_GOLD
                          }} />
                      </div>
                      <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)', fontSize: '10px' }}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                      {formatDate(c.created_at)}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-right">
                    <span style={{ color: 'rgba(0,0,0,0.2)' }}>→</span>
                  </div>

                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Customer detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
            {/* Close */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Customer Detail</div>
              <button onClick={() => setSelected(null)}
                className="text-sm" style={{ color: 'rgba(0,0,0,0.3)' }}>✕</button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
                style={{ background: 'rgba(27,79,114,0.1)', color: PARTNA_PRIMARY }}>
                {selected.first_name?.[0]}{selected.last_name?.[0]}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>
                  {selected.first_name} {selected.last_name}
                </div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{selected.phone}</div>
              </div>
            </div>

            {/* Details */}
            {[
              { label: 'Email', value: selected.email },
              { label: 'Phone', value: selected.phone },
              { label: 'NIN', value: selected.nin ? '••••' + selected.nin.slice(-4) : 'Not provided' },
              { label: 'Draw code', value: selected.draw_code || '—' },
              { label: 'KYC status', value: selected.kyc_status === 'verified' ? '✓ Verified' : '⏳ Pending' },
              { label: 'Payment network', value: selected.payment_network ? (selected.payment_network === 'mtn' ? 'MTN MoMo' : 'Airtel Money') : 'Not set' },
              { label: 'Balance', value: formatUGX(wallets[selected.id] ? Number(wallets[selected.id].balance) : 0) },
              { label: 'Progress', value: pct(selected).toFixed(1) + '%' },
              { label: 'Registered', value: formatDate(selected.created_at) },
            ].map((row, i, arr) => (
              <div key={i} className="flex justify-between items-center py-1.5"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
                <span className="text-xs font-semibold"
                  style={{ color: row.label === 'KYC status' && selected.kyc_status === 'verified' ? '#16A34A' : PARTNA_PRIMARY }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Transaction history */}
          <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
            <div className="text-sm font-bold mb-3" style={{ color: PARTNA_PRIMARY }}>
              Transaction History
            </div>
            {txnLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-4 rounded-full animate-spin"
                  style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
              </div>
            ) : customerTxns.length === 0 ? (
              <div className="text-xs text-center py-6" style={{ color: 'rgba(0,0,0,0.3)' }}>
                No transactions yet
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {customerTxns.map((txn, i) => (
                  <div key={txn.id} className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: i < customerTxns.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                        {txIcon(txn.type)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold capitalize" style={{ color: '#333' }}>
                          {txn.type === 'payment' ? 'Fee payment' : txn.type}
                        </div>
                        <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                          {formatDate(txn.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold" style={{ color: txColor(txn.type) }}>
                      {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}