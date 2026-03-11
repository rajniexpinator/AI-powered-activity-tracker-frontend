import { useRef, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, User, ChevronDown, Pencil, Menu, X } from 'lucide-react'
import logoSrc from '../../../public/logo.png'
import { useAuth } from '@/context/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpen])

  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  function handleLogout() {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase()

  const mobileNavContent = user ? (
    <>
      <div className="px-4 py-3 border-b border-black/[0.06] flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium">
          {userInitial}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#111] truncate">{user.name || 'User'}</p>
          <p className="text-[12px] text-[#666] truncate">{user.email}</p>
        </div>
      </div>
      <div className="p-2">
        <Link to="/dashboard" onClick={closeMobileMenu} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#333] hover:bg-black/[0.04] no-underline text-[15px]">
          <LayoutDashboard className="w-5 h-5 text-[#666]" />
          Dashboard
        </Link>
        {user.role === 'admin' && (
          <Link to="/users" onClick={closeMobileMenu} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#333] hover:bg-black/[0.04] no-underline text-[15px]">
            <Users className="w-5 h-5 text-[#666]" />
            Users
          </Link>
        )}
        <Link to="/profile" onClick={closeMobileMenu} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#333] hover:bg-black/[0.04] no-underline text-[15px]">
          <User className="w-5 h-5 text-[#666]" />
          View profile
        </Link>
        <Link to="/profile?edit=1" onClick={closeMobileMenu} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#333] hover:bg-black/[0.04] no-underline text-[15px]">
          <Pencil className="w-5 h-5 text-[#666]" />
          Edit profile
        </Link>
        <button type="button" onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-[#666] hover:bg-red-50 hover:text-red-700 text-left text-[15px]">
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </>
  ) : (
    <div className="p-4 flex flex-col gap-2">
      <Link to="/login" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[#444] font-medium border border-[var(--color-border)] hover:bg-black/[0.03] no-underline text-[15px]">
        Sign in
      </Link>
    </div>
  )

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 no-underline text-[#111] hover:opacity-90 transition-opacity min-w-0">
          <span className="flex items-center justify-center w-15 h-15 overflow-hidden shrink-0">
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
          </span>
       
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-0.5">
          {user ? (
            <>
              <Link to="/dashboard" className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium text-[#666] hover:text-[#111] rounded-lg hover:bg-black/[0.06] hover:ring-1 hover:ring-black/5 transition-colors no-underline">
                <LayoutDashboard className="w-4 h-4 opacity-70" />
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link to="/users" className="flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium rounded-lg transition-all no-underline bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 !text-white">
                  <Users className="w-4 h-4" />
                  Users
                </Link>
              )}
              <span className="hidden lg:inline-block w-px h-4 mx-1 bg-black/10" aria-hidden />
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.06] hover:ring-1 hover:ring-black/10 transition-all border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium">
                    {userInitial}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#666] transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 py-1.5 rounded-xl bg-white border border-black/[0.08] shadow-lg z-50">
                    <div className="px-4 py-2.5 border-b border-black/[0.06]">
                      <p className="text-[13px] font-medium text-[#111] truncate">{user.name || 'User'}</p>
                      <p className="text-[12px] text-[#666] truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[11px] font-medium text-[var(--color-primary)] uppercase tracking-wider">{user.role}</span>
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#333] hover:bg-black/[0.04] no-underline">
                      <User className="w-4 h-4 text-[#666]" />
                      View profile
                    </Link>
                    <Link to="/profile?edit=1" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#333] hover:bg-black/[0.04] no-underline">
                      <Pencil className="w-4 h-4 text-[#666]" />
                      Edit profile
                    </Link>
                    <button type="button" onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-[14px] text-[#666] hover:bg-red-50 hover:text-red-700 transition-colors text-left">
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-2 px-3.5 py-2 text-[14px] font-medium text-[#444] hover:text-[#111] rounded-lg hover:bg-black/[0.06] hover:ring-1 hover:ring-black/5 transition-all no-underline">
                Sign in
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle — visible only on md and below */}
        <div className="flex md:hidden items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-lg hover:bg-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#111]" /> : <Menu className="w-6 h-6 text-[#111]" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel — slide-down */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-black/[0.08] shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto z-40">
          {mobileNavContent}
        </div>
      )}
    </header>
  )
}
