import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { BrandContext, buildBrand } from './lib/BrandContext'
import { getEffectiveStatus } from './lib/campaignUtils'

import Landing from './pages/portal/Landing'
import Register from './pages/portal/Register'
import Login from './pages/portal/Login'
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
import DashboardApp from './pages/dashboard/DashboardApp'
import AdminApp from './pages/admin/AdminApp'

function PortalGuard({ customer, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  return children
}

function HomeGuard({ customer, campaign, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  if (!customer.campaign_id) return <Navigate to="/portal/select-campaign" replace />
  if (campaign && getEffectiveStatus(campaign) === 'deleted') {
    return <Navigate to="/portal/select-campaign" replace />
  }
  return children
}

// ── Portal + Dashboard tree — mounts useAuth ──
function PortalAndDashboard() {
  const { customer, business, campaign, loading, signOut } = useAuth()
  const brand = buildBrand(business)

  return (
    <BrandContext.Provider value={brand}>
      <Routes>
        <Route path="/" element={<Navigate to="/portal" replace />} />

        {/* ── Customer portal ── */}
        <Route path="/portal" element={<Landing />} />
        <Route path="/portal/register" element={<Register />} />
        <Route path="/portal/login" element={<Login />} />

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

        <Route path="/portal/home" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Home customer={customer} signOut={signOut} />
          </HomeGuard>
        } />

        <Route path="/portal/card" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <CardDetail customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/rewards" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Rewards customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/transactions" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Transactions customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/profile" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Profile customer={customer} signOut={signOut} />
          </HomeGuard>
        } />

        <Route path="/portal/add-money" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <AddMoney customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/pay" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Pay customer={customer} />
          </HomeGuard>
        } />

        <Route path="/portal/withdraw" element={
          <HomeGuard customer={customer} campaign={campaign} loading={loading}>
            <Withdraw customer={customer} />
          </HomeGuard>
        } />

        {/* ── Business portal ── */}
        <Route path="/dashboard/*" element={<DashboardApp />} />
      </Routes>
    </BrandContext.Provider>
  )
}

// ── Root router — splits admin from everything else ──
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin portal — completely isolated, never mounts useAuth */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Everything else — mounts useAuth */}
        <Route path="/*" element={<PortalAndDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App