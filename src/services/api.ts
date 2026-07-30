import type { User, LoginResponse } from '@/types/auth'
import type { SharePreferences } from '@/constants/sharePreferences'

export type BarcodePatternField =
  | 'partNumber'
  | 'partName'
  | 'customer'
  | 'supplier'
  | 'serialNumber'
  | 'notes'

export type BarcodePatternSegment = {
  start: number
  end: number
  field: BarcodePatternField
}

export type BarcodePatternDto = {
  _id: string
  name?: string
  sampleBarcode: string
  structureKey: string
  segments: BarcodePatternSegment[]
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  extracted?: Record<string, string>
}

export type BarcodeBulkScanItem = {
  _id: string
  barcode: string
  scannedAt?: string
  scannedBy?: unknown
  partName?: string
  partNumber?: string
  customer?: string
  supplier?: string
  serialNumber?: string
  notes?: string
  patternId?: string | null
  mappingId?: string | null
}

export type BarcodeBulkLotSummary = {
  _id: string
  name: string
  description?: string
  status: 'open' | 'closed'
  createdBy?: unknown
  itemCount: number
  createdAt?: string
  updatedAt?: string
}

export type BarcodeBulkLotDetail = BarcodeBulkLotSummary & {
  items: BarcodeBulkScanItem[]
}

