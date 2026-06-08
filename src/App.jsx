import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { BrandContext, buildBrand } from './lib/BrandContext'

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

function PortalGuard({ customer, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  return children
}

// Guard that also enforces campaign selection before home
function HomeGuard({ customer, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  // If customer has no campaign selected, redirect to campaign selection
  if (!customer.campaign_id) return <Navigate to="/portal/select-campaign" replace />
  return children
}

function App() {
  const { customer, business, loading, signOut } = useAuth()
  const brand = buildBrand(business)

  return (
    <BrandContext.Provider value={brand}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/portal" replace />} />

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

          {/* Campaign selection — required before home, not skippable */}
          <Route path="/portal/select-campaign" element={
            <PortalGuard customer={customer} loading={loading}>
              <SelectCampaign customer={customer} business={business} />
            </PortalGuard>
          } />

          {/* All home-level routes use HomeGuard which enforces campaign selection */}
          <Route path="/portal/home" element={
            <HomeGuard customer={customer} loading={loading}>
              <Home customer={customer} signOut={signOut} />
            </HomeGuard>
          } />

          <Route path="/portal/card" element={
            <HomeGuard customer={customer} loading={loading}>
              <CardDetail customer={customer} />
            </HomeGuard>
          } />

          <Route path="/portal/rewards" element={
            <HomeGuard customer={customer} loading={loading}>
              <Rewards customer={customer} />
            </HomeGuard>
          } />

          <Route path="/portal/transactions" element={
            <HomeGuard customer={customer} loading={loading}>
              <Transactions customer={customer} />
            </HomeGuard>
          } />

          <Route path="/portal/profile" element={
            <HomeGuard customer={customer} loading={loading}>
              <Profile customer={customer} signOut={signOut} />
            </HomeGuard>
          } />

          <Route path="/portal/add-money" element={
            <HomeGuard customer={customer} loading={loading}>
              <AddMoney customer={customer} />
            </HomeGuard>
          } />

          <Route path="/portal/pay" element={
            <HomeGuard customer={customer} loading={loading}>
              <Pay customer={customer} />
            </HomeGuard>
          } />

          <Route path="/portal/withdraw" element={
            <HomeGuard customer={customer} loading={loading}>
              <Withdraw customer={customer} />
            </HomeGuard>
          } />

          <Route path="/dashboard/*" element={<DashboardApp />} />
        </Routes>
      </BrowserRouter>
    </BrandContext.Provider>
  )
}

export default App