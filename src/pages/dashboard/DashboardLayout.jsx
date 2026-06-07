import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const PARTNA_PRIMARY = '#1B4F72'
const PARTNA_GOLD = '#D4AF37'

const NAV_ITEMS = [
  { path: '/dashboard/overview', label: 'Overview', icon: '▦' },
  { path: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { path: '/dashboard/campaigns', label: 'Campaigns', icon: '🎯' },
  { path: '/dashboard/payments', label: 'Payments', icon: '💳' },
  { path: '/dashboard/vouchers', label: 'Vouchers & Prizes', icon: '🎁' },
  { path: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export default function DashboardLayout({ admin, business, signOut, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const kybPending = business?.kyb_status !== 'verified'

  function initials(name) {
    if (!name) return 'A'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f2f5' }}>

      {/* Sidebar */}
      <aside className="flex flex-col flex-shrink-0 transition-all"
        style={{ width: sidebarOpen ? '240px' : '64px', background: PARTNA_PRIMARY, minHeight: '100vh' }}>

        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src="/partna-icon.svg" alt="Partna" className="w-8 h-8 flex-shrink-0" />
              <div>
                <div className="text-white text-sm font-bold">Partna</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Business</div>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <img src="/partna-icon.svg" alt="Partna" className="w-8 h-8 mx-auto" />
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)', marginLeft: sidebarOpen ? '0' : 'auto' }}>
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Business info */}
        {sidebarOpen && business && (
          <div className="px-4 py-3 mx-3 mt-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              {business.logo_url && business.logo_url !== '/partna-icon.svg' ? (
                <img src={business.logo_url} alt=""
                  className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)' }} />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  {business.name?.[0]?.toUpperCase() || 'B'}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-white text-xs font-semibold truncate">{business.name}</div>
                <div className="text-xs truncate capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {business.subscription_package || 'starter'} plan
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KYB warning */}
        {sidebarOpen && kybPending && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.4)' }}>
            <div className="text-xs font-semibold" style={{ color: '#FCD34D' }}>⚠ KYB pending</div>
            <div className="text-xs" style={{ color: 'rgba(252,211,77,0.7)' }}>Features locked</div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/dashboard/overview' && location.pathname.startsWith(item.path))
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                }}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-xs font-semibold"
                    style={{ color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Admin info + logout */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: PARTNA_GOLD, color: PARTNA_PRIMARY }}>
                {initials(admin?.full_name)}
              </div>
              <div className="overflow-hidden">
                <div className="text-white text-xs font-semibold truncate">{admin?.full_name}</div>
                <div className="text-xs truncate capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {admin?.role}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-3"
              style={{ background: PARTNA_GOLD, color: PARTNA_PRIMARY }}>
              {initials(admin?.full_name)}
            </div>
          )}
          <button onClick={() => { signOut(); navigate('/dashboard/login') }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
            <span>↩</span>
            {sidebarOpen && 'Log out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: PARTNA_PRIMARY }}>
              {NAV_ITEMS.find(n =>
                location.pathname === n.path ||
                (n.path !== '/dashboard/overview' && location.pathname.startsWith(n.path))
              )?.label || 'Dashboard'}
            </h1>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {business?.name} · {new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kybPending && (
              <button onClick={() => navigate('/dashboard/settings')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(217,119,6,0.1)', color: '#D97706', border: '1px solid rgba(217,119,6,0.3)' }}>
                ⚠ Complete KYB verification
              </button>
            )}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: PARTNA_PRIMARY, color: PARTNA_GOLD }}>
              {initials(admin?.full_name)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {kybPending && (
            <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
              <span className="text-lg">🔒</span>
              <div className="flex-1">
                <div className="text-xs font-bold" style={{ color: '#D97706' }}>Platform features are locked</div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  Complete your KYB verification to unlock all features.
                </div>
              </div>
              <button onClick={() => navigate('/dashboard/settings')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#D97706', color: '#fff' }}>
                Verify now →
              </button>
            </div>
          )}
          {children}
        </main>

      </div>
    </div>
  )
}