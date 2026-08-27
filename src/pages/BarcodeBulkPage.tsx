import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'react-toastify'
import {
  api,
  type BarcodeBulkLotDetail,
  type BarcodeBulkLotSummary,
  type BarcodeSerialStatus,
} from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import {
  ScanLine,
  Plus,
  Loader2,
  Download,
  ArrowLeft,
  Trash2,
  X,
  AlertCircle,
  FolderOpen,
  Upload,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react'

type SerialListKind = 'good' | 'bad'

function ScannerOverlay(props: {
  open: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  error: string | null
  manualBarcode: string
  setManualBarcode: (v: string) => void
  submitting: boolean
  lastStatus: BarcodeSerialStatus | null
  onClose: () => void
  onSubmitManual: () => void
}) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-[14px] font-semibold text-[#222]">Scan into sheet</p>
          <button
            type="button"
            onClick={props.onClose}
            className="p-1.5 rounded-lg text-[#666] hover:bg-[var(--color-bg)]"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-black aspect-[4/3]">
          <video ref={props.videoRef as RefObject<HTMLVideoElement>} className="w-full h-full object-cover" playsInline muted />
        </div>
        {props.lastStatus ? (
          <div className="px-4 pt-3">
            <SerialStatusBanner status={props.lastStatus} />
          </div>
        ) : null}
        {props.error ? (
          <p className="px-4 pt-3 text-[12px] text-red-600 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {props.error}
          </p>
        ) : (
          <p className="px-4 pt-3 text-[12px] text-[#666]">Scan parts for this bulk sheet only (not AI logs).</p>
        )}
        <form
          className="p-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            props.onSubmitManual()
          }}
        >
          <input
            type="text"
            value={props.manualBarcode}
            onChange={(e) => props.setManualBarcode(e.target.value)}
            placeholder="Or type / paste code…"
            className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px]"
          />
          <button
            type="submit"
            disabled={props.submitting || !props.manualBarcode.trim()}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

function SerialListUploadModal(props: {
  kind: SerialListKind
  open: boolean
  uploading: boolean
  onClose: () => void
  onSubmit: (payload: { text: string; mode: 'replace' | 'append' }) => void
}) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (props.open) {
      setText('')
      setMode('replace')
    }
  }, [props.open])

  if (!props.open) return null

  const label = props.kind === 'good' ? 'Good' : 'Bad'
  const accent =
    props.kind === 'good'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-red-600 hover:bg-red-700'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#222]">Upload {label} serials</h2>
            <p className="mt-1 text-[12px] text-[#666]">
              Paste a column of serials, or choose a CSV/TXT file. One serial per line (commas also work).
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="p-1.5 rounded-lg text-[#666] hover:bg-[var(--color-bg)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'SN001\nSN002\nSN003'}
          className="mt-4 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px] font-mono"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const content = typeof reader.result === 'string' ? reader.result : ''
                setText(content)
                toast.success(`Loaded ${file.name}`)
              }
              reader.onerror = () => toast.error('Could not read that file')
              reader.readAsText(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[12px] font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose file
          </button>
          <label className="inline-flex items-center gap-2 text-[12px] text-[#555]">
            <input
              type="radio"
              name="serial-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            Replace list
          </label>
          <label className="inline-flex items-center gap-2 text-[12px] text-[#555]">
            <input
              type="radio"
              name="serial-mode"
              checked={mode === 'append'}
              onChange={() => setMode('append')}
            />
            Append
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-[13px] text-[#555]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={props.uploading || !text.trim()}
            onClick={() => props.onSubmit({ text, mode })}
            className={`rounded-xl px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50 ${accent}`}
          >
            {props.uploading ? 'Uploading…' : `Load ${label} list`}
          </button>
        </div>
      </div>
    </div>
  )
}

function countItemsByStatus(items: { serialStatus?: BarcodeSerialStatus | null }[] | undefined) {
  let good = 0
  let bad = 0
  let notFound = 0
  for (const item of items || []) {
    if (item.serialStatus === 'good') good += 1
    else if (item.serialStatus === 'bad') bad += 1
    else if (item.serialStatus === 'not_found') notFound += 1
  }
  return { good, bad, notFound }
}

