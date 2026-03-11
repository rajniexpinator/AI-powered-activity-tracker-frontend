export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'employee'
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
