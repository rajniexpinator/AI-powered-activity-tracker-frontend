import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 w-full">
        <Outlet />
      </div>
    </div>
  )
}
