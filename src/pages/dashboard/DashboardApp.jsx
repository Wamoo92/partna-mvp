import { Routes, Route, Navigate } from 'react-router-dom'
import { useBusinessAuth } from '../../hooks/useBusinessAuth'

import DashboardLogin from './DashboardLogin'
import DashboardRegister from './DashboardRegister'
import ResetPassword from './ResetPassword'
import DashboardLayout from './DashboardLayout'
import Overview from './Overview'
import Customers from './Customers'
import Campaigns from './Campaigns'
import Payments from './Payments'
import VouchersPrizes from './VouchersPrizes'
import Settings from './Settings'
import Products from './Products'

function DashboardGuard({ admin, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!admin) return <Navigate to="/dashboard/login" replace />
  return children
}

export default function DashboardApp() {
  const { admin, business, loading, signOut } = useBusinessAuth()

  return (
    <Routes>
      <Route path="/login" element={<DashboardLogin />} />
      <Route path="/register" element={<DashboardRegister />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/*" element={
        <DashboardGuard admin={admin} loading={loading}>
          <DashboardLayout admin={admin} business={business} signOut={signOut}>
            <Routes>
              <Route path="/overview" element={<Overview admin={admin} business={business} />} />
              <Route path="/customers" element={<Customers admin={admin} business={business} />} />
              <Route path="/campaigns" element={<Campaigns admin={admin} business={business} />} />
              <Route path="/payments" element={<Payments admin={admin} business={business} />} />
              <Route path="/vouchers" element={<VouchersPrizes admin={admin} business={business} />} />
              <Route path="/settings" element={<Settings admin={admin} business={business} />} />
              <Route path="/products" element={<Products admin={admin} business={business} />} />
              <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
            </Routes>
          </DashboardLayout>
        </DashboardGuard>
      } />
    </Routes>
  )
}