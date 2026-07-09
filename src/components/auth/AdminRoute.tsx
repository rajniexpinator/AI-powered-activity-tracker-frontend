import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isAdminRole } from '@/lib/roles'
import type { UserRole } from '@/lib/roles'

interface AdminRouteProps {
  children: React.ReactNode
  /** Allowed roles (admin also grants super_admin access) */
  roles?: UserRole[]
}

export function AdminRoute({ children, roles = ['admin'] }: AdminRouteProps) {
  const { user } = useAuth()

  if (!user) return null

  const hasAccess = roles.some((role) => {
    if (role === 'admin') return isAdminRole(user.role)
    return user.role === role
  })

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
