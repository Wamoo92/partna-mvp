import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const BASE_NAV_ITEMS = [
  { path: '/dashboard/overview',  label: 'Overview',          icon: 'dashboard',      sectors: null },
  { path: '/dashboard/customers', label: 'Customers',         icon: 'group',          sectors: null },
  { path: '/dashboard/students',  label: 'Students',          icon: 'school',         sectors: ['Education'] },
  { path: '/dashboard/products',  label: 'Products',          icon: 'inventory_2',    sectors: ['Retail'] },
  { path: '/dashboard/campaigns', label: 'Campaigns',         icon: 'campaign',       sectors: null },
  { path: '/dashboard/payments',  label: 'Fee Payments',      icon: 'receipt_long',   sectors: ['Education'] },
  { path: '/dashboard/payments',  label: 'Payments',          icon: 'payments',       sectors: ['Retail', null] },
  { path: '/dashboard/sales',     label: 'Sales',             icon: 'receipt_long',   sectors: ['Retail'] },
  { path: '/dashboard/vouchers',  label: 'Vouchers & Prizes', icon: 'card_giftcard',  sectors: null },
  { path: '/dashboard/settings',  label: 'Settings',          icon: 'settings',       sectors: null },
]

function initials(name) {
  if (!name) return 'A'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function DashboardLayout({ admin, business, signOut, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const kybPending = business?.kyb_status !== 'verified'
  const sector     = business?.sector || ''

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => {
    if (item.sectors === null) return true
    if (Array.isArray(item.sectors)) {
      // null in the array means "show for non-Education, non-Retail"
      if (item.sectors.includes(null) && sector !== 'Education' && sector !== 'Retail') return true
      return item.sectors.includes(sector)
    }
    return false
  })

  const activeItem = NAV_ITEMS.find(n =>
    location.pathname === n.path ||
    (n.path !== '/dashboard/overview' && location.pathname.startsWith(n.path))
  )

  const sidebarW = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarW,
        minHeight: '100vh',
        background: 'var(--color-black)',
        borderRight: 'var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        transition: 'width var(--transition-slow)',
        overflow: 'hidden',
      }}>

        {/* Logo row */}
        <div style={{
          padding: 'var(--space-5) var(--space-4)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 'var(--space-3)',
          minHeight: 'var(--topbar-height)',
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
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
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.35)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                  Business
                </div>
              </div>
            </div>
          )}

          {collapsed && (
            <img src="/partna-icon.svg" alt="Partna" style={{ width: 28, height: 28 }} />
          )}

          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              width: 28, height: 28,
              border: '1.5px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'border-color var(--transition-base)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
          >
            <span className="icon-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Business card */}
        {!collapsed && business && (
          <div style={{
            margin: 'var(--space-3) var(--space-3) 0',
            padding: 'var(--space-3)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {business.logo_url && business.logo_url !== '/partna-icon.svg' ? (
                <img src={business.logo_url} alt="" style={{
                  width: 32, height: 32, objectFit: 'contain', flexShrink: 0,
                  background: 'rgba(255,255,255,0.1)', padding: 2,
                }} />
              ) : (
                <div style={{
                  width: 32, height: 32, flexShrink: 0,
                  background: 'var(--color-primary)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)',
                  color: 'var(--color-black)',
                }}>
                  {business.name?.[0]?.toUpperCase() || 'B'}
                </div>
              )}
              <div style={{ overflow: 'hidden' }}>
                <div style={{
                  color: 'var(--color-white)', fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-bold)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {business.name}
                </div>
                <div style={{
                  fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)',
                  fontWeight: 'var(--weight-bold)', textTransform: 'capitalize',
                  letterSpacing: 'var(--tracking-wide)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {business.subscription_package || 'Starter'} · {sector}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KYB warning */}
        {!collapsed && kybPending && (
          <div style={{
            margin: 'var(--space-2) var(--space-3) 0',
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(250,232,164,0.1)',
            border: '1px solid rgba(250,232,164,0.25)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}>
            <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-yellow)', flexShrink: 0 }}>warning</span>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-yellow)' }}>
                KYB pending
              </div>
              <div style={{ fontSize: 9, color: 'rgba(250,232,164,0.6)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
                Features locked
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--space-2)' }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/dashboard/overview' && location.pathname.startsWith(item.path))
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: collapsed ? 'var(--space-3)' : 'var(--space-3) var(--space-3)',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? 'var(--color-primary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? 'var(--color-black)' : 'rgba(255,255,255,0.55)',
                  transition: 'background var(--transition-base), color var(--transition-base)',
                  position: 'relative',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--color-white)' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}}
              >
                {active && !collapsed && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--color-black)' }} />
                )}
                <span className="icon-outlined" style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: active ? 'var(--weight-black)' : 'var(--weight-semibold)',
                    letterSpacing: active ? 'var(--tracking-tight)' : 'var(--tracking-normal)',
                    whiteSpace: 'nowrap',
                    fontVariationSettings: "'wdth' 100, 'opsz' 14",
                  }}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer — admin + log out */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: 'var(--space-4) var(--space-3)' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{
                width: 32, height: 32, flexShrink: 0,
                background: 'var(--color-primary)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
                color: 'var(--color-black)',
              }}>
                {initials(admin?.full_name)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: 'var(--color-white)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {admin?.full_name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
                  {admin?.role}
                </div>
              </div>
            </div>
          )}

          {collapsed && (
            <div style={{
              width: 32, height: 32,
              background: 'var(--color-primary)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
              color: 'var(--color-black)',
              margin: '0 auto var(--space-3)',
            }}>
              {initials(admin?.full_name)}
            </div>
          )}

          <button
            onClick={() => { signOut(); navigate('/dashboard/login') }}
            title={collapsed ? 'Log out' : undefined}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
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
            {!collapsed && 'Log out'}
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
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
          <div>
            <h1 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-black)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 100, 'opsz' 20",
              color: 'var(--color-black)',
            }}>
              {activeItem?.label || 'Dashboard'}
            </h1>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', marginTop: 1 }}>
              {business?.name} · {new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {kybPending && (
              <button onClick={() => navigate('/dashboard/settings')} className="btn btn-sm btn-warning">
                <span className="icon-outlined icon-xs">warning</span>
                Complete KYB
              </button>
            )}
            <div style={{
              width: 36, height: 36,
              background: 'var(--color-black)',
              border: '2px solid var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)',
              color: 'var(--color-primary)',
              letterSpacing: 'var(--tracking-tight)',
            }}>
              {initials(admin?.full_name)}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 'var(--space-6)', overflowY: 'auto' }}>
          {kybPending && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
              padding: 'var(--space-4) var(--space-5)',
              background: 'var(--color-yellow)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: 'var(--space-6)',
            }}>
              <span className="icon-outlined" style={{ fontSize: 22, flexShrink: 0 }}>lock</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                  Platform features are locked
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>
                  Complete your KYB verification to unlock all features.
                </div>
              </div>
              <button onClick={() => navigate('/dashboard/settings')} className="btn btn-sm btn-black">
                <span className="icon-outlined icon-xs">arrow_forward</span>
                Verify now
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}