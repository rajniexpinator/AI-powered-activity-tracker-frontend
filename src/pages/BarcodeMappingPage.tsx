import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { toast } from 'react-toastify'
import {
  api,
  type BarcodePatternDto,
  type BarcodePatternField,
  type BarcodePatternSegment,
} from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import {
  ScanLine,
  Play,
  Loader2,
  Trash2,
  Save,
  X,
  AlertCircle,
  ListChecks,
} from 'lucide-react'

const FIELD_OPTIONS: { value: BarcodePatternField; label: string }[] = [
  { value: 'partNumber', label: 'Part number' },
  { value: 'partName', label: 'Part name' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier code' },
  { value: 'serialNumber', label: 'Serial number' },
  { value: 'notes', label: 'Notes' },
]

type BreakPiece = {
  start: number
  end: number
  text: string
}

/** Split barcode into clickable breaks (spaces / gaps) — no drag needed. */
function splitBarcodeBreaks(barcode: string): BreakPiece[] {
  const text = barcode || ''
  if (!text.trim()) return []
  const pieces: BreakPiece[] = []
  const re = /\S+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    pieces.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    })
  }
  // If somehow empty but string exists, treat whole string as one piece
  if (pieces.length === 0 && text.length > 0) {
    pieces.push({ start: 0, end: text.length, text })
  }
  return pieces
}

function previewFields(barcode: string, segments: BarcodePatternSegment[]) {
  const fields: Record<string, string> = {}
  const ordered = [...segments].sort((a, b) => a.start - b.start || a.end - b.end)
  for (const seg of ordered) {
    if (seg.start < 0 || seg.end > barcode.length || seg.start >= seg.end) continue
    const piece = barcode.slice(seg.start, seg.end)
    if (!piece) continue
    fields[seg.field] = fields[seg.field] ? `${fields[seg.field]} ${piece}` : piece
  }
  return fields
}

function fieldLabel(field: BarcodePatternField) {
  return FIELD_OPTIONS.find((f) => f.value === field)?.label || field
}

