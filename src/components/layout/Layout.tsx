import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  const location = useLocation()
  const hideHeader =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/dashboard/') ||
    location.pathname === '/users' ||
    location.pathname.startsWith('/users/') ||
    location.pathname === '/chat' ||
    location.pathname.startsWith('/chat/') ||
    location.pathname === '/customers' ||
    location.pathname.startsWith('/customers/') ||
    location.pathname === '/employee-files' ||
    location.pathname.startsWith('/employee-files/') ||
    location.pathname === '/activity' ||
    location.pathname.startsWith('/activity/') ||
    location.pathname === '/admin-ai' ||
    location.pathname.startsWith('/admin-ai/') ||
    location.pathname === '/reports' ||
    location.pathname.startsWith('/reports/') ||
    location.pathname === '/report-dashboard' ||
    location.pathname.startsWith('/report-dashboard/') ||
    location.pathname === '/my-reports' ||
    location.pathname.startsWith('/my-reports/') ||
    location.pathname === '/barcode-reports' ||
    location.pathname.startsWith('/barcode-reports/') ||
    location.pathname === '/barcode-mapping' ||
    location.pathname.startsWith('/barcode-mapping/') ||
    location.pathname === '/barcode-bulk' ||
    location.pathname.startsWith('/barcode-bulk/') ||
    location.pathname === '/profile' ||
    location.pathname.startsWith('/profile/')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {!hideHeader && <Header />}
      <div className="flex-1 w-full">
        <Outlet />
      </div>
    </div>
  )
}
