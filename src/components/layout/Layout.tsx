import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6 md:p-8 max-w-[1200px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
