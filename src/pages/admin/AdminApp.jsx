import { Routes, Route, Navigate } from 'react-router-dom'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import AdminLogin from './AdminLogin'
import AdminLayout from './AdminLayout'
import Dashboard from './Dashboard'
import Businesses from './Businesses'
import BusinessDetail from './BusinessDetail'
import Customers from './Customers'
import CustomerDetail from './CustomerDetail'
import Transactions from './Transactions'
import Revenue from './Revenue'
import KYBQueue from './KYBQueue'
import Vouchers from './Vouchers'
import Settings from './Settings'

function AdminGuard({ admin, loading, children }) {
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!admin) return <Navigate to="/admin/login" replace />
  return children
}

export default function AdminApp() {
  const { admin, loading, signOut } = useAdminAuth()
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/*" element={
        <AdminGuard admin={admin} loading={loading}>
          <AdminLayout admin={admin} signOut={signOut}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/businesses" element={<Businesses />} />
              <Route path="/businesses/:id" element={<BusinessDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/revenue" element={<Revenue />} />
              <Route path="/kyb" element={<KYBQueue />} />
              <Route path="/vouchers" element={<Vouchers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </AdminLayout>
        </AdminGuard>
      } />
    </Routes>
  )
}