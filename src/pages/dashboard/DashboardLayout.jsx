import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'

const BASE_NAV_ITEMS = [
  { path: '/dashboard/overview',  label: 'Overview',     sectors: null },
  { path: '/dashboard/customers', label: 'Customers',    sectors: null },
  { path: '/dashboard/students',  label: 'Students',     sectors: ['Education'] },
  { path: '/dashboard/products',  label: 'Products',     sectors: ['Retail'] },
  { path: '/dashboard/campaigns', label: 'Campaigns',    sectors: null },
  { path: '/dashboard/payments',  label: 'Fee Payments', sectors: ['Education'] },
  { path: '/dashboard/payments',  label: 'Payments',     sectors: ['Retail', null] },
  { path: '/dashboard/sales',     label: 'Sales',        sectors: ['Retail'] },
  { path: '/dashboard/cards',     label: 'Cards',        sectors: null },
  { path: '/dashboard/settings',  label: 'Settings',     sectors: null },
]

function initials(name) {
  if (!name) return 'A'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
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
}

// ── Nav icons as inline SVGs ───────────────────────────────────────────────
function NavIcon({ label, active }) {
  const color = active ? C.black : C.secondary
  const w = 18

  const icons = {
    Overview:          <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    Customers:         <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    Students:          <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
    Products:          <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></>,
    Campaigns:         <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></>,
    'Fee Payments':    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /></>,
    Payments:          <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    Sales:             <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    Cards:             <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><line x1="4" y1="16" x2="7" y2="16" /></>,
    Settings:          <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  }

  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {icons[label] || icons['Overview']}
    </svg>
  )
}

// ── Small lock icon for Campaigns nav item ─────────────────────────────────
function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── Alert badge for Students nav item — expanded sidebar ───────────────────
function StudentAlertBadge() {
  return (
    <div style={{
      marginLeft: 'auto', flexShrink: 0,
      width: 16, height: 16, borderRadius: '50%',
      background: C.red,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: C.white, lineHeight: 1,
    }}>
      !
    </div>
  )
}

// ── Red dot for Students nav icon — collapsed sidebar ─────────────────────
function StudentAlertDot() {
  return (
    <div style={{
      position: 'absolute', top: 6, right: 6,
      width: 7, height: 7, borderRadius: '50%',
      background: C.red,
      border: `1.5px solid ${C.white}`,
    }} />
  )
}

export default function DashboardLayout({ admin, business, signOut, children }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed, setCollapsed]       = useState(false)
  const [studentCount, setStudentCount] = useState(null) // null = not yet fetched

  // Only treat KYB as pending once business has actually loaded — otherwise the
  // banner flashes during the initial load when business is still null/undefined.
  const kybPending    = !!business && business.kyb_status !== 'verified'
  const sector        = business?.sector || ''
  const isEducation   = sector === 'Education'
  const showStudentAlert = isEducation && studentCount === 0

  // ── Fetch student count for Education businesses ───────────────────────
  useEffect(() => {
    if (!isEducation || !business?.id) return
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ count }) => {
        setStudentCount(count ?? 0)
      })
      .catch(() => setStudentCount(0))
  }, [business?.id, isEducation])

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => {
    if (item.sectors === null) return true
    if (Array.isArray(item.sectors)) {
      if (item.sectors.includes(null) && sector !== 'Education' && sector !== 'Retail') return true
      return item.sectors.includes(sector)
    }
    return false
  })

  const activeItem = NAV_ITEMS.find(n =>
    location.pathname === n.path ||
    (n.path !== '/dashboard/overview' && location.pathname.startsWith(n.path))
  )

  const sidebarW = collapsed ? 60 : 220

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarW, minHeight: '100vh', flexShrink: 0,
        background: C.white, borderRight: `1px solid ${C.stroke}`,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.25s ease',
      }}>

        {/* Logo row */}
        <div style={{ padding: '14px 12px', borderBottom: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10, minHeight: 60 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', margin: 0 }}>Partna</p>
                <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Business</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{ width: 26, height: 26, borderRadius: 7, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F6F7EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{ width: 24, height: 24, border: `1px solid ${C.grayLine}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: C.grayMid, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.black}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.grayLine}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <><polyline points="9 18 15 12 9 6" /></> : <><polyline points="15 18 9 12 15 6" /></>}
            </svg>
          </button>
        </div>

        {/* Business card */}
        {!collapsed && business && (
          <div style={{ margin: '10px 10px 0', padding: '10px 12px', background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {business.logo_url && business.logo_url !== '/partna-icon.svg' ? (
                <img src={business.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, flexShrink: 0, background: C.bg }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: '#F6F7EE', flexShrink: 0 }}>
                  {business.name?.[0]?.toUpperCase() || 'B'}
                </div>
              )}
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{business.name}</p>
                <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {business.subscription_package || 'Starter'} · {sector}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KYB warning */}
        {!collapsed && kybPending && (
          <div style={{ margin: '6px 10px 0', padding: '8px 10px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.orange, margin: '0 0 1px' }}>KYB pending</p>
              <p style={{ fontSize: 10, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.7 }}>Features locked</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active           = location.pathname === item.path || (item.path !== '/dashboard/overview' && location.pathname.startsWith(item.path))
            const showLock         = kybPending && item.label === 'Campaigns' && !collapsed
            const showStudentBadge = showStudentAlert && item.label === 'Students' && !collapsed
            const showStudentDot   = showStudentAlert && item.label === 'Students' && collapsed

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: '9px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, border: 'none',
                  background: active ? C.bg : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? C.black : C.secondary,
                  transition: 'all 0.12s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.black } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.secondary } }}
              >
                <NavIcon label={item.label} active={active} />
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                {showLock         && <LockIcon />}
                {showStudentBadge && <StudentAlertBadge />}
                {showStudentDot   && <StudentAlertDot />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.stroke}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 8px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: C.black, flexShrink: 0 }}>
                {initials(admin?.full_name)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.full_name}</p>
                <p style={{ fontSize: 10, fontWeight: 500, color: C.secondary, margin: 0, textTransform: 'capitalize' }}>{admin?.role}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color: C.black, margin: '0 auto 4px' }}>
              {initials(admin?.full_name)}
            </div>
          )}
          <button
            onClick={() => { signOut(); navigate('/dashboard/login') }}
            title={collapsed ? 'Log out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 7, padding: '7px 10px', borderRadius: 8,
              background: 'transparent', border: `1px solid ${C.grayLine}`,
              fontSize: 12, fontWeight: 500, color: C.secondary,
              cursor: 'pointer', transition: 'all 0.12s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bgRed; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = C.red }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.secondary; e.currentTarget.style.borderColor = C.grayLine }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && 'Log out'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ height: 60, background: C.white, borderBottom: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-0.8px', margin: '0 0 2px' }}>
              {activeItem?.label || 'Dashboard'}
            </h1>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: 0 }}>
              {business?.name} · {new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {kybPending && (
              <button onClick={() => navigate('/dashboard/settings')} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.white, background: C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Complete KYB
              </button>
            )}
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.labelBg, border: `1px solid ${C.stroke}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: C.black }}>
              {initials(admin?.full_name)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {kybPending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 10, marginBottom: 20 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.orange, margin: '0 0 2px' }}>Platform features are locked</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, margin: 0, opacity: 0.8 }}>Complete your KYB verification to unlock all features.</p>
              </div>
              <button onClick={() => navigate('/dashboard/settings')} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.white, background: C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
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