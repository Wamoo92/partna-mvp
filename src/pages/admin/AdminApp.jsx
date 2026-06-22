import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAdminAuth }           from '../../hooks/useAdminAuth'
import { useInactivityLogout }    from '../../hooks/useInactivityLogout'

import AdminLogin       from './AdminLogin'
import AdminLayout      from './AdminLayout'
import Dashboard        from './Dashboard'
import Businesses       from './Businesses'
import BusinessDetail   from './BusinessDetail'
import OnboardBusiness  from './OnboardBusiness'
import Customers        from './Customers'
import CustomerDetail   from './CustomerDetail'
import Transactions     from './Transactions'
import Revenue          from './Revenue'
import KYBQueue         from './KYBQueue'
import Rewards          from './Rewards'
import Cards            from './Cards'
import Settings         from './Settings'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

const C = {
  white:    '#FFFFFF',
  black:    '#111111',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  red:      '#CC3939',
  orange:   '#EF8354',
  bgOrange: '#F8F0E4',
}

// ── Inactivity warning modal ───────────────────────────────────────────────
function InactivityWarning({ secondsLeft, onStay, onLogout }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, backdropFilter: 'blur(4px)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.16)' }}>

        <div style={{ background: C.bgOrange, borderBottom: `1px solid ${C.grayLine}`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>Session expiring soon</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>You have been inactive for a while</p>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '150%' }}>
            For your security, you will be logged out automatically in
          </p>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 52, fontWeight: 700, color: secondsLeft <= 10 ? C.red : C.orange, margin: 0, letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {secondsLeft}
            </p>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '4px 0 0' }}>seconds</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onLogout}
              style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, color: C.secondary, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Log out now
            </button>
            <button
              onClick={onStay}
              style={{ flex: 2, padding: '11px', fontSize: 13, fontWeight: 600, color: C.white, background: C.black, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Stay logged in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Guard ──────────────────────────────────────────────────────────────────
function AdminGuard({ admin, loading, children }) {
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )
  if (!admin) return <Navigate to="/admin/login" replace />
  return children
}

// ── Inner app — only mounts when admin is authenticated ───────────────────
function AdminInner({ admin, signOut }) {
  const navigate = useNavigate()

  function handleLogout() {
    signOut()
    navigate('/admin/login', { replace: true })
  }

  const { showWarning, secondsLeft, extendSession } = useInactivityLogout(
    INACTIVITY_TIMEOUT,
    handleLogout,
  )

  return (
    <>
      {showWarning && (
        <InactivityWarning
          secondsLeft={secondsLeft}
          onStay={extendSession}
          onLogout={handleLogout}
        />
      )}
      <AdminLayout admin={admin} signOut={signOut}>
        <Routes>
          <Route path="/dashboard"         element={<Dashboard />} />
          <Route path="/businesses"        element={<Businesses />} />
          <Route path="/businesses/:id"    element={<BusinessDetail />} />
          <Route path="/onboard"           element={<OnboardBusiness />} />
          <Route path="/customers"         element={<Customers />} />
          <Route path="/customers/:id"     element={<CustomerDetail />} />
          <Route path="/transactions"      element={<Transactions />} />
          <Route path="/revenue"           element={<Revenue />} />
          <Route path="/kyb"               element={<KYBQueue />} />
          <Route path="/rewards"           element={<Rewards />} />
          <Route path="/cards"             element={<Cards />} />
          <Route path="/settings"          element={<Settings />} />
          <Route path="/"                  element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AdminLayout>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminApp() {
  const { admin, loading, signOut } = useAdminAuth()

  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/*" element={
        <AdminGuard admin={admin} loading={loading}>
          <AdminInner admin={admin} signOut={signOut} />
        </AdminGuard>
      } />
    </Routes>
  )
}