function formatCount(n: number) {
  return n.toLocaleString()
}

function SerialListStatBox(props: {
  kind: 'good' | 'bad'
  loaded: number
  scanned: number
}) {
  const isGood = props.kind === 'good'
  return (
    <div
      className={`min-w-[148px] rounded-xl border px-3 py-2 ${
        isGood ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          isGood ? 'text-emerald-800' : 'text-red-800'
        }`}
      >
        {isGood ? 'Good' : 'Bad'}
      </p>
      <div className="mt-1 flex items-end gap-3">
        <div>
          <p className={`text-[18px] font-semibold leading-none ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
            {formatCount(props.loaded)}
          </p>
          <p className={`mt-0.5 text-[11px] ${isGood ? 'text-emerald-700' : 'text-red-700'}`}>loaded</p>
        </div>
        <div className={`h-8 w-px ${isGood ? 'bg-emerald-200' : 'bg-red-200'}`} />
        <div>
          <p className={`text-[18px] font-semibold leading-none ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
            {formatCount(props.scanned)}
          </p>
          <p className={`mt-0.5 text-[11px] ${isGood ? 'text-emerald-700' : 'text-red-700'}`}>scanned</p>
        </div>
      </div>
    </div>
  )
}

function SerialStatusBanner({ status }: { status: BarcodeSerialStatus }) {
  if (status === 'good') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Good
      </div>
    )
  }
  if (status === 'bad') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
        <XCircle className="w-4 h-4 shrink-0" />
        Bad
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-900">
      <HelpCircle className="w-4 h-4 shrink-0" />
      Not found
    </div>
  )
}

function SerialStatusBadge({ status }: { status?: BarcodeSerialStatus | null }) {
  if (!status) return <span className="text-[#bbb]">—</span>
  if (status === 'good') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Good
      </span>
    )
  }
  if (status === 'bad') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
        <XCircle className="w-3 h-3" />
        Bad
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <HelpCircle className="w-3 h-3" />
      Not found
    </span>
  )
}

