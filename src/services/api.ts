import type { User, LoginResponse } from '@/types/auth'

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'activity_tracker_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (!options?.skipAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data as T
}

export const api = {
  getHealth: () => request<{ status: string }>('/health', { method: 'GET', skipAuth: true }),
  getApiInfo: () => request<{ name: string; version: string; phase: number }>('/api', { method: 'GET', skipAuth: true }),

  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name?: string, role?: string) =>
      request<LoginResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      }),
    getMe: () => request<{ user: User }>('/api/auth/me', { method: 'GET' }),
    updateMe: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
      request<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getUsers: () => request<{ users: User[] }>('/api/auth/users', { method: 'GET' }),
    updateUser: (id: string, data: { role?: User['role']; isActive?: boolean }) =>
      request<{ user: User }>(`/api/auth/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  ai: {
    extractActivity: (text: string, customerHint?: string) =>
      request<{
        structured: unknown
        rawText: string
        model: string
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }>('/api/ai/extract-activity', {
        method: 'POST',
        body: JSON.stringify({ text, customerHint }),
      }),

    validateActivity: (structured: unknown, rawText: string) =>
      request<{
        ok: boolean
        severity: 'ok' | 'minor' | 'warning' | 'critical'
        issues: string[]
        suggestions: string[]
      }>('/api/ai/validate-activity', {
        method: 'POST',
        body: JSON.stringify({ structured, rawText }),
      }),
  },

  activities: {
    create: (payload: { rawText: string; structured: unknown }) =>
      request<{ activity: unknown }>('/api/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
}
