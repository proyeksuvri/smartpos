import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import './App.css'

/* ── Lazy-loaded pages (code splitting) ─────────────────── */
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PosPage       = lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })))
const ProductsPage  = lazy(() => import('./pages/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const StockPage     = lazy(() => import('./pages/StockPage').then((m) => ({ default: m.StockPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const CustomersPage  = lazy(() => import('./pages/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const SuppliersPage  = lazy(() => import('./pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })))
const SettingsPage   = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ReceiptPage    = lazy(() => import('./pages/ReceiptPage').then((m) => ({ default: m.ReceiptPage })))
const LoginPage      = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const ReportsPage           = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const OperationalCostsPage  = lazy(() => import('./pages/OperationalCostsPage').then((m) => ({ default: m.OperationalCostsPage })))
const SyncQueuePage         = lazy(() => import('./pages/SyncQueuePage').then((m) => ({ default: m.SyncQueuePage })))
const EmployeesPage         = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const ResetDataPage         = lazy(() => import('./pages/ResetDataPage').then((m) => ({ default: m.ResetDataPage })))
const ShiftsPage            = lazy(() => import('./pages/ShiftsPage').then((m) => ({ default: m.ShiftsPage })))

/* ── Page loading fallback ───────────────────────────────── */
function PageLoader() {
  return (
    <div style={{ alignItems: 'center', display: 'flex', height: '60vh', justifyContent: 'center', gap: 12 }}>
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Memuat halaman...</span>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="pos"        element={<Suspense fallback={<PageLoader />}><PosPage /></Suspense>} />
          <Route path="products"   element={<Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>} />
          <Route path="stock"      element={<Suspense fallback={<PageLoader />}><StockPage /></Suspense>} />
          <Route path="categories" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
          <Route path="customers"  element={<Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>} />
          <Route path="suppliers"  element={<Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense>} />
          <Route path="settings"      element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          <Route path="transactions"  element={<Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>} />
          <Route path="reports"            element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
          <Route path="operational-costs"  element={<Suspense fallback={<PageLoader />}><OperationalCostsPage /></Suspense>} />
          <Route path="sync-queue"          element={<Suspense fallback={<PageLoader />}><SyncQueuePage /></Suspense>} />
          <Route path="employees"            element={<Suspense fallback={<PageLoader />}><EmployeesPage /></Suspense>} />
          <Route path="reset-data"           element={<Suspense fallback={<PageLoader />}><ResetDataPage /></Suspense>} />
          <Route path="shifts"               element={<Suspense fallback={<PageLoader />}><ShiftsPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />

        {/* Receipt — protected but no sidebar */}
        <Route
          path="/receipt/:invoiceNo"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ReceiptPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

export default App
