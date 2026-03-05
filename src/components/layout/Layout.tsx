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
    location.pathname === '/activity' ||
    location.pathname.startsWith('/activity/')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {!hideHeader && <Header />}
      <div className="flex-1 w-full">
        <Outlet />
      </div>
    </div>
  )
}
