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
  let res: Response
  try {
    res = await fetch(url, { ...options, headers })
  } catch (e) {
    // Covers network failures (including CORS / backend not reachable)
    const baseMessage = e instanceof Error ? e.message : 'Network request failed'
    const isFetchFailure = baseMessage.toLowerCase().includes('failed to fetch')
    const message = isFetchFailure
      ? 'Network error: could not reach the server. Check backend URL, CORS, and server status.'
      : baseMessage

    throw new Error(message)
  }

  let data: unknown = {}
  try {
    data = await res.json()
  } catch {
    // If backend doesn't return JSON (or empty body), fall back to text for better error messages
    try {
      const text = await res.text()
      data = { error: text }
    } catch {
      data = {}
    }
  }

  if (!res.ok) {
    const asAny = data as { error?: unknown; message?: unknown }
    const serverMessage =
      (typeof asAny?.error === 'string' && asAny.error.trim()) ||
      (typeof asAny?.message === 'string' && asAny.message.trim())

    const message = serverMessage
      ? `HTTP ${res.status}: ${serverMessage}`
      : `HTTP ${res.status}: ${res.statusText}`

    const err = new Error(message) as Error & { status?: number }
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
    updateUser: (
      id: string,
      data: { role?: User['role']; isActive?: boolean; name?: string; email?: string; resetPassword?: string }
    ) =>
      request<{ user: User }>(`/api/auth/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteUser: (id: string) =>
      request<{ success: boolean }>(`/api/auth/users/${id}`, {
        method: 'DELETE',
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

    validateActivity: (structured: unknown, rawText: string, images?: string[]) =>
      request<{
        ok: boolean
        severity: 'ok' | 'minor' | 'warning' | 'critical'
        issues: string[]
        suggestions: string[]
      }>('/api/ai/validate-activity', {
        method: 'POST',
        body: JSON.stringify({ structured, rawText, images }),
      }),
  },

  activities: {
    create: (payload: { rawText: string; structured: unknown; images?: string[] }) =>
      request<{ activity: unknown }>('/api/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: { rawText?: string; structured?: unknown; images?: string[] }) =>
      request<{ activity: unknown }>(`/api/activities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    list: (params?: { limit?: number; page?: number }) => {
      const search = new URLSearchParams()
      search.set('limit', String(params?.limit ?? 20))
      if (params?.page) search.set('page', String(params.page))
      return request<{
        activities: { _id: string; customer?: string; summary?: string; createdAt: string }[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(`/api/activities?${search.toString()}`, { method: 'GET' })
    },

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

    restore: (id: string) =>
      request<{ success: boolean }>(`/api/activities/${id}/restore`, {
        method: 'POST',
      }),

    deleteArchived: (id: string) =>
      request<{ success: boolean }>(`/api/activities/${id}`, {
        method: 'DELETE',
      }),

    adminList: (params: {
      userId?: string
      customer?: string
      from?: string
      to?: string
      limit?: number
      page?: number
    }) => {
      const search = new URLSearchParams()
      if (params.userId) search.set('userId', params.userId)
      if (params.customer) search.set('customer', params.customer)
      if (params.from) search.set('from', params.from)
      if (params.to) search.set('to', params.to)
      if (typeof params.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params.page === 'number') search.set('page', String(params.page))
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
        total: number
        page: number
        limit: number
        totalPages: number
      }>(path, { method: 'GET' })
    },

    adminArchivedList: (params: {
      userId?: string
      customer?: string
      from?: string
      to?: string
      limit?: number
      page?: number
    }) => {
      const search = new URLSearchParams()
      if (params.userId) search.set('userId', params.userId)
      if (params.customer) search.set('customer', params.customer)
      if (params.from) search.set('from', params.from)
      if (params.to) search.set('to', params.to)
      if (typeof params.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      const path = qs ? `/api/activities/admin/archived?${qs}` : '/api/activities/admin/archived'
      return request<{
        activities: {
          _id: string
          customer?: string
          summary?: string
          createdAt: string
          archivedAt?: string
          userId?: { _id: string; name?: string; email?: string; role?: string }
        }[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(path, { method: 'GET' })
    },

    generateWeeklyReport: (payload: {
      userId?: string
      customer?: string
      from?: string
      to?: string
      limit?: number
      includeCustomerSummaries?: boolean
    }) =>
      request<{ report: string; reportId: string }>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    /** Natural-language search (admin). Example: "Show me all Bosch issues last week". */
    adminAiQuery: (payload: { question: string; limit?: number }) =>
      request<{
        interpretation: string
        count: number
        answer?: string
        activities: {
          _id: string
          customer?: string
          summary?: string
          createdAt: string
          isArchived?: boolean
          userId?: { _id: string; name?: string; email?: string; role?: string }
        }[]
      }>('/api/activities/admin/ai-query', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    /** Generate a weekly report narrative from an admin question (AI -> filters -> weekly report). */
    adminAiWeeklyReport: (payload: { question: string; limit?: number }) =>
      request<{ report: string; reportId: string }>('/api/activities/admin/ai-weekly-report', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  reports: {
    list: (params?: { page?: number; limit?: number }) => {
      const search = new URLSearchParams()
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      const path = qs ? `/api/reports?${qs}` : '/api/reports'
      return request<{
        reports: {
          _id: string
          customer?: string
          userId?: string
          from?: string
          to?: string
          includeCustomerSummaries?: boolean
          model?: string
          activityCount?: number
          createdAt: string
        }[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(path, { method: 'GET' })
    },
    getOne: (id: string) =>
      request<{
        report: {
          _id: string
          customer?: string
          userId?: string
          from?: string
          to?: string
          includeCustomerSummaries?: boolean
          model?: string
          activityCount?: number
          createdAt: string
          content: string
        }
      }>(`/api/reports/${id}`, { method: 'GET' }),

    deleteOne: (id: string) =>
      request<{ success: boolean }>(`/api/reports/${id}`, { method: 'DELETE' }),

    clearMine: () =>
      request<{ success: boolean; deleted: number }>('/api/reports/clear', { method: 'POST' }),
  },

  ms365: {
    status: () =>
      request<{ configured: boolean; dbConnected: boolean }>('/api/ms365/status', {
        method: 'GET',
      }),

    getDefaultRecipients: () =>
      request<{ recipients: { to: string[]; cc: string[] } }>('/api/ms365/recipients/default', {
        method: 'GET',
      }),

    setDefaultRecipients: (payload: { to?: string[]; cc?: string[] }) =>
      request<{ recipients: { to: string[]; cc: string[] } }>('/api/ms365/recipients/default', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    createWeeklyReportDraft: (payload: {
      reportId: string
      to?: string[] | string
      cc?: string[] | string
      subject?: string
      bodyText?: string
    }) =>
      request<{
        draft: {
          id: string
          webLink?: string
          createdDateTime?: string
          subject?: string
        }
      }>('/api/ms365/drafts/weekly-report', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    createCustomerEmailDraft: (payload: {
      customer?: string
      weekEnding?: string
      to?: string[] | string
      cc?: string[] | string
      extraContext?: string
    }) =>
      request<{
        draft: {
          id: string
          webLink?: string
          createdDateTime?: string
          subject?: string
        }
      }>('/api/ms365/drafts/customer-email', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    sendDraft: (messageId: string) =>
      request<{ success: boolean }>(`/api/ms365/drafts/${encodeURIComponent(messageId)}/send`, {
        method: 'POST',
      }),
  },

  customers: {
    list: () =>
      request<{
        customers: {
          _id: string
          name: string
          email?: string
          notes?: string
          createdAt: string
          createdBy?: { _id: string; name?: string; email?: string; role?: string }
        }[]
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

  barcodes: {
    clarify: (barcode: string) =>
      request<{
        barcode: string
        mode: 'known' | 'unknown'
        prompt: string
        fields: string[]
        mapping: {
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        } | null
      }>('/api/barcodes/clarify', {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      }),

    getOne: (barcode: string) =>
      request<{
        mapping: {
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        }
      }>(`/api/barcodes/${encodeURIComponent(barcode)}`, { method: 'GET' }),

    scan: (barcode: string) =>
      request<{
        mapping: {
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        }
      }>('/api/barcodes/scan', { method: 'POST', body: JSON.stringify({ barcode }) }),

    upsert: (
      barcode: string,
      payload: { customer?: string; partName?: string; partNumber?: string; productName?: string; metadata?: unknown }
    ) =>
      request<{
        mapping: {
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        }
      }>(`/api/barcodes/${encodeURIComponent(barcode)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
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
