import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth }                from './hooks/useAuth'
import { useInactivityLogout }    from './hooks/useInactivityLogout'
import { BrandContext, buildBrand } from './lib/BrandContext'
import { getEffectiveStatus }     from './lib/campaignUtils'

import Landing        from './pages/portal/Landing'
import Register       from './pages/portal/Register'
import Login          from './pages/portal/Login'
import ResetPin       from './pages/portal/ResetPin'
import Home           from './pages/portal/Home'
import CardDetail     from './pages/portal/CardDetail'
import Transactions   from './pages/portal/Transactions'
import Profile        from './pages/portal/Profile'
import AddMoney       from './pages/portal/AddMoney'
import Pay            from './pages/portal/Pay'
import Withdraw       from './pages/portal/Withdraw'
import KYC            from './pages/portal/KYC'
import PaymentSource  from './pages/portal/PaymentSource'
import SelectCampaign from './pages/portal/SelectCampaign'
import PaymentSuccess from './pages/portal/PaymentSuccess'
import DashboardApp   from './pages/dashboard/DashboardApp'
import AdminApp       from './pages/admin/AdminApp'

const PORTAL_INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

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
      <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 16, width: '100%', maxWidth: 360, overflow: 'hidden', boxShadow: '0 8px 32px rgba(17,17,17,0.16)' }}>

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
              Log out
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

// ── Portal not found screen ────────────────────────────────────────────────
function PortalNotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-black)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-8)',
      textAlign: 'center',
      gap: 'var(--space-5)',
    }}>
      <img src="/partna-icon.svg" alt="Partna" style={{ width: 48, height: 48, opacity: 0.4 }} />
      <div>
        <div style={{
          fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)',
          color: 'var(--color-white)', letterSpacing: 'var(--tracking-tight)',
          marginBottom: 'var(--space-3)',
        }}>
          Portal not found
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.45)', lineHeight: 'var(--leading-normal)', maxWidth: 340 }}>
          This savings portal does not exist or has been deactivated.
          Please check the link you were given or contact your institution.
        </div>
      </div>
      <a
        href="https://www.partna.io"
        style={{
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
          color: 'var(--color-primary)', letterSpacing: 'var(--tracking-wide)',
          textDecoration: 'none',
        }}
      >
        www.partna.io
      </a>
    </div>
  )
}

// ── Guards — unchanged ─────────────────────────────────────────────────────
function PortalGuard({ customer, loading, children }) {
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  return children
}

function HomeGuard({ customer, enrollments, loading, children }) {
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  if (enrollments.length === 0) return <Navigate to="/portal/select-campaign" replace />
  const hasAccessibleEnrollment = enrollments.some(e => {
    const status = e.campaigns ? getEffectiveStatus(e.campaigns) : 'active'
    return status !== 'deleted'
  })
  if (!hasAccessibleEnrollment) return <Navigate to="/portal/select-campaign" replace />
  return children
}

// ── Inactivity wrapper — only mounts when customer is logged in ────────────
function PortalInactivityWrapper({ customer, enrollments, loading, business, signOut, children }) {
  const navigate = useNavigate()

  function handleLogout() {
    signOut()
    navigate('/portal/login', { replace: true })
  }

  const { showWarning, secondsLeft, extendSession } = useInactivityLogout(
    PORTAL_INACTIVITY_TIMEOUT,
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
      {children}
    </>
  )
}

// ── Main portal + dashboard component ─────────────────────────────────────
function PortalAndDashboard() {
  const { customer, business, subdomainBusiness, enrollments, loading, signOut, refetch } = useAuth()

  const isSubdomain = (
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname !== 'www.partna.io' &&
    window.location.hostname !== 'partna.io' &&
    window.location.hostname.endsWith('.partna.io')
  )
  if (isSubdomain && !loading && !subdomainBusiness) {
    return <PortalNotFound />
  }

  const brand = buildBrand(business)

  return (
    <BrandContext.Provider value={brand}>
      <Routes>
        <Route path="/" element={<Navigate to="/portal" replace />} />

        {/* ── Public routes — no inactivity timer ── */}
        <Route path="/portal"            element={<Landing />} />
        <Route path="/portal/register"   element={<Register />} />
        <Route path="/portal/login"      element={<Login />} />
        <Route path="/portal/reset-pin"  element={<ResetPin />} />

        {/* ── Authenticated portal routes — wrapped with inactivity timer ── */}
        <Route path="/portal/*" element={
          customer ? (
            <PortalInactivityWrapper
              customer={customer}
              enrollments={enrollments}
              loading={loading}
              business={business}
              signOut={signOut}
            >
              <Routes>
                <Route path="/kyc" element={
                  <PortalGuard customer={customer} loading={loading}>
                    <KYC customer={customer} />
                  </PortalGuard>
                } />
                <Route path="/payment-source" element={
                  <PortalGuard customer={customer} loading={loading}>
                    <PaymentSource customer={customer} />
                  </PortalGuard>
                } />
                <Route path="/select-campaign" element={
                  <PortalGuard customer={customer} loading={loading}>
                    <SelectCampaign customer={customer} business={business} refetch={refetch} />
                  </PortalGuard>
                } />
                <Route path="/payment-success" element={
                  <PortalGuard customer={customer} loading={loading}>
                    <PaymentSuccess />
                  </PortalGuard>
                } />
                <Route path="/home" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <Home customer={customer} business={business} signOut={signOut} />
                  </HomeGuard>
                } />
                <Route path="/card" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <CardDetail customer={customer} business={business} />
                  </HomeGuard>
                } />
                <Route path="/transactions" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <Transactions customer={customer} business={business} />
                  </HomeGuard>
                } />
                <Route path="/profile" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <Profile customer={customer} business={business} signOut={signOut} />
                  </HomeGuard>
                } />
                <Route path="/add-money" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <AddMoney customer={customer} />
                  </HomeGuard>
                } />
                <Route path="/pay" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <Pay customer={customer} refetch={refetch} />
                  </HomeGuard>
                } />
                <Route path="/withdraw" element={
                  <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
                    <Withdraw customer={customer} refetch={refetch} />
                  </HomeGuard>
                } />
              </Routes>
            </PortalInactivityWrapper>
          ) : (
            // Not logged in — redirect to login for any /portal/* path
            // that is not already a public route handled above
            <Navigate to="/portal/login" replace />
          )
        } />

        {/* ── Business dashboard ── */}
        <Route path="/dashboard/*" element={<DashboardApp />} />
      </Routes>
    </BrandContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*"  element={<AdminApp />} />
        <Route path="/*"        element={<PortalAndDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App