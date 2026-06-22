import { Routes, Route, Navigate } from 'react-router-dom'
import { useBusinessAuth } from '../../hooks/useBusinessAuth'

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

function DashboardGuard({ admin, loading, mustChangePassword, business, clearFirstLogin, children }) {
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )
  if (!admin) return <Navigate to="/dashboard/login" replace />
  if (mustChangePassword) return (
    <FirstLogin
      admin={admin}
      business={business}
      clearFirstLogin={clearFirstLogin}
    />
  )
  return children
}

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
        </DashboardGuard>
      } />
    </Routes>
  )
}