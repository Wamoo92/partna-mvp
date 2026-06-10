import { useNavigate, useLocation } from 'react-router-dom'

const ADMIN_PRIMARY = '#1B4F72'
const ADMIN_GOLD = '#D4AF37'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '▦', path: '/admin/dashboard' },
  { label: 'Businesses', icon: '🏢', path: '/admin/businesses' },
  { label: 'Customers', icon: '👤', path: '/admin/customers' },
  { label: 'Transactions', icon: '↕', path: '/admin/transactions' },
  { label: 'Revenue', icon: '💰', path: '/admin/revenue' },
  { label: 'KYB Queue', icon: '📋', path: '/admin/kyb' },
  { label: 'Vouchers', icon: '🎫', path: '/admin/vouchers' },
  { label: 'Settings', icon: '⚙', path: '/admin/settings' },
]

export default function AdminLayout({ admin, signOut, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(path) {
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f2f5' }}>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col w-56 min-h-screen flex-shrink-0"
        style={{ background: ADMIN_PRIMARY, boxShadow: '2px 0 12px rgba(0,0,0,0.1)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: ADMIN_GOLD }}>
            <img src="/partna-icon.svg" alt="Partna" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-white text-sm font-bold leading-tight">Partna</div>
            <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Admin Portal
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all"
              style={{
                background: isActive(item.path) ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive(item.path) ? '#fff' : 'rgba(255,255,255,0.55)',
              }}>
              <span className="text-base leading-none w-5 text-center flex-shrink-0">
                {item.icon}
              </span>
              <span className="text-xs font-semibold">{item.label}</span>
              {item.path === '/admin/kyb' && (
                <KYBBadge />
              )}
            </button>
          ))}
        </nav>

        {/* Admin user + sign out */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: ADMIN_GOLD, color: ADMIN_PRIMARY }}>
              {admin?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {admin?.email || 'Admin'}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Super Admin
              </div>
            </div>
          </div>
          <button
            onClick={() => { signOut(); navigate('/admin/login') }}
            className="w-full py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="text-sm font-bold" style={{ color: ADMIN_PRIMARY }}>
            {NAV_ITEMS.find(n => isActive(n.path))?.label || 'Admin'}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: 'rgba(27,79,114,0.08)', color: ADMIN_PRIMARY }}>
              Partna Internal
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// Small badge showing pending KYB count
function KYBBadge() {
  return null // Will be wired up when KYBQueue is built
}