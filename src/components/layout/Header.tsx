import { Link } from 'react-router-dom'
import logoSrc from '@/assets/ApexLogoFinal_Color.png'

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4 bg-white text-gray-900 shadow-sm border-b-2 border-[#3f4b9d]">
      <Link
        to="/"
        className="flex items-center gap-3 no-underline font-semibold text-[#3f4b9d] hover:text-[#323b7d]"
      >
        <span className="flex items-center justify-center p-1.5 px-2 bg-white ">
          <img
            src={logoSrc}
            alt="Apex Logo"
            className="h-9 w-auto block md:h-[42px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              const next = (e.target as HTMLImageElement).nextElementSibling
              if (next) (next as HTMLElement).style.display = 'block'
            }}
          />
          <span
            className="hidden flex items-center justify-center w-9 h-9 md:w-[42px] md:h-[42px] bg-[#E22637] rounded-lg text-[10px] text-white leading-none"
            aria-hidden
          >
            AI
          </span>
        </span>
        <span className="text-lg md:text-xl">AI Activity Tracker</span>
      </Link>
      <nav className="flex items-center gap-4">
        <span className="text-xs font-semibold bg-[#E22637] text-white px-2.5 py-1 rounded">
          Phase 1
        </span>
      </nav>
    </header>
  )
}
