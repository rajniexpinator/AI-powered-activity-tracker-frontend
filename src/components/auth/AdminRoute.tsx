import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

type Role = 'admin' | 'supervisor' | 'employee'

interface AdminRouteProps {
  children: React.ReactNode
  /** Allowed roles (default: admin only) */
  roles?: Role[]
}

export function AdminRoute({ children, roles = ['admin'] }: AdminRouteProps) {
  const { user } = useAuth()

  if (!user) return null
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