function formatWhen(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function toastForSerialStatus(status?: BarcodeSerialStatus | null, serial?: string) {
  const sn = serial?.trim() ? ` (${serial.trim()})` : ''
  if (status === 'good') {
    toast.success(`Good${sn}`)
    return
  }
  if (status === 'bad') {
    toast.error(`Bad${sn}`)
    return
  }
  if (status === 'not_found') {
    toast.warning(`Not found${sn}`)
    return
  }
  toast.success(serial ? `Added SN ${serial}` : 'Scan added to sheet')
}

export function BarcodeBulkPage() {
  const [lots, setLots] = useState<BarcodeBulkLotSummary[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [q, setQ] = useState('')
  const [activeLot, setActiveLot] = useState<BarcodeBulkLotDetail | null>(null)
  const [loadingLot, setLoadingLot] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [uploadKind, setUploadKind] = useState<SerialListKind | null>(null)
  const [uploadingList, setUploadingList] = useState(false)
  const [lastScanStatus, setLastScanStatus] = useState<BarcodeSerialStatus | null>(null)

  const loadLots = useCallback(async (search?: string) => {
    setLoadingList(true)
    try {
      const res = await api.barcodeBulk.list({ q: search, limit: 50, status: 'all' })
      setLots(res.lots)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sheets')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void loadLots()
  }, [loadLots])

  const openLot = useCallback(async (id: string) => {
    setLoadingLot(true)
    setLastScanStatus(null)
    try {
      const { lot } = await api.barcodeBulk.getOne(id)
      setActiveLot(lot)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open sheet')
    } finally {
      setLoadingLot(false)
    }
  }, [])

  const mergeLotSummary = useCallback((summary: BarcodeBulkLotSummary) => {
    setActiveLot((prev) =>
      prev
        ? {
            ...prev,
            ...summary,
            items: prev.items,
          }
        : prev
    )
  }, [])

  const onDetected = useCallback(
    async (code: string) => {
      if (!activeLot?._id) return
      if (activeLot.status === 'closed') {
        toast.error('This sheet is closed. Re-open it to add scans.')
        return
      }
      setAdding(true)
      try {
        const { added, lot: summary } = await api.barcodeBulk.addScans(activeLot._id, { barcode: code })
        const { lot } = await api.barcodeBulk.getOne(activeLot._id)
        setActiveLot(lot)
        mergeLotSummary(summary)
        const row = added[0]
        const status = row?.serialStatus ?? null
        setLastScanStatus(status)
        toastForSerialStatus(status, row?.serialNumber || row?.barcode)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add scan')
      } finally {
        setAdding(false)
      }
    },
    [activeLot, mergeLotSummary]
  )

  const scanner = useBarcodeScanner({ onDetected })

  async function createLot() {
    const name = newName.trim()
    if (!name) {
      toast.error('Give this sheet a name so you can find it later.')
      return
    }
    setCreating(true)
    try {
      const { lot } = await api.barcodeBulk.create({ name })
      setShowCreate(false)
      setNewName('')
      toast.success('Sheet created')
      await loadLots()
      await openLot(lot._id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create sheet')
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus() {
    if (!activeLot) return
    const next = activeLot.status === 'open' ? 'closed' : 'open'
    try {
      const { lot } = await api.barcodeBulk.update(activeLot._id, { status: next })
      setActiveLot(lot)
      await loadLots()
      toast.success(next === 'closed' ? 'Sheet closed' : 'Sheet re-opened')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update sheet')
    }
  }

  async function removeItem(itemId: string) {
    if (!activeLot) return
    try {
      await api.barcodeBulk.removeScan(activeLot._id, itemId)
      const { lot } = await api.barcodeBulk.getOne(activeLot._id)
      setActiveLot(lot)
      await loadLots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove row')
    }
  }

  async function exportCsv() {
    if (!activeLot) return
    setExporting(true)
    try {
      const { blob, filename } = await api.barcodeBulk.exportCsv(activeLot._id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Spreadsheet downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function submitSerialList(payload: { text: string; mode: 'replace' | 'append' }) {
    if (!activeLot || !uploadKind) return
    const text = payload.text.trim()
    if (!text) {
      toast.error('Paste serials or choose a file first.')
      return
    }
    setUploadingList(true)
    try {
      const result =
        uploadKind === 'good'
          ? await api.barcodeBulk.uploadGoodSerials(activeLot._id, { text, mode: payload.mode })
          : await api.barcodeBulk.uploadBadSerials(activeLot._id, { text, mode: payload.mode })
      mergeLotSummary(result.lot)
      setActiveLot((prev) =>
        prev
          ? {
              ...prev,
              goodSerialCount: result.lot.goodSerialCount ?? prev.goodSerialCount,
              badSerialCount: result.lot.badSerialCount ?? prev.badSerialCount,
              hasSerialLists: result.lot.hasSerialLists ?? prev.hasSerialLists,
            }
          : prev
      )
      const label = uploadKind === 'good' ? 'Good' : 'Bad'
      toast.success(`${label} list loaded — ${result.total} serial${result.total === 1 ? '' : 's'}`)
      setUploadKind(null)
      await loadLots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload serial list')
    } finally {
      setUploadingList(false)
    }
  }

  async function clearSerialList(kind: SerialListKind) {
    if (!activeLot) return
    const label = kind === 'good' ? 'Good' : 'Bad'
    if (!window.confirm(`Clear the ${label} serial list for this sheet?`)) return
    try {
      const result =
        kind === 'good'
          ? await api.barcodeBulk.clearGoodSerials(activeLot._id)
          : await api.barcodeBulk.clearBadSerials(activeLot._id)
      mergeLotSummary(result.lot)
      setActiveLot((prev) =>
        prev
          ? {
              ...prev,
              goodSerialCount: result.lot.goodSerialCount ?? (kind === 'good' ? 0 : prev.goodSerialCount),
              badSerialCount: result.lot.badSerialCount ?? (kind === 'bad' ? 0 : prev.badSerialCount),
              hasSerialLists: result.lot.hasSerialLists,
            }
          : prev
      )
      toast.success(`${label} list cleared`)
      await loadLots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear list')
    }
  }

  const goodCount = activeLot?.goodSerialCount ?? 0
  const badCount = activeLot?.badSerialCount ?? 0
  const fromItems = countItemsByStatus(activeLot?.items)
  const goodScanned = activeLot?.goodScannedCount ?? fromItems.good
  const badScanned = activeLot?.badScannedCount ?? fromItems.bad
  const notFoundScanned = activeLot?.notFoundScannedCount ?? fromItems.notFound
  const hasLists = Boolean(activeLot?.hasSerialLists) || goodCount > 0 || badCount > 0

  return (
    <AdminShell>
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        {!activeLot ? (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                  Operations
                </p>
                <h1 className="mt-1 text-[22px] font-semibold text-[#1a1a1a]">Barcode Bulk</h1>
                <p className="mt-1 text-[13px] text-[#666] max-w-2xl">
                  Scan hundreds of parts into a named sheet — separate from AI logs. Load Good / Bad serial lists to
                  verify each scan, then export a spreadsheet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-medium text-white"
              >
                <Plus className="w-4 h-4" />
                New sheet
              </button>
            </div>

            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void loadLots(q)
              }}
            >
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by sheet name…"
                className="flex-1 max-w-md rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px]"
              />
              <button
                type="submit"
                className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-[13px] font-medium"
              >
                Search
              </button>
            </form>

            {loadingList ? (
              <p className="text-[13px] text-[#888] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading sheets…
              </p>
            ) : lots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
                <FolderOpen className="w-8 h-8 text-[#ccc] mx-auto mb-2" />
                <p className="text-[14px] text-[#555]">No bulk sheets yet.</p>
                <p className="text-[12px] text-[#888] mt-1">Create one and give it a name you can search later.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[var(--color-bg)] text-[11px] uppercase tracking-wide text-[#666]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Sheet name</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Scans</th>
                      <th className="px-4 py-2.5 font-semibold">Loaded / scanned</th>
                      <th className="px-4 py-2.5 font-semibold">Updated</th>
                      <th className="px-4 py-2.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => (
                      <tr key={lot._id} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-3 font-medium text-[#222]">{lot.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              lot.status === 'open'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#f0f0f0] text-[#666]'
                            }`}
                          >
                            {lot.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{lot.itemCount}</td>
                        <td className="px-4 py-3 text-[#666]">
                          <div className="flex flex-col gap-0.5 text-[12px] leading-tight">
                            <span>
                              Good {formatCount(lot.goodSerialCount ?? 0)} loaded ·{' '}
                              {formatCount(lot.goodScannedCount ?? 0)} scanned
                            </span>
                            <span>
                              Bad {formatCount(lot.badSerialCount ?? 0)} loaded ·{' '}
                              {formatCount(lot.badScannedCount ?? 0)} scanned
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#666]">{formatWhen(lot.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void openLot(lot._id)}
                            className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveLot(null)
                  setLastScanStatus(null)
                  void loadLots(q)
                }}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#555] hover:text-[#111]"
              >
                <ArrowLeft className="w-4 h-4" />
                All sheets
              </button>
            </div>

            {loadingLot ? (
              <p className="text-[13px] text-[#888] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading sheet…
              </p>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-[22px] font-semibold text-[#1a1a1a]">{activeLot.name}</h1>
                    <p className="mt-1 text-[13px] text-[#666]">
                      {activeLot.itemCount} scan{activeLot.itemCount === 1 ? '' : 's'} ·{' '}
                      <span className="capitalize">{activeLot.status}</span>
                      {activeLot.description ? ` · ${activeLot.description}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeLot.status === 'open' && (
                      <button
                        type="button"
                        disabled={adding}
                        onClick={() => void scanner.startScanner()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
                      >
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                        Scan
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={exporting || activeLot.itemCount === 0}
                      onClick={() => void exportCsv()}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-[14px] font-medium disabled:opacity-50"
                    >
                      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleStatus()}
                      className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-[13px] font-medium text-[#444]"
                    >
                      {activeLot.status === 'open' ? 'Close sheet' : 'Re-open sheet'}
                    </button>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#222]">Serial verification</p>
                      <p className="mt-0.5 text-[12px] text-[#666]">
                        Loaded stays at the list size. Scanned goes up as Good, Bad, or Not found hits come in.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-stretch gap-2">
                      <SerialListStatBox kind="good" loaded={goodCount} scanned={goodScanned} />
                      <SerialListStatBox kind="bad" loaded={badCount} scanned={badScanned} />
                      {hasLists ? (
                        <div className="min-w-[108px] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                            Not found
                          </p>
                          <p className="mt-1 text-[18px] font-semibold leading-none text-amber-950">
                            {formatCount(notFoundScanned)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-800">scanned</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!hasLists ? (
                    <p className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      No lists loaded yet. Upload Good and/or Bad serials to start verifying scans.
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadKind('good')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Good serials
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadKind('bad')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Bad serials
                    </button>
                    {goodCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void clearSerialList('good')}
                        className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-[12px] text-[#666]"
                      >
                        Clear Good
                      </button>
                    ) : null}
                    {badCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void clearSerialList('bad')}
                        className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-[12px] text-[#666]"
                      >
                        Clear Bad
                      </button>
                    ) : null}
                  </div>

                  {lastScanStatus && hasLists ? (
                    <div className="mt-3">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-[#888]">Last scan</p>
                      <SerialStatusBanner status={lastScanStatus} />
                    </div>
                  ) : null}
                </div>

                {activeLot.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-8 text-center text-[13px] text-[#666]">
                    No scans yet. Click Scan to add parts to this sheet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white">
                    <table className="w-full text-left text-[12px]">
                      <thead className="bg-[var(--color-bg)] text-[11px] uppercase tracking-wide text-[#666]">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">When</th>
                          <th className="px-3 py-2.5 font-semibold">Barcode</th>
                          <th className="px-3 py-2.5 font-semibold">Part #</th>
                          <th className="px-3 py-2.5 font-semibold">Part name</th>
                          <th className="px-3 py-2.5 font-semibold">Customer</th>
                          <th className="px-3 py-2.5 font-semibold">Serial</th>
                          <th className="px-3 py-2.5 font-semibold">Notes</th>
                          <th className="px-3 py-2.5 font-semibold">Status</th>
                          <th className="px-3 py-2.5 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...activeLot.items].reverse().map((item) => (
                          <tr key={item._id} className="border-t border-[var(--color-border)] align-top">
                            <td className="px-3 py-2 text-[#666] whitespace-nowrap">{formatWhen(item.scannedAt)}</td>
                            <td className="px-3 py-2 font-mono max-w-[160px] truncate" title={item.barcode}>
                              {item.barcode}
                            </td>
                            <td className="px-3 py-2">{item.partNumber || '—'}</td>
                            <td className="px-3 py-2">{item.partName || '—'}</td>
                            <td className="px-3 py-2">{item.customer || item.supplier || '—'}</td>
                            <td className="px-3 py-2 font-mono">{item.serialNumber || '—'}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate" title={item.notes}>
                              {item.notes || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <SerialStatusBadge status={item.serialStatus} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => void removeItem(item._id)}
                                className="p-1 text-[#999] hover:text-red-600"
                                aria-label="Remove scan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-[16px] font-semibold text-[#222]">New bulk sheet</h2>
            <p className="mt-1 text-[12px] text-[#666]">Name it so you can open the same sheet later.</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Incoming parts – Jul 29"
              className="mt-4 w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-[14px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createLot()
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false)
                  setNewName('')
                }}
                className="rounded-xl px-4 py-2 text-[13px] text-[#555]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => void createLot()}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SerialListUploadModal
        kind={uploadKind || 'good'}
        open={uploadKind != null}
        uploading={uploadingList}
        onClose={() => {
          if (!uploadingList) setUploadKind(null)
        }}
        onSubmit={(payload) => void submitSerialList(payload)}
      />

      <ScannerOverlay
        open={scanner.scannerOpen}
        videoRef={scanner.videoRef}
        error={scanner.scannerError}
        manualBarcode={scanner.manualBarcode}
        setManualBarcode={scanner.setManualBarcode}
        submitting={scanner.manualBarcodeSubmitting || adding}
        lastStatus={hasLists ? lastScanStatus : null}
        onClose={scanner.stopScanner}
        onSubmitManual={() => void scanner.submitManual()}
      />
    </AdminShell>
  )
}
