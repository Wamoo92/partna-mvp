import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/admin/dashboard'    },
  { label: 'Businesses',   path: '/admin/businesses'   },
  { label: 'Customers',    path: '/admin/customers'    },
  { label: 'Transactions', path: '/admin/transactions' },
  { label: 'Revenue',      path: '/admin/revenue'      },
  { label: 'KYB Queue',    path: '/admin/kyb'          },
  { label: 'Rewards',      path: '/admin/rewards'      },
  { label: 'Cards',        path: '/admin/cards'        },
  { label: 'Settings',     path: '/admin/settings'     },
]

function KYBBadge() { return null }

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  red:       '#CC3939',
}

// ── Nav icons as inline SVGs ───────────────────────────────────────────────
function NavIcon({ label, active }) {
  const color = active ? C.black : C.secondary
  const w = 18

  const icons = {
    Dashboard:    <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    Businesses:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    Customers:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    Transactions: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>,
    Revenue:      <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    'KYB Queue':  <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
    Rewards:      <><path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
    Cards:        <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><line x1="4" y1="16" x2="7" y2="16" /></>,
    Settings:     <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  }

  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {icons[label]}
    </svg>
  )
}

export default function AdminLayout({ admin, signOut, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(path) { return location.pathname.startsWith(path) }
  const activeLabel = NAV_ITEMS.find(n => isActive(n.path))?.label || 'Admin'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 224, minHeight: '100vh', flexShrink: 0,
        background: C.white, borderRight: `1px solid ${C.stroke}`,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${C.stroke}`,
          display: 'flex', alignItems: 'center', gap: 10,
          minHeight: 60,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>Partna</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8,
                  background: active ? C.bg : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  color: active ? C.black : C.secondary,
                  transition: 'all 0.12s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.black } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.secondary } }}
              >
                <NavIcon label={item.label} active={active} />
                <span>{item.label}</span>
                {item.path === '/admin/kyb' && <KYBBadge />}
              </button>
            )
          })}
        </nav>

        {/* Admin footer */}
        <div style={{ borderTop: `1px solid ${C.stroke}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Admin user row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 8px' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: C.black, flexShrink: 0 }}>
              {admin?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.black, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {admin?.email || 'Admin'}
              </p>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>Super Admin</p>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { signOut(); navigate('/admin/login') }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8,
              background: 'transparent', border: `1px solid ${C.grayLine}`,
              fontSize: 13, fontWeight: 500, color: C.secondary,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8E4E4'; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = C.red }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.secondary; e.currentTarget.style.borderColor = C.grayLine }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="app-main">

        {/* Topbar */}
        <header style={{
          height: 60, background: C.white, borderBottom: `1px solid ${C.stroke}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: 0 }}>
            {activeLabel}
          </h1>
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.secondary,
            background: C.labelBg, borderRadius: 6, padding: '3px 10px',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Partna Internal
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {children}
        </main>

      </div>
    </div>
  )
}