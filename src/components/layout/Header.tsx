import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut } from 'lucide-react'
import logoSrc from '@/assets/ApexLogoFinal_Color.png'
import { useAuth } from '@/context/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 md:px-8 h-16 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-3 no-underline text-[#111] hover:opacity-90 transition-opacity"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f5f5f7] overflow-hidden border border-black/[0.06]">
            <img
              src={logoSrc}
              alt="AI Activity Tracker"
              className="h-full w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const next = (e.target as HTMLImageElement).nextElementSibling
                if (next) (next as HTMLElement).style.display = 'flex'
              }}
            />
            <span
              className="hidden items-center justify-center w-full h-full bg-[var(--color-accent)] text-white text-xs font-semibold"
              aria-hidden
            >
              AI
            </span>
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-[#111]">
            AI Activity Tracker
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {user ? (
            <>
              <Link
                to="/"
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium text-[#666] hover:text-[#111] rounded-lg hover:bg-black/[0.04] transition-colors no-underline"
              >
                <LayoutDashboard className="w-4 h-4 opacity-70" />
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link
                  to="/users"
                  className="flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium rounded-lg transition-colors no-underline bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] !text-white"
                >
                  <Users className="w-4 h-4" />
                  Users
                </Link>
              )}
              <span className="hidden lg:inline-block w-px h-4 mx-1 bg-black/10" aria-hidden />
              <span className="hidden md:inline text-[13px] text-[#666] px-3 py-1.5 rounded-lg bg-black/[0.03]">
                <span className="text-[#333]">{user.email}</span>
                <span className="text-[var(--color-primary)] ml-1">· {user.role}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium text-[#666] hover:text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium text-[#444] hover:text-[#111] rounded-lg hover:bg-black/[0.04] transition-colors no-underline"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium rounded-lg transition-colors no-underline bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] !text-white"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
