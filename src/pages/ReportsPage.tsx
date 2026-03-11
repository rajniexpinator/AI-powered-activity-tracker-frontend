import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/AdminShell'
import { api } from '@/services/api'
import { FileText, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

type ReportListItem = {
  _id: string
  customer?: string
  userId?: string
  from?: string
  to?: string
  includeCustomerSummaries?: boolean
  activityCount?: number
  createdAt: string
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [selectedContent, setSelectedContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingOne, setLoadingOne] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    document.title = 'Reports'
    return () => {
      document.title = 'AI Activity Tracker'
    }
  }, [])

  async function loadList(nextPage = page) {
    setLoading(true)
    setError('')
    try {
      const res = await api.reports.list({ page: nextPage, limit: 20 })
      setReports(res.reports)
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

  async function loadOne(id: string) {
    setSelectedReportId(id)
    setSelectedContent('')
    setLoadingOne(true)
    setError('')
    try {
      const { report } = await api.reports.getOne(id)
      setSelectedContent(report.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoadingOne(false)
    }
  }

  const selected = reports.find((r) => r._id === selectedReportId)

  return (
    <AdminShell>
      <main className="py-2 sm:py-3">
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
            <div className="px-5 sm:px-6 md:px-8 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3 bg-gradient-to-r from-[var(--color-bg)] to-white">
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] tracking-[0.16em] uppercase">
                  History
                </p>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {reports.length} report{reports.length !== 1 ? 's' : ''} saved
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Page <span className="font-semibold text-[var(--color-text)]">{page}</span> / {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-[var(--color-border)] max-h-[520px] overflow-auto">
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
                reports.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => void loadOne(r._id)}
                    className={`w-full text-left px-5 sm:px-6 md:px-8 py-3 hover:bg-[var(--color-bg)]/60 transition-colors ${
                      selectedReportId === r._id
                        ? 'bg-[var(--color-primary)]/6 border-l-2 border-[var(--color-primary)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--color-text-secondary)] mb-0.5">
                          {r.customer ? r.customer : 'All customers'}
                        </p>
                        <p className="text-[13px] font-semibold text-[var(--color-text)]">
                          Weekly report
                          {r.includeCustomerSummaries ? ' · customer summaries' : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                          {new Date(r.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                        {r.activityCount ?? 0} logs
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: report preview */}
          <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_16px_45px_rgba(15,23,42,0.14)] p-4 sm:p-5 flex flex-col min-h-[520px]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-text-secondary)]">
                  Report preview
                </p>
                {selected && (
                  <p className="mt-1 text-[13px] text-[var(--color-text)] font-semibold truncate">
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
            </div>
            <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 sm:px-3.5 py-3 text-[13px] text-[var(--color-text)] overflow-auto">
              {loadingOne ? (
                <span className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading report…
                </span>
              ) : selectedContent ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {selectedContent}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  Select a report from the left to view the full AI-generated summary here.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </AdminShell>
  )
}

