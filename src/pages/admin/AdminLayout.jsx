import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Dashboard',    icon: 'dashboard',     path: '/admin/dashboard'   },
  { label: 'Businesses',   icon: 'business',      path: '/admin/businesses'  },
  { label: 'Customers',    icon: 'group',         path: '/admin/customers'   },
  { label: 'Transactions', icon: 'swap_vert',     path: '/admin/transactions'},
  { label: 'Revenue',      icon: 'payments',      path: '/admin/revenue'     },
  { label: 'KYB Queue',    icon: 'verified_user', path: '/admin/kyb'         },
  { label: 'Rewards',      icon: 'redeem',        path: '/admin/rewards'     },
  { label: 'Settings',     icon: 'settings',      path: '/admin/settings'    },
]

// Wired up when KYBQueue is built
function KYBBadge() { return null }

export default function AdminLayout({ admin, signOut, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(path) { return location.pathname.startsWith(path) }

  const activeLabel = NAV_ITEMS.find(n => isActive(n.path))?.label || 'Admin'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 224,
        minHeight: '100vh',
        flexShrink: 0,
        background: 'var(--color-black)',
        borderRight: 'var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
      }}>

        {/* Logo */}
        <div style={{
          padding: 'var(--space-5) var(--space-4)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          minHeight: 'var(--topbar-height)',
        }}>
          <img src="/partna-icon.svg" alt="Partna" style={{ width: 32, height: 32, flexShrink: 0 }} />
          <div>
            <div style={{
              color: 'var(--color-white)',
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-base)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 110, 'opsz' 16",
            }}>
              Part<span style={{ color: 'var(--color-primary)' }}>na</span>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'rgba(255,255,255,0.35)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
            }}>
              Admin
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1,
          padding: 'var(--space-3) var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          marginTop: 'var(--space-2)',
        }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={item.label}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  background: active ? 'var(--color-primary)' : 'transparent',
                  border: 'none',
                  color: active ? 'var(--color-black)' : 'rgba(255,255,255,0.55)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 'var(--weight-black)' : 'var(--weight-semibold)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-base), color var(--transition-base)',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--color-white)' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}}
              >
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, background: 'var(--color-black)',
                  }} />
                )}
                <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ letterSpacing: active ? 'var(--tracking-tight)' : 'var(--tracking-normal)', fontVariationSettings: "'wdth' 100, 'opsz' 14" }}>
                  {item.label}
                </span>
                {item.path === '/admin/kyb' && <KYBBadge />}
              </button>
            )
          })}
        </nav>

        {/* Admin footer */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: 'var(--space-4) var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{
              width: 32, height: 32,
              background: 'var(--color-primary)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-black)',
              flexShrink: 0,
            }}>
              {admin?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: 'var(--color-white)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-bold)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {admin?.email || 'Admin'}
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
              }}>
                Super Admin
              </div>
            </div>
          </div>

          <button
            onClick={() => { signOut(); navigate('/admin/login') }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background var(--transition-base), color var(--transition-base)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-red)'; e.currentTarget.style.color = 'var(--color-black)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <span className="icon-outlined" style={{ fontSize: 16 }}>logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="app-main">

        {/* Topbar */}
        <header style={{
          height: 'var(--topbar-height)',
          background: 'var(--color-white)',
          borderBottom: 'var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-sticky)',
        }}>
          <h1 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 100, 'opsz' 20",
            color: 'var(--color-black)',
          }}>
            {activeLabel}
          </h1>
          <div style={{
            padding: '4px var(--space-3)',
            background: 'var(--color-black)',
            border: '1.5px solid var(--color-primary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-black)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
          }}>
            Partna Internal
          </div>
        </header>

        <main style={{ flex: 1, padding: 'var(--space-6)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}