function ScannerOverlay(props: {
  open: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  error: string | null
  manualBarcode: string
  setManualBarcode: (v: string) => void
  submitting: boolean
  onClose: () => void
  onSubmitManual: () => void
}) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-[14px] font-semibold text-[#222]">Scan barcode</p>
          <button
            type="button"
            onClick={props.onClose}
            className="p-1.5 rounded-lg text-[#666] hover:bg-[var(--color-bg)]"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-black aspect-[4/3] relative">
          <video
            ref={props.videoRef as RefObject<HTMLVideoElement>}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
        </div>
        {props.error ? (
          <p className="px-4 pt-3 text-[12px] text-red-600 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {props.error}
          </p>
        ) : (
          <p className="px-4 pt-3 text-[12px] text-[#666]">Point the camera at a barcode or QR code.</p>
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
            className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
          />
          <button
            type="submit"
            disabled={props.submitting || !props.manualBarcode.trim()}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Use
          </button>
        </form>
      </div>
    </div>
  )
}

export function BarcodeMappingPage() {
  const [step, setStep] = useState<'idle' | 'mapping'>('idle')
  const [sampleBarcode, setSampleBarcode] = useState('')
  const [patternName, setPatternName] = useState('')
  const [segments, setSegments] = useState<BarcodePatternSegment[]>([])
  /** Which break is waiting for a field dropdown choice */
  const [activeBreak, setActiveBreak] = useState<BreakPiece | null>(null)
  const [pendingField, setPendingField] = useState<BarcodePatternField>('partNumber')
  const [saving, setSaving] = useState(false)
  const [patterns, setPatterns] = useState<BarcodePatternDto[]>([])
  const [loadingPatterns, setLoadingPatterns] = useState(false)

  const loadPatterns = useCallback(async () => {
    setLoadingPatterns(true)
    try {
      const res = await api.barcodePatterns.list({ limit: 50 })
      setPatterns(res.patterns)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load patterns')
    } finally {
      setLoadingPatterns(false)
    }
  }, [])

  useEffect(() => {
    void loadPatterns()
  }, [loadPatterns])

  const onDetected = useCallback(async (code: string) => {
    setSampleBarcode(code)
    setSegments([])
    setActiveBreak(null)
    setPendingField('partNumber')
    setStep('mapping')
    toast.success('Barcode captured — tap each break and pick a field.')
  }, [])

  const scanner = useBarcodeScanner({ onDetected })

  const breaks = useMemo(() => splitBarcodeBreaks(sampleBarcode), [sampleBarcode])

  const preview = useMemo(
    () => (sampleBarcode ? previewFields(sampleBarcode, segments) : {}),
    [sampleBarcode, segments]
  )

  function fieldForBreak(piece: BreakPiece): BarcodePatternField | null {
    const hit = segments.find((s) => s.start === piece.start && s.end === piece.end)
    return hit?.field ?? null
  }

  function onTapBreak(piece: BreakPiece) {
    setActiveBreak(piece)
    setPendingField(fieldForBreak(piece) || 'partNumber')
  }

  function assignActiveBreak() {
    if (!activeBreak) return
    setSegments((prev) => {
      const without = prev.filter((s) => !(s.start === activeBreak.start && s.end === activeBreak.end))
      return [...without, { start: activeBreak.start, end: activeBreak.end, field: pendingField }]
    })
    toast.success(`Assigned to ${fieldLabel(pendingField)}`)
    setActiveBreak(null)
  }

  function removeSegment(index: number) {
    setSegments((prev) => prev.filter((_, i) => i !== index))
  }

  async function savePattern() {
    if (!sampleBarcode.trim()) {
      toast.error('Scan or enter a barcode first.')
      return
    }
    if (segments.length === 0) {
      toast.error('Tap at least one break and assign a field.')
      return
    }
    setSaving(true)
    try {
      await api.barcodePatterns.create({
        sampleBarcode: sampleBarcode.trim(),
        segments,
        name: patternName.trim() || undefined,
      })
      toast.success('Pattern saved — similar barcodes will reuse this mapping.')
      setStep('idle')
      setSampleBarcode('')
      setSegments([])
      setPatternName('')
      setActiveBreak(null)
      await loadPatterns()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save pattern')
    } finally {
      setSaving(false)
    }
  }

  async function deactivatePattern(id: string) {
    try {
      await api.barcodePatterns.remove(id)
      toast.success('Pattern deactivated')
      await loadPatterns()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove pattern')
    }
  }

  function resetMapping() {
    setStep('idle')
    setSampleBarcode('')
    setSegments([])
    setActiveBreak(null)
    setPendingField('partNumber')
    setPatternName('')
  }

  return (
    <AdminShell>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            Admin
          </p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#1a1a1a]">Barcode mapping</h1>
          <p className="mt-1 text-[13px] text-[#666] max-w-2xl">
            Teach the system how a barcode is structured. Scan once, tap each break, pick a field from the
            dropdown. Similar barcodes will fill those fields automatically next time.
          </p>
        </div>

        {step === 'idle' ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <p className="text-[14px] text-[#444] mb-4">
              Click <strong>Start</strong>, then scan a barcode (or paste it) to begin mapping.
            </p>
            <button
              type="button"
              onClick={() => void scanner.startScanner()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-95"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
            <button
              type="button"
              onClick={() => {
                setSampleBarcode('')
                setSegments([])
                setActiveBreak(null)
                setStep('mapping')
              }}
              className="ml-2 inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-[14px] font-medium text-[#333] hover:bg-[var(--color-bg)]"
            >
              Paste code manually
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h2 className="text-[15px] font-semibold text-[#222]">Map this barcode</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void scanner.startScanner()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[#333]"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    Rescan
                  </button>
                  <button
                    type="button"
                    onClick={resetMapping}
                    className="rounded-lg px-3 py-1.5 text-[12px] text-[#666] hover:bg-[var(--color-bg)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Pattern name (optional)</label>
                <input
                  type="text"
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                  placeholder="e.g. Jabil TCU label"
                  className="w-full max-w-md rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">
                  Full scanned code (edit only if needed)
                </label>
                <input
                  type="text"
                  value={sampleBarcode}
                  onChange={(e) => {
                    setSampleBarcode(e.target.value)
                    setSegments([])
                    setActiveBreak(null)
                  }}
                  spellCheck={false}
                  className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 font-mono text-[13px] text-[#222] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                  placeholder="Scan or paste the full barcode text here…"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">
                  Tap a break, then choose a field
                </label>
                {breaks.length === 0 ? (
                  <p className="text-[13px] text-[#888]">Scan or paste a barcode to see breaks.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {breaks.map((piece) => {
                      const assigned = fieldForBreak(piece)
                      const isActive =
                        activeBreak?.start === piece.start && activeBreak?.end === piece.end
                      return (
                        <button
                          key={`${piece.start}-${piece.end}`}
                          type="button"
                          onClick={() => onTapBreak(piece)}
                          className={`max-w-full rounded-xl border px-3 py-2 text-left font-mono text-[12px] transition-colors ${
                            isActive
                              ? 'border-[#3F4B9D] bg-[#3F4B9D] text-white'
                              : assigned
                                ? 'border-emerald-300 bg-emerald-50 text-[#222]'
                                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[#222] hover:border-[#3F4B9D]/40'
                          }`}
                          title={assigned ? `Assigned: ${fieldLabel(assigned)}` : 'Tap to assign a field'}
                        >
                          <span className="break-all">{piece.text}</span>
                          {assigned ? (
                            <span
                              className={`mt-1 block text-[10px] font-sans font-semibold ${
                                isActive ? 'text-white/85' : 'text-emerald-700'
                              }`}
                            >
                              {fieldLabel(assigned)}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {activeBreak && (
                <div className="rounded-xl border border-[#3F4B9D]/25 bg-[#3F4B9D]/5 p-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-[#444]">
                    Selected: <span className="font-mono font-medium text-[#222]">{activeBreak.text}</span>
                  </span>
                  <select
                    value={pendingField}
                    onChange={(e) => setPendingField(e.target.value as BarcodePatternField)}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-[12px]"
                    autoFocus
                  >
                    {FIELD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={assignActiveBreak}
                    className="rounded-lg bg-[#3F4B9D] px-3 py-1.5 text-[12px] font-medium text-white"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBreak(null)}
                    className="rounded-lg px-3 py-1.5 text-[12px] text-[#666]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {segments.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#555] mb-2">Assigned breaks</p>
                  <ul className="space-y-1.5">
                    {segments.map((seg, i) => (
                      <li
                        key={`${seg.start}-${seg.end}-${seg.field}-${i}`}
                        className="flex items-center gap-2 text-[12px] rounded-lg bg-[var(--color-bg)] px-3 py-2"
                      >
                        <span className="font-medium text-[#3F4B9D]">{fieldLabel(seg.field)}</span>
                        <span className="font-mono text-[#444] truncate flex-1">
                          {sampleBarcode.slice(seg.start, seg.end)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSegment(i)}
                          className="p-1 text-[#888] hover:text-red-600"
                          aria-label="Remove segment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Object.keys(preview).length > 0 && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
                  <p className="text-[11px] font-semibold text-[#555] mb-2">Preview</p>
                  <dl className="grid gap-1 text-[12px]">
                    {Object.entries(preview).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="text-[#888] w-28 shrink-0">
                          {FIELD_OPTIONS.find((f) => f.value === k)?.label || k}
                        </dt>
                        <dd className="font-mono text-[#222]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <button
                type="button"
                disabled={saving || !sampleBarcode.trim() || segments.length === 0}
                onClick={() => void savePattern()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save mapping
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-[#555]" />
            <h2 className="text-[15px] font-semibold text-[#222]">Saved patterns</h2>
          </div>
          {loadingPatterns ? (
            <p className="text-[13px] text-[#888] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </p>
          ) : patterns.length === 0 ? (
            <p className="text-[13px] text-[#888]">No patterns taught yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[var(--color-bg)] text-[11px] uppercase tracking-wide text-[#666]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Sample</th>
                    <th className="px-4 py-2.5 font-semibold">Fields</th>
                    <th className="px-4 py-2.5 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((p) => (
                    <tr key={p._id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2.5">{p.name || '—'}</td>
                      <td
                        className="px-4 py-2.5 font-mono text-[12px] max-w-[280px] truncate"
                        title={p.sampleBarcode}
                      >
                        {p.sampleBarcode}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[#555]">
                        {[...new Set(p.segments.map((s) => s.field))].join(', ')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void deactivatePattern(p._id)}
                          className="text-[12px] text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ScannerOverlay
        open={scanner.scannerOpen}
        videoRef={scanner.videoRef}
        error={scanner.scannerError}
        manualBarcode={scanner.manualBarcode}
        setManualBarcode={scanner.setManualBarcode}
        submitting={scanner.manualBarcodeSubmitting}
        onClose={scanner.stopScanner}
        onSubmitManual={() => void scanner.submitManual()}
      />
    </AdminShell>
  )
}
