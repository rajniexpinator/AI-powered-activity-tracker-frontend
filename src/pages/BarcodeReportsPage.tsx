import { useEffect, useMemo, useState } from 'react'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import {
  ScanLine,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Link2,
  Hash,
  Type,
  Binary,
} from 'lucide-react'

type MappingRow = {
  _id: string
  barcode: string
  partName?: string
  partNumber?: string
  productName?: string
  customer?: string
  scanCount: number
  metadata?: unknown
  lastScannedBy: { _id: string; name?: string; email?: string } | null
  createdAt: string
  updatedAt: string
}

type FormatVariant = 'url' | 'longtext' | 'numeric' | 'alphanumeric' | 'mixed' | 'empty'

function scanFormatInfo(code: string): { label: string; variant: FormatVariant } {
  const c = code.trim()
  if (!c) return { label: '—', variant: 'empty' }
  if (/^https?:\/\//i.test(c) || /^www\./i.test(c)) return { label: 'QR / URL', variant: 'url' }
  if (c.length > 48) return { label: 'Long text', variant: 'longtext' }
  if (/^[0-9]+$/.test(c)) return { label: 'Numeric', variant: 'numeric' }
  if (/^[A-Za-z0-9\-_.]+$/i.test(c)) return { label: 'Alphanumeric', variant: 'alphanumeric' }
  return { label: 'Mixed', variant: 'mixed' }
}

const formatBadgeClasses: Record<FormatVariant, string> = {
  empty: 'bg-slate-100 text-slate-400 border-slate-200/80',
  url: 'bg-sky-50 text-sky-800 border-sky-200/90',
  longtext: 'bg-violet-50 text-violet-800 border-violet-200/90',
  numeric: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
  alphanumeric: 'bg-slate-100 text-slate-700 border-slate-200/90',
  mixed: 'bg-amber-50 text-amber-900 border-amber-200/90',
}

function FormatBadge({ label, variant }: { label: string; variant: FormatVariant }) {
  const icon =
    variant === 'url' ? (
      <Link2 className="w-3 h-3 shrink-0 opacity-80" />
    ) : variant === 'numeric' ? (
      <Hash className="w-3 h-3 shrink-0 opacity-80" />
    ) : variant === 'alphanumeric' || variant === 'longtext' ? (
      <Type className="w-3 h-3 shrink-0 opacity-80" />
    ) : variant === 'mixed' ? (
      <Binary className="w-3 h-3 shrink-0 opacity-80" />
    ) : null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${formatBadgeClasses[variant]}`}
    >
      {icon}
      {label}
    </span>
  )
}

function formatMetadataPreview(meta: unknown): string | null {
  if (meta == null) return null
  if (typeof meta === 'object' && meta !== null && !Array.isArray(meta)) {
    const o = meta as Record<string, unknown>
    if (typeof o.notes === 'string' && o.notes.trim()) {
      const t = o.notes.trim()
      return t.length > 120 ? `${t.slice(0, 117)}…` : t
    }
  }
  try {
    const s = JSON.stringify(meta)
    return s.length > 90 ? `${s.slice(0, 87)}…` : s
  } catch {
    return null
  }
}

function CellEmpty() {
  return <span className="text-slate-300 select-none">—</span>
}

function formatCreatedAt(iso: string) {
  const d = new Date(iso)
  return {
    line1: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    line2: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}

export function BarcodeReportsPage() {
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [qInput, setQInput] = useState('')
  const [qApplied, setQApplied] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 6
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

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

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.barcodes.adminList({
        q: qApplied || undefined,
        limit: pageSize,
        page,
      })
      setMappings(res.mappings as MappingRow[])
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load barcode report')
      setMappings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, qApplied, refreshTick])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setQApplied(qInput.trim())
    setPage(1)
    setRefreshTick((t) => t + 1)
  }

  return (
    <AdminShell>
      <main className="w-full min-w-0 max-w-[1400px] mx-auto">
        {/* Page hero — mobile: stacked, centered intro; md+: side-by-side with stats */}
        <div className="relative mb-4 sm:mb-6 overflow-hidden rounded-xl sm:rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)]">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-primary)] via-[#5c6bc0] to-[#7e8adb]"
            aria-hidden
          />
          <div className="p-4 sm:p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="flex min-w-0 flex-col items-center text-center gap-3 sm:flex-row sm:items-start sm:text-left sm:gap-4">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20">
                <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</p>
                <h1 className="mt-0.5 text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-slate-900 leading-snug">
                  Barcode &amp; QR reports
                </h1>
                <p className="mt-2 text-[12px] sm:text-[13px] text-slate-600 leading-relaxed max-w-xl mx-auto sm:mx-0">
                  Browse every saved scan from AI logs. Filter by code, customer, or part details. Format badges help you
                  spot URLs, numeric barcodes, and free‑text payloads at a glance.
                </p>
              </div>
            </div>
            {!loading && total > 0 && (
              <div className="w-full shrink-0 rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-4 sm:py-3 text-center md:w-auto md:min-w-[132px] md:text-right">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mappings</p>
                <p className="mt-1 text-3xl sm:text-2xl font-bold tabular-nums text-[var(--color-primary)] leading-none">
                  {total}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500">{qApplied ? 'matching search' : 'in database'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Search + table card */}
        <section className="rounded-xl sm:rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-3 sm:px-5 py-3 sm:py-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 min-w-0 w-full">
                <label htmlFor="barcode-search" className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                  Search mappings
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="barcode-search"
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    enterKeyHint="search"
                    placeholder="Code, customer, part name or number…"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-[16px] sm:text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/35 focus-visible:border-[var(--color-primary)]/40"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-[13px] font-semibold text-white shadow-md shadow-[var(--color-primary)]/25 hover:brightness-105 active:brightness-95 disabled:opacity-60 transition-[filter,opacity]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </form>
          </div>

          <div className="p-2 sm:p-4">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[13px] text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {loading && mappings.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 py-14 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin inline-block align-middle text-[var(--color-primary)]" />
                <span className="ml-2 align-middle text-[13px]">Loading reports…</span>
              </div>
            ) : mappings.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-white py-12 px-4">
                <div className="mx-auto max-w-md text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-800">No mappings yet</p>
                  <p className="mt-1 text-[13px] text-slate-600 leading-relaxed">
                    Scans appear here after employees save barcode or QR mappings from AI logs.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile: card list (readable without horizontal scroll) */}
                <div className="md:hidden space-y-3">
                  {mappings.map((row) => {
                    const fmt = scanFormatInfo(row.barcode)
                    const notes = formatMetadataPreview(row.metadata)
                    const created = row.createdAt ? formatCreatedAt(row.createdAt) : null
                    return (
                      <article
                        key={row._id}
                        className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/80"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 gap-y-2">
                          <FormatBadge label={fmt.label} variant={fmt.variant} />
                          <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-[var(--color-primary)]/12 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                            {row.scanCount} scans
                          </span>
                        </div>
                        <p
                          className="mt-3 font-mono text-[11px] leading-snug text-slate-900 break-all"
                          title={row.barcode}
                        >
                          {row.barcode}
                        </p>
                        <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px] border-t border-slate-100 pt-3">
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500 shrink-0">Customer</dt>
                            <dd className="text-right font-medium text-slate-800 min-w-0 truncate">
                              {row.customer?.trim() || '—'}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500 shrink-0">Part</dt>
                            <dd className="text-right text-slate-800 min-w-0">
                              <span className="line-clamp-2">
                                {row.partName || row.productName || '—'}
                                {row.partNumber ? (
                                  <span className="block font-mono text-[11px] text-slate-600 mt-0.5">{row.partNumber}</span>
                                ) : null}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500 shrink-0">Last by</dt>
                            <dd className="text-right text-slate-800 min-w-0 truncate" title={row.lastScannedBy?.email}>
                              {row.lastScannedBy?.name || row.lastScannedBy?.email || '—'}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500 shrink-0">Created</dt>
                            <dd className="text-right text-slate-700">
                              {created ? (
                                <>
                                  {created.line1}
                                  <span className="block text-[11px] text-slate-500">{created.line2}</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                        </dl>
                        {notes ? (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                            <p className="mt-1 text-[12px] text-slate-700 leading-snug">{notes}</p>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>

                {/* Desktop: wide table */}
                <div className="hidden md:block overflow-x-auto rounded-xl ring-1 ring-slate-200/80 bg-slate-50/40 overscroll-x-contain touch-pan-x">
                  <table className="min-w-[1000px] w-full text-left text-[13px]">
                    <thead>
                      <tr className="bg-slate-100/95 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-slate-200">
                        <th className="px-4 py-3.5 first:rounded-tl-xl">Scanned code</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Format</th>
                        <th className="px-4 py-3.5">Customer</th>
                        <th className="px-4 py-3.5">Part name</th>
                        <th className="px-4 py-3.5">Part #</th>
                        <th className="px-4 py-3.5 text-right">Scans</th>
                        <th className="px-4 py-3.5">Last by</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Created</th>
                        <th className="px-4 py-3.5 last:rounded-tr-xl">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {mappings.map((row, idx) => {
                        const fmt = scanFormatInfo(row.barcode)
                        const notes = formatMetadataPreview(row.metadata)
                        const created = row.createdAt ? formatCreatedAt(row.createdAt) : null
                        return (
                          <tr
                            key={row._id}
                            className={`transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                            } hover:bg-[var(--color-primary)]/[0.045]`}
                          >
                            <td className="px-4 py-3 align-top max-w-[min(320px,32vw)]">
                              <p
                                className="font-mono text-[11px] leading-snug text-slate-900 break-all line-clamp-3"
                                title={row.barcode}
                              >
                                {row.barcode}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <FormatBadge label={fmt.label} variant={fmt.variant} />
                            </td>
                            <td className="px-4 py-3 align-top text-slate-800 font-medium">
                              {row.customer?.trim() || <CellEmpty />}
                            </td>
                            <td
                              className="px-4 py-3 align-top text-slate-700 max-w-[160px] truncate"
                              title={row.partName || row.productName}
                            >
                              {row.partName || row.productName || <CellEmpty />}
                            </td>
                            <td className="px-4 py-3 align-top font-mono text-[11px] text-slate-700">
                              {row.partNumber?.trim() || <CellEmpty />}
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                              <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-[var(--color-primary)]/12 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                                {row.scanCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top max-w-[140px]">
                              {row.lastScannedBy ? (
                                <span
                                  className="block truncate text-slate-700"
                                  title={row.lastScannedBy.email || undefined}
                                >
                                  {row.lastScannedBy.name || row.lastScannedBy.email || <CellEmpty />}
                                </span>
                              ) : (
                                <CellEmpty />
                              )}
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                              {created ? (
                                <div className="leading-tight">
                                  <p className="text-[12px] font-medium text-slate-800">{created.line1}</p>
                                  <p className="text-[11px] text-slate-500">{created.line2}</p>
                                </div>
                              ) : (
                                <CellEmpty />
                              )}
                            </td>
                            <td
                              className="px-4 py-3 align-top max-w-[200px] text-slate-600"
                              title={notes || undefined}
                            >
                              {notes ? (
                                <span className="line-clamp-2 text-[12px] leading-snug">{notes}</span>
                              ) : (
                                <span className="text-slate-300 italic text-[12px] select-none">No notes</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {(totalPages || 1) > 1 && (
              <div className="mt-4 flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-3 px-1 text-[12px] text-slate-600">
                <p className="text-center sm:text-left">
                  Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
                  <span className="font-semibold text-slate-900">{totalPages || 1}</span>
                  <span className="text-slate-400 mx-1">·</span>
                  <span className="tabular-nums">{total}</span> total
                </p>
                <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || loading}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      disabled={loading}
                      className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                        p === page
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                    disabled={page >= (totalPages || 1) || loading}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages || 1)}
                    disabled={page >= (totalPages || 1) || loading}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </AdminShell>
  )
}
