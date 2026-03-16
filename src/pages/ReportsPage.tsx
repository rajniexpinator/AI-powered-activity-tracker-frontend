import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/AdminShell'
import { api } from '@/services/api'
import { FileText, Loader2, AlertCircle, ChevronLeft, ChevronRight, Mail, ExternalLink, Send, Save } from 'lucide-react'

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
      setMs365Configured(false)
    }
  }

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
    void loadMs365()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function loadOne(id: string) {
    setSelectedReportId(id)
    setSelectedContent('')
    setLoadingOne(true)
    setError('')
    setDraft(null)
    setEmailSubject('')
    try {
      const { report } = await api.reports.getOne(id)
      setSelectedContent(report.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoadingOne(false)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save default recipients')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send draft')
    } finally {
      setSending(false)
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

          {/* Right: email + preview */}
          <div className="grid gap-4">
            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_12px_40px_rgba(15,23,42,0.10)] overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3 bg-gradient-to-r from-[var(--color-bg)] to-white">
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
                  className="inline-flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                >
                  Refresh
                </button>
              </div>

              <div className="px-5 sm:px-6 py-4 grid gap-3">
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

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveDefaultRecipients()}
                    disabled={savingRecipients || ms365Configured === false}
                    className="inline-flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                  >
                    {savingRecipients ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save defaults
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCreateDraft()}
                    disabled={!selectedReportId || drafting || ms365Configured === false}
                    className="inline-flex items-center gap-2 h-9 rounded-lg bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                  >
                    {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Create draft
                  </button>

                  {draft?.webLink && (
                    <a
                      href={draft.webLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"
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
                      className="inline-flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_16px_45px_rgba(15,23,42,0.14)] overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-bg)] to-white">
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

              <div className="max-h-[520px] overflow-auto px-4 sm:px-5 py-4 text-[13px] text-[var(--color-text)] bg-[var(--color-bg)]">
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
          </div>
        </section>
      </main>
    </AdminShell>
  )
}