export type EmployeeFileItem = {
  _id: string
  title: string
  description?: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  updatedAt?: string
  uploadedBy?: { _id: string; name?: string; email?: string } | null
}

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
      ? serverMessage
      : res.statusText?.trim() || `Request failed (${res.status})`

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
    updateMe: (data: {
      name?: string
      currentPassword?: string
      newPassword?: string
      emailNotifications?: { enabled?: boolean; severityLevels?: number[] }
      assignedPlant?: string | null
      assignedPlantOther?: string | null
      sharePreferences?: SharePreferences
    }) =>
      request<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getUsers: () => request<{ users: User[] }>('/api/auth/users', { method: 'GET' }),

    getCoworkers: () =>
      request<{
        users: { id: string; name?: string; email: string; role: string }[]
      }>('/api/auth/coworkers', { method: 'GET' }),
    updateUser: (
      id: string,
      data: {
        role?: User['role']
        isActive?: boolean
        name?: string
        email?: string
        resetPassword?: string
        emailNotifications?: { enabled?: boolean; severityLevels?: number[] }
        assignedPlant?: string | null
        assignedPlantOther?: string | null
        sharePreferences?: SharePreferences
      }
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
    create: (payload: {
      rawText: string
      structured: unknown
      images?: string[]
      attachments?: { url: string; name: string; mime?: string; size?: number }[]
      /** Part / unit serial number (up to 128 chars). */
      serialNumber?: string
    }) =>
      request<{ activity: unknown }>('/api/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: {
        rawText?: string
        structured?: unknown
        images?: string[]
        attachments?: { url: string; name: string; mime?: string; size?: number }[]
        /** Pass '' to clear the existing serial number. */
        serialNumber?: string
      }
    ) =>
      request<{ activity: unknown }>(`/api/activities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    list: (params?: {
      limit?: number
      page?: number
      period?: 'all' | 'today' | '3days' | 'week' | '2weeks' | 'month'
      customers?: string[]
    }) => {
      const search = new URLSearchParams()
      search.set('limit', String(params?.limit ?? 100))
      if (params?.page) search.set('page', String(params.page))
      if (params?.period && params.period !== 'all') search.set('period', params.period)
      if (params?.customers?.length) search.set('customers', params.customers.join(','))
      return request<{
        activities: {
          _id: string
          customer?: string
          serialNumber?: string
          summary?: string
          createdAt: string
          isOwner?: boolean
        }[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(`/api/activities?${search.toString()}`, { method: 'GET' })
    },

    todayCount: () =>
      request<{ todayCount: number }>('/api/activities/today-count', {
        method: 'GET',
      }),

    getOne: (id: string) =>
      request<{
        activity: {
          _id: string
          userId?: string | { _id: string; name?: string; email?: string; role?: string }
          sharedWith?: { _id: string; name?: string; email?: string; role?: string }[]
          collaborationNotes?: {
            _id?: string
            text: string
            createdAt: string
            userId?: { _id?: string; name?: string; email?: string }
          }[]
          customer?: string
          serialNumber?: string
          summary?: string
          rawConversation?: string
          structuredData?: unknown
          images?: string[]
          attachments?: { url: string; name: string; mime?: string; size?: number }[]
          createdAt: string
        }
      }>(`/api/activities/${id}`, {
        method: 'GET',
      }),

    share: (id: string, sharedWithUserIds: string[]) =>
      request<{ activity: unknown }>(`/api/activities/${id}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ sharedWithUserIds }),
      }),

    addNote: (id: string, text: string) =>
      request<{ activity: unknown }>(`/api/activities/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),

    adminGetOne: (id: string) =>
      request<{
        activity: {
          _id: string
          customer?: string
          serialNumber?: string
          summary?: string
          rawConversation?: string
          structuredData?: unknown
          images?: string[]
          attachments?: { url: string; name: string; mime?: string; size?: number }[]
          createdAt: string
          isArchived?: boolean
          archivedAt?: string
        }
      }>(`/api/activities/admin/${id}`, {
        method: 'GET',
      }),

    archive: (id: string) =>
      request<{ success: boolean }>(`/api/activities/${id}/archive`, {
        method: 'POST',
      }),

    sendEmail: (id: string, payload?: { to?: string[] | string; cc?: string[] | string; subject?: string }) =>
      request<{
        success: boolean
        to: string[]
        cc: string[]
        attachedCount: number
        sourceCount: number
        skipped: { url: string; reason: string }[]
      }>(`/api/activities/${id}/send-email`, {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
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
      customers?: string[]
      period?: 'all' | 'today' | '3days' | 'week' | '2weeks' | 'month'
      from?: string
      to?: string
      limit?: number
      page?: number
      /** Exact issue severity 0–3 (structuredData.severity) */
      severity?: string
      /** Minimum severity 0–3 (e.g. 2 = medium and high) */
      minSeverity?: string
      oem?: string
    }) => {
      const search = new URLSearchParams()
      if (params.userId) search.set('userId', params.userId)
      if (params.customer) search.set('customer', params.customer)
      if (params.customers?.length) search.set('customers', params.customers.join(','))
      if (params.period && params.period !== 'all') search.set('period', params.period)
      if (params.from) search.set('from', params.from)
      if (params.to) search.set('to', params.to)
      if (params.severity) search.set('severity', params.severity)
      if (params.minSeverity) search.set('minSeverity', params.minSeverity)
      if (params.oem) search.set('oem', params.oem)
      if (typeof params.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      const path = qs ? `/api/activities/admin?${qs}` : '/api/activities/admin'
      return request<{
        activities: {
          _id: string
          customer?: string
          serialNumber?: string
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
      severity?: string
      minSeverity?: string
    }) => {
      const search = new URLSearchParams()
      if (params.userId) search.set('userId', params.userId)
      if (params.customer) search.set('customer', params.customer)
      if (params.from) search.set('from', params.from)
      if (params.to) search.set('to', params.to)
      if (params.severity) search.set('severity', params.severity)
      if (params.minSeverity) search.set('minSeverity', params.minSeverity)
      if (typeof params.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      const path = qs ? `/api/activities/admin/archived?${qs}` : '/api/activities/admin/archived'
      return request<{
        activities: {
          _id: string
          customer?: string
          serialNumber?: string
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
      customers?: string[]
      period?: 'all' | 'today' | '3days' | 'week' | '2weeks' | 'month'
      from?: string
      to?: string
      limit?: number
      includeCustomerSummaries?: boolean
      reportSections?: Record<string, boolean>
      includeReportPictures?: boolean
      hideSeverity?: boolean
      oem?: string
      severity?: string | number
      minSeverity?: string | number
    }) =>
      request<{
        report: string
        reportId: string
        imageGallery?: Array<{
          activityId?: string
          customer?: string
          summary?: string
          createdAt?: string
          imageUrls?: string[]
        }>
      }>('/api/reports/generate', {
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

    /** Generate a quality report narrative from an admin question (AI -> filters -> report). */
    adminAiWeeklyReport: (payload: {
      question: string
      limit?: number
      reportSections?: Record<string, boolean>
      includeReportPictures?: boolean
      hideSeverity?: boolean
    }) =>
      request<{
        report: string
        reportId: string
        imageGallery?: Array<{
          activityId?: string
          customer?: string
          summary?: string
          createdAt?: string
          imageUrls?: string[]
        }>
      }>('/api/activities/admin/ai-weekly-report', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  reports: {
    list: (params?: { page?: number; limit?: number; oem?: string }) => {
      const search = new URLSearchParams()
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      if (params?.oem) search.set('oem', params.oem)
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
          issueSeverityExact?: number
          issueSeverityMin?: number
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
          period?: string
          dateMode?: 'fixed' | 'today'
          aiQuestion?: string
          includeCustomerSummaries?: boolean
          reportSections?: Record<string, boolean>
          includeReportPictures?: boolean
          hideSeverity?: boolean
          issueSeverityExact?: number
          issueSeverityMin?: number
          model?: string
          activityCount?: number
          createdAt: string
          content: string
          imageGallery?: Array<{
            activityId?: string
            customer?: string
            summary?: string
            createdAt?: string
            imageUrls?: string[]
          }>
        }
      }>(`/api/reports/${id}`, { method: 'GET' }),

    regenerate: (
      id: string,
      payload: {
        customer?: string
        from?: string
        to?: string
        period?: string
        dateMode?: 'fixed' | 'today'
        aiQuestion?: string
        severity?: string | number
        minSeverity?: string | number
        includeCustomerSummaries?: boolean
        reportSections?: Record<string, boolean>
        includeReportPictures?: boolean
        hideSeverity?: boolean
      }
    ) =>
      request<{
        report: string
        reportId: string
        imageGallery?: Array<{
          activityId?: string
          customer?: string
          summary?: string
          createdAt?: string
          imageUrls?: string[]
        }>
      }>(`/api/reports/${id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    deleteOne: (id: string) =>
      request<{ success: boolean }>(`/api/reports/${id}`, { method: 'DELETE' }),

    clearMine: () =>
      request<{ success: boolean; deleted: number }>('/api/reports/clear', { method: 'POST' }),
  },

  reportDashboard: {
    list: () =>
      request<{
        items: {
          _id: string
          displayName: string
          customer?: string
          dateMode?: 'fixed' | 'today'
          period?: string
          aiQuestion?: string
          activityCount?: number
          createdAt: string
        }[]
      }>('/api/report-dashboard', { method: 'GET' }),

    add: (payload: { displayName: string; sourceReportId: string }) =>
      request<{ item: { _id: string; displayName: string } }>('/api/report-dashboard', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    preview: (
      id: string,
      payload?: {
        customer?: string
        from?: string
        to?: string
        period?: string
        dateMode?: 'fixed' | 'today'
        aiQuestion?: string
        severity?: string | number
        minSeverity?: string | number
      }
    ) =>
      request<{
        displayName: string
        dateMode?: string
        content: string
        imageGallery?: Array<{
          activityId?: string
          customer?: string
          summary?: string
          createdAt?: string
          imageUrls?: string[]
        }>
        activityCount?: number
        customer?: string
      }>(`/api/report-dashboard/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),

    remove: (id: string) =>
      request<{ success: boolean }>(`/api/report-dashboard/${id}`, { method: 'DELETE' }),

    duplicate: (
      id: string,
      payload: {
        displayName: string
        customer?: string
        from?: string
        to?: string
        period?: string
        dateMode?: 'fixed' | 'today'
        aiQuestion?: string
        severity?: string | number
        minSeverity?: string | number
      }
    ) =>
      request<{ item: { _id: string; displayName: string } }>(`/api/report-dashboard/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    createFromAi: (payload: { displayName: string; aiQuestion: string }) =>
      request<{ item: { _id: string; displayName: string } }>('/api/report-dashboard/from-ai', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
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

    sendTestEmailNotification: () =>
      request<{ success: boolean; to: string }>('/api/ms365/email/test-notification', {
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
          serialNumber?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        } | null
        structureKey?: string
        pattern?: { _id: string; name?: string; sampleBarcode?: string; structureKey?: string } | null
        extracted?: Record<string, string> | null
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
          serialNumber?: string
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
          serialNumber?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        }
        pattern?: { _id: string; name?: string; structureKey?: string } | null
        extracted?: Record<string, string> | null
      }>('/api/barcodes/scan', { method: 'POST', body: JSON.stringify({ barcode }) }),

    upsert: (
      barcode: string,
      payload: {
        customer?: string
        partName?: string
        partNumber?: string
        productName?: string
        serialNumber?: string
        metadata?: unknown
      }
    ) =>
      request<{
        mapping: {
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          serialNumber?: string
          scanCount?: number
          updatedAt?: string
          createdAt?: string
        }
      }>(`/api/barcodes/${encodeURIComponent(barcode)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    adminList: (params?: { q?: string; limit?: number; page?: number }) => {
      const search = new URLSearchParams()
      if (params?.q?.trim()) search.set('q', params.q.trim())
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      return request<{
        mappings: {
          _id: string
          barcode: string
          partName?: string
          partNumber?: string
          productName?: string
          customer?: string
          serialNumber?: string
          scanCount: number
          metadata?: unknown
          lastScannedBy: { _id: string; name?: string; email?: string } | null
          createdAt: string
          updatedAt: string
        }[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(`/api/barcodes/admin${qs ? `?${qs}` : ''}`, { method: 'GET' })
    },
  },

  barcodePatterns: {
    list: (params?: { q?: string; limit?: number; page?: number; activeOnly?: boolean }) => {
      const search = new URLSearchParams()
      if (params?.q?.trim()) search.set('q', params.q.trim())
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      if (params?.activeOnly === false) search.set('activeOnly', 'false')
      const qs = search.toString()
      return request<{
        patterns: BarcodePatternDto[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(`/api/barcode-patterns${qs ? `?${qs}` : ''}`, { method: 'GET' })
    },
    getOne: (id: string) =>
      request<{ pattern: BarcodePatternDto }>(`/api/barcode-patterns/${id}`, { method: 'GET' }),
    create: (payload: {
      sampleBarcode: string
      segments: BarcodePatternSegment[]
      name?: string
    }) =>
      request<{ pattern: BarcodePatternDto; extracted: Record<string, string> }>('/api/barcode-patterns', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: {
        sampleBarcode?: string
        segments?: BarcodePatternSegment[]
        name?: string
        isActive?: boolean
      }
    ) =>
      request<{ pattern: BarcodePatternDto; extracted?: Record<string, string> }>(
        `/api/barcode-patterns/${id}`,
        { method: 'PUT', body: JSON.stringify(payload) }
      ),
    remove: (id: string, opts?: { hard?: boolean }) => {
      const qs = opts?.hard ? '?hard=true' : ''
      return request<{ deleted: boolean; hard: boolean; pattern?: BarcodePatternDto; _id?: string }>(
        `/api/barcode-patterns/${id}${qs}`,
        { method: 'DELETE' }
      )
    },
    apply: (barcode: string) =>
      request<{
        barcode: string
        structureKey: string
        matched: boolean
        pattern: BarcodePatternDto | null
        extracted: Record<string, string> | null
        reason?: string
      }>('/api/barcode-patterns/apply', {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      }),
  },

  barcodeBulk: {
    list: (params?: { q?: string; status?: 'open' | 'closed' | 'all'; limit?: number; page?: number }) => {
      const search = new URLSearchParams()
      if (params?.q?.trim()) search.set('q', params.q.trim())
      if (params?.status && params.status !== 'all') search.set('status', params.status)
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      const qs = search.toString()
      return request<{
        lots: BarcodeBulkLotSummary[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(`/api/barcode-bulk${qs ? `?${qs}` : ''}`, { method: 'GET' })
    },
    create: (payload: { name: string; description?: string }) =>
      request<{ lot: BarcodeBulkLotDetail }>('/api/barcode-bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getOne: (id: string) =>
      request<{ lot: BarcodeBulkLotDetail }>(`/api/barcode-bulk/${id}`, { method: 'GET' }),
    update: (id: string, payload: { name?: string; description?: string; status?: 'open' | 'closed' }) =>
      request<{ lot: BarcodeBulkLotDetail }>(`/api/barcode-bulk/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    addScans: (
      id: string,
      payload: {
        barcode?: string
        barcodes?: string[]
        partName?: string
        partNumber?: string
        customer?: string
        supplier?: string
        serialNumber?: string
        notes?: string
      }
    ) =>
      request<{
        lot: BarcodeBulkLotSummary
        added: BarcodeBulkScanItem[]
      }>(`/api/barcode-bulk/${id}/scans`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    removeScan: (id: string, itemId: string) =>
      request<{ lot: BarcodeBulkLotSummary; deleted: boolean }>(
        `/api/barcode-bulk/${id}/scans/${itemId}`,
        { method: 'DELETE' }
      ),
    exportCsv: async (id: string) => {
      const url = `${BASE}/api/barcode-bulk/${id}/export.csv`
      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(url, { method: 'GET', headers })
      if (!res.ok) {
        let message = `Export failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (data?.error) message = data.error
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || 'bulk-lot-export.csv'
      return { blob, filename }
    },
  },

  employeeFiles: {
    list: () =>
      request<{
        files: EmployeeFileItem[]
      }>('/api/employee-files', { method: 'GET' }),

    getDownloadUrl: (id: string) =>
      request<{ url: string; expiresIn?: number; filename?: string }>(`/api/employee-files/${encodeURIComponent(id)}/download`, {
        method: 'GET',
      }),

    upload: async (file: File, opts?: { title?: string; description?: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      if (opts?.title?.trim()) formData.append('title', opts.title.trim())
      if (opts?.description?.trim()) formData.append('description', opts.description.trim())

      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${BASE}/api/employee-files`, {
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
      return data as { file: EmployeeFileItem }
    },

    remove: (id: string) =>
      request<{ success: boolean }>(`/api/employee-files/${encodeURIComponent(id)}`, {
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

    attachment: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${BASE}/api/upload/attachment`, {
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
      return data as { key: string; url: string; name: string; mime: string; size: number }
    },
  },
}
