import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MessageSquare,
  Clock,
  Tag,
  Archive,
  Send,
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  X,
  Plus,
  ScanLine,
  Paperclip,
  Video,
  FileText,
  Users,
  UserCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { useSharedLogsNotify } from '@/context/SharedLogsNotifyContext'

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
  customer?: string
  summary?: string
  part_name?: string
  intent?: string
  outcome?: string
  next_actions?: string[]
  notes?: string
}

type ActivityAttachment = {
  url: string
  name: string
  mime?: string
  size?: number
}

type ActivityDetail = {
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
  summary?: string
  rawConversation?: string
  structuredData?: StructuredActivity | (StructuredActivity & Record<string, unknown>)
  images?: string[]
  attachments?: ActivityAttachment[]
  createdAt: string
}

function activityOwnerId(d: ActivityDetail | null): string | null {
  if (!d?.userId) return null
  const u = d.userId as { _id?: string } | string
  if (typeof u === 'object' && u !== null && '_id' in u && u._id) return String(u._id)
  return String(d.userId)
}

type CollabNote = NonNullable<ActivityDetail['collaborationNotes']>[number]

function noteAuthorId(note: CollabNote): string {
  const u = note.userId as unknown
  if (typeof u === 'string' && u.trim()) return u.trim()
  if (u && typeof u === 'object' && u !== null && '_id' in u && (u as { _id?: unknown })._id != null) {
    return String((u as { _id: unknown })._id)
  }
  return ''
}

function isCollabNoteFromUser(
  note: CollabNote,
  u: { id: string; email?: string } | null | undefined
): boolean {
  if (!u?.id) return false
  const aid = noteAuthorId(note)
  if (aid && String(aid) === String(u.id)) return true
  const raw = note.userId as { email?: string } | null | undefined
  if (raw && typeof raw === 'object' && u.email && typeof raw.email === 'string') {
    if (raw.email.trim().toLowerCase() === u.email.trim().toLowerCase()) return true
  }
  return false
}

function collabNoteKey(n: CollabNote): string {
  if (n._id) return String(n._id)
  return `${noteAuthorId(n)}-${n.createdAt}-${(n.text || '').slice(0, 48)}`
}

/** Stable pastel styles per author so different people are easy to tell apart */
const OTHER_NOTE_STYLES = [
  {
    bubble:
      'border-sky-200/90 bg-gradient-to-br from-sky-50 to-sky-50/70 text-slate-900 ring-1 ring-sky-100/80',
    meta: 'text-sky-900/70',
  },
  {
    bubble:
      'border-violet-200/85 bg-gradient-to-br from-violet-50 to-violet-50/70 text-slate-900 ring-1 ring-violet-100/80',
    meta: 'text-violet-900/70',
  },
  {
    bubble:
      'border-emerald-200/85 bg-gradient-to-br from-emerald-50 to-emerald-50/70 text-slate-900 ring-1 ring-emerald-100/80',
    meta: 'text-emerald-900/70',
  },
  {
    bubble:
      'border-amber-200/90 bg-gradient-to-br from-amber-50 to-amber-50/65 text-slate-900 ring-1 ring-amber-100/80',
    meta: 'text-amber-900/75',
  },
  {
    bubble:
      'border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-50/70 text-slate-900 ring-1 ring-rose-100/70',
    meta: 'text-rose-900/70',
  },
  {
    bubble:
      'border-cyan-200/85 bg-gradient-to-br from-cyan-50 to-cyan-50/70 text-slate-900 ring-1 ring-cyan-100/80',
    meta: 'text-cyan-900/70',
  },
]

function styleIndexForAuthorId(authorId: string): number {
  if (!authorId) return 0
  let h = 0
  for (let i = 0; i < authorId.length; i++) {
    h = (h + authorId.charCodeAt(i) * (i + 19)) >>> 0
  }
  return h % OTHER_NOTE_STYLES.length
}

const OTHER_AVATAR_STYLES = [
  'bg-sky-200/90 text-sky-950 border border-sky-300/80',
  'bg-violet-200/90 text-violet-950 border border-violet-300/80',
  'bg-emerald-200/90 text-emerald-950 border border-emerald-300/80',
  'bg-amber-200/90 text-amber-950 border border-amber-300/80',
  'bg-rose-200/90 text-rose-950 border border-rose-300/80',
  'bg-cyan-200/90 text-cyan-950 border border-cyan-300/80',
]

const MAX_IMAGES_PER_ENTRY = 8
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024 // 10 MB — keep in sync with Backend upload middleware
const MAX_IMAGE_FILE_ERROR = 'Maximum file size up to 10 MB.'
const MAX_ATTACHMENTS_PER_ENTRY = 10
const MAX_ATTACHMENT_FILE_BYTES = 50 * 1024 * 1024 // 50 MB — keep in sync with Backend attachment middleware
const MAX_ATTACHMENT_FILE_ERROR = 'Maximum attachment size is 50 MB.'

/** Poll server so collaboration updates appear without manual refresh (not true WebSocket realtime). */
const POLL_ACTIVITY_DETAIL_MS = 8000
const POLL_ACTIVITY_LIST_MS = 22000

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

