import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/types/auth'
import { api, getToken, setToken } from '@/services/api'

const USER_KEY = 'activity_tracker_user'

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function storeUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // ignore storage issues (private mode, quota, etc.)
  }
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => loadStoredUser())
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((u: User | null) => {
    setUserState(u)
    storeUser(u)
  }, [])

  const loadUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { user: me } = await api.auth.getMe()
      setUser(me)
    } catch (err) {
      // Only clear stored token on 401 (invalid/expired) so refresh keeps user logged in
      const status = (err as Error & { status?: number }).status
      if (status === 401) {
        setToken(null)
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await api.auth.login(email, password)
      setToken(token)
      setUser(u)
    },
    []
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
