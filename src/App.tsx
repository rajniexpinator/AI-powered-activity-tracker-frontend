import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider } from '@/context/AuthContext'
import { SharedLogsNotifyProvider } from '@/context/SharedLogsNotifyContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { RouteFallback } from '@/components/RouteFallback'
import { PwaInstallBar } from '@/components/PwaInstallBar'
import { Layout } from './components/layout/Layout'

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ChatPage = lazy(() => import('@/pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const UserManagementPage = lazy(() =>
  import('@/pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage }))
)
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const EmployeeFilesPage = lazy(() =>
  import('@/pages/EmployeeFilesPage').then((m) => ({ default: m.EmployeeFilesPage }))
)
const AdminActivityPage = lazy(() =>
  import('@/pages/AdminActivityPage').then((m) => ({ default: m.AdminActivityPage }))
)
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const BarcodeReportsPage = lazy(() =>
  import('@/pages/BarcodeReportsPage').then((m) => ({ default: m.BarcodeReportsPage }))
)

function App() {
  return (
    <AuthProvider>
      <SharedLogsNotifyProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute>
                    <AdminRoute roles={['admin']}>
                      <UserManagementPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers"
                element={
                  <ProtectedRoute>
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employee-files"
                element={
                  <ProtectedRoute>
                    <EmployeeFilesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="activity"
                element={
                  <ProtectedRoute>
                    <AdminActivityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute>
                    <AdminRoute roles={['admin']}>
                      <ReportsPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="barcode-reports"
                element={
                  <ProtectedRoute>
                    <AdminRoute roles={['admin']}>
                      <BarcodeReportsPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
        />
        <PwaInstallBar />
      </SharedLogsNotifyProvider>
    </AuthProvider>
  )
}

export default App
