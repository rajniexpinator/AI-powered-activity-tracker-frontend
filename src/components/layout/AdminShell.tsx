import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Users, Building2, LogOut, Menu, X, BarChart3, UserCircle, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface AdminShellProps {
  children: ReactNode
}

export function AdminShell({ children }: AdminShellProps) {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canViewActivity = isAdmin
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logoSrc = `${import.meta.env.BASE_URL}logo.png`

  const path = location.pathname

  const isActive = (to: string) => path === to || path.startsWith(`${to}/`)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
    setMobileOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <div className="w-full flex-1 px-3 sm:px-4 md:px-6 py-5 sm:py-7 flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 self-stretch flex-col rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border)] flex items-center gap-3">
            <div className="flex h-15 w-15 items-center justify-center rounded-xl overflow-hidden">
              <img
                src={logoSrc}
                alt="AI Activity Tracker logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className='text'>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                {isAdmin ? 'Admin' : 'Employee'}
              </p>
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                Operations
              </p>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1 text-[14px]">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                isActive('/dashboard')
                  ? 'bg-[#3F4B9D] text-white shadow-[0_8px_20px_rgba(63,75,157,0.25)]'
                  : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              to="/chat"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                isActive('/chat')
                  ? 'bg-[#3F4B9D] text-white'
                  : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
              }`}
            >
              <MessageSquare className="w-4 h-4 opacity-80" />
              AI logs
            </Link>
            {canViewActivity && (
              <Link
                to="/activity"
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                  isActive('/activity')
                    ? 'bg-[#3F4B9D] text-white'
                    : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                }`}
              >
                <BarChart3 className="w-4 h-4 opacity-80" />
                Activity
              </Link>
            )}
            {canViewActivity && (
              <Link
                to="/reports"
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                  isActive('/reports')
                    ? 'bg-[#3F4B9D] text-white'
                    : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                }`}
              >
                <FileText className="w-4 h-4 opacity-80" />
                Reports
              </Link>
            )}
            {isAdmin && (
              <div className="flex flex-col gap-0.5 mt-2">
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                  People
                </p>
                <Link
                  to="/users"
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/users')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <Users className="w-4 h-4 opacity-80" />
                  Users
                </Link>
                <Link
                  to="/customers"
                  className={`mt-0.5 flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/customers')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <Building2 className="w-4 h-4 opacity-70" />
                  Customers
                </Link>
              </div>
            )}
            {!isAdmin && (
              <div className="flex flex-col gap-0.5 mt-2">
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                  Customers
                </p>
                <Link
                  to="/customers"
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/customers')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <Building2 className="w-4 h-4 opacity-70" />
                  Customers
                </Link>
              </div>
            )}
          </nav>
          <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]/60 mt-auto space-y-2">
            {user && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg)]/80">
                <UserCircle className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                <p className="text-[12px] text-[var(--color-text-secondary)] truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#b91c1c] hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 relative">
          {/* Mobile top bar with toggle */}
          <div className="md:hidden mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-[12px] text-[#444]"
            >
              <Menu className="w-4 h-4" />
              Menu
            </button>
          </div>

          {children}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
            <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl border-r border-[var(--color-border)] flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 overflow-hidden">
                  <img
                    src={logoSrc}
                    alt="AI Activity Tracker logo"
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    {isAdmin ? 'Admin' : 'Employee'}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[var(--color-text)]">
                    Operations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/[0.04]"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-1 text-[14px]">
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-[#3F4B9D] text-white'
                    : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                to="/chat"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                  isActive('/chat')
                    ? 'bg-[#3F4B9D] text-white'
                    : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                }`}
              >
                <MessageSquare className="w-4 h-4 opacity-80" />
                AI logs
              </Link>
              {canViewActivity && (
                <Link
                  to="/activity"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/activity')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 opacity-80" />
                  Activity
                </Link>
              )}
              {canViewActivity && (
                <Link
                  to="/reports"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/reports')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <FileText className="w-4 h-4 opacity-80" />
                  Reports
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link
                    to="/users"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                      isActive('/users')
                        ? 'bg-[#3F4B9D] text-white'
                        : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                    }`}
                  >
                    <Users className="w-4 h-4 opacity-80" />
                    Employees
                  </Link>
                  <Link
                    to="/customers"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                      isActive('/customers')
                        ? 'bg-[#3F4B9D] text-white'
                        : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                    }`}
                  >
                    <Building2 className="w-4 h-4 opacity-70" />
                    Customers
                  </Link>
                </>
              )}
              {!isAdmin && (
                <Link
                  to="/customers"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                    isActive('/customers')
                      ? 'bg-[#3F4B9D] text-white'
                      : 'text-[#555] hover:text-[#111] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <Building2 className="w-4 h-4 opacity-70" />
                  Customers
                </Link>
              )}
            </nav>
            <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]/60 space-y-2">
              {user && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg)]/80">
                  <UserCircle className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                  <p className="text-[12px] text-[var(--color-text-secondary)] truncate" title={user.email}>
                    {user.email}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#b91c1c] hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

