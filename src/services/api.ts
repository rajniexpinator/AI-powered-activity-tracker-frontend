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
    create: (payload: { rawText: string; structured: unknown; images?: string[] }) =>
      request<{ activity: unknown }>('/api/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    list: (limit = 20) =>
      request<{
        activities: { _id: string; customer?: string; summary?: string; createdAt: string }[]
      }>(`/api/activities?limit=${limit}`, {
        method: 'GET',
      }),

    getOne: (id: string) =>
      request<{
        activity: {
          _id: string
          customer?: string
          summary?: string
          rawConversation?: string
          structuredData?: unknown
          images?: string[]
          createdAt: string
        }
      }>(`/api/activities/${id}`, {
        method: 'GET',
      }),

    archive: (id: string) =>
      request<{ success: boolean }>(`/api/activities/${id}/archive`, {
        method: 'POST',
      }),

    adminList: (params: { userId?: string; customer?: string; from?: string; to?: string; limit?: number }) => {
      const search = new URLSearchParams()
      if (params.userId) search.set('userId', params.userId)
      if (params.customer) search.set('customer', params.customer)
      if (params.from) search.set('from', params.from)
      if (params.to) search.set('to', params.to)
      if (typeof params.limit === 'number') search.set('limit', String(params.limit))
      const qs = search.toString()
      const path = qs ? `/api/activities/admin?${qs}` : '/api/activities/admin'
      return request<{
        activities: {
          _id: string
          customer?: string
          summary?: string
          createdAt: string
          userId?: { _id: string; name?: string; email?: string; role?: string }
        }[]
      }>(path, { method: 'GET' })
    },

    generateWeeklyReport: (payload: { userId?: string; customer?: string; from?: string; to?: string; limit?: number }) =>
      request<{ report: string }>('/api/activities/admin/weekly-report', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  customers: {
    list: () =>
      request<{
        customers: { _id: string; name: string; email?: string; notes?: string; createdAt: string }[]
      }>('/api/customers', {
        method: 'GET',
      }),
    create: (payload: { name: string; email?: string; notes?: string }) =>
      request<{ customer: { _id: string; name: string; email?: string; notes?: string; createdAt: string } }>(
        '/api/customers',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),
    update: (id: string, payload: { name?: string; email?: string; notes?: string }) =>
      request<{ customer: { _id: string; name: string; email?: string; notes?: string; createdAt: string } }>(
        `/api/customers/${id}`,
        { method: 'PATCH', body: JSON.stringify(payload) }
      ),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/customers/${id}`, {
        method: 'DELETE',
      }),
  },

  upload: {
    image: async (file: File) => {
      const formData = new FormData()
      formData.append('image', file)

      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${BASE}/api/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error((data as { error?: string }).error || res.statusText) as Error & { status?: number }
        err.status = res.status
        throw err
      }
      return data as { key: string; url: string }
    },
  },
}
