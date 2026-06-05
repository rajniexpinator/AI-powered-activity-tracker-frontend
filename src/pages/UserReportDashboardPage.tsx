import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/AdminShell'
import { ReportImageGallery } from '@/components/ReportImageGallery'
import { ReportActionMenu } from '@/components/reports/ReportActionMenu'
import { ReportChangeModal, type ReportChangeValues } from '@/components/reports/ReportChangeModal'
import { AddToDashboardModal } from '@/components/reports/AddToDashboardModal'
import { api } from '@/services/api'
import { getToken } from '@/services/api'
import { dateOnlyOverridePayload } from '@/lib/reportOverrides'
import { downloadBlob, sharePdfBlob, validatePdfBlob } from '@/lib/shareReport'
import {
  LayoutDashboard,
  Loader2,
  AlertCircle,
  Trash2,
  Share2,
  Download,
  X,
  Sparkles,
} from 'lucide-react'
import { toast } from 'react-toastify'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

type DashboardItem = {
  _id: string
  displayName: string
  customer?: string
  dateMode?: 'fixed' | 'today'
  period?: string
  aiQuestion?: string
  from?: string
  to?: string
  createdAt: string
}

function toDateInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function changeValuesFromItem(item: DashboardItem): ReportChangeValues {
  return {
    customer: item.customer || '',
    from: toDateInput(item.from),
    to: toDateInput(item.to),
    period: item.period || (item.dateMode === 'today' ? 'today' : ''),
    dateMode: item.dateMode === 'today' ? 'today' : 'fixed',
    severity: '',
    minSeverity: '',
    aiQuestion: item.aiQuestion || '',
  }
}

