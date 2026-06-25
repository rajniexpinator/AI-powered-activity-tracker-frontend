import type { SharePreferences } from '@/constants/sharePreferences'

export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'employee'
  isActive?: boolean
  emailNotifications?: {
    enabled?: boolean
    severityLevels?: number[]
  }
  assignedPlant?: string
  assignedPlantOther?: string
  sharePreferences?: SharePreferences
}

export interface AuthState {
  token: string | null
  user: User | null
}

export interface LoginResponse {
  token: string
  user: User
}
