import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
      <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{label}</div>
      <div className="text-2xl font-bold mb-0.5" style={{ color: color || PARTNA_PRIMARY }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>{sub}</div>}
    </div>
  )
}

export default function Overview({ admin, business }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSavings: 0,
    activeCustomers: 0,
    totalPayments: 0,
    campaignProgress: { saving: 0, total: 0 },
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (business) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    try {
      // Fetch all customers for this business
      const { data: customers } = await supabase
        .from('customers')
        .select('id, first_name, last_name, created_at, registration_status')
        .eq('business_id', business.id)

      const customerIds = customers?.map(c => c.id) || []

      // Fetch all wallets for these customers
      let totalSavings = 0
      if (customerIds.length > 0) {
        const { data: wallets } = await supabase
          .from('wallets')
          .select('balance, customer_id')
          .in('customer_id', customerIds)
        totalSavings = wallets?.reduce((sum, w) => sum + Number(w.balance), 0) || 0
      }

      // Fetch campaigns
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', business.id)
      setCampaigns(campaignData || [])

      // Fetch payment transactions
      let totalPayments = 0
      if (customerIds.length > 0) {
        const { data: payments } = await supabase
          .from('transactions')
          .select('amount')
          .in('customer_id', customerIds)
          .eq('type', 'payment')
        totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      }

      // Recent activity — last 10 transactions
      let recentTxns = []
      if (customerIds.length > 0) {
        const { data: txns } = await supabase
          .from('transactions')
          .select('*, customers(first_name, last_name)')
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false })
          .limit(10)
        recentTxns = txns || []
      }
      setRecentActivity(recentTxns)

      // Chart data — deposits by day for last 14 days
      const days = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        days.push({
          label: date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' }),
          date: date.toDateString(),
          deposits: 0,
          withdrawals: 0,
        })
      }

      if (customerIds.length > 0) {
        const { data: chartTxns } = await supabase
          .from('transactions')
          .select('type, amount, created_at')
          .in('customer_id', customerIds)
          .in('type', ['deposit', 'withdrawal'])
          .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())

        chartTxns?.forEach(txn => {
          const dateStr = new Date(txn.created_at).toDateString()
          const day = days.find(d => d.date === dateStr)
          if (day) {
            if (txn.type === 'deposit') day.deposits += Number(txn.amount)
            else day.withdrawals += Number(txn.amount)
          }
        })
      }
      setChartData(days)

      setStats({
        totalSavings,
        activeCustomers: customers?.filter(c => c.registration_status === 'complete').length || 0,
        totalPayments,
        campaignProgress: {
          saving: customers?.filter(c => c.registration_status === 'complete').length || 0,
          total: campaignData?.[0]?.target_amount || 0,
        },
      })
    } catch (e) {
      console.error('Overview load error:', e)
    }
    setLoading(false)
  }

  function formatUGX(n) {
    if (n >= 1000000) return 'UGX ' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return 'UGX ' + (n / 1000).toFixed(0) + 'K'
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatUGXFull(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function txIcon(type) {
    switch (type) {
      case 'deposit': return '↓'
      case 'withdrawal': return '↑'
      case 'payment': return '↑'
      default: return '·'
    }
  }

  function txColor(type) {
    return type === 'deposit' ? '#16A34A' : '#DC2626'
  }

  function txLabel(type) {
    switch (type) {
      case 'deposit': return 'Deposit'
      case 'withdrawal': return 'Withdrawal'
      case 'payment': return 'Fee payment'
      default: return type
    }
  }

  // Chart max value
  const chartMax = Math.max(...chartData.map(d => Math.max(d.deposits, d.withdrawals)), 1)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: PARTNA_PRIMARY, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Savings (AUM)"
          value={formatUGX(stats.totalSavings)}
          sub="Across all customers"
        />
        <StatCard
          label="Active Customers"
          value={stats.activeCustomers}
          sub="Registered accounts"
        />
        <StatCard
          label="Total Payments Received"
          value={formatUGX(stats.totalPayments)}
          sub="Fees paid this campaign"
          color="#16A34A"
        />
        <StatCard
          label="Campaign Progress"
          value={stats.activeCustomers + ' saving'}
          sub={campaigns[0]?.name || 'No active campaign'}
          color={PARTNA_GOLD}
        />
      </div>

      {/* Chart + Recent activity */}
      <div className="grid grid-cols-3 gap-4">

        {/* Bar chart */}
        <div className="col-span-2 rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>
              Deposits & Withdrawals
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#16A34A' }} />
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Deposits</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#DC2626' }} />
                <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>Withdrawals</span>
              </div>
            </div>
          </div>

          {chartData.every(d => d.deposits === 0 && d.withdrawals === 0) ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
                No transaction data yet
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {chartData.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                    <div className="flex-1 rounded-t-sm transition-all"
                      style={{
                        height: `${(day.deposits / chartMax) * 100}%`,
                        background: '#16A34A',
                        minHeight: day.deposits > 0 ? '2px' : '0',
                      }} />
                    <div className="flex-1 rounded-t-sm transition-all"
                      style={{
                        height: `${(day.withdrawals / chartMax) * 100}%`,
                        background: '#DC2626',
                        minHeight: day.withdrawals > 0 ? '2px' : '0',
                      }} />
                  </div>
                  {i % 2 === 0 && (
                    <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px' }}>
                      {day.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Recent Activity</div>
            <button onClick={() => navigate('/dashboard/payments')}
              className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>
              See all
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-xs text-center" style={{ color: 'rgba(0,0,0,0.3)' }}>
                No activity yet
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentActivity.slice(0, 8).map((txn, i) => (
                <div key={txn.id} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: i < Math.min(recentActivity.length, 8) - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${txColor(txn.type)}15`, color: txColor(txn.type) }}>
                    {txIcon(txn.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: '#333' }}>
                      {txn.customers?.first_name} {txn.customers?.last_name}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px' }}>
                      {txLabel(txn.type)}
                    </div>
                  </div>
                  <div className="text-xs font-bold flex-shrink-0" style={{ color: txColor(txn.type) }}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatUGX(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaigns summary */}
      {campaigns.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold" style={{ color: PARTNA_PRIMARY }}>Active Campaigns</div>
            <button onClick={() => navigate('/dashboard/campaigns')}
              className="text-xs font-semibold" style={{ color: PARTNA_GOLD }}>
              Manage campaigns
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {campaigns.slice(0, 3).map(c => {
              const progress = Math.min((stats.totalSavings / Number(c.target_amount)) * 100, 100)
              const daysLeft = Math.max(
                Math.ceil((new Date(c.target_date).getTime() - Date.now()) / 86400000), 0
              )
              return (
                <div key={c.id} className="rounded-xl p-4" style={{ background: '#f0f2f5' }}>
                  <div className="text-xs font-bold mb-1 truncate" style={{ color: PARTNA_PRIMARY }}>{c.name}</div>
                  <div className="text-xs mb-2" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Target: {formatUGXFull(c.target_amount)}
                  </div>
                  <div className="w-full h-1.5 rounded-full mb-1" style={{ background: 'rgba(27,79,114,0.15)' }}>
                    <div className="h-1.5 rounded-full"
                      style={{ width: `${progress}%`, background: progress >= 75 ? '#16A34A' : PARTNA_GOLD }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    <span>{progress.toFixed(0)}% saved</span>
                    <span>{daysLeft} days left</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
          <div className="text-3xl mb-3">🎯</div>
          <div className="text-sm font-bold mb-1" style={{ color: PARTNA_PRIMARY }}>
            No campaigns yet
          </div>
          <div className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.4)' }}>
            Create your first campaign to start enrolling customers
          </div>
          <button onClick={() => navigate('/dashboard/campaigns')}
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: PARTNA_PRIMARY, color: '#fff' }}>
            Create campaign
          </button>
        </div>
      )}

    </div>
  )
}