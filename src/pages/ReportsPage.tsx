import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from '@/components/layout/AdminShell'
import { ReportImageGallery } from '@/components/ReportImageGallery'
import { api } from '@/services/api'
import { FileText, Loader2, AlertCircle, ChevronLeft, ChevronRight, Mail, ExternalLink, Send, Save, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'

type ReportListItem = {
  _id: string
  customer?: string
  userId?: string
  from?: string
  to?: string
  includeCustomerSummaries?: boolean
  issueSeverityExact?: number
  issueSeverityMin?: number
  activityCount?: number
  createdAt: string
}

function formatReportSeverityLabel(r: ReportListItem): string | null {
  if (typeof r.issueSeverityExact === 'number' && r.issueSeverityExact >= 0 && r.issueSeverityExact <= 3) {
    const word =
      r.issueSeverityExact === 3 ? 'High' : r.issueSeverityExact === 2 ? 'Medium' : r.issueSeverityExact === 1 ? 'Low' : 'All good'
    return `Severity ${r.issueSeverityExact} (${word})`
  }
  if (typeof r.issueSeverityMin === 'number' && r.issueSeverityMin >= 0 && r.issueSeverityMin <= 3) {
    return r.issueSeverityMin === 2 ? 'Severity 2–3' : r.issueSeverityMin === 0 ? 'Severity 0–3' : `Severity ≥ ${r.issueSeverityMin}`
  }
  return null
}

export function ReportsPage() {
  const PAGE_SIZE = 4
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [selectedContent, setSelectedContent] = useState<string>('')
  const [selectedImageGallery, setSelectedImageGallery] = useState<
    {
      activityId?: string
      customer?: string
      summary?: string
      createdAt?: string
      imageUrls?: string[]
    }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [loadingOne, setLoadingOne] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [ms365Configured, setMs365Configured] = useState<boolean | null>(null)
  const [recipientsTo, setRecipientsTo] = useState<string>('')
  const [recipientsCc, setRecipientsCc] = useState<string>('')
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<{ id: string; webLink?: string; subject?: string } | null>(null)
  const [emailSubject, setEmailSubject] = useState<string>('')
  const [emailBodyText, setEmailBodyText] = useState<string>(
    'Please see attached report. Let us know if you have any questions.'
  )

  useEffect(() => {
    document.title = 'Reports'
    return () => {
      document.title = 'AI Activity Tracker'
    }
  }, [])

  function parseEmails(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function loadMs365() {
    setError('')
    try {
      const [{ configured }, recipientsRes] = await Promise.all([api.ms365.status(), api.ms365.getDefaultRecipients()])
      setMs365Configured(Boolean(configured))
      setRecipientsTo((recipientsRes.recipients.to || []).join(', '))
      setRecipientsCc((recipientsRes.recipients.cc || []).join(', '))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh Microsoft 365 settings'
      setError(msg)
      setMs365Configured(false)
      toast.error(msg)
    }
  }

  async function loadList(nextPage = page) {
    setLoading(true)
    setError('')
    try {
      const res = await api.reports.list({ page: nextPage, limit: PAGE_SIZE })
      setReports(res.reports)
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void loadMs365()
  }, [])

  async function loadOne(id: string) {
    setSelectedReportId(id)
    setSelectedContent('')
    setSelectedImageGallery([])
    setLoadingOne(true)
    setError('')
    setDraft(null)
    setEmailSubject('')
    try {
      const { report } = await api.reports.getOne(id)
      setSelectedContent(report.content)
      setSelectedImageGallery(Array.isArray(report.imageGallery) ? report.imageGallery : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoadingOne(false)
    }
  }

  async function handleDeleteReport(id: string) {
    const ok = window.confirm('Are you sure you want to delete this report? This action cannot be undone.')
    if (!ok) return
    setError('')
    try {
      await api.reports.deleteOne(id)
      const nextPage = reports.length === 1 && page > 1 ? page - 1 : page
      if (selectedReportId === id) {
        setSelectedReportId('')
        setSelectedContent('')
        setSelectedImageGallery([])
        setDraft(null)
        setEmailSubject('')
      }
      setPage(nextPage)
      await loadList(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report')
    }
  }

  async function handleClearHistory() {
    setError('')
    try {
      await api.reports.clearMine()
      setReports([])
      setSelectedReportId('')
      setSelectedContent('')
      setSelectedImageGallery([])
      setDraft(null)
      setEmailSubject('')
      setPage(1)
      setTotal(0)
      setTotalPages(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history')
    }
  }

  async function handleSaveDefaultRecipients() {
    setSavingRecipients(true)
    setError('')
    try {
      const to = parseEmails(recipientsTo)
      const cc = parseEmails(recipientsCc)
      const res = await api.ms365.setDefaultRecipients({ to, cc })
      setRecipientsTo((res.recipients.to || []).join(', '))
      setRecipientsCc((res.recipients.cc || []).join(', '))
      toast.success('Default recipients saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save default recipients'
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingRecipients(false)
    }
  }

  async function handleCreateDraft() {
    if (!selectedReportId) return
    setDrafting(true)
    setError('')
    setDraft(null)
    try {
      const to = parseEmails(recipientsTo)
      const cc = parseEmails(recipientsCc)

      const res = await api.ms365.createWeeklyReportDraft({
        reportId: selectedReportId,
        to: to.length ? to : undefined,
        cc: cc.length ? cc : undefined,
        subject: emailSubject?.trim() ? emailSubject.trim() : undefined,
        bodyText: emailBodyText?.trim() ? emailBodyText.trim() : undefined,
      })
      setDraft(res.draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Outlook draft')
    } finally {
      setDrafting(false)
    }
  }

  async function handleSendDraft() {
    if (!draft?.id) return
    setSending(true)
    setError('')
    try {
      await api.ms365.sendDraft(draft.id)
      toast.success('Email sent successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send email'
      setError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const selected = useMemo(() => reports.find((r) => r._id === selectedReportId), [reports, selectedReportId])
  const pageNumbers = useMemo(() => {
    const maxButtons = 5
    const safeTotal = Math.max(1, totalPages || 1)
    const safePage = Math.min(Math.max(page, 1), safeTotal)
    const half = Math.floor(maxButtons / 2)
    let start = Math.max(1, safePage - half)
    let end = Math.min(safeTotal, start + maxButtons - 1)
    start = Math.max(1, end - maxButtons + 1)
    const nums: number[] = []
    for (let p = start; p <= end; p++) nums.push(p)
    return nums
  }, [page, totalPages])

  return (
    <AdminShell>
      <main className="py-2 sm:py-3 px-1 sm:px-0">
        <section className="mb-5 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-[26px] md:text-[30px] font-bold tracking-tight text-[var(--color-text)]">
                  Reports
                </h1>
                <p className="mt-1.5 text-[13px] sm:text-[14px] text-[var(--color-text-secondary)] max-w-xl">
                  Review and reuse AI-generated weekly quality reports across customers and plants.
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="grid gap-4 xl:gap-5 lg:grid-cols-[minmax(0,_0.9fr)_minmax(0,_1.1fr)] items-start">
          {/* Left: history list */}
          <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_12px_40px_rgba(15,23,42,0.10)] overflow-hidden">
            <div className="px-4 sm:px-6 md:px-8 py-3.5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-[var(--color-bg)] to-white">
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] tracking-[0.16em] uppercase">
                  History
                </p>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    <>
                      {total} total · page {page} of {totalPages || 1}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => void handleClearHistory()}
                  disabled={loading || reports.length === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 shadow-sm"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[min(58dvh,520px)] sm:max-h-[520px] overflow-auto bg-[var(--color-bg)]/40 sm:bg-transparent px-2.5 py-2 sm:p-0 sm:divide-y sm:divide-[var(--color-border)]">
              {loading ? (
                <div className="px-5 sm:px-6 md:px-8 py-6 text-[13px] text-[var(--color-text-secondary)] inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading reports…
                </div>
              ) : reports.length === 0 ? (
                <div className="px-5 sm:px-6 md:px-8 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
                  No reports yet. Generate one from the Activity page.
                </div>
              ) : (
                reports.map((r) => {
                  const sevLabel = formatReportSeverityLabel(r)
                  return (
                  <div
                    key={r._id}
                    className={`group w-full px-3.5 sm:px-6 md:px-8 py-3 sm:py-3.5 transition-colors rounded-2xl sm:rounded-none border sm:border-0 shadow-[0_8px_22px_rgba(15,23,42,0.08)] sm:shadow-none mb-2.5 sm:mb-0 ${
                      selectedReportId === r._id
                        ? 'bg-[var(--color-primary)]/8 border-[var(--color-primary)]/35 sm:border-l-2 sm:border-[var(--color-primary)]'
                        : 'bg-white border-[var(--color-border)] hover:bg-[var(--color-bg)]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => void loadOne(r._id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--color-text-secondary)] mb-0.5">
                          {r.customer ? r.customer : 'All customers'}
                        </p>
                        <p className="text-[13px] font-semibold text-[var(--color-text)] leading-snug">
                          Weekly report
                          {r.includeCustomerSummaries ? ' · customer summaries' : ''}
                          {sevLabel ? ` · ${sevLabel}` : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                          {new Date(r.createdAt).toLocaleString()}
                        </p>
                      </button>

                      <div className="shrink-0 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                          {r.activityCount ?? 0} logs
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteReport(r._id)}
                          className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-50 p-2 text-red-700 shadow-sm hover:bg-red-600 hover:text-white hover:border-red-700"
                          title="Delete report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 md:px-8 py-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                    title="First page"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      disabled={loading}
                      className={`inline-flex items-center justify-center min-w-9 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                        p === page
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                      }`}
                      aria-current={p === page ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages || loading}
                    className="inline-flex items-center rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                    title="Last page"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: email + preview */}
          <div className="grid gap-4 min-w-0">
            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_12px_40px_rgba(15,23,42,0.10)] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-[var(--color-bg)] to-white">
                <div className="inline-flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0">
                    <Mail className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-text-secondary)]">
                      Email
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-[var(--color-text)] truncate">
                      Outlook draft
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                      {ms365Configured === false
                        ? 'Microsoft 365 is not configured on the server.'
                        : 'Create a draft, review in Outlook, then send.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadMs365()}
                  className="inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] w-full sm:w-auto"
                >
                  Refresh
                </button>
              </div>

              <div className="px-4 sm:px-6 py-4 grid gap-3">
                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
                    To
                  </label>
                  <input
                    value={recipientsTo}
                    onChange={(e) => setRecipientsTo(e.target.value)}
                    placeholder="supplier@company.com, team@company.com"
                    className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
                    Cc
                  </label>
                  <input
                    value={recipientsCc}
                    onChange={(e) => setRecipientsCc(e.target.value)}
                    placeholder="info@apexquality.net"
                    className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  Default To/Cc are merged with the matching customer&apos;s email when employees send a single AI log
                  from the Log with AI screen (and used for report emails when recipients are not overridden).
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
                      Subject
                    </label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Weekly quality report"
                      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
                      Body
                    </label>
                    <input
                      value={emailBodyText}
                      onChange={(e) => setEmailBodyText(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveDefaultRecipients()}
                    disabled={savingRecipients || ms365Configured === false}
                    className="inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 w-full sm:w-auto"
                  >
                    {savingRecipients ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save defaults
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCreateDraft()}
                    disabled={!selectedReportId || drafting || ms365Configured === false}
                    className="inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 w-full sm:w-auto"
                  >
                    {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Create draft
                  </button>

                  {draft?.webLink && (
                    <a
                      href={draft.webLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] w-full sm:w-auto"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open draft
                    </a>
                  )}

                  {draft?.id && (
                    <button
                      type="button"
                      onClick={() => void handleSendDraft()}
                      disabled={sending || ms365Configured === false}
                      className="inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 w-full sm:w-auto"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_16px_45px_rgba(15,23,42,0.14)] overflow-hidden min-w-0">
              <div className="px-4 sm:px-6 py-4 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-bg)] to-white">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-text-secondary)]">
                  Report preview
                </p>
                {selected && (
                  <p className="mt-1 text-[13px] text-[var(--color-text)] font-semibold break-words">
                    Weekly report · {selected.customer ? selected.customer : 'All customers'}
                  </p>
                )}
                {selected && (
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    {new Date(selected.createdAt).toLocaleString()} · {selected.activityCount ?? 0} logs
                    {selected.includeCustomerSummaries ? ' · customer summaries' : ''}
                  </p>
                )}
              </div>

              <div className="max-h-[min(62dvh,520px)] sm:max-h-[520px] overflow-auto px-4 sm:px-5 py-4 text-[13px] text-[var(--color-text)] bg-[var(--color-bg)]">
                {loadingOne ? (
                  <span className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading report…
                  </span>
                ) : selectedContent ? (
                  <div>
                    <div className="whitespace-pre-wrap leading-relaxed">{selectedContent}</div>
                    <ReportImageGallery entries={selectedImageGallery} />
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    Select a report from the left to view the full AI-generated summary here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </AdminShell>
  )
}

