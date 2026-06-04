import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

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

function PortalGuard({ customer, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!customer) return <Navigate to="/portal" replace />
  return children
}

function App() {
  const { customer, loading, signOut } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/portal" replace />} />

        <Route path="/portal" element={<Landing />} />
        <Route path="/portal/register" element={<Register />} />
        <Route path="/portal/login" element={<Login />} />
        <Route path="/portal/home" element={
          <PortalGuard customer={customer} loading={loading}>
            <Home customer={customer} signOut={signOut} />
          </PortalGuard>
        } />
        <Route path="/portal/card" element={
          <PortalGuard customer={customer} loading={loading}>
            <CardDetail customer={customer} />
          </PortalGuard>
        } />
        <Route path="/portal/rewards" element={
          <PortalGuard customer={customer} loading={loading}>
            <Rewards customer={customer} />
          </PortalGuard>
        } />
        <Route path="/portal/transactions" element={
          <PortalGuard customer={customer} loading={loading}>
            <Transactions customer={customer} />
          </PortalGuard>
        } />
        <Route path="/portal/profile" element={
          <PortalGuard customer={customer} loading={loading}>
            <Profile customer={customer} signOut={signOut} />
          </PortalGuard>
        } />
        <Route path="/portal/add-money" element={
          <PortalGuard customer={customer} loading={loading}>
            <AddMoney customer={customer} />
          </PortalGuard>
        } />
        <Route path="/portal/pay" element={
          <PortalGuard customer={customer} loading={loading}>
            <Pay customer={customer} />
          </PortalGuard>
        } />
        <Route path="/portal/withdraw" element={
          <PortalGuard customer={customer} loading={loading}>
            <Withdraw customer={customer} />
          </PortalGuard>
        } />

        <Route path="/dashboard/*" element={
          <div className="p-8 text-2xl font-bold text-[#1B4F72]">
            Business Dashboard — coming soon
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App