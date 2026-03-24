import { useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Clock,
  Tag,
  Archive,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  X,
  Plus,
  ScanLine,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useAuth } from '@/context/AuthContext'

type ExtractResult = {
  structured: unknown
  rawText: string
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

type ValidationResult = {
  ok: boolean
  severity: 'ok' | 'minor' | 'warning' | 'critical'
  issues: string[]
  suggestions: string[]
}

type StructuredActivity = {
  summary?: string
  part_name?: string
  intent?: string
  outcome?: string
  next_actions?: string[]
  notes?: string
}

type ActivityDetail = {
  _id: string
  customer?: string
  summary?: string
  rawConversation?: string
  structuredData?: StructuredActivity | (StructuredActivity & Record<string, unknown>)
  images?: string[]
  createdAt: string
}

const MAX_IMAGES_PER_ENTRY = 4

export function ChatPage() {
  const { user } = useAuth()
  const isEmployee = user?.role === 'employee'
  const [text, setText] = useState('')
  const [customerHint, setCustomerHint] = useState('')
  const [customerHintTouched, setCustomerHintTouched] = useState(false)
  const [customers, setCustomers] = useState<
    { _id: string; name: string; email?: string; notes?: string; createdAt: string }[]
  >([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [loadingExtract, setLoadingExtract] = useState(false)
  const [loadingValidate, setLoadingValidate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [recentActivities, setRecentActivities] = useState<
    { _id: string; customer?: string; summary?: string; createdAt: string }[]
  >([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [editSummary, setEditSummary] = useState('')
  const [editPartName, setEditPartName] = useState('')
  const [editIntent, setEditIntent] = useState('')
  const [editOutcome, setEditOutcome] = useState('')
  const [editNextActions, setEditNextActions] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loadingSelected, setLoadingSelected] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all')
  const [customerFilter, setCustomerFilter] = useState<string>('') // '' = all customers
  const [savedResultKey, setSavedResultKey] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualBarcodeSubmitting, setManualBarcodeSubmitting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [barcodeModal, setBarcodeModal] = useState<{
    barcode: string
    mode: 'new' | 'existing'
    customer?: string
    partName?: string
    partNumber?: string
    scanCount?: number
  } | null>(null)
  const [barcodeCustomer, setBarcodeCustomer] = useState('')
  const [barcodePartName, setBarcodePartName] = useState('')
  const [barcodePartNumber, setBarcodePartNumber] = useState('')
  const [barcodeNotes, setBarcodeNotes] = useState('')
  const [savingBarcode, setSavingBarcode] = useState(false)
  const [recentModalOpen, setRecentModalOpen] = useState(false)
  const newLogButtonRef = useRef<HTMLButtonElement | null>(null)

  function openBarcodeModal(payload: NonNullable<typeof barcodeModal>) {
    setBarcodeModal(payload)
    setBarcodeCustomer(payload.customer ?? '')
    setBarcodePartName(payload.partName ?? '')
    setBarcodePartNumber(payload.partNumber ?? '')
    setBarcodeNotes('')
  }

  function closeBarcodeModal() {
    setBarcodeModal(null)
    setBarcodeCustomer('')
    setBarcodePartName('')
    setBarcodePartNumber('')
    setBarcodeNotes('')
  }

  async function handleBarcodeDetected(code: string) {
    setText((prev) => (prev ? `Scanned barcode: ${code}\n${prev}` : `Scanned barcode: ${code}`))

    try {
      const res = await api.barcodes.scan(code)
      const mapping = res.mapping
      if (mapping?.customer) {
        setCustomerHint((prev) => prev || String(mapping.customer))
      }
      toast.info(
        mapping?.customer || mapping?.partName || mapping?.partNumber || mapping?.productName
          ? `Barcode recognized: ${mapping.partName || mapping.productName || ''}${mapping.partNumber ? ` [${mapping.partNumber}]` : ''}${mapping.customer ? ` (${mapping.customer})` : ''}`.trim()
          : 'Barcode recognized.'
      )
      openBarcodeModal({
        barcode: code,
        mode: 'existing',
        customer: mapping.customer,
        partName: mapping.partName || mapping.productName,
        partNumber: mapping.partNumber,
        scanCount: mapping.scanCount,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('not found')) {
        openBarcodeModal({ barcode: code, mode: 'new' })
        toast.info('New barcode detected. Please map it to a customer and part number.')
      } else {
        toast.error(msg || 'Failed to look up barcode')
      }
    }
  }

  async function startScanner() {
    setScannerError(null)
    setScannerOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (!(window as any).BarcodeDetector) {
        setScannerError('This browser does not support live barcode detection. You can still type the code manually.')
        return
      }
      setScanning(true)
      const detector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const loop = async () => {
        if (!videoRef.current || !scanning) return
        const video = videoRef.current
        if (video.readyState === 4 && ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            const barcodes = await detector.detect(canvas)
            if (barcodes && barcodes[0]?.rawValue) {
              const code = String(barcodes[0].rawValue).trim()
              if (code) {
                stopScanner()
                void handleBarcodeDetected(code)
                return
              }
            }
          } catch (err) {
            console.error('Barcode detection failed', err)
          }
        }
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    } catch (err) {
      console.error(err)
      setScannerError('Unable to access camera. Please check browser permissions.')
    }
  }

  function stopScanner() {
    setScanning(false)
    setScannerOpen(false)
    setManualBarcode('')
    setManualBarcodeSubmitting(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  async function loadRecent() {
    setLoadingRecent(true)
    try {
      const { activities } = await api.activities.list({ limit: 20 })
      setRecentActivities(activities)
    } catch {
    } finally {
      setLoadingRecent(false)
    }
  }

  useEffect(() => {
    void loadRecent()
    const loadCustomers = async () => {
      setLoadingCustomers(true)
      try {
        const { customers } = await api.customers.list()
        setCustomers(customers)
      } catch {
      } finally {
        setLoadingCustomers(false)
      }
    }
    void loadCustomers()
  }, [])

  function resetToNewLog() {
    setSelectedActivityId(null)
    setResult(null)
    setValidation(null)
    setError(null)
    setSaveMessage(null)
    setText('')
    setEditSummary('')
    setEditPartName('')
    setEditIntent('')
    setEditOutcome('')
    setEditNextActions('')
    setEditNotes('')
    setImageUrls([])
    setImageFile(null)
    setImagePreview(null)
    setSavedResultKey(null)
    setCustomerHintTouched(false)
  }

  async function handleExtract() {
    if (!text.trim()) {
      setError('Please describe the activity before logging with AI.')
      return
    }
    if (isEmployee) {
      const hasDropdownChoice = Boolean(selectedCustomerId)
      const hasTypedCustomer = Boolean(customerHint.trim())
      if (!hasDropdownChoice && !hasTypedCustomer) {
        setError('Please select a customer before logging with AI.')
        setCustomerHintTouched(true)
        return
      }
    }
    setError(null)
    setSaveMessage(null)
    setValidation(null)
    setSavedResultKey(null)
    setCustomerHintTouched(false)
    setLoadingExtract(true)
    try {
      const data = await api.ai.extractActivity(text, customerHint || undefined)
      setResult(data)
      const structured = (data.structured || {}) as StructuredActivity
      setEditSummary(structured.summary ?? '')
      setEditPartName(structured.part_name ?? '')
      setEditIntent(structured.intent ?? '')
      setEditOutcome(structured.outcome ?? '')
      setEditNextActions(structured.next_actions?.join('\n') ?? '')
      setEditNotes(structured.notes ?? '')
    } catch (err) {
      const message = (err as Error).message || 'Failed to extract activity'
      setError(message)
    } finally {
      setLoadingExtract(false)
    }
  }

  async function handleValidate() {
    if (!result) return
    setError(null)
    setSaveMessage(null)
    setLoadingValidate(true)
    try {
      const data = await api.ai.validateActivity(result.structured, result.rawText)
      setValidation(data)
    } catch (err) {
      const message = (err as Error).message || 'Failed to validate activity'
      setError(message)
    } finally {
      setLoadingValidate(false)
    }
  }

  async function handleSave() {
    if (!result) return
    if (isEmployee) {
      const hasDropdownChoice = Boolean(selectedCustomerId)
      const hasTypedCustomer = Boolean(customerHint.trim())
      if (!hasDropdownChoice && !hasTypedCustomer) {
        setError('Please select a customer before saving to tracker.')
        setCustomerHintTouched(true)
        return
      }
    }
    setError(null)
    setSaveMessage(null)
    setSaving(true)
    try {
      if (imageUrls.length > MAX_IMAGES_PER_ENTRY) {
        setError(`You can attach up to ${MAX_IMAGES_PER_ENTRY} images per entry.`)
        return
      }

      const base = (result.structured || {}) as any
      const resolvedSummary = editSummary || base.summary || ''
      const resolvedPartName = editPartName || base.part_name || ''
      const resolvedIntent = editIntent || base.intent || ''
      const resolvedOutcome = editOutcome || base.outcome || ''
      const resolvedNextActions = editNextActions
        ? editNextActions
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : Array.isArray(base.next_actions)
          ? base.next_actions
          : undefined
      const resolvedNotes = editNotes || base.notes || ''

      const nextActionsKey = Array.isArray(resolvedNextActions) ? resolvedNextActions.join('\n') : ''
      const imagesKey = imageUrls.slice().join('|')
      const currentKey = [
        (result.rawText || '').trim(),
        String(resolvedSummary).trim(),
        String(resolvedPartName).trim(),
        String(resolvedIntent).trim(),
        String(resolvedOutcome).trim(),
        String(nextActionsKey).trim(),
        String(resolvedNotes).trim(),
        String(imagesKey),
      ].join('||')

      if (savedResultKey && savedResultKey === currentKey) {
        setSaveMessage(selectedActivityId ? 'No changes to update.' : 'Already saved to tracker.')
        toast.info(selectedActivityId ? 'No changes to update.' : 'Already saved to tracker.')
        return
      }

      const editedStructured = {
        ...base,
        summary: resolvedSummary || base.summary,
        part_name: resolvedPartName || base.part_name,
        intent: resolvedIntent || base.intent,
        outcome: resolvedOutcome || base.outcome,
        next_actions: resolvedNextActions,
        notes: resolvedNotes || base.notes,
      }

      const resolvedRawText = text.trim() || result.rawText

      const { activity } = selectedActivityId
        ? await api.activities.update(selectedActivityId, {
            rawText: resolvedRawText,
            structured: editedStructured,
            images: imageUrls.length ? imageUrls : [],
          })
        : await api.activities.create({
            rawText: resolvedRawText,
            structured: editedStructured,
            images: imageUrls.length ? imageUrls : undefined,
          })

      setSaveMessage(selectedActivityId ? 'Activity updated.' : 'Activity saved to tracker.')
      toast.success(selectedActivityId ? 'Updated successfully.' : 'Saved to tracker.')
      setSavedResultKey(currentKey)
      // Keep recent list in sync after create/update.
      setRecentActivities((prev) => {
        const nextItem = {
          _id: (activity as any)._id,
          customer: (activity as any).customer,
          summary: (activity as any).summary,
          createdAt: (activity as any).createdAt,
        }
        if (selectedActivityId) {
          return prev.map((item) => (item._id === selectedActivityId ? nextItem : item))
        }
        return [nextItem, ...prev]
      })
    } catch (err) {
      const message = (err as Error).message || 'Failed to save activity'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectRecent(id: string) {
    setSelectedActivityId(id)
    setLoadingSelected(true)
    setError(null)
    setSaveMessage(null)
    setValidation(null)
    setSavedResultKey(null)
    setCustomerHintTouched(false)
    try {
      const { activity } = await api.activities.getOne(id)
      const detail = activity as ActivityDetail

      const structured = (detail.structuredData || {}) as StructuredActivity

      setResult({
        structured,
        rawText: detail.rawConversation ?? '',
        model: 'from-history',
      })

      setText(detail.rawConversation ?? '')
      setEditSummary(structured.summary ?? '')
      setEditPartName(structured.part_name ?? '')
      setEditIntent(structured.intent ?? '')
      setEditOutcome(structured.outcome ?? '')
      setEditNextActions(structured.next_actions?.join('\n') ?? '')
      setEditNotes(structured.notes ?? '')
      setImageUrls(detail.images ?? [])
      setImageFile(null)
      setImagePreview(null)

      // Prevent re-saving an existing activity from history
      const existingKey = [
        (detail.rawConversation ?? '').trim(),
        String(structured.summary ?? '').trim(),
        String(structured.part_name ?? '').trim(),
        String(structured.intent ?? '').trim(),
        String(structured.outcome ?? '').trim(),
        String(structured.next_actions?.join('\n') ?? '').trim(),
        String(structured.notes ?? '').trim(),
        String((detail.images ?? []).join('|')),
      ].join('||')
      setSavedResultKey(existingKey)
    } catch (err) {
      const message = (err as Error).message || 'Failed to load activity'
      setError(message)
    } finally {
      setLoadingSelected(false)
    }
  }

  const filteredActivities = recentActivities.filter((act) => {
    if (dateFilter === 'today') {
      const actDate = new Date(act.createdAt)
      const today = new Date()
      if (
        actDate.getFullYear() !== today.getFullYear() ||
        actDate.getMonth() !== today.getMonth() ||
        actDate.getDate() !== today.getDate()
      ) {
        return false
      }
    }
    if (customerFilter && act.customer !== customerFilter) return false
    return true
  })
  const mobileRecentPreview = filteredActivities.slice(0, 3)

  return (
    <AdminShell>
      <main className="max-w-6xl mx-auto px-5 sm:px-6 md:px-8 py-4 md:py-6 overflow-x-hidden">
        {/* Header row */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#111] flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <MessageSquare className="w-4 h-4" />
              </span>
              AI Chat Logging
            </h1>
            <p className="mt-1 text-sm text-[#666] max-w-xl">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => setDateFilter((prev) => (prev === 'today' ? 'all' : 'today'))}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-2 text-[12px] sm:text-sm font-semibold transition-colors ${
                dateFilter === 'today'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[#444] hover:bg-black/[0.03]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="leading-none">Today</span>
            </button>
            <button
              type="button"
              onClick={() => setCustomerFilter('')}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-2 text-[12px] sm:text-sm font-semibold transition-colors ${
                !customerFilter
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[#444] hover:bg-black/[0.03]'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span className="leading-none">All customers</span>
            </button>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-2 text-[12px] sm:text-sm font-semibold text-[#444] hover:bg-black/[0.03] transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              <span className="leading-none">Scan barcode</span>
            </button>
          </div>
        </div>

        {/* Scanner overlay */}
        {scannerOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-3 sm:p-4 md:p-6">
            <div className="w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <ScanLine className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#555]">Barcode scanner</p>
                    <p className="text-[12px] text-[#777]">Point your camera at the barcode to capture it.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 text-[#666]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pt-3 pb-4 space-y-3 flex-1 overflow-auto">
                <div className="relative w-full rounded-xl overflow-hidden bg-black/80 aspect-video flex items-center justify-center md:aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  {!scanning && !scannerError && (
                    <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-white/80">
                      Initializing camera…
                    </p>
                  )}
                </div>
                {scannerError && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p>{scannerError}</p>
                  </div>
                )}
                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#777]">
                    Enter barcode manually
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      placeholder="Type barcode value"
                      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                    <button
                      type="button"
                      disabled={manualBarcodeSubmitting || !manualBarcode.trim()}
                      onClick={async () => {
                        const code = manualBarcode.trim()
                        if (!code) return
                        setManualBarcodeSubmitting(true)
                        stopScanner()
                        try {
                          await handleBarcodeDetected(code)
                        } finally {
                          setManualBarcodeSubmitting(false)
                        }
                      }}
                      className="inline-flex items-center justify-center h-10 rounded-lg bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
                    >
                      Use code
                    </button>
                  </div>
                </div>
                <p className="text-[12px] text-[#777] leading-relaxed">
                  When a code is detected, it will be inserted into the activity text as{' '}
                  <span className="font-mono text-[11px] text-[var(--color-primary)]">Scanned barcode: ...</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {barcodeModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <ScanLine className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#555]">
                      {barcodeModal.mode === 'new' ? 'New barcode' : 'Barcode recognized'}
                    </p>
                    <p className="text-[11px] text-[#777] font-mono break-all">{barcodeModal.barcode}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeBarcodeModal}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 text-[#666]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 pt-4 pb-5 space-y-3">
                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#777]">
                    Customer
                  </label>
                  <input
                    value={barcodeCustomer}
                    onChange={(e) => setBarcodeCustomer(e.target.value)}
                    placeholder="Bosch"
                    className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#777]">
                    Part name
                  </label>
                  <input
                    value={barcodePartName}
                    onChange={(e) => setBarcodePartName(e.target.value)}
                    placeholder="Brake Housing"
                    className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#777]">
                    Part number
                  </label>
                  <input
                    value={barcodePartNumber}
                    onChange={(e) => setBarcodePartNumber(e.target.value)}
                    placeholder="BCZM-1023"
                    className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#777]">
                    Notes (optional)
                  </label>
                  <textarea
                    value={barcodeNotes}
                    onChange={(e) => setBarcodeNotes(e.target.value)}
                    rows={3}
                    placeholder="Any notes regarding this part?"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-y"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeBarcodeModal}
                    className="inline-flex items-center gap-2 h-9 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[#444] hover:bg-black/[0.03]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingBarcode}
                    onClick={async () => {
                      if (!barcodeModal?.barcode) return
                      setSavingBarcode(true)
                      try {
                        const payload = {
                          customer: barcodeCustomer.trim() || undefined,
                          partName: barcodePartName.trim() || undefined,
                          partNumber: barcodePartNumber.trim() || undefined,
                          metadata: barcodeNotes.trim() ? { notes: barcodeNotes.trim() } : undefined,
                        }
                        await api.barcodes.upsert(barcodeModal.barcode, payload)

                        if (payload.customer) {
                          setCustomerHint((prev) => prev || String(payload.customer))
                        }
                        if (payload.partName || payload.partNumber) {
                          setText((prev) =>
                            prev
                              ? `Part: ${payload.partName || ''}${payload.partNumber ? ` (${payload.partNumber})` : ''}\n${prev}`
                              : `Part: ${payload.partName || ''}${payload.partNumber ? ` (${payload.partNumber})` : ''}`
                          )
                        }

                        toast.success('Barcode saved. It will be remembered next time.')
                        closeBarcodeModal()
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to save barcode')
                      } finally {
                        setSavingBarcode(false)
                      }
                    }}
                    className="inline-flex items-center gap-2 h-9 rounded-lg bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
                  >
                    {savingBarcode ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile: recent logs modal */}
        {recentModalOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden">
            <div className="absolute inset-x-0 bottom-0 top-12 rounded-t-2xl bg-white border border-[var(--color-border)] shadow-xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#777]">Recent logs</p>
                  <p className="text-[11px] text-[#777]">{filteredActivities.length} shown</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecentModalOpen(false)
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[#444] hover:bg-black/[0.03]"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivityId(null)
                    setResult(null)
                    setValidation(null)
                    setError(null)
                    setSaveMessage(null)
                    setText('')
                    setEditSummary('')
                    setEditPartName('')
                    setEditIntent('')
                    setEditOutcome('')
                    setEditNextActions('')
                    setEditNotes('')
                    setImageUrls([])
                    setImageFile(null)
                    setImagePreview(null)
                    setSavedResultKey(null)
                    setCustomerHintTouched(false)
                    setRecentModalOpen(false)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] font-semibold text-[#444] hover:bg-black/[0.03]"
                >
                  <Plus className="w-4 h-4" />
                  New log
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedActivityId) {
                      setError('Select a log from the list before archiving.')
                      return
                    }
                    setArchiving(true)
                    setError(null)
                    setSaveMessage(null)
                    try {
                      await api.activities.archive(selectedActivityId)
                      setRecentActivities((prev) => prev.filter((a) => a._id !== selectedActivityId))
                      setSelectedActivityId(null)
                      setResult(null)
                      setValidation(null)
                      setText('')
                      setEditSummary('')
                      setEditPartName('')
                      setEditIntent('')
                      setEditOutcome('')
                      setEditNextActions('')
                      setEditNotes('')
                      setImageUrls([])
                      setImageFile(null)
                      setImagePreview(null)
                      setSavedResultKey(null)
                      setRecentModalOpen(false)
                    } catch (err) {
                      const message = (err as Error).message || 'Failed to archive activity'
                      setError(message)
                    } finally {
                      setArchiving(false)
                    }
                  }}
                  disabled={!selectedActivityId || archiving}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] font-semibold text-[#666] hover:bg-black/[0.03] disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  {archiving ? 'Archiving…' : 'Archive'}
                </button>
              </div>

              <div className="flex-1 overflow-auto divide-y divide-[var(--color-border)]">
                {loadingRecent ? (
                  <div className="px-4 py-3 text-left text-xs text-[#777]">Loading recent logs…</div>
                ) : filteredActivities.length > 0 ? (
                  filteredActivities.map((act) => {
                    const isSelected = act._id === selectedActivityId
                    return (
                      <button
                        key={act._id}
                        type="button"
                        onClick={() => {
                          void handleSelectRecent(act._id)
                          setRecentModalOpen(false)
                        }}
                        className={`relative w-full text-left px-4 py-3 transition-colors ${
                          isSelected ? 'bg-[var(--color-primary)]/6' : 'hover:bg-black/[0.025]'
                        }`}
                      >
                        {isSelected && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"
                          />
                        )}
                        <p className="text-xs font-medium text-[#999] mb-0.5 truncate">
                          {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-[#222] truncate">{act.summary || 'No summary'}</p>
                      </button>
                    )
                  })
                ) : (
                  <div className="px-4 py-6 text-left">
                    <p className="text-xs font-medium text-[#999] mb-0.5">
                      {recentActivities.length === 0 ? 'No activity yet' : 'No matching logs'}
                    </p>
                    <p className="text-sm text-[#666]">
                      {recentActivities.length === 0
                        ? 'Use the form to describe an activity. The AI will extract a structured log for you.'
                        : dateFilter === 'today' || customerFilter
                          ? 'Try "All customers" or show all dates.'
                          : 'Use the form to add a new activity.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,_260px)_minmax(0,_1fr)]">
          {/* Left: recent activity list */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden hidden md:block">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#777]">Recent logs</p>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivityId(null)
                    setResult(null)
                    setValidation(null)
                    setError(null)
                    setSaveMessage(null)
                    setText('')
                    setEditSummary('')
                    setEditPartName('')
                    setEditIntent('')
                    setEditOutcome('')
                    setEditNextActions('')
                    setEditNotes('')
                    setImageUrls([])
                    setImageFile(null)
                    setImagePreview(null)
                    setSavedResultKey(null)
                    setCustomerHintTouched(false)
                  }}
                  className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-[11px] font-semibold text-[#444] hover:bg-black/[0.03] border border-[var(--color-border)] bg-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New log
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedActivityId) {
                      setError('Select a log from the list before archiving.')
                      return
                    }
                    setArchiving(true)
                    setError(null)
                    setSaveMessage(null)
                    try {
                      await api.activities.archive(selectedActivityId)
                      setRecentActivities((prev) => prev.filter((a) => a._id !== selectedActivityId))
                      setSelectedActivityId(null)
                      setResult(null)
                      setValidation(null)
                      setText('')
                      setEditSummary('')
                      setEditPartName('')
                      setEditIntent('')
                      setEditOutcome('')
                      setEditNextActions('')
                      setEditNotes('')
                      setImageUrls([])
                      setImageFile(null)
                      setImagePreview(null)
                      setSavedResultKey(null)
                    } catch (err) {
                      const message = (err as Error).message || 'Failed to archive activity'
                      setError(message)
                    } finally {
                      setArchiving(false)
                    }
                  }}
                  disabled={!selectedActivityId || archiving}
                  className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-[11px] font-semibold text-[#666] hover:bg-black/[0.03] disabled:opacity-50 border border-[var(--color-border)] bg-white transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {archiving ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto divide-y divide-[var(--color-border)]">
              {loadingRecent ? (
                <div className="px-4 py-3 text-left text-xs text-[#777]">Loading recent logs…</div>
              ) : filteredActivities.length > 0 ? (
                filteredActivities.map((act) => {
                  const isSelected = act._id === selectedActivityId
                  return (
                    <button
                      key={act._id}
                      type="button"
                      onClick={() => void handleSelectRecent(act._id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)]/6 border-l-2 border-[var(--color-primary)]'
                          : 'hover:bg-black/[0.025]'
                      }`}
                    >
                      <p className="text-xs font-medium text-[#999] mb-0.5 truncate">
                        {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-[#222] truncate">{act.summary || 'No summary'}</p>
                    </button>
                  )
                })
              ) : (
                <div className="px-4 py-6 text-left">
                  <p className="text-xs font-medium text-[#999] mb-0.5">
                    {recentActivities.length === 0
                      ? 'No activity yet'
                      : 'No matching logs'}
                  </p>
                  <p className="text-sm text-[#666]">
                    {recentActivities.length === 0
                      ? 'Use the form on the right to describe an activity. The AI will extract a structured log for you.'
                      : dateFilter === 'today' || customerFilter
                        ? 'Try "All customers" or show all dates.'
                        : 'Use the form on the right to add a new activity.'}
                  </p>
                </div>
              )}
            </div>
            {loadingSelected && (
              <div className="px-4 py-2 text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                Loading selected activity…
              </div>
            )}
          </section>

          {/* Mobile: recent logs preview */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden md:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#777]">Recent logs</p>
              <button
                type="button"
                onClick={() => setRecentModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-[11px] font-semibold text-[#444] hover:bg-black/[0.03] border border-[var(--color-border)] bg-white transition-colors"
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {loadingRecent ? (
                <div className="px-4 py-3 text-left text-xs text-[#777]">Loading recent logs…</div>
              ) : mobileRecentPreview.length > 0 ? (
                mobileRecentPreview.map((act) => {
                  const isSelected = act._id === selectedActivityId
                  return (
                  <button
                    key={act._id}
                    type="button"
                    onClick={() => void handleSelectRecent(act._id)}
                    className={`relative w-full text-left px-4 py-3 transition-colors ${
                      isSelected ? 'bg-[var(--color-primary)]/6' : 'hover:bg-black/[0.025]'
                    }`}
                  >
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"
                      />
                    )}
                    <p className="text-xs font-medium text-[#999] mb-0.5 truncate">
                      {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-[#222] truncate">{act.summary || 'No summary'}</p>
                  </button>
                  )
                })
              ) : (
                <div className="px-4 py-6 text-left">
                  <p className="text-xs font-medium text-[#999] mb-0.5">
                    {recentActivities.length === 0 ? 'No activity yet' : 'No matching logs'}
                  </p>
                  <p className="text-sm text-[#666]">
                    {recentActivities.length === 0
                      ? 'Use the form below to describe an activity.'
                      : dateFilter === 'today' || customerFilter
                        ? 'Try "All customers" or show all dates.'
                        : 'Use the form below to add a new activity.'}
                  </p>
                </div>
              )}
            </div>
            {filteredActivities.length > mobileRecentPreview.length && (
              <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                <button
                  type="button"
                  onClick={() => setRecentModalOpen(true)}
                  className="w-full inline-flex items-center justify-center h-9 rounded-lg border border-[var(--color-border)] bg-white text-[12px] font-semibold text-[#444] hover:bg-black/[0.03]"
                >
                  View all recent logs ({filteredActivities.length})
                </button>
              </div>
            )}
          </section>

          {/* Right: chat surface */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col min-h-[420px]">
            {/* Chat meta */}
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777]">New activity</p>
                <p className="text-sm text-[#333]">
                  Describe a call, issue, task, or conversation and we&apos;ll turn it into a structured activity.
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                <button
                  ref={newLogButtonRef}
                  type="button"
                  onClick={() => resetToNewLog()}
                  className="inline-flex sm:hidden w-full items-center justify-center h-9 rounded-lg bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  New log
                </button>
                <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                  <p className="text-xs text-[#777]">
                    1) Extract JSON with AI, 2) validate, 3) save to tracker.
                  </p>
                  <Link to="/dashboard" className="text-[11px] font-medium text-[var(--color-primary)] hover:underline">
                    View dashboard
                  </Link>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 px-4 sm:px-5 py-4 space-y-3 overflow-auto bg-[var(--color-bg)]">
              {error && (
                <div className="flex items-start gap-2 rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {result && (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-xs font-medium text-[#666]">Extracted JSON</p>
                    {validation && (
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          validation.ok && validation.severity === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {validation.ok ? 'Ready to save' : validation.severity === 'critical' ? 'Needs attention' : 'Review suggested'}
                        </span>
                      </div>
                    )}
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-[var(--radius)] bg-[#0b1020] text-[11px] text-[#e5f0ff] px-3 py-2 border border-[#1f2937] whitespace-pre-wrap break-words">
                    {JSON.stringify(result.structured, null, 2)}
                  </pre>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Summary
                        </label>
                        <input
                          type="text"
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="One-sentence summary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Part name
                        </label>
                        <input
                          type="text"
                          value={editPartName}
                          onChange={(e) => setEditPartName(e.target.value)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="e.g. wheel liner, BCM, IP"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Intent
                        </label>
                        <input
                          type="text"
                          value={editIntent}
                          onChange={(e) => setEditIntent(e.target.value)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="What were you trying to achieve?"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Outcome
                        </label>
                        <input
                          type="text"
                          value={editOutcome}
                          onChange={(e) => setEditOutcome(e.target.value)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="What actually happened / decided?"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Next actions (one per line)
                        </label>
                        <textarea
                          rows={3}
                          value={editNextActions}
                          onChange={(e) => setEditNextActions(e.target.value)}
                          className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="- Call supplier\n- Take new photos\n- Check DTC history"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Notes
                        </label>
                        <textarea
                          rows={2}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="Any extra context or clarifications."
                        />
                      </div>
                    </div>
                  </div>
                  {validation && (validation.issues.length > 0 || validation.suggestions.length > 0) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {validation.issues.length > 0 && (
                        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-amber-800 mb-1">Issues</p>
                          <ul className="space-y-0.5">
                            {validation.issues.map((issue, idx) => (
                              <li key={idx} className="text-[11px] text-amber-900">
                                • {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validation.suggestions.length > 0 && (
                        <div className="rounded-[var(--radius)] border border-sky-200 bg-sky-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-sky-800 mb-1">Suggestions</p>
                          <ul className="space-y-0.5">
                            {validation.suggestions.map((s, idx) => (
                              <li key={idx} className="text-[11px] text-sky-900">
                                • {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {saveMessage && (
                    <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] px-4 sm:px-5 py-3 bg-white">
              <div className="flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Example: Spoke with Apex Engineering about line-3 downtime; diagnosed sensor issue and planned follow‑up visit tomorrow at 10:00."
                  className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                />
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedCustomerId(id)
                      const customer = customers.find((c) => c._id === id)
                      // Only auto-fill if the employee hasn't typed a custom value
                      if (!customerHintTouched || !customerHint.trim()) {
                        setCustomerHint(customer?.name ?? '')
                        setCustomerHintTouched(false)
                      }
                    }}
                    className="w-full sm:w-1/2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs text-[#222] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                  >
                    <option value="">
                      {loadingCustomers
                        ? 'Loading customers…'
                        : isEmployee
                          ? 'Select customer *'
                          : 'Select customer (optional)'}
                    </option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}{c.email ? ` — ${c.email}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customerHint}
                    onChange={(e) => {
                      setCustomerHint(e.target.value)
                      setCustomerHintTouched(true)
                    }}
                    placeholder={isEmployee ? 'Type customer name (required if not selected)' : 'Or type a customer / project name'}
                    className="w-full sm:flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                  />
                </div>
                {/* Image upload section */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] sm:text-xs text-[#444] cursor-pointer hover:bg-black/[0.03]">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{imageFile ? 'Change image' : 'Attach image (optional)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setImageFile(file)
                            setImagePreview(URL.createObjectURL(file))
                            setUploadError(null)
                          }
                        }}
                      />
                    </label>
                    {imageFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null)
                          setImagePreview(null)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[#666] hover:bg-black/[0.03]"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                    {imageFile && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!imageFile) return
                          if (imageUrls.length >= MAX_IMAGES_PER_ENTRY) {
                            setUploadError(`You can attach up to ${MAX_IMAGES_PER_ENTRY} images per entry.`)
                            return
                          }
                          setUploadingImage(true)
                          setUploadError(null)
                          try {
                            const { url } = await api.upload.image(imageFile)
                            setImageUrls((prev) => [...prev, url])
                            setImageFile(null)
                            setImagePreview(null)
                          } catch (err) {
                            const msg = (err as Error).message || 'Failed to upload image'
                            setUploadError(msg)
                          } finally {
                            setUploadingImage(false)
                          }
                        }}
                        disabled={uploadingImage || imageUrls.length >= MAX_IMAGES_PER_ENTRY}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-[var(--color-primary)]/15 disabled:opacity-60"
                      >
                        {uploadingImage
                          ? 'Uploading…'
                          : imageUrls.length >= MAX_IMAGES_PER_ENTRY
                            ? 'Max images reached'
                            : 'Upload image'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {imagePreview && (
                      <div className="h-10 w-10 rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]">
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                    {imageUrls.length > 0 && (
                      <p className="text-[10px] text-[#777]">
                        {imageUrls.length}/{MAX_IMAGES_PER_ENTRY} image{imageUrls.length !== 1 ? 's' : ''} attached
                      </p>
                    )}
                  </div>
                </div>
                {uploadError && (
                  <p className="text-[11px] text-red-600">{uploadError}</p>
                )}
                <p className="text-[11px] text-[#777] leading-relaxed">
                  Upload up to 4 photos as evidence for this activity (defect, part label/barcode, workstation
                  condition, or before/after repair). Use clear images that help explain the issue and resolution.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-[#999] hidden sm:block">
                    1) Extract JSON, 2) validate the log, 3) save when you&apos;re satisfied.
                  </p>
                  <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto sm:items-center">
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={loadingExtract}
                      className="inline-flex w-full flex-col items-center justify-center gap-1 rounded-[var(--radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3 py-2.5 text-[12px] sm:text-sm font-semibold text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed min-h-12"
                    >
                      <Send className="w-4 h-4" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        {loadingExtract ? (
                          '…'
                        ) : (
                          <>
                            <span className="sm:hidden">Log</span>
                            <span className="hidden sm:inline">Log with AI</span>
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleValidate}
                      disabled={!result || loadingValidate}
                      className="inline-flex w-full flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-white hover:bg-black/[0.03] px-3 py-2.5 text-[12px] sm:text-xs font-semibold text-[#444] transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-12"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        {loadingValidate ? '…' : 'Validate'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!result || saving}
                      className="inline-flex w-full flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-2.5 text-[12px] sm:text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-12"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        {saving ? '…' : 'Save'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AdminShell>
  )
}

