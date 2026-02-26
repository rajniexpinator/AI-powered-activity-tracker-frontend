export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'supervisor' | 'employee'
  isActive?: boolean
}

export interface AuthState {
  token: string | null
  user: User | null
}

export interface LoginResponse {
  token: string
  user: User
}