async function fetchDashboardPdfBlob(
  dashboardId: string,
  overrides?: Record<string, unknown>
): Promise<{ blob: Blob; filename: string }> {
  const base = API_BASE.replace(/\/$/, '')
  const url = `${base}/api/report-dashboard/${encodeURIComponent(dashboardId)}/pdf`
  const token = getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(overrides || {}) })
  if (!res.ok) {
    let message = `Failed to load PDF (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (typeof data?.error === 'string') message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  await validatePdfBlob(blob)
  return { blob, filename: `my-report-${dashboardId.slice(-6)}.pdf` }
}

export function UserReportDashboardPage() {
  const [items, setItems] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [creating, setCreating] = useState(false)

  const [actionItem, setActionItem] = useState<DashboardItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewGallery, setPreviewGallery] = useState<
    { activityId?: string; customer?: string; summary?: string; createdAt?: string; imageUrls?: string[] }[]
  >([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, unknown>>({})
  const [previewItemId, setPreviewItemId] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [sharingPdf, setSharingPdf] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [changeOpen, setChangeOpen] = useState(false)
  const [changeTargetId, setChangeTargetId] = useState('')
  const [changeValues, setChangeValues] = useState<ReportChangeValues | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [showSaveNewPrompt, setShowSaveNewPrompt] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.reportDashboard.list()
      setItems(res.items as DashboardItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'My reports'
    void loadList()
    return () => {
      document.title = 'AI Activity Tracker'
    }
  }, [loadList])

  async function runPreview(item: DashboardItem, overrides?: Record<string, unknown>) {
    setPreviewLoading(true)
    setError('')
    try {
      const res = await api.reportDashboard.preview(item._id, overrides as Parameters<typeof api.reportDashboard.preview>[1])
      setPreviewContent(res.content)
      setPreviewGallery(Array.isArray(res.imageGallery) ? res.imageGallery : [])
      setPreviewOverrides(overrides || {})
      setPreviewTitle(res.displayName || item.displayName)
      setPreviewItemId(item._id)
      if (!overrides || Object.keys(overrides).length === 0) setShowSaveNewPrompt(false)
      setPreviewOpen(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to run report'
      setError(msg)
      toast.error(msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    const question = newQuestion.trim()
    if (!name || !question) return
    setCreating(true)
    setError('')
    try {
      await api.reportDashboard.createFromAi({ displayName: name, aiQuestion: question })
      setNewName('')
      setNewQuestion('')
      await loadList()
      toast.success('Report has been added to your dashboard.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create report'
      setError(msg)
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this report from your dashboard?')) return
    try {
      await api.reportDashboard.remove(id)
      if (actionItem?._id === id) setActionItem(null)
      await loadList()
      toast.success('Report removed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  return (
    <AdminShell>
      <main className="py-2 sm:py-3 px-1 sm:px-0">
        <section className="mb-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">My reports</h1>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                Simple reports for one customer — e.g. &quot;Inoac issues from today&quot;. Most use today automatically.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--color-text)]">Create a report with AI</h2>
              <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                Describe what you need and give it a name. Include a customer (e.g. Inoac).
              </p>
            </div>
          </div>
          <form className="space-y-3" onSubmit={(e) => void handleCreate(e)}>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Report name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Inoac issues from today"
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px]"
                disabled={creating}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                AI question
              </label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
                placeholder="e.g. Show me all Inoac issues from today"
                className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-[13px] resize-y"
                disabled={creating}
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newName.trim() || !newQuestion.trim()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[var(--color-primary)] text-white text-[13px] font-semibold disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Create report
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_12px_40px_rgba(15,23,42,0.10)] overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-center text-[13px] text-[var(--color-text-secondary)]">
              No reports yet. Create one above with AI.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {items.map((item) => (
                <li key={item._id} className="px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setActionItem(item)} className="min-w-0 flex-1 text-left">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">{item.displayName}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                      {item.customer || 'Customer'}
                      {item.dateMode === 'today' ? ' · uses today when run' : ''}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--color-primary)]">Tap for options</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item._id)}
                    className="shrink-0 rounded-xl border border-red-300 bg-red-50 p-2 text-red-700 hover:bg-red-600 hover:text-white"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ReportActionMenu
          open={Boolean(actionItem)}
          employeeMode
          title={actionItem?.displayName || 'Report'}
          subtitle={actionItem?.customer || undefined}
          onClose={() => setActionItem(null)}
          onPreview={() => {
            if (!actionItem) return
            const item = actionItem
            setActionItem(null)
            void runPreview(item)
          }}
          onAddToDashboard={() => {}}
          onChangeReport={() => {
            if (!actionItem) return
            setChangeTargetId(actionItem._id)
            setChangeValues(changeValuesFromItem(actionItem))
            setActionItem(null)
            setChangeOpen(true)
          }}
        />

        <ReportChangeModal
          open={changeOpen && Boolean(changeValues)}
          datesOnly
          title={items.find((i) => i._id === changeTargetId)?.displayName || 'Report'}
          initial={changeValues || changeValuesFromItem({} as DashboardItem)}
          saving={regenerating}
          onClose={() => {
            setChangeOpen(false)
            setChangeTargetId('')
          }}
          onApply={async (values) => {
            const id = changeTargetId
            const item = items.find((i) => i._id === id)
            if (!id || !item) return
            setRegenerating(true)
            try {
              const payload = dateOnlyOverridePayload(values)
              setPreviewOverrides(payload)
              setShowSaveNewPrompt(true)
              setChangeOpen(false)
              setChangeTargetId('')
              await runPreview(item, payload)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to preview')
            } finally {
              setRegenerating(false)
            }
          }}
        />

        <AddToDashboardModal
          open={saveAsNewOpen}
          reportTitle={items.find((i) => i._id === previewItemId)?.displayName || 'Report'}
          saving={savingNew}
          onClose={() => setSaveAsNewOpen(false)}
          onSave={async (displayName) => {
            if (!previewItemId) return
            setSavingNew(true)
            try {
              await api.reportDashboard.duplicate(previewItemId, {
                displayName,
                ...previewOverrides,
              } as Parameters<typeof api.reportDashboard.duplicate>[1])
              setSaveAsNewOpen(false)
              setShowSaveNewPrompt(false)
              await loadList()
              toast.success('Report has been added to your dashboard.')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to save')
            } finally {
              setSavingNew(false)
            }
          }}
        />

        {previewOpen && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="w-full sm:max-w-2xl max-h-[92dvh] rounded-t-2xl sm:rounded-2xl bg-white border shadow-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-4 border-b flex justify-between items-start">
                <p className="font-semibold text-[var(--color-text)]">{previewTitle}</p>
                <button type="button" onClick={() => { setPreviewOpen(false); setShowSaveNewPrompt(false) }} className="p-2 border rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[var(--color-bg)] text-[13px]">
                {previewLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <div className="whitespace-pre-wrap leading-relaxed">{previewContent}</div>
                    <ReportImageGallery entries={previewGallery} />
                  </>
                )}
              </div>
              <div className="p-3 border-t flex flex-col gap-2">
                {showSaveNewPrompt && (
                  <div className="w-full rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2.5 text-[12px]">
                    <p className="font-semibold text-[var(--color-text)]">Save new report to dashboard?</p>
                    <p className="mt-0.5 text-[var(--color-text-secondary)]">Your original saved report was not changed.</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setSaveAsNewOpen(true)} className="h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white text-[12px] font-semibold">
                        Yes, name it
                      </button>
                      <button type="button" onClick={() => setShowSaveNewPrompt(false)} className="h-8 px-3 rounded-lg border text-[12px] font-semibold">
                        No thanks
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={sharingPdf || !previewItemId}
                    onClick={async () => {
                      if (!previewItemId) return
                      setSharingPdf(true)
                      try {
                        const { blob, filename } = await fetchDashboardPdfBlob(previewItemId, previewOverrides)
                        const result = await sharePdfBlob(blob, filename, previewTitle)
                        toast.success(
                          result.mode === 'native'
                            ? 'Share sheet opened.'
                            : 'Report opened in a new tab.'
                        )
                      } catch (err) {
                        if (err instanceof DOMException && err.name === 'AbortError') return
                        toast.error(err instanceof Error ? err.message : 'Share failed')
                      } finally {
                        setSharingPdf(false)
                      }
                    }}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--color-primary)] text-white text-[12px] font-semibold"
                  >
                    {sharingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    Share
                  </button>
                  <button
                    type="button"
                    disabled={downloadingPdf || !previewItemId}
                    onClick={async () => {
                      if (!previewItemId) return
                      setDownloadingPdf(true)
                      try {
                        const { blob, filename } = await fetchDashboardPdfBlob(previewItemId, previewOverrides)
                        downloadBlob(blob, filename)
                        toast.success('PDF downloaded.')
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Download failed')
                      } finally {
                        setDownloadingPdf(false)
                      }
                    }}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[12px] font-semibold"
                  >
                    {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download PDF
                  </button>
                  <button type="button" onClick={() => { setPreviewOpen(false); setShowSaveNewPrompt(false) }} className="h-9 px-3 rounded-lg border text-[12px] font-semibold ml-auto">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminShell>
  )
}
