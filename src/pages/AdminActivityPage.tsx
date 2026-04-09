import { useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types/auth'
import { AdminShell } from '@/components/layout/AdminShell'
import {
  BarChart3,
  Filter,
  Users,
  Building2,
  Calendar,
  FileText,
  AlertCircle,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Loader2,
  Trash2,
  MoreVertical,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'react-toastify'

type AdminActivity = {
  _id: string
  customer?: string
  summary?: string
  createdAt: string
  archivedAt?: string
  userId?: { _id: string; name?: string; email?: string; role?: string }
}

type ActivityAttachment = {
  url: string
  name: string
  mime?: string
  size?: number
}

type ActivityDetail = {
  _id: string
  customer?: string
  summary?: string
  rawConversation?: string
  structuredData?: { summary?: string; notes?: string } | Record<string, unknown>
  images?: string[]
  attachments?: ActivityAttachment[]
  createdAt: string
}

function formatFileSize(bytes?: number) {
  if (bytes == null || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isVideoAttachment(a: ActivityAttachment): boolean {
  const mime = (a.mime ?? '').toLowerCase()
  if (mime.startsWith('video/')) return true
  const path = `${a.name ?? ''} ${a.url ?? ''}`.toLowerCase()
  return /\.(mp4|mov|webm|m4v|ogv|ogg)(\?|#|$)/.test(path)
}

/** First & last page, … gaps, and current ± 1 between (no “show all pages when total ≤ 7”). */
function buildPaginationItems(current: number, total: number): Array<number | 'ellipsis'> {
  const safeTotal = Math.max(1, total)
  const c = Math.min(Math.max(current, 1), safeTotal)
  if (safeTotal === 1) return [1]

  const windowStart = Math.max(2, c - 1)
  const windowEnd = Math.min(safeTotal - 1, c + 1)
  const items: Array<number | 'ellipsis'> = [1]
  if (windowStart > 2) items.push('ellipsis')
  if (windowStart <= windowEnd) {
    for (let p = windowStart; p <= windowEnd; p++) items.push(p)
  }
  if (windowEnd < safeTotal - 1) items.push('ellipsis')
  items.push(safeTotal)
  return items
}

export function AdminActivityPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<{ _id: string; name: string }[]>([])

  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 5

  const [loading, setLoading] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingAiWeeklyReport, setLoadingAiWeeklyReport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingWeeklyExcel, setExportingWeeklyExcel] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [report, setReport] = useState<string>('')
  const [reportId, setReportId] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [includeCustomerSummaries, setIncludeCustomerSummaries] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [aiOverlay, setAiOverlay] = useState<{ interpretation: string; activities: AdminActivity[]; answer?: string } | null>(null)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<ActivityDetail | null>(null)
  const [loadingSelectedActivity, setLoadingSelectedActivity] = useState(false)
  const [selectedDetailError, setSelectedDetailError] = useState('')
  const [failedSelectedImages, setFailedSelectedImages] = useState<Record<string, boolean>>({})
  const [loadingSelectedImages, setLoadingSelectedImages] = useState<Record<string, boolean>>({})
  const mediaPanelRef = useRef<HTMLDivElement | null>(null)
  const requestSeq = useRef(0)
  const paginationItems = useMemo(
    () => buildPaginationItems(page, totalPages || 1),
    [page, totalPages]
  )

  const weeklyReportReady = useMemo(
    () => Boolean(report?.trim()) || Boolean(reportId),
    [report, reportId]
  )

  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [{ users }, { customers }] = await Promise.all([
          api.auth.getUsers(),
          api.customers.list(),
        ])
        const employees = users.filter((u) => u.role === 'employee')
        setUsers(employees)
        setCustomers(customers.map((c) => ({ _id: c._id, name: c.name })))
      } catch {
        // non-blocking for page
      }
    }
    void loadFilterData()
  }, [])

  const appliedFilters = useMemo(
    () => ({
      userId: selectedUserId !== 'all' ? selectedUserId : undefined,
      customer: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      from: from || undefined,
      to: to || undefined,
      limit: pageSize,
      page,
    }),
    [selectedUserId, selectedCustomer, from, to, page]
  )

  async function loadActivities() {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      if (tab === 'archived') {
        const res = await api.activities.adminArchivedList(appliedFilters)
        if (seq !== requestSeq.current) return
        setActivities(res.activities)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      } else {
        const res = await api.activities.adminList(appliedFilters)
        if (seq !== requestSeq.current) return
        setActivities(res.activities)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      }
    } catch (err) {
      if (seq !== requestSeq.current) return
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    setAiOverlay(null)
    setSelectedActivityId(null)
    setSelectedActivityDetail(null)
    setSelectedDetailError('')
    setFailedSelectedImages({})
    setLoadingSelectedImages({})
  }, [tab, selectedUserId, selectedCustomer, from, to])

  useEffect(() => {
    const urls = selectedActivityDetail?.images ?? []
    if (!urls.length) {
      setLoadingSelectedImages({})
      return
    }
    const next = urls.reduce<Record<string, boolean>>((acc, url) => {
      acc[url] = true
      return acc
    }, {})
    setLoadingSelectedImages(next)
  }, [selectedActivityDetail])

  useEffect(() => {
    void loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page])

  async function handleSelectActivity(id: string) {
    setSelectedActivityId(id)
    setLoadingSelectedActivity(true)
    setSelectedDetailError('')
    setFailedSelectedImages({})
    setLoadingSelectedImages({})
    try {
      const res = tab === 'archived' ? await api.activities.adminGetOne(id) : await api.activities.getOne(id)
      setSelectedActivityDetail(res.activity as ActivityDetail)
    } catch (err) {
      setSelectedActivityDetail(null)
      const rawMessage = err instanceof Error ? err.message : 'Failed to load selected activity'
      const normalized = rawMessage.toLowerCase()
      setSelectedDetailError(
        normalized.includes('not found') || normalized.includes('404')
          ? 'Activity not found'
          : rawMessage
      )
    } finally {
      setLoadingSelectedActivity(false)
      // On phones, jump to details/media so selected images are immediately visible.
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        requestAnimationFrame(() => {
          mediaPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }

  async function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    await loadActivities()
  }

  async function handleResetFilters() {
    setActionMenuId(null)
    setSelectedUserId('all')
    setSelectedCustomer('all')
    setFrom('')
    setTo('')
    setPage(1)
    setAiOverlay(null)
    setError('')
    const seq = ++requestSeq.current
    setLoading(true)
    try {
      if (tab === 'archived') {
        const res = await api.activities.adminArchivedList({ limit: pageSize, page: 1 })
        if (seq !== requestSeq.current) return
        setActivities(res.activities)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      } else {
        const res = await api.activities.adminList({ limit: pageSize, page: 1 })
        if (seq !== requestSeq.current) return
        setActivities(res.activities)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      }
    } catch (err) {
      if (seq !== requestSeq.current) return
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  async function handleRestore(id: string) {
    setActionMenuId(null)
    try {
      await api.activities.restore(id)
      await loadActivities()
      toast.success('Activity restored.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore')
      toast.error(err instanceof Error ? err.message : 'Failed to restore.')
    }
  }

  async function handlePermanentDelete(id: string) {
    const ok = window.confirm('Permanently delete this archived activity? This cannot be restored.')
    if (!ok) return

    setActionMenuId(null)
    setDeletingId(id)
    setError('')
    try {
      await api.activities.deleteArchived(id)
      await loadActivities()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete activity')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAiAsk() {
    const q = aiQuestion.trim()
    if (!q) {
      toast.error('Type a question first.')
      return
    }
    setAiLoading(true)
    setError('')
    try {
      const res = await api.activities.adminAiQuery({ question: q, limit: 50 })
      setAiOverlay({
        interpretation: res.interpretation || 'Here are the closest matches from your activity logs.',
        activities: res.activities as AdminActivity[],
        answer: res.answer,
      })
      toast.success(
        res.count === 0
          ? 'No matching activities found.'
          : `Found ${res.count} matching ${res.count === 1 ? 'log' : 'logs'}.`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI search failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleAiWeeklyReport() {
    const q = aiQuestion.trim()
    if (!q) {
      toast.error('Type a question first.')
      return
    }
    setLoadingAiWeeklyReport(true)
    setError('')
    try {
      const { report: nextReport, reportId } = await api.activities.adminAiWeeklyReport({
        question: q,
        limit: 200,
      })
      setReport(nextReport)
      setReportId(reportId)
      toast.success('Weekly report generated from your AI question.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate weekly report'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoadingAiWeeklyReport(false)
    }
  }

  async function handleGenerateReport() {
    setLoadingReport(true)
    setError('')
    setReport('')
    setReportId('')
    setActionMenuId(null)
    try {
      const { report, reportId } = await api.activities.generateWeeklyReport({
        ...appliedFilters,
        includeCustomerSummaries: includeCustomerSummaries && selectedCustomer === 'all',
      })
      setReport(report)
      setReportId(reportId)
      toast.success(
        'Weekly AI report is ready. Use “Download timesheet Excel” below for the spreadsheet layout — one tab per customer, same date filters.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate weekly report')
    } finally {
      setLoadingReport(false)
    }
  }

  async function handleExportCsv() {
    try {
      setExporting(true)
      setActionMenuId(null)
      const search = new URLSearchParams()
      if (appliedFilters.userId) search.set('userId', appliedFilters.userId)
      if (appliedFilters.customer) search.set('customer', appliedFilters.customer)
      if (appliedFilters.from) search.set('from', appliedFilters.from)
      if (appliedFilters.to) search.set('to', appliedFilters.to)
      if (appliedFilters.limit) search.set('limit', String(appliedFilters.limit))
      if (tab === 'archived') search.set('archived', 'true')
      const qs = search.toString()
      const base = import.meta.env.VITE_API_BASE_URL ?? ''
      const url = `${base}/api/activities/admin/export${qs ? `?${qs}` : ''}`

      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        throw new Error('Failed to export CSV')
      }
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'activities-export.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportWeeklyExcel() {
    try {
      setExportingWeeklyExcel(true)
      setActionMenuId(null)
      const search = new URLSearchParams()
      if (appliedFilters.userId) search.set('userId', appliedFilters.userId)
      if (appliedFilters.customer) search.set('customer', appliedFilters.customer)
      if (appliedFilters.from) search.set('from', appliedFilters.from)
      if (appliedFilters.to) search.set('to', appliedFilters.to)
      if (tab === 'archived') search.set('archived', 'true')
      const weekEnd =
        appliedFilters.to ||
        appliedFilters.from ||
        new Date().toISOString().slice(0, 10)
      search.set('weekEnd', weekEnd)

      const qs = search.toString()
      const base = import.meta.env.VITE_API_BASE_URL ?? ''
      const url = `${base}/api/activities/admin/export/weekly-xlsx${qs ? `?${qs}` : ''}`

      const headers: HeadersInit = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || 'Failed to export weekly Excel')
      }
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download =
        appliedFilters.from && appliedFilters.to
          ? `weekly-activity-report-${appliedFilters.from}_to_${appliedFilters.to}.xlsx`
          : `weekly-activity-report-${weekEnd}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      toast.success('Timesheet Excel downloaded (by customer).')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export weekly Excel'
      setError(msg)
      toast.error(msg)
    } finally {
      setExportingWeeklyExcel(false)
    }
  }

  useEffect(() => {
    if (!actionMenuId) return

    const onMouseDown = (e: MouseEvent) => {
      const menuEl = document.getElementById(`action-menu-${actionMenuId}`)
      const btnEl = document.getElementById(`action-menu-btn-${actionMenuId}`)
      const target = e.target as Node | null
      if (!target) return

      const clickedInside = Boolean(
        (menuEl && menuEl.contains(target)) || (btnEl && btnEl.contains(target))
      )
      if (!clickedInside) setActionMenuId(null)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [actionMenuId])

  const displayActivities = aiOverlay?.activities ?? activities

  return (
    <AdminShell>
      <main className="py-1 sm:py-0 w-full min-w-0 max-w-full overflow-x-hidden">
        <section className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-[28px] md:text-[32px] font-bold tracking-tight text-[var(--color-text)] flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                </span>
                Activity overview
              </h1>
              <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                Use filters for exact lists. Ask AI below to query logs in plain English (for example, &quot;Show me
                all Bosch issues last week&quot;). Generate weekly AI report creates a narrative from the same filters;
                the timesheet-style Excel (one tab per customer) lives in that weekly report panel. Saved reports are
                under Reports.
              </p>
            </div>
            {user && (
              <p className="text-[12px] text-[var(--color-text-secondary)] break-words max-w-full sm:max-w-xs md:max-w-none">
                Signed in as <span className="font-medium break-all">{user.email}</span>
              </p>
            )}
          </div>
        </section>

        {/* Filters + report CTA */}
        <section className="mb-5 rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-3 sm:p-5 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mb-2 sm:mb-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text)] self-start"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary)]/8 text-[var(--color-primary)]">
                <Filter className="w-3.5 h-3.5" />
              </span>
              <span>Filters</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--color-text-secondary)] transition-transform ${
                  filtersOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
              <label className="inline-flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] select-none sm:items-center">
                <input
                  type="checkbox"
                  className="mt-0.5 sm:mt-0 shrink-0"
                  checked={includeCustomerSummaries}
                  onChange={(e) => setIncludeCustomerSummaries(e.target.checked)}
                  disabled={selectedCustomer !== 'all'}
                />
                <span className="leading-snug">
                  Customer summaries
                  {selectedCustomer !== 'all' && (
                    <span className="block text-[11px] opacity-70 sm:inline sm:ml-1">
                      (select “All customers” to enable)
                    </span>
                  )}
                </span>
              </label>
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto sm:flex-none">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting || exportingWeeklyExcel}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Export CSV
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={loadingReport}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3.5 py-2.5 sm:py-2 text-[12px] sm:text-[13px] font-semibold !text-white disabled:opacity-60 text-center"
              >
                <FileText className="w-4 h-4 shrink-0" />
                {loadingReport ? 'Generating report…' : 'Generate weekly AI report'}
              </button>
              </div>
            </div>
          </div>
          {filtersOpen && (
            <form
              onSubmit={handleApplyFilters}
              className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4 items-end"
            >
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  Employee
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  >
                    <option value="all">All employees</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  Customer
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  >
                    <option value="all">All customers</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  From date
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" />
                  </span> 
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  To date
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 md:col-span-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleResetFilters()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset filters
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3.5 py-2 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Apply filters'
                  )}
                </button>
              </div>
            </form>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/[0.06] to-[var(--color-bg)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                <Sparkles className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Ask AI about activity</h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  Type a question in plain English. The assistant maps it to customer names, dates, and keywords,
                  then searches your database. This is different from the weekly report, which writes one long
                  narrative from the filtered table.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="sr-only" htmlFor="admin-ai-question">
                    Question
                  </label>
                  <textarea
                    id="admin-ai-question"
                    rows={2}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder='Example: Show me all Bosch issues last week'
                    className="w-full flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAiAsk()}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold !text-white shadow-sm hover:opacity-95 disabled:opacity-50 sm:shrink-0"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Search with AI
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAiWeeklyReport()}
                    disabled={loadingAiWeeklyReport || !aiOverlay}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[var(--color-primary)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-60 disabled:cursor-not-allowed sm:shrink-0"
                    title="Generate a supplier-style weekly report from the same AI question"
                  >
                    {loadingAiWeeklyReport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Generate report
                      </>
                    )}
                  </button>
                </div>
             
              </div>
            </div>
          </div>
        </section>

        {/* Activity table + weekly report */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)] min-w-0">
          {/* Activity table */}
          <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] min-w-0">
            <div className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 border-b border-[var(--color-border)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
                <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                  {tab === 'archived' ? 'Archived activity' : 'All employee activity'}
                </h2>
              </div>
              <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto sm:items-end sm:flex-row sm:items-center sm:gap-3">
                <div className="flex rounded-xl border border-[var(--color-border)] p-0.5 bg-[var(--color-bg)] w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1)
                      setTab('active')
                    }}
                    className={`flex flex-1 sm:flex-initial justify-center items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      tab === 'active'
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-text)]'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1)
                      setTab('archived')
                    }}
                    className={`flex flex-1 sm:flex-initial justify-center items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      tab === 'archived'
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5 shrink-0" />
                    Archived
                  </button>
                </div>
              </div>
            </div>

            {aiOverlay && (
              <div className="px-3 sm:px-6 md:px-8 py-3 border-b border-[var(--color-border)] bg-[var(--color-primary)]/8 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <p className="text-[12px] text-[var(--color-text)] pr-1">
                    <span className="font-semibold text-[var(--color-primary)]">AI search: </span>
                    {aiOverlay.interpretation}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiOverlay(null)}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] shrink-0"
                  >
                    Back to filtered list
                  </button>
                </div>

                {aiOverlay.answer && (
                  <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-white/60 px-3 py-2 text-[12px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-auto">
                    {aiOverlay.answer}
                  </div>
                )}
              </div>
            )}

            <div
              className={`hidden md:grid px-3 sm:px-6 md:px-8 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)] bg-[var(--color-bg)] ${
                tab === 'archived'
                  ? 'grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,110px)]'
                  : 'grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2.2fr)]'
              }`}
            >
              <span>Employee</span>
              <span>Customer</span>
              <span>Date</span>
              <span>Summary</span>
              {tab === 'archived' && <span className="text-right">Action</span>}
            </div>

            <div className="relative divide-y divide-[var(--color-border)] max-h-[min(480px,70vh)] sm:max-h-[480px] overflow-y-auto overflow-x-hidden md:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              {loading && activities.length > 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-text)] shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                    Loading activity…
                  </div>
                </div>
              )}
              {loading && displayActivities.length === 0 ? (
                <div className="px-3 sm:px-6 md:px-8 py-6 text-[13px] text-[var(--color-text-secondary)]">
                  Loading activity…
                </div>
              ) : displayActivities.length === 0 ? (
                <div className="px-3 sm:px-6 md:px-8 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
                  {aiOverlay
                    ? 'No activities matched this question. Try broader wording or a different time range.'
                    : 'No activity found for the selected filters.'}
                </div>
              ) : (
                displayActivities.map((a, idx) => {
                  const openMenuUp = idx >= displayActivities.length - 2
                  return (
                  <div
                    key={a._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleSelectActivity(a._id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        void handleSelectActivity(a._id)
                      }
                    }}
                    className={`px-3 sm:px-6 md:px-8 py-3.5 flex flex-col gap-2 min-w-0 md:grid md:items-center md:gap-x-0 md:gap-y-2 cursor-pointer transition-colors ${
                      tab === 'archived'
                        ? 'md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,110px)]'
                        : 'md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2.2fr)]'
                    } ${
                      selectedActivityId === a._id
                        ? 'bg-[var(--color-primary)]/8'
                        : 'hover:bg-[var(--color-primary)]/4'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[12px] font-semibold">
                        {(a.userId?.name || a.userId?.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--color-text)] break-words md:truncate">
                          {a.userId?.name || a.userId?.email || 'Unknown user'}
                        </p>
                        {a.userId?.email && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] truncate md:hidden">
                            {a.userId.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] md:truncate break-words">
                      <span className="font-semibold text-[var(--color-text)] md:hidden">Customer: </span>
                      {a.customer || '—'}
                    </p>
                    <p className="text-[11px] sm:text-[12px] text-[var(--color-text-secondary)] break-words">
                      <span className="font-semibold text-[var(--color-text)] md:hidden">Date: </span>
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                    <p
                      className="text-[13px] text-[var(--color-text)] overflow-hidden break-words"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      <span className="font-semibold md:hidden">Summary: </span>
                      {a.summary || 'No summary'}
                    </p>
                    {tab === 'archived' && (
                      <div className="flex justify-end pt-1 md:pt-0 border-t border-[var(--color-border)]/60 md:border-0 mt-1 md:mt-0">
                        <div className="relative">
                          <button
                            id={`action-menu-btn-${a._id}`}
                            type="button"
                            onClick={() => setActionMenuId((cur) => (cur === a._id ? null : a._id))}
                            disabled={deletingId !== null}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white hover:bg-[var(--color-bg)] disabled:opacity-60"
                            aria-haspopup="menu"
                            aria-expanded={actionMenuId === a._id}
                            title="Actions"
                          >
                            <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          </button>

                          {actionMenuId === a._id && (
                            <div
                              id={`action-menu-${a._id}`}
                              className={`absolute right-0 z-50 w-36 rounded-xl border border-[var(--color-border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14)] overflow-hidden ${
                                openMenuUp ? 'bottom-full mb-2' : 'top-full mt-2'
                              }`}
                              role="menu"
                            >
                              <button
                                type="button"
                                onClick={() => handleRestore(a._id)}
                                disabled={deletingId !== null}
                                className="w-full px-3 py-2 flex items-center gap-2 text-left text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-60"
                                role="menuitem"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePermanentDelete(a._id)}
                                disabled={deletingId === a._id || deletingId !== null}
                                className="w-full px-3 py-2 flex items-center gap-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                role="menuitem"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )})
              )}
            </div>
            {!aiOverlay && (totalPages || 1) > 1 && (
              <div className="px-3 sm:px-6 md:px-8 py-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 min-w-0">
                <p className="text-[12px] text-[var(--color-text-secondary)] order-2 sm:order-1">
                  Page {page} of {totalPages || 1} ({total} total)
                </p>
                <div className="order-1 sm:order-2 w-full sm:w-auto min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4 sm:hidden" aria-hidden />
                    <span className="hidden sm:inline">First</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  {paginationItems.map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="inline-flex min-w-8 items-center justify-center px-1 text-[12px] font-medium text-[var(--color-text-secondary)] select-none"
                        aria-hidden
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        disabled={loading}
                        className={`inline-flex items-center justify-center min-w-9 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
                          item === page
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                        }`}
                        aria-current={item === page ? 'page' : undefined}
                      >
                        {item}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                    disabled={page >= (totalPages || 1) || loading}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages || 1)}
                    disabled={page >= (totalPages || 1) || loading}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <span className="hidden sm:inline">Last</span>
                    <ChevronsRight className="w-4 h-4 sm:hidden" aria-hidden />
                  </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <div
              ref={mediaPanelRef}
              className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-4 sm:p-5 min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--color-primary)]" />
                  Activity details & media
                </h2>
              </div>
              {!selectedActivityId ? (
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  Click any activity on the left to preview related images and files.
                </p>
              ) : loadingSelectedActivity ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                    Loading selected activity...
                  </p>
                </div>
              ) : !selectedActivityDetail ? (
                <p className="text-[12px] text-red-600">{selectedDetailError || 'Unable to load details.'}</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                    <p className="text-[12px] text-[var(--color-text)] font-medium">
                      {selectedActivityDetail.summary ||
                        (selectedActivityDetail.structuredData as { summary?: string } | undefined)?.summary ||
                        'No summary'}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                      {new Date(selectedActivityDetail.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {selectedActivityDetail.images?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedActivityDetail.images.map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative block rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]"
                          title={`Open image ${idx + 1}`}
                        >
                          {!failedSelectedImages[url] ? (
                            <>
                              <img
                                src={url}
                                alt={`Activity image ${idx + 1}`}
                                className={`h-28 sm:h-20 w-full object-cover transition-opacity duration-300 ${
                                  loadingSelectedImages[url] ? 'opacity-0' : 'opacity-100'
                                }`}
                                onLoad={() => setLoadingSelectedImages((prev) => ({ ...prev, [url]: false }))}
                                onError={() => {
                                  setFailedSelectedImages((prev) => ({ ...prev, [url]: true }))
                                  setLoadingSelectedImages((prev) => ({ ...prev, [url]: false }))
                                }}
                              />
                              {loadingSelectedImages[url] && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100/90">
                                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                                  <span className="text-[10px] text-[var(--color-text-secondary)]">Loading image...</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-28 sm:h-20 w-full flex items-center justify-center text-[10px] text-red-600 px-2 text-center bg-[var(--color-bg)]">
                              Image load failed
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--color-text-secondary)]">No image attached.</p>
                  )}

                  {selectedActivityDetail.attachments?.length ? (
                    <div className="space-y-1.5">
                      {selectedActivityDetail.attachments.map((a, idx) => (
                        <a
                          key={`${a.url}-${idx}`}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-[11px] hover:bg-black/[0.02]"
                          title={a.name}
                        >
                          <span className="truncate max-w-[75%]">
                            {isVideoAttachment(a) ? 'Video: ' : 'File: '}
                            {a.name}
                          </span>
                          <span className="text-[#999]">{formatFileSize(a.size)}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--color-text-secondary)]">No files or videos attached.</p>
                  )}
                </div>
              )}
            </div>

            {/* Weekly AI report + matching timesheet Excel */}
            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2 min-w-0">
                <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 shrink-0 text-[var(--color-primary)]" />
                  Weekly quality report
                </h2>
                <button
                  type="button"
                  onClick={() => void handleExportWeeklyExcel()}
                  disabled={exporting || exportingWeeklyExcel || loadingReport || !weeklyReportReady}
                  title={
                    weeklyReportReady
                      ? 'Same filters as the AI report you just generated. With From and To set, each customer tab includes every week in that range.'
                      : 'Generate weekly AI report first (button in the filters bar above). Then download the matching timesheet Excel for the All employee activity data.'
                  }
                  className="inline-flex w-full sm:w-auto sm:shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3 py-2 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-60"
                >
                  {exportingWeeklyExcel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading…
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Download timesheet Excel
                    </>
                  )}
                </button>
              </div>
              {!weeklyReportReady && !loadingReport && (
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-2 sm:text-right">
                  Generate the weekly AI report first — then this button unlocks for the same filters as All employee
                  activity.
                </p>
              )}
              <p className="text-[12px] text-[var(--color-text-secondary)] mb-3 leading-relaxed">
                <span className="font-medium text-[var(--color-text)]">AI narrative</span> — click Generate weekly AI
                report above (uses current filters).{' '}
                <span className="font-medium text-[var(--color-text)]">Spreadsheet layout</span> — after the report is
                generated, download here for an Excel file <span className="font-medium">broken down by customer</span>{' '}
                (one worksheet per customer): day, date, part, concern ID, activity text, hours when captured — same
                From/To range as the AI report. For ad-hoc questions, use Ask AI above; send narratives from the Reports
                page.
              </p>
              {reportId && (
                <p className="mb-2 text-[11px] text-[var(--color-text-secondary)]">
                  Saved to reports history.
                </p>
              )}
              <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3 text-[13px] text-[var(--color-text)] overflow-auto whitespace-pre-wrap">
                {loadingReport && !report
                  ? 'Generating weekly report…'
                  : report || 'Click "Generate weekly AI report" above to create a summary.'}
              </div>
            </div>
          </div>
        </section>
      </main>
    </AdminShell>
  )
}

