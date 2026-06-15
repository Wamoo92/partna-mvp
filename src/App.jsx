import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { BrandContext, buildBrand } from './lib/BrandContext'
import { getEffectiveStatus } from './lib/campaignUtils'

import Landing from './pages/portal/Landing'
import Register from './pages/portal/Register'
import Login from './pages/portal/Login'
import ResetPin from './pages/portal/ResetPin'
import Home from './pages/portal/Home'
import CardDetail from './pages/portal/CardDetail'
import Rewards from './pages/portal/Rewards'
import Transactions from './pages/portal/Transactions'
import Profile from './pages/portal/Profile'
import AddMoney from './pages/portal/AddMoney'
import Pay from './pages/portal/Pay'
import Withdraw from './pages/portal/Withdraw'
import KYC from './pages/portal/KYC'
import PaymentSource from './pages/portal/PaymentSource'
import SelectCampaign from './pages/portal/SelectCampaign'
import PaymentSuccess from './pages/portal/PaymentSuccess'
import DashboardApp from './pages/dashboard/DashboardApp'
import AdminApp from './pages/admin/AdminApp'

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

function PortalAndDashboard() {
  const { customer, business, enrollments, loading, signOut } = useAuth()
  const brand = buildBrand(business)

  return (
    <BrandContext.Provider value={brand}>
      <Routes>
        <Route path="/" element={<Navigate to="/portal" replace />} />

        {/* ── Public routes ── */}
        <Route path="/portal" element={<Landing />} />
        <Route path="/portal/register" element={<Register />} />
        <Route path="/portal/login" element={<Login />} />
        <Route path="/portal/reset-pin" element={<ResetPin />} />

        {/* ── Requires login, no enrollment needed ── */}
        <Route path="/portal/kyc" element={
          <PortalGuard customer={customer} loading={loading}>
            <KYC customer={customer} />
          </PortalGuard>
        } />

        <Route path="/portal/payment-source" element={
          <PortalGuard customer={customer} loading={loading}>
            <PaymentSource customer={customer} />
          </PortalGuard>
        } />

        <Route path="/portal/select-campaign" element={
          <PortalGuard customer={customer} loading={loading}>
            <SelectCampaign customer={customer} business={business} />
          </PortalGuard>
        } />

        {/* ── Pesapal returns here after payment ── */}
        {/* PortalGuard only — customer must be logged in but enrollment not required */}
        {/* (Pesapal redirects back mid-session so HomeGuard would be too strict) */}
        <Route path="/portal/payment-success" element={
          <PortalGuard customer={customer} loading={loading}>
            <PaymentSuccess />
          </PortalGuard>
        } />

        {/* ── Requires login + active enrollment ── */}
        <Route path="/portal/home" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Home customer={customer} signOut={signOut} />
          </HomeGuard>
        } />

        <Route path="/portal/card" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <CardDetail customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/rewards" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Rewards customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/transactions" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Transactions customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/profile" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Profile customer={customer} signOut={signOut} />
          </HomeGuard>
        } />

        <Route path="/portal/add-money" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <AddMoney customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/pay" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Pay customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/withdraw" element={
          <HomeGuard customer={customer} enrollments={enrollments} loading={loading}>
            <Withdraw customer={customer} />
          </HomeGuard>
        } />

        {/* ── Business portal ── */}
        <Route path="/dashboard/*" element={<DashboardApp />} />
      </Routes>
    </BrandContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*" element={<PortalAndDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App