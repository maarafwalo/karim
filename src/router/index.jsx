import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { ROLE_HOME } from '../lib/utils.js'
import AppLayout          from '../layouts/AppLayout.jsx'
import LoginPage          from '../pages/LoginPage.jsx'
import UnauthorizedPage   from '../pages/UnauthorizedPage.jsx'
import POSPage            from '../pages/pos/POSPage.jsx'
import CatalogPage        from '../pages/catalog/CatalogPage.jsx'
import StockPage          from '../pages/stock/StockPage.jsx'
import EditingPage        from '../pages/editing/EditingPage.jsx'
import AdminPage          from '../pages/admin/AdminPage.jsx'

function RequireAuth() {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted font-arabic">جارٍ التحميل...</p>
      </div>
    </div>
  )
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireRole({ allowed }) {
  const { profile } = useAuthStore()
  if (!profile) return null
  return allowed.includes(profile.role) ? <Outlet /> : <Navigate to="/unauthorized" replace />
}

function RoleRedirect() {
  const { profile } = useAuthStore()
  const dest = profile ? (ROLE_HOME[profile.role] || '/catalog') : '/catalog'
  return <Navigate to={dest} replace />
}

export const router = createBrowserRouter([
  { path: '/login',        element: <LoginPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  {
    element: <RequireAuth />,
    children: [{
      element: <AppLayout />,
      children: [
        { index: true, element: <RoleRedirect /> },
        {
          element: <RequireRole allowed={['admin', 'cashier']} />,
          children: [{ path: 'pos', element: <POSPage /> }],
        },
        {
          element: <RequireRole allowed={['admin', 'vendor']} />,
          children: [{ path: 'catalog', element: <CatalogPage /> }],
        },
        {
          element: <RequireRole allowed={['admin', 'stock_manager']} />,
          children: [
            { path: 'stock',   element: <StockPage /> },
            { path: 'editing', element: <EditingPage /> },
          ],
        },
        {
          element: <RequireRole allowed={['admin']} />,
          children: [{ path: 'admin', element: <AdminPage /> }],
        },
      ],
    }],
  },
])
