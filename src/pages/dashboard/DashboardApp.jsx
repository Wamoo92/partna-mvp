import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useBusinessAuth }        from '../../hooks/useBusinessAuth'
import { useInactivityLogout }    from '../../hooks/useInactivityLogout'

import DashboardLogin    from './DashboardLogin'
import DashboardRegister from './DashboardRegister'
import ResetPassword     from './ResetPassword'
import FirstLogin        from './FirstLogin'
import DashboardLayout   from './DashboardLayout'
import Overview          from './Overview'
import Customers         from './Customers'
import Campaigns         from './Campaigns'
import Payments          from './Payments'
import Students          from './Students'
import Cards             from './Cards'
import Settings          from './Settings'
import Products          from './Products'
import Sales             from './Sales'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes

const C = {
  white:    '#FFFFFF',
  black:    '#111111',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  red:      '#CC3939',
  bgRed:    '#F8E4E4',
  orange:   '#EF8354',
  bgOrange: '#F8F0E4',
}

// ── Inactivity warning modal ───────────────────────────────────────────────
function InactivityWarning({ secondsLeft, onStay, onLogout }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, backdropFilter: 'blur(4px)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.16)' }}>

        {/* Header */}
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

        {/* Body */}
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
function DashboardGuard({ admin, loading, mustChangePassword, business, clearFirstLogin, children }) {
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )
  if (!admin) return <Navigate to="/dashboard/login" replace />
  if (mustChangePassword) return (
    <FirstLogin admin={admin} business={business} clearFirstLogin={clearFirstLogin} />
  )
  return children
}

// ── Inner app — only mounts when admin is authenticated ───────────────────
function DashboardInner({ admin, business, signOut }) {
  const navigate = useNavigate()

  function handleLogout() {
    signOut()
    navigate('/dashboard/login', { replace: true })
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
      <DashboardLayout admin={admin} business={business} signOut={signOut}>
        <Routes>
          <Route path="/overview"   element={<Overview   admin={admin} business={business} />} />
          <Route path="/customers"  element={<Customers  admin={admin} business={business} />} />
          <Route path="/students"   element={<Students   admin={admin} business={business} />} />
          <Route path="/campaigns"  element={<Campaigns  admin={admin} business={business} />} />
          <Route path="/payments"   element={<Payments   admin={admin} business={business} />} />
          <Route path="/cards"      element={<Cards      admin={admin} business={business} />} />
          <Route path="/settings"   element={<Settings   admin={admin} business={business} />} />
          <Route path="/products"   element={<Products   admin={admin} business={business} />} />
          <Route path="/sales"      element={<Sales      admin={admin} business={business} />} />
          <Route path="/"           element={<Navigate to="/dashboard/overview" replace />} />
        </Routes>
      </DashboardLayout>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DashboardApp() {
  const { admin, business, loading, signOut, mustChangePassword, clearFirstLogin } = useBusinessAuth()

  return (
    <Routes>
      <Route path="/login"          element={<DashboardLogin />} />
      <Route path="/register"       element={<DashboardRegister />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/*" element={
        <DashboardGuard
          admin={admin}
          loading={loading}
          mustChangePassword={mustChangePassword}
          business={business}
          clearFirstLogin={clearFirstLogin}
        >
          <DashboardInner admin={admin} business={business} signOut={signOut} />
        </DashboardGuard>
      } />
    </Routes>
  )
}