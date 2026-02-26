import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'


export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (!user) return null
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