export function ChatPage() {
  const { user } = useAuth()
  const { highlightSharedIds, clearSharedLogHighlight } = useSharedLogsNotify()
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
    { _id: string; customer?: string; summary?: string; createdAt: string; isOwner?: boolean }[]
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
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false)
  const [failedUploadedImages, setFailedUploadedImages] = useState<Record<string, boolean>>({})
  const [failedAttachmentVideos, setFailedAttachmentVideos] = useState<Record<string, boolean>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<ActivityAttachment[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [loadingSelected, setLoadingSelected] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null)
  const [coworkers, setCoworkers] = useState<{ id: string; name?: string; email: string; role: string }[]>([])
  const [loadingCoworkers, setLoadingCoworkers] = useState(false)
  const [coworkersError, setCoworkersError] = useState<string | null>(null)
  const [shareSearch, setShareSearch] = useState('')
  const [shareSelection, setShareSelection] = useState<string[]>([])
  /** Team panel: split sharing vs notes so the page is less overwhelming */
  const [teamWorkspaceTab, setTeamWorkspaceTab] = useState<'sharing' | 'notes'>('notes')
  const [showExtractedJson, setShowExtractedJson] = useState(false)
  const [collabNote, setCollabNote] = useState('')
  const [savingShare, setSavingShare] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const mainLogLocked =
    Boolean(selectedActivityId && activityDetail && user && user.role !== 'admin' && activityOwnerId(activityDetail) !== user.id)

  const canArchiveSelected =
    Boolean(selectedActivityId && activityDetail && user && (user.role === 'admin' || activityOwnerId(activityDetail) === user.id))

  const canManageSharing = Boolean(
    activityDetail && user && (user.role === 'admin' || activityOwnerId(activityDetail) === user.id)
  )

  const canAddCollabNote = Boolean(
    activityDetail &&
      user &&
      (user.role === 'admin' ||
        activityOwnerId(activityDetail) === user.id ||
        activityDetail.sharedWith?.some((s) => String(s._id) === user.id))
  )

  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all')
  const [customerFilter, setCustomerFilter] = useState<string>('') // '' = all customers
  const [savedResultKey, setSavedResultKey] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const scanningRef = useRef(false)
  const zxingLoadPromiseRef = useRef<Promise<any> | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualBarcodeSubmitting, setManualBarcodeSubmitting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [barcodeModal, setBarcodeModal] = useState<{
    barcode: string
    mode: 'new' | 'existing'
    customer?: string
    partName?: string
    partNumber?: string
    scanCount?: number
    prompt?: string
    fields?: string[]
  } | null>(null)
  const [barcodeCustomer, setBarcodeCustomer] = useState('')
  const [barcodePartName, setBarcodePartName] = useState('')
  const [barcodePartNumber, setBarcodePartNumber] = useState('')
  const [barcodeNotes, setBarcodeNotes] = useState('')
  const [savingBarcode, setSavingBarcode] = useState(false)
  const [recentModalOpen, setRecentModalOpen] = useState(false)
  const newLogButtonRef = useRef<HTMLButtonElement | null>(null)

  const loadTeamForSharing = useCallback(async () => {
    if (!user) return
    setLoadingCoworkers(true)
    setCoworkersError(null)
    try {
      if (user.role === 'admin') {
        const { users } = await api.auth.getUsers()
        const mapped = users
          .filter((u) => u.id !== user.id && u.isActive !== false)
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
          }))
          .sort((a, b) =>
            (a.name || a.email).localeCompare(b.name || b.email, undefined, { sensitivity: 'base' })
          )
        setCoworkers(mapped)
      } else {
        const { users } = await api.auth.getCoworkers()
        setCoworkers(users)
      }
    } catch (err) {
      setCoworkersError(err instanceof Error ? err.message : 'Could not load team list')
      setCoworkers([])
    } finally {
      setLoadingCoworkers(false)
    }
  }, [user])

  const displayedCoworkers = useMemo(() => {
    const q = shareSearch.trim().toLowerCase()
    const match = (c: (typeof coworkers)[0]) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    const seen = new Set<string>()
    const out: typeof coworkers = []
    for (const c of coworkers) {
      if (!shareSelection.includes(c.id) && !match(c)) continue
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
    return out.sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email, undefined, { sensitivity: 'base' })
    )
  }, [coworkers, shareSearch, shareSelection])

  function normalizeCustomerName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  function isUnsupportedIphoneImage(file: File) {
    const type = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')
  }

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

  /** iPhone / iPad browsers (including Chrome on iOS) use WebKit; BarcodeDetector is often missing or unreliable. */
  function isAppleMobileWebKit() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) return true
    const nav = navigator as Navigator & { maxTouchPoints?: number }
    return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1
  }

  async function loadZXingFromCDN() {
    if ((window as any).ZXing) return (window as any).ZXing
    if (!zxingLoadPromiseRef.current) {
      zxingLoadPromiseRef.current = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-zxing="true"]') as HTMLScriptElement | null
        if (existing) {
          // In case the script tag exists but hasn't loaded yet.
          existing.addEventListener('load', () => resolve((window as any).ZXing))
          existing.addEventListener('error', reject)
          return
        }

        const script = document.createElement('script')
        script.setAttribute('data-zxing', 'true')
        script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
        script.async = true
        script.onload = () => resolve((window as any).ZXing)
        script.onerror = () => reject(new Error('Failed to load ZXing fallback scanner'))
        document.head.appendChild(script)
      })
    }
    return zxingLoadPromiseRef.current
  }

  async function handleBarcodeDetected(code: string) {
    setText((prev) => (prev ? `Scanned barcode: ${code}\n${prev}` : `Scanned barcode: ${code}`))

    try {
      const clarification = await api.barcodes.clarify(code)
      const mapping = clarification.mapping
      if (mapping?.customer) {
        setCustomerHint((prev) => prev || String(mapping.customer))
      }

      const readablePart = mapping?.partName || mapping?.productName || ''
      if (clarification.mode === 'known') {
        toast.info(
          readablePart || mapping?.partNumber || mapping?.customer
            ? `Known barcode: ${readablePart}${mapping?.partNumber ? ` [${mapping.partNumber}]` : ''}${mapping?.customer ? ` (${mapping.customer})` : ''}`.trim()
            : 'Known barcode recognized.'
        )
      } else {
        toast.info('New barcode detected. Please confirm customer/part once so it is reused next time.')
      }

      // Keep scan counts in memory fresh for known barcodes.
      if (clarification.mode === 'known') {
        try {
          await api.barcodes.scan(code)
        } catch {
          // Non-blocking: clarification UX should still continue if scan-count update fails.
        }
      }

      openBarcodeModal({
        barcode: code,
        mode: clarification.mode === 'known' ? 'existing' : 'new',
        customer: mapping?.customer,
        partName: mapping?.partName || mapping?.productName,
        partNumber: mapping?.partNumber,
        scanCount: mapping?.scanCount,
        prompt: clarification.prompt,
        fields: Array.isArray(clarification.fields) ? clarification.fields : [],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check barcode'
      toast.error(msg)
    }
  }

  async function startScanner() {
    setScannerError(null)
    setScannerOpen(true)
    try {
      let stream: MediaStream
      try {
        // Prefer back camera on mobile, but some browsers/devices reject this constraint.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      } catch {
        // Fallback: request any available camera.
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const hasBarcodeDetector = Boolean((window as any).BarcodeDetector)
      const useZxingOnApple = isAppleMobileWebKit()
      // On Apple mobile WebKit, run ZXing immediately — native detector is often absent or never returns results.
      const preferZxingImmediately = !hasBarcodeDetector || useZxingOnApple
      const zxingIntervalMs = preferZxingImmediately ? 400 : 1200
      setScanning(true)
      scanningRef.current = true

      // Create a primary detector only if the browser supports it.
      // If not supported (common on some iPhones), we will rely on the ZXing fallback.
      let detector: any = null
      if (hasBarcodeDetector && !useZxingOnApple) {
        const desiredFormats = ['qr_code', 'data_matrix', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
        const supportedFormats =
          typeof (window as any).BarcodeDetector.getSupportedFormats === 'function'
            ? await (window as any).BarcodeDetector.getSupportedFormats()
            : desiredFormats

        const formats = desiredFormats.filter((f) => supportedFormats.includes(f))
        // Some Android browsers may report a partial/odd supported format list.
        // If filtering results in nothing, fall back to "detect all" to avoid scanning a blank list.
        detector = formats.length
          ? new (window as any).BarcodeDetector({ formats })
          : new (window as any).BarcodeDetector()
      }
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const scanStartedAt = Date.now()
      let primaryDetected = false
      let fallbackStarted = preferZxingImmediately
      let zxingBusy = false
      let lastPrimaryDetectAt = 0
      let lastZxingAttemptAt = 0
      const loop = async () => {
        if (!videoRef.current || !scanningRef.current) return
        const video = videoRef.current
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && ctx) {
          try {
            const now = Date.now()
            // Slightly higher resolution on Apple mobile helps ZXing; still capped for performance.
            const maxDim = preferZxingImmediately ? 1024 : 900
            const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
            const drawW = Math.max(1, Math.floor(video.videoWidth * scale))
            const drawH = Math.max(1, Math.floor(video.videoHeight * scale))
            canvas.width = drawW
            canvas.height = drawH
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            const shouldTryPrimary = now - lastPrimaryDetectAt > 350
            if (shouldTryPrimary) lastPrimaryDetectAt = now

            let barcodes: any[] | undefined
            if (shouldTryPrimary) {
              barcodes = detector ? await detector.detect(canvas) : undefined
            }

            if (barcodes && barcodes.length) {
              primaryDetected = true
              const decoded = (b: any) => {
                const value = b?.rawValue ?? b?.value
                return typeof value === 'string' ? value.trim() : ''
              }

              // If multiple codes are found, prefer QR first (as requested by client).
              // Different browsers may use different field names and format identifiers.
              const qr = barcodes.find((b: any) => {
                const fmt = String(b?.format ?? '').toLowerCase()
                return fmt.includes('qr') && decoded(b)
              })
              const chosen = qr ?? barcodes.find((b: any) => decoded(b))
              const code = decoded(chosen)
              if (code) {
                primaryDetected = true
                stopScanner()
                void handleBarcodeDetected(code)
                return
              }
            }
            // Fallback if BarcodeDetector returns nothing for a while on this device/browser.
            const shouldStartFallback = !primaryDetected && !fallbackStarted && now - scanStartedAt > 2500
            if (shouldStartFallback) {
              fallbackStarted = true
            }

            const shouldTryZxing =
              fallbackStarted && !primaryDetected && now - lastZxingAttemptAt > zxingIntervalMs && !zxingBusy
            if (shouldTryZxing) {
              zxingBusy = true
              lastZxingAttemptAt = now

              const decodeWithZXing = async (mode: 'qr' | 'barcode') => {
                const ZXing = await loadZXingFromCDN()
                const {
                  MultiFormatReader,
                  DecodeHintType,
                  BarcodeFormat,
                  BinaryBitmap,
                  HybridBinarizer,
                  GlobalHistogramBinarizer,
                  RGBLuminanceSource,
                  HTMLCanvasElementLuminanceSource,
                  InvertedLuminanceSource,
                } = ZXing

                const hints = new Map()
                hints.set(DecodeHintType.TRY_HARDER, true)

                const qrFormats = [
                  BarcodeFormat.QR_CODE,
                  BarcodeFormat.DATA_MATRIX,
                  BarcodeFormat.AZTEC,
                ].filter(Boolean)
                const barcodeFormats = [
                  BarcodeFormat.CODE_128,
                  BarcodeFormat.EAN_13,
                  BarcodeFormat.EAN_8,
                  BarcodeFormat.UPC_A,
                  BarcodeFormat.UPC_E,
                  BarcodeFormat.CODE_39,
                  BarcodeFormat.CODE_93,
                  BarcodeFormat.ITF,
                  BarcodeFormat.PDF_417,
                  BarcodeFormat.CODABAR,
                ].filter(Boolean)
                hints.set(DecodeHintType.POSSIBLE_FORMATS, mode === 'qr' ? qrFormats : barcodeFormats)

                let luminanceSource: any
                if (typeof HTMLCanvasElementLuminanceSource === 'function') {
                  luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)
                } else {
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                  const grey = new Uint8ClampedArray(canvas.width * canvas.height)
                  const d = imageData.data
                  let j = 0
                  for (let i = 0; i < d.length; i += 4) {
                    grey[j++] = ((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114 + 500) / 1000) | 0
                  }
                  luminanceSource = new RGBLuminanceSource(grey, canvas.width, canvas.height)
                }

                const trySources = [luminanceSource]
                if (typeof InvertedLuminanceSource === 'function') {
                  trySources.push(new InvertedLuminanceSource(luminanceSource))
                }

                for (const source of trySources) {
                  for (const Binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
                    if (typeof Binarizer !== 'function') continue
                    try {
                      const reader = new MultiFormatReader()
                      reader.setHints(hints)
                      const binaryBitmap = new BinaryBitmap(new Binarizer(source))
                      const result = reader.decode(binaryBitmap)
                      const text = typeof result.getText === 'function' ? result.getText() : result.text
                      const format =
                        typeof result.getBarcodeFormat === 'function' ? result.getBarcodeFormat().toString() : ''
                      return { text: String(text || '').trim(), format }
                    } catch {
                      // NotFoundException: try next binarizer / source
                    }
                  }
                }
                return { text: '', format: '' }
              }

              try {
                // QR first, as requested by the client.
                const qrResult = await decodeWithZXing('qr')
                if (qrResult?.text) {
                  stopScanner()
                  void handleBarcodeDetected(qrResult.text)
                  return
                }

                const bcResult = await decodeWithZXing('barcode')
                if (bcResult?.text) {
                  stopScanner()
                  void handleBarcodeDetected(bcResult.text)
                  return
                }
              } catch (e) {
                // NotFound or decode failure: ignore and try again later.
                console.debug('ZXing fallback decode not found/failed', e)
              } finally {
                zxingBusy = false
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
      const name = (err as { name?: string })?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setScannerError('Camera permission denied. Please allow camera access in browser site settings.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setScannerError('No camera found on this device.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setScannerError('Camera is busy in another app. Please close other camera apps and try again.')
      } else {
        setScannerError('Unable to access camera. Please check browser permissions.')
      }
    }
  }

  function stopScanner() {
    setScanning(false)
    scanningRef.current = false
    setScannerOpen(false)
    setManualBarcode('')
    setManualBarcodeSubmitting(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  /** List refresh only; new shared-log toasts run app-wide in SharedLogsNotifyProvider */
  const refreshRecentList = useCallback(async (opts?: { silent?: boolean }) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (!opts?.silent) setLoadingRecent(true)
    try {
      const { activities } = await api.activities.list({ limit: 20 })
      setRecentActivities(activities)
    } catch {
    } finally {
      if (!opts?.silent) setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    void refreshRecentList({ silent: false })
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
  }, [refreshRecentList])

  useEffect(() => {
    const id = window.setInterval(() => void refreshRecentList({ silent: true }), POLL_ACTIVITY_LIST_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshRecentList({ silent: true })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshRecentList])

  useEffect(() => {
    void loadTeamForSharing()
  }, [loadTeamForSharing])

  /** Merge collaboration fields while a log is open — no full page refresh needed for new notes. */
  const collabPullInFlightRef = useRef(false)
  const lastRemoteNoteToastAtRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!selectedActivityId || !user?.id) return
    let cancelled = false

    const pull = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (collabPullInFlightRef.current) return
      collabPullInFlightRef.current = true
      try {
        const { activity } = await api.activities.getOne(selectedActivityId)
        if (cancelled) return
        const next = activity as ActivityDetail

        setActivityDetail((prev) => {
          if (!prev || prev._id !== next._id) return next

          const prevNoteKeys = new Set((prev.collaborationNotes ?? []).map((n) => collabNoteKey(n)))
          const now = Date.now()
          for (const n of next.collaborationNotes ?? []) {
            const nk = collabNoteKey(n)
            if (prevNoteKeys.has(nk) || isCollabNoteFromUser(n, user)) continue

            const lastToast = lastRemoteNoteToastAtRef.current[nk] ?? 0
            if (now - lastToast < 5000) continue
            lastRemoteNoteToastAtRef.current[nk] = now

            const who = (n.userId?.name || n.userId?.email || 'Someone').trim()
            toast.info(`${who} added a note on this log`)
          }

          const wasInShared = (prev.sharedWith ?? []).some((s) => String(s._id) === user.id)
          const nowInShared = (next.sharedWith ?? []).some((s) => String(s._id) === user.id)
          if (!wasInShared && nowInShared) {
            toast.info('You were added to this log — you can view and add notes')
          }

          return {
            ...prev,
            collaborationNotes: next.collaborationNotes,
            sharedWith: next.sharedWith,
            userId: next.userId,
          }
        })
      } catch {
        /* ignore transient poll errors */
      } finally {
        collabPullInFlightRef.current = false
      }
    }

    void pull()
    const intervalId = window.setInterval(pull, POLL_ACTIVITY_DETAIL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
      collabPullInFlightRef.current = false
    }
  }, [selectedActivityId, user?.id])

  useEffect(() => {
    if (selectedCustomerId || !customerHint.trim() || customers.length === 0) return
    const normalized = normalizeCustomerName(customerHint)
    const matched = customers.find((c) => normalizeCustomerName(c.name) === normalized)
    if (matched?._id) {
      setSelectedCustomerId(matched._id)
    }
  }, [customers, customerHint, selectedCustomerId])

  function resetToNewLog() {
    clearSharedLogHighlight()
    setSelectedActivityId(null)
    setActivityDetail(null)
    setShareSelection([])
    setShareSearch('')
    setCollabNote('')
    setTeamWorkspaceTab('notes')
    setShowExtractedJson(false)
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
    setPreviewLoadFailed(false)
    setFailedUploadedImages({})
    setFailedAttachmentVideos({})
    if (imageInputRef.current) imageInputRef.current.value = ''
    setAttachments([])
    setAttachmentFile(null)
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
    setSavedResultKey(null)
    setCustomerHintTouched(false)
  }

  async function handleExtract() {
    if (!text.trim()) {
      setError('Please describe the activity before logging with AI.')
      return
    }
    if (mainLogLocked) {
      setError('This log is shared with you in read-only mode. Ask the owner to edit main fields.')
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
      const data = await api.ai.validateActivity(result.structured, result.rawText, imageUrls)
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
    if (mainLogLocked) {
      toast.error('Only the log owner can edit the main fields. You can add collaboration notes below.')
      return
    }
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
      if (attachments.length > MAX_ATTACHMENTS_PER_ENTRY) {
        setError(`You can attach up to ${MAX_ATTACHMENTS_PER_ENTRY} files (PDF, Office, video, etc.) per entry.`)
        return
      }

      const base = (result.structured || {}) as any
      const selectedCustomerName =
        selectedCustomerId && customers.length > 0
          ? customers.find((c) => c._id === selectedCustomerId)?.name?.trim() || ''
          : ''
      const resolvedCustomer =
        selectedCustomerName ||
        customerHint.trim() ||
        (typeof base.customer === 'string' && base.customer.trim() ? base.customer.trim() : '')
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
      const attachmentsKey = attachments
        .map((a) => a.url)
        .slice()
        .sort()
        .join('|')
      const currentKey = [
        (result.rawText || '').trim(),
        String(resolvedSummary).trim(),
        String(resolvedPartName).trim(),
        String(resolvedIntent).trim(),
        String(resolvedOutcome).trim(),
        String(nextActionsKey).trim(),
        String(resolvedNotes).trim(),
        String(resolvedCustomer).trim(),
        String(imagesKey),
        String(attachmentsKey),
      ].join('||')

      if (savedResultKey && savedResultKey === currentKey) {
        setSaveMessage(selectedActivityId ? 'No changes to update.' : 'Already saved to tracker.')
        toast.info(selectedActivityId ? 'No changes to update.' : 'Already saved to tracker.')
        return
      }

      const editedStructured = {
        ...base,
        customer: resolvedCustomer || base.customer,
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
            images: imageUrls,
            attachments,
          })
        : await api.activities.create({
            rawText: resolvedRawText,
            structured: editedStructured,
            images: imageUrls.length ? imageUrls : undefined,
            attachments: attachments.length ? attachments : undefined,
          })

      const saved = activity as {
        attachments?: ActivityAttachment[]
        images?: string[]
      }
      if (Array.isArray(saved.attachments)) setAttachments(saved.attachments)
      if (Array.isArray(saved.images)) setImageUrls(saved.images)

      setSaveMessage(selectedActivityId ? 'Activity updated.' : 'Activity saved to tracker.')
      toast.success(selectedActivityId ? 'Updated successfully.' : 'Saved to tracker.')
      setSavedResultKey(currentKey)

      const newId = String((activity as { _id?: string })._id || '')
      if (selectedActivityId && newId) {
        try {
          const refreshed = await api.activities.getOne(selectedActivityId)
          const d = refreshed.activity as ActivityDetail
          setActivityDetail(d)
          setShareSelection((d.sharedWith ?? []).map((s) => s._id))
        } catch {
        }
      } else if (!selectedActivityId && newId) {
        setSelectedActivityId(newId)
        try {
          const refreshed = await api.activities.getOne(newId)
          const d = refreshed.activity as ActivityDetail
          setActivityDetail(d)
          setShareSelection((d.sharedWith ?? []).map((s) => s._id))
        } catch {
          setActivityDetail(activity as ActivityDetail)
        }
      }

      // Keep recent list in sync after create/update.
      setRecentActivities((prev) => {
        const nextItem = {
          _id: (activity as any)._id,
          customer: (activity as any).customer,
          summary: (activity as any).summary,
          createdAt: (activity as any).createdAt,
          isOwner: true,
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

  async function handleSaveSharing() {
    if (!selectedActivityId || !canManageSharing) return
    setSavingShare(true)
    setError(null)
    try {
      const { activity } = await api.activities.share(selectedActivityId, shareSelection)
      setActivityDetail(activity as ActivityDetail)
      toast.success('Sharing updated.')
    } catch (err) {
      const message = (err as Error).message || 'Failed to update sharing'
      setError(message)
      toast.error(message)
    } finally {
      setSavingShare(false)
    }
  }

  async function handleAddCollabNote() {
    if (!selectedActivityId || !collabNote.trim() || !canAddCollabNote) return
    setSavingNote(true)
    setError(null)
    try {
      const { activity } = await api.activities.addNote(selectedActivityId, collabNote.trim())
      setActivityDetail(activity as ActivityDetail)
      setCollabNote('')
      toast.success('Note added.')
    } catch (err) {
      const message = (err as Error).message || 'Failed to add note'
      setError(message)
      toast.error(message)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSelectRecent(id: string) {
    clearSharedLogHighlight(id)
    setSelectedActivityId(id)
    setActivityDetail(null)
    setShareSelection([])
    setShareSearch('')
    setCollabNote('')
    setTeamWorkspaceTab('notes')
    setShowExtractedJson(false)
    setLoadingSelected(true)
    setError(null)
    setSaveMessage(null)
    setValidation(null)
    setSavedResultKey(null)
    setCustomerHintTouched(false)
    try {
      const recentListCustomer =
        recentActivities.find((a) => a._id === id)?.customer?.trim() || ''
      const { activity } = await api.activities.getOne(id)
      const detail = activity as ActivityDetail
      setActivityDetail(detail)
      setShareSelection((detail.sharedWith ?? []).map((s) => s._id))

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
      setAttachments(Array.isArray(detail.attachments) ? detail.attachments : [])
      setAttachmentFile(null)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      setImageFile(null)
      setImagePreview(null)
      setPreviewLoadFailed(false)
      setFailedUploadedImages({})
      setFailedAttachmentVideos({})
      if (imageInputRef.current) imageInputRef.current.value = ''
      const detailCustomer =
        (typeof detail.customer === 'string' && detail.customer.trim()) ||
        (typeof structured.customer === 'string' && structured.customer.trim()) ||
        recentListCustomer ||
        ''
      if (detailCustomer) {
        const normalizedDetailCustomer = normalizeCustomerName(detailCustomer)
        const matchedCustomer = customers.find(
          (c) => normalizeCustomerName(c.name) === normalizedDetailCustomer
        )
        setSelectedCustomerId(matchedCustomer?._id ?? '')
        setCustomerHint(detailCustomer)
      } else {
        setSelectedCustomerId('')
        setCustomerHint('')
      }
      setCustomerHintTouched(false)

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
        String(
          (detail.attachments ?? [])
            .map((a) => a.url)
            .slice()
            .sort()
            .join('|')
        ),
      ].join('||')
      setSavedResultKey(existingKey)
    } catch (err) {
      const message = (err as Error).message || 'Failed to load activity'
      setError(message)
    } finally {
      setLoadingSelected(false)
    }
  }

  async function handleSendLogEmail() {
    if (!selectedActivityId) {
      setError('Select a log from the list before sending email.')
      return
    }
    setSendingEmail(true)
    setError(null)
    setSaveMessage(null)
    try {
      const res = await api.activities.sendEmail(selectedActivityId)
      const recipientLabel = res.to.length > 0 ? res.to.join(', ') : 'configured recipients'
      const skippedCount = Array.isArray(res.skipped) ? res.skipped.length : 0
      const extra =
        skippedCount > 0
          ? ` Sent ${res.attachedCount}/${res.sourceCount} files (${skippedCount} skipped due to download or size limits).`
          : ` Sent with ${res.attachedCount} attached file(s).`
      toast.success(`Email sent to ${recipientLabel}.${extra}`)
    } catch (err) {
      const message = (err as Error).message || 'Failed to send activity email'
      setError(message)
      toast.error(message)
    } finally {
      setSendingEmail(false)
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
  const hasRecentSharedHighlight = highlightSharedIds.size > 0

  return (
    <AdminShell>
      <style>{`
        @keyframes scanner-sweep {
          0% { top: 0; opacity: 0.55; }
          50% { opacity: 1; }
          100% { top: calc(100% - 2px); opacity: 0.55; }
        }
      `}</style>
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
              Turn site visits and quality notes into structured logs. Add photos, files, and barcodes, then save them
              to your activity history. Admins can review everything from the Activity screen.
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
                    <p className="text-[12px] text-[#777]">
                      Point your camera at the barcode to capture it.
                      {isAppleMobileWebKit() && (
                        <span className="block mt-1 text-[11px] text-[#999]">
                          On iPhone, use bright light, hold steady, and fill the frame. Safari and Chrome on iOS use the
                          same camera; the site must be opened over HTTPS (not HTTP) except on localhost.
                        </span>
                      )}
                    </p>
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
                  {scanning && !scannerError && (
                    <>
                      <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)_inset]" />
                      <div className="pointer-events-none absolute inset-x-6 top-6 bottom-6 overflow-hidden">
                        <div
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.95)]"
                          style={{ animation: 'scanner-sweep 1.7s linear infinite alternate' }}
                        />
                      </div>
                      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                        Scanning...
                      </div>
                    </>
                  )}
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
                    AI follow-up
                  </label>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[12px] text-[#444] leading-relaxed">
                    {barcodeModal.prompt ||
                      'Please confirm customer and part details so this barcode can be reused automatically.'}
                  </div>
                </div>

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
                  {barcodeModal.fields?.includes('customer') && !barcodeCustomer.trim() ? (
                    <p className="text-[11px] text-amber-700">Required for first-time barcode mapping.</p>
                  ) : null}
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
                  {barcodeModal.fields?.includes('partName') && !barcodePartName.trim() ? (
                    <p className="text-[11px] text-amber-700">Required for first-time barcode mapping.</p>
                  ) : null}
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
                      const needsCustomer = barcodeModal.fields?.includes('customer')
                      const needsPartName = barcodeModal.fields?.includes('partName')
                      if (needsCustomer && !barcodeCustomer.trim()) {
                        toast.error('Please provide customer for this barcode.')
                        return
                      }
                      if (needsPartName && !barcodePartName.trim()) {
                        toast.error('Please provide part name for this barcode.')
                        return
                      }
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
            <div
              className={`absolute inset-x-0 bottom-0 top-12 rounded-t-2xl bg-white border shadow-xl overflow-hidden flex flex-col ${
                hasRecentSharedHighlight
                  ? 'border-sky-400/80 ring-2 ring-sky-300/50 ring-inset bg-gradient-to-b from-sky-50/95 to-white'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <div>
                  <p
                    className={`text-xs font-medium uppercase tracking-[0.14em] ${
                      hasRecentSharedHighlight ? 'text-sky-900 font-semibold' : 'text-[#777]'
                    }`}
                  >
                    Recent logs
                  </p>
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

              <div className="flex flex-wrap items-center justify-center gap-2 min-w-0 px-4 pr-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivityId(null)
                    setActivityDetail(null)
                    setShareSelection([])
                    setCollabNote('')
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
                    setPreviewLoadFailed(false)
                    setFailedUploadedImages({})
                    setFailedAttachmentVideos({})
                    setAttachments([])
                    setAttachmentFile(null)
                    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                    setSavedResultKey(null)
                    setCustomerHintTouched(false)
                    setRecentModalOpen(false)
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03]"
                  aria-label="New log"
                  title="New log"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleSendLogEmail()}
                  disabled={!selectedActivityId || sendingEmail || archiving}
                  aria-label={sendingEmail ? 'Sending email…' : 'Send email'}
                  title={
                    !selectedActivityId
                      ? 'Select a log first to enable Send email'
                      : sendingEmail
                        ? 'Sending…'
                        : 'Send selected log by email'
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
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
                      setActivityDetail(null)
                      setShareSelection([])
                      setCollabNote('')
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
                      setPreviewLoadFailed(false)
                      setFailedUploadedImages({})
                      setFailedAttachmentVideos({})
                      setAttachments([])
                      setAttachmentFile(null)
                      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                      setSavedResultKey(null)
                      setRecentModalOpen(false)
                    } catch (err) {
                      const message = (err as Error).message || 'Failed to archive activity'
                      setError(message)
                    } finally {
                      setArchiving(false)
                    }
                  }}
                  disabled={!selectedActivityId || archiving || !canArchiveSelected}
                  aria-label={archiving ? 'Archiving…' : 'Archive'}
                  title={!selectedActivityId ? 'Select a log first to enable Archive' : 'Archive selected log'}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-100 disabled:text-red-600 disabled:border-red-300 disabled:shadow-none"
                >
                  {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
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
                        }${highlightSharedIds.has(act._id) ? ' ring-2 ring-inset ring-sky-400/75 bg-sky-50/60' : ''}`}
                      >
                        {isSelected && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"
                          />
                        )}
                        <p className="text-xs font-medium text-[#999] mb-0.5 truncate flex flex-wrap items-center gap-1.5">
                          {act.isOwner === false && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
                              Shared
                            </span>
                          )}
                          <span className="truncate">
                            {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                          </span>
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
          <section
            className={`rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden hidden md:block border bg-white transition-[box-shadow,background-color,border-color] duration-300 ${
              hasRecentSharedHighlight
                ? 'border-sky-400/85 ring-2 ring-sky-300/45 bg-gradient-to-b from-sky-50/95 to-white shadow-[0_10px_28px_rgba(14,165,233,0.2)]'
                : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 min-w-0 pl-4 pr-5 sm:pr-6 py-3 border-b border-[var(--color-border)]">
              <p
                className={`text-xs font-medium uppercase tracking-[0.14em] shrink min-w-0 ${
                  hasRecentSharedHighlight ? 'text-sky-900 font-semibold' : 'text-[#777]'
                }`}
              >
                Recent logs
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivityId(null)
                    setActivityDetail(null)
                    setShareSelection([])
                    setCollabNote('')
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
                    setPreviewLoadFailed(false)
                    setFailedUploadedImages({})
                    setFailedAttachmentVideos({})
                    setAttachments([])
                    setAttachmentFile(null)
                    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                    setSavedResultKey(null)
                    setCustomerHintTouched(false)
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03] transition-colors"
                  aria-label="New log"
                  title="New log"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendLogEmail()}
                  disabled={!selectedActivityId || sendingEmail || archiving}
                  aria-label={sendingEmail ? 'Sending email…' : 'Send email'}
                  title={
                    !selectedActivityId
                      ? 'Select a log first to enable Send email'
                      : sendingEmail
                        ? 'Sending…'
                        : 'Send selected log by email'
                  }
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
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
                      setActivityDetail(null)
                      setShareSelection([])
                      setCollabNote('')
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
                      setPreviewLoadFailed(false)
                      setFailedUploadedImages({})
                      setFailedAttachmentVideos({})
                      setAttachments([])
                      setAttachmentFile(null)
                      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                      setSavedResultKey(null)
                    } catch (err) {
                      const message = (err as Error).message || 'Failed to archive activity'
                      setError(message)
                    } finally {
                      setArchiving(false)
                    }
                  }}
                  disabled={!selectedActivityId || archiving || !canArchiveSelected}
                  aria-label={archiving ? 'Archiving…' : 'Archive'}
                  title={!selectedActivityId ? 'Select a log first to enable Archive' : 'Archive selected log'}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-100 disabled:text-red-600 disabled:border-red-300 disabled:shadow-none transition-colors"
                >
                  {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
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
                      }${highlightSharedIds.has(act._id) ? ' ring-2 ring-inset ring-sky-400/75 bg-sky-50/60' : ''}`}
                    >
                      <p className="text-xs font-medium text-[#999] mb-0.5 truncate flex flex-wrap items-center gap-1.5">
                        {act.isOwner === false && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
                            Shared
                          </span>
                        )}
                        <span className="truncate">
                          {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                        </span>
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
          <section
            className={`rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden md:hidden border bg-white transition-[box-shadow,background-color,border-color] duration-300 ${
              hasRecentSharedHighlight
                ? 'border-sky-400/85 ring-2 ring-sky-300/45 bg-gradient-to-b from-sky-50/95 to-white shadow-[0_10px_28px_rgba(14,165,233,0.2)]'
                : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 min-w-0 pl-4 pr-5 py-3 border-b border-[var(--color-border)]">
              <p
                className={`text-xs font-medium uppercase tracking-[0.14em] min-w-0 ${
                  hasRecentSharedHighlight ? 'text-sky-900 font-semibold' : 'text-[#777]'
                }`}
              >
                Recent logs
              </p>
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
                    }${highlightSharedIds.has(act._id) ? ' ring-2 ring-inset ring-sky-400/75 bg-sky-50/60' : ''}`}
                  >
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"
                      />
                    )}
                    <p className="text-xs font-medium text-[#999] mb-0.5 truncate flex flex-wrap items-center gap-1.5">
                      {act.isOwner === false && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
                          Shared
                        </span>
                      )}
                      <span className="truncate">
                        {act.customer || 'Unknown customer'} · {new Date(act.createdAt).toLocaleString()}
                      </span>
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
                <fieldset
                  disabled={mainLogLocked}
                  className="mt-2 space-y-3 min-w-0 border-0 p-0 m-0 disabled:opacity-[0.85]"
                >
                  <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-[#666]">Extracted data</p>
                      <button
                        type="button"
                        onClick={() => setShowExtractedJson((s) => !s)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#555] hover:bg-black/[0.03]"
                      >
                        {showExtractedJson ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        {showExtractedJson ? 'Hide raw JSON' : 'Show raw JSON'}
                      </button>
                    </div>
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
                  {showExtractedJson ? (
                    <pre className="max-h-48 overflow-auto rounded-[var(--radius)] bg-[#0b1020] text-[11px] text-[#e5f0ff] px-3 py-2 border border-[#1f2937] whitespace-pre-wrap break-words">
                      {JSON.stringify(result.structured, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-[#888] mb-1">
                      Fields below are editable. Open <span className="font-medium text-[#555]">raw JSON</span> only if you
                      need the full AI payload.
                    </p>
                  )}
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
                </fieldset>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] px-4 sm:px-5 py-3 bg-white">
              <fieldset
                disabled={mainLogLocked}
                className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0 disabled:opacity-[0.85]"
              >
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
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (isUnsupportedIphoneImage(file)) {
                              setUploadError(
                                'This iPhone image format (HEIC/HEIF) may not display reliably in web preview. Please use JPG/PNG, or set iPhone Camera > Formats > Most Compatible.'
                              )
                              if (imageInputRef.current) imageInputRef.current.value = ''
                              setImageFile(null)
                              setImagePreview(null)
                              setPreviewLoadFailed(false)
                              return
                            }
                            if (file.size > MAX_IMAGE_FILE_BYTES) {
                              setUploadError(MAX_IMAGE_FILE_ERROR)
                              if (imageInputRef.current) imageInputRef.current.value = ''
                              setImageFile(null)
                              setImagePreview(null)
                              setPreviewLoadFailed(false)
                              return
                            }
                            setImageFile(file)
                            setImagePreview(URL.createObjectURL(file))
                            setPreviewLoadFailed(false)
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
                          setPreviewLoadFailed(false)
                          if (imageInputRef.current) imageInputRef.current.value = ''
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
                          if (imageFile.size > MAX_IMAGE_FILE_BYTES) {
                            setUploadError(MAX_IMAGE_FILE_ERROR)
                            return
                          }
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
                            setPreviewLoadFailed(false)
                            if (imageInputRef.current) imageInputRef.current.value = ''
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
                        {!previewLoadFailed ? (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-full w-full object-cover"
                            onError={() => setPreviewLoadFailed(true)}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[9px] text-red-600 px-1 text-center">
                            Load failed
                          </div>
                        )}
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
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {imageUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] group"
                      >
                        <a href={url} target="_blank" rel="noreferrer" title="Open image">
                          {!failedUploadedImages[url] ? (
                            <img
                              src={url}
                              alt={`Uploaded activity ${idx + 1}`}
                              className="h-20 w-full object-cover transition-transform group-hover:scale-[1.02]"
                              onError={() =>
                                setFailedUploadedImages((prev) => ({
                                  ...prev,
                                  [url]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="h-20 w-full flex items-center justify-center text-[10px] text-red-600 px-2 text-center bg-[var(--color-bg)]">
                              Image load failed
                            </div>
                          )}
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setImageUrls((prev) => prev.filter((_, imageIdx) => imageIdx !== idx))
                          }
                          className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80"
                          aria-label={`Remove image ${idx + 1}`}
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {attachments.some((a) => !isVideoAttachment(a)) && (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {attachments.map((a, idx) =>
                      !isVideoAttachment(a) ? (
                        <div
                          key={`${a.url}-${idx}`}
                          className="relative rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] group"
                        >
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            title={a.name}
                            className="flex h-20 w-full flex-col items-center justify-center gap-0.5 px-2 py-1 text-center hover:bg-black/[0.02] transition-colors"
                          >
                            <FileText className="w-6 h-6 text-[var(--color-primary)] shrink-0" />
                            <span className="text-[9px] font-medium text-[#444] truncate w-full leading-tight">
                              {a.name}
                            </span>
                            {formatFileSize(a.size) ? (
                              <span className="text-[8px] text-[#999]">{formatFileSize(a.size)}</span>
                            ) : null}
                          </a>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 z-10"
                            aria-label={`Remove file ${idx + 1}`}
                            title="Remove file"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
                {/* Documents & video (test reports, customer data files) */}
                <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)]/80 bg-[var(--color-bg)]/50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-[#555] flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    Attach files (optional)
                  </p>
                  <p className="text-[10px] text-[#777] leading-relaxed">
                    PDF, Word, Excel, CSV, RTF, ZIP, JSON/XML/DAT, MP4/MOV/WebM — up to {MAX_ATTACHMENTS_PER_ENTRY}{' '}
                    files, {MAX_ATTACHMENT_FILE_BYTES / (1024 * 1024)} MB each. For equipment test data or files you
                    send to customers.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] text-[#444] cursor-pointer hover:bg-black/[0.03]">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span>{attachmentFile ? 'Change file' : 'Choose file'}</span>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.mp4,.mov,.webm,.m4v,.json,.xml,.dat,video/*,application/pdf,application/rtf,text/rtf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
                              setUploadError(MAX_ATTACHMENT_FILE_ERROR)
                              if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                              setAttachmentFile(null)
                              return
                            }
                            setAttachmentFile(file)
                            setUploadError(null)
                          }
                        }}
                      />
                    </label>
                    {attachmentFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentFile(null)
                          if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[#666] hover:bg-black/[0.03]"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                    {attachmentFile && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!attachmentFile) return
                          if (attachments.length >= MAX_ATTACHMENTS_PER_ENTRY) {
                            setUploadError(`You can attach up to ${MAX_ATTACHMENTS_PER_ENTRY} files per entry.`)
                            return
                          }
                          if (attachmentFile.size > MAX_ATTACHMENT_FILE_BYTES) {
                            setUploadError(MAX_ATTACHMENT_FILE_ERROR)
                            return
                          }
                          setUploadingAttachment(true)
                          setUploadError(null)
                          try {
                            const res = await api.upload.attachment(attachmentFile)
                            setAttachments((prev) => [
                              ...prev,
                              { url: res.url, name: res.name, mime: res.mime, size: res.size },
                            ])
                            setAttachmentFile(null)
                            if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                          } catch (err) {
                            setUploadError((err as Error).message || 'Failed to upload file')
                          } finally {
                            setUploadingAttachment(false)
                          }
                        }}
                        disabled={uploadingAttachment || attachments.length >= MAX_ATTACHMENTS_PER_ENTRY}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 text-[11px] font-medium hover:bg-[var(--color-primary)]/15 disabled:opacity-60"
                      >
                        {uploadingAttachment
                          ? 'Uploading…'
                          : attachments.length >= MAX_ATTACHMENTS_PER_ENTRY
                            ? 'Max files reached'
                            : 'Upload file'}
                      </button>
                    )}
                  </div>
                </div>
                {attachments.some(isVideoAttachment) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-[#555] flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                      Uploaded videos
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {attachments.map((a, idx) =>
                        isVideoAttachment(a) ? (
                          <div
                            key={`${a.url}-${idx}`}
                            className="relative rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] group"
                            title={a.name}
                          >
                            {!failedAttachmentVideos[a.url] ? (
                              <video
                                src={a.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="h-20 w-full object-cover bg-black"
                                title={a.name}
                                onError={() =>
                                  setFailedAttachmentVideos((prev) => ({ ...prev, [a.url]: true }))
                                }
                              />
                            ) : (
                              <div className="h-20 w-full flex items-center justify-center text-[10px] text-red-600 px-2 text-center bg-[var(--color-bg)]">
                                Video load failed
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 z-10"
                              aria-label={`Remove video ${idx + 1}`}
                              title="Remove video"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-[#777] leading-relaxed">
                  Upload up to {MAX_IMAGES_PER_ENTRY} photos as evidence for this activity (defect, part label/barcode,
                  workstation condition, or before/after repair). Each image may be up to 10 MB. Use clear images that
                  help explain the issue and resolution.
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
              </fieldset>
            </div>

            {selectedActivityId && activityDetail && (
              <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 sm:px-5 py-4 rounded-b-[var(--radius-lg)]">
                <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-primary)]/[0.07] via-white to-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)]/90 bg-white/90 backdrop-blur-sm flex flex-wrap items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-[var(--color-text)] tracking-tight">
                          Team workspace
                        </h3>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900"
                          title="Sharing and notes refresh automatically while you keep this page open"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          Live sync
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 leading-snug">
                        Use <span className="font-medium text-[var(--color-text)]">Sharing</span> to invite viewers, or{' '}
                        <span className="font-medium text-[var(--color-text)]">Notes</span> for the thread—only one panel
                        shows at a time so the page stays shorter.
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {mainLogLocked && (
                      <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-[12px] text-amber-950 leading-relaxed">
                        <span className="font-semibold">Read-only for you.</span> This log was shared with you—open{' '}
                        <span className="font-semibold">Notes</span> to participate. Ask the owner if the main activity
                        text needs to change.
                      </div>
                    )}

                    <div
                      className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]"
                      role="tablist"
                      aria-label="Team workspace sections"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={teamWorkspaceTab === 'sharing'}
                        onClick={() => setTeamWorkspaceTab('sharing')}
                        className={`flex-1 min-w-0 rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-[12px] font-semibold transition ${
                          teamWorkspaceTab === 'sharing'
                            ? 'bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/[0.06]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        Sharing
                        {canManageSharing && shareSelection.length > 0 ? (
                          <span className="ml-1 opacity-75 font-normal">({shareSelection.length})</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={teamWorkspaceTab === 'notes'}
                        onClick={() => setTeamWorkspaceTab('notes')}
                        className={`flex-1 min-w-0 rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-[12px] font-semibold transition inline-flex items-center justify-center gap-1 ${
                          teamWorkspaceTab === 'notes'
                            ? 'bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/[0.06]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-80" />
                        Notes
                        {(activityDetail.collaborationNotes ?? []).length > 0 ? (
                          <span className="opacity-75 font-normal">
                            ({(activityDetail.collaborationNotes ?? []).length})
                          </span>
                        ) : null}
                      </button>
                    </div>

                    {activityDetail.userId && typeof activityDetail.userId === 'object' && (
                      <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] px-0.5">
                        <UserCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--color-primary)]" />
                        <span className="truncate">
                          <span className="font-semibold text-[var(--color-text)]">Owner:</span>{' '}
                          {(activityDetail.userId as { name?: string }).name?.trim() ||
                            (activityDetail.userId as { email?: string }).email ||
                            '—'}
                          {(activityDetail.userId as { email?: string }).email ? (
                            <span className="text-[var(--color-text-secondary)]">
                              {' '}
                              · {(activityDetail.userId as { email?: string }).email}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )}

                    {teamWorkspaceTab === 'sharing' && (
                      <div className="space-y-3">
                        {!canManageSharing ? (
                          <div className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                            Only the log owner can change who this activity is shared with. Switch to{' '}
                            <button
                              type="button"
                              className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
                              onClick={() => setTeamWorkspaceTab('notes')}
                            >
                              Notes
                            </button>{' '}
                            to read and post updates.
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[var(--color-border)] bg-white p-3.5 shadow-sm space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                                  Who can view &amp; comment
                                </p>
                                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 max-w-md">
                                  Multi-select below. Shared teammates can open this log and post notes—they cannot edit the
                                  main AI fields.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void loadTeamForSharing()}
                                disabled={loadingCoworkers}
                                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text)] hover:bg-black/[0.04] disabled:opacity-50"
                              >
                                {loadingCoworkers ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5" />
                                )}
                                Refresh list
                              </button>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                Search team
                              </label>
                              <input
                                type="search"
                                value={shareSearch}
                                onChange={(e) => setShareSearch(e.target.value)}
                                placeholder="Filter by name or email…"
                                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                              />
                            </div>

                            {coworkersError && (
                              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{coworkersError}</span>
                              </div>
                            )}

                            {loadingCoworkers ? (
                              <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--color-text-secondary)]">
                                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                                Loading team…
                              </div>
                            ) : coworkers.length === 0 ? (
                              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed rounded-lg bg-[var(--color-bg)] border border-dashed border-[var(--color-border)] px-3 py-3">
                                No other people in the system yet. Add accounts under{' '}
                                <span className="font-semibold text-[var(--color-text)]">User management</span> (admin),
                                then refresh this list.
                              </p>
                            ) : (
                              <>
                                <div>
                                  <label className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                    Select coworkers
                                  </label>
                                  <select
                                    multiple
                                    size={Math.min(10, Math.max(5, displayedCoworkers.length))}
                                    value={shareSelection}
                                    onChange={(e) => {
                                      const next = Array.from(e.target.selectedOptions, (opt) => opt.value)
                                      setShareSelection(next)
                                    }}
                                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 min-h-[140px]"
                                  >
                                    {displayedCoworkers.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name?.trim()
                                          ? `${c.name.trim()}  ·  ${c.email}  ·  ${c.role === 'admin' ? 'Admin' : 'Employee'}`
                                          : `${c.email}  ·  ${c.role === 'admin' ? 'Admin' : 'Employee'}`}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]">
                                    Hold{' '}
                                    <kbd className="px-1 py-0.5 rounded bg-black/[0.06] font-sans text-[9px]">Ctrl</kbd>{' '}
                                    (Windows) or{' '}
                                    <kbd className="px-1 py-0.5 rounded bg-black/[0.06] font-sans text-[9px]">⌘</kbd> (Mac)
                                    and click to select multiple.
                                  </p>
                                </div>

                                {shareSelection.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">
                                      Selected ({shareSelection.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {shareSelection.map((id) => {
                                        const c = coworkers.find((x) => x.id === id)
                                        const label = c?.name?.trim() || c?.email || id
                                        return (
                                          <span
                                            key={id}
                                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/8 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-[var(--color-text)]"
                                          >
                                            <span className="max-w-[180px] truncate">{label}</span>
                                            <button
                                              type="button"
                                              onClick={() => setShareSelection((prev) => prev.filter((x) => x !== id))}
                                              className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10 text-[var(--color-text-secondary)]"
                                              aria-label={`Remove ${label}`}
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => void handleSaveSharing()}
                              disabled={savingShare || !canManageSharing || loadingCoworkers}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                            >
                              {savingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              {savingShare ? 'Saving…' : 'Save sharing'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {teamWorkspaceTab === 'notes' && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-white p-3.5 shadow-sm space-y-3">
                        <p className="text-[13px] font-semibold text-[var(--color-text)]">Notes &amp; updates</p>
                        <div className="space-y-3 max-h-[min(360px,50vh)] overflow-y-auto pr-0.5">
                          {(activityDetail.collaborationNotes ?? []).length === 0 ? (
                            <p className="text-[12px] text-[var(--color-text-secondary)] py-2">
                              No notes yet—be the first to add an update.
                            </p>
                          ) : (
                            (activityDetail.collaborationNotes ?? []).map((n, idx) => {
                              const aid = noteAuthorId(n)
                              const isMine = Boolean(
                                user?.id && aid != null && String(aid) === String(user.id)
                              )
                              const label = n.userId?.name?.trim() || n.userId?.email || 'User'
                              const initial = (label.slice(0, 1) || '?').toUpperCase()
                              const si = styleIndexForAuthorId(aid)
                              const st = OTHER_NOTE_STYLES[si]
                              const av = OTHER_AVATAR_STYLES[si]
                              return (
                                <div
                                  key={n._id || `${String(n.createdAt)}-${idx}`}
                                  className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`flex max-w-[min(92%,420px)] gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                                  >
                                    {!isMine && (
                                      <div
                                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm ${av}`}
                                        aria-hidden
                                      >
                                        {initial}
                                      </div>
                                    )}
                                    <div
                                      className={
                                        isMine
                                          ? 'min-w-0 rounded-2xl rounded-br-md border border-[var(--color-primary)]/35 bg-gradient-to-br from-[var(--color-primary)]/18 to-[var(--color-primary)]/10 px-3.5 py-2.5 shadow-sm ring-1 ring-[var(--color-primary)]/15'
                                          : `min-w-0 rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm ${st.bubble}`
                                      }
                                    >
                                      <p
                                        className={`text-[10px] font-semibold mb-1 ${isMine ? 'text-[var(--color-primary)]' : st.meta}`}
                                      >
                                        {isMine ? 'You' : label}
                                        <span
                                          className={`font-normal ${isMine ? 'text-[var(--color-primary)]/75' : 'opacity-80'}`}
                                        >
                                          {' '}
                                          · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                                        </span>
                                      </p>
                                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-[var(--color-text)]">
                                        {n.text}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                        {canAddCollabNote ? (
                          <div className="space-y-2 pt-1 border-t border-[var(--color-border)]/80">
                            <label className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                              Add a note
                            </label>
                            <textarea
                              rows={3}
                              value={collabNote}
                              onChange={(e) => setCollabNote(e.target.value)}
                              placeholder="Status update, question, or handoff for your team…"
                              className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25 min-h-[72px]"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddCollabNote()}
                              disabled={savingNote || !collabNote.trim()}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
                            >
                              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {savingNote ? 'Posting…' : 'Post note'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </AdminShell>
  )
}

