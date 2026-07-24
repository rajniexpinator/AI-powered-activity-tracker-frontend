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
  Share2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { LazyActivityImage } from '@/components/LazyActivityImage'
import { useAuth } from '@/context/AuthContext'
import { formatRoleLabel, isAdminRole } from '@/lib/roles'
import { useSharedLogsNotify } from '@/context/SharedLogsNotifyContext'
import { CustomerTypeahead } from '@/components/customers/CustomerTypeahead'
import { findCustomerByName } from '@/lib/customerName'
import { formatUsDateTime } from '@/lib/formatDate'
import { formatPlantLabel } from '@/constants/plants'
import { resolveSharePreferences } from '@/constants/sharePreferences'
import {
  areSharePhotosReady,
  canUseNativeShare,
  clearShareImageCache,
  isSharePhotosLoading,
  preloadShareImages,
  shareActivityLog,
} from '@/lib/shareActivityLog'

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

const VEHICLE_LINE_OPTIONS = ['Super Duty', 'Expedition', 'Navigator'] as const
type VehicleLineOption = (typeof VEHICLE_LINE_OPTIONS)[number]

type StructuredActivity = {
  customer?: string
  summary?: string
  part_name?: string
  part_number?: string
  partNumber?: string
  partName?: string
  supplier_code?: string
  supplierCode?: string
  vehicle_line?: string[]
  vehicleLine?: string[]
  /** Up to 5-character physical-location tag at the plant (e.g. A12, B-7). */
  location?: string
  intent?: string
  severity?: number
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
  /** Up to 5-character physical-location tag (top-level). */
  location?: string
  /** Reporting plant/OEM stamped at log creation. */
  reportingPlant?: string
  summary?: string
  rawConversation?: string
  structuredData?: StructuredActivity | (StructuredActivity & Record<string, unknown>)
  images?: string[]
  attachments?: ActivityAttachment[]
  createdAt: string
}

type ActivityDatePeriod = 'all' | 'today' | '3days' | 'week' | '2weeks' | 'month'

const DATE_PERIOD_OPTIONS: { value: ActivityDatePeriod; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: '3days', label: '3 days' },
  { value: 'week', label: 'Week' },
  { value: '2weeks', label: '2 weeks' },
  { value: 'month', label: 'Month' },
]

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
type PendingImage = { id: string; file: File; preview: string }
const MAX_ATTACHMENTS_PER_ENTRY = 10
const MAX_ATTACHMENT_FILE_BYTES = 50 * 1024 * 1024 // 50 MB — keep in sync with Backend attachment middleware
const MAX_ATTACHMENT_FILE_ERROR = 'Maximum attachment size is 50 MB.'
const DEFAULT_ISSUE_SEVERITY = 0 as const
const MAX_LOCATION_LENGTH = 5
const MAX_SUPPLIER_CODE_LENGTH = 5

/** Up-to-5-char physical location tag. Letters, digits, and dash only; uppercased. */
function normalizeLocationInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, MAX_LOCATION_LENGTH)
}

/** Up-to-5-char supplier code. Letters and digits only; uppercased. */
function normalizeSupplierCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_SUPPLIER_CODE_LENGTH)
}

function readPartNumberFromStructured(structured: StructuredActivity | Record<string, unknown>): string {
  const s = structured as Record<string, unknown>
  const v = s.part_number ?? s.partNumber
  return typeof v === 'string' ? v.trim() : ''
}

function readSupplierCodeFromStructured(structured: StructuredActivity | Record<string, unknown>): string {
  const s = structured as Record<string, unknown>
  const v = s.supplier_code ?? s.supplierCode
  return typeof v === 'string' ? normalizeSupplierCodeInput(v) : ''
}

function readVehicleLineFromStructured(structured: StructuredActivity | Record<string, unknown>): VehicleLineOption[] {
  const s = structured as Record<string, unknown>
  const raw = s.vehicle_line ?? s.vehicleLine
  if (!Array.isArray(raw)) return []
  const picked = new Set(raw.map((x) => String(x).trim()))
  return VEHICLE_LINE_OPTIONS.filter((opt) => picked.has(opt))
}

function parseIssueSeverity(raw: unknown): 0 | 1 | 2 | 3 {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (n === 0 || n === 1 || n === 2 || n === 3) return n
  return DEFAULT_ISSUE_SEVERITY
}

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

type BarcodeClarifyMapping = {
  barcode: string
  partName?: string
  partNumber?: string
  productName?: string
  customer?: string
  scanCount?: number
  updatedAt?: string
  createdAt?: string
}

type PendingBarcodeClarification = {
  barcode: string
  mode: 'known' | 'unknown'
  mapping: BarcodeClarifyMapping | null
  prompt: string
  fields: string[]
}

function buildBarcodeLogSnippet(
  barcode: string,
  customer?: string,
  partName?: string,
  partNumber?: string,
  notes?: string
) {
  const lines = [`Scanned barcode: ${barcode}`]
  // "Supplier" matches the form label; backend also accepts legacy "Customer:".
  if (customer?.trim()) lines.push(`Supplier: ${customer.trim()}`)
  const partLabel = partName?.trim() || ''
  if (partLabel) lines.push(`Part name: ${partLabel}`)
  if (partNumber?.trim()) lines.push(`Part number: ${partNumber.trim()}`)
  if (notes?.trim()) lines.push(`Notes: ${notes.trim()}`)
  return lines.join('\n')
}

type BarcodeFieldHints = {
  customer?: string
  partName?: string
  partNumber?: string
  /** Full scan snippet — kept in Notes while fields are also filled. */
  notes?: string
}

function mergeNotesWithScanBlock(existingNotes: string, scanBlock?: string) {
  const scan = scanBlock?.trim() || ''
  const existing = existingNotes.trim()
  if (!scan) return existing
  if (!existing) return scan
  if (existing.includes(scan)) return existing
  if (scan.includes(existing)) return scan
  return `${scan}\n\n${existing}`
}

function needsBarcodeMappingStep(p: PendingBarcodeClarification): boolean {
  if (p.mode === 'unknown') return true
  const f = p.fields || []
  const m = p.mapping
  if (f.includes('customer') && !String(m?.customer || '').trim()) return true
  if (f.includes('partName') && !String(m?.partName || m?.productName || '').trim()) return true
  return false
}

export function ChatPage() {
  const { user } = useAuth()
  const userReportingPlant = formatPlantLabel(user?.assignedPlant, user?.assignedPlantOther)
  const { highlightSharedIds, clearSharedLogHighlight } = useSharedLogsNotify()
  const isEmployee = user?.role === 'employee'
  const [text, setText] = useState('')
  const [customerHint, setCustomerHint] = useState('')
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
    {
      _id: string
      customer?: string
      location?: string
      reportingPlant?: string
      summary?: string
      createdAt: string
      isOwner?: boolean
    }[]
  >([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [editSummary, setEditSummary] = useState('')
  const [editPartName, setEditPartName] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editSupplierCode, setEditSupplierCode] = useState('')
  const [editVehicleLine, setEditVehicleLine] = useState<VehicleLineOption[]>([])
  const [editLocation, setEditLocation] = useState('')
  const [editIntent, setEditIntent] = useState('')
  const [editSeverity, setEditSeverity] = useState<0 | 1 | 2 | 3>(DEFAULT_ISSUE_SEVERITY)
  const [editOutcome, setEditOutcome] = useState('')
  const [editNextActions, setEditNextActions] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
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
  const [sharingLog, setSharingLog] = useState(false)
  const [sharePhotosReady, setSharePhotosReady] = useState(true)
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiveCloseRecentModal, setArchiveCloseRecentModal] = useState(false)
  const [emailRecipientsLoading, setEmailRecipientsLoading] = useState(false)
  const [emailCustomerRecipients, setEmailCustomerRecipients] = useState<string[]>([])
  const [selectedCustomerEmailRecipients, setSelectedCustomerEmailRecipients] = useState<string[]>([])
  const [emailManagerCcRecipients, setEmailManagerCcRecipients] = useState<string[]>([])
  const [includeManagerCcRecipients, setIncludeManagerCcRecipients] = useState(true)
  const selectedRecentMeta = selectedActivityId
    ? recentActivities.find((a) => a._id === selectedActivityId)
    : null
  const canArchiveSelected = Boolean(
    selectedActivityId &&
      user &&
      (isAdminRole(user.role) ||
        selectedRecentMeta?.isOwner === true ||
        (activityDetail &&
          String(activityDetail._id) === String(selectedActivityId) &&
          activityOwnerId(activityDetail) === user.id))
  )

  const canManageSharing = Boolean(
    activityDetail && user && (isAdminRole(user.role) || activityOwnerId(activityDetail) === user.id)
  )

  const canAddCollabNote = Boolean(activityDetail && user)

  const [datePeriod, setDatePeriod] = useState<ActivityDatePeriod>('all')
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false)
  const dateFilterRef = useRef<HTMLDivElement | null>(null)
  const customerFilterRef = useRef<HTMLDivElement | null>(null)
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
  const addImageInputRef = useRef<HTMLInputElement | null>(null)
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
  const [barcodeIntegrationOpen, setBarcodeIntegrationOpen] = useState(false)
  const [barcodeIntegrationStep, setBarcodeIntegrationStep] = useState<'choice' | 'pickLog'>('choice')
  const [pendingBarcodeClarification, setPendingBarcodeClarification] =
    useState<PendingBarcodeClarification | null>(null)
  const barcodeMergeIntentRef = useRef<
    null | { kind: 'newLog' } | { kind: 'existingLog'; activityId: string }
  >(null)
  const [recentModalOpen, setRecentModalOpen] = useState(false)
  const newLogButtonRef = useRef<HTMLButtonElement | null>(null)

  const recentActivitiesEditable = recentActivities

  const datePeriodLabel =
    DATE_PERIOD_OPTIONS.find((o) => o.value === datePeriod)?.label ?? 'All dates'

  const customerFilterLabel =
    selectedCustomers.length === 0
      ? 'All customers'
      : selectedCustomers.length === 1
        ? selectedCustomers[0]
        : `${selectedCustomers.length} customers`

  const loadTeamForSharing = useCallback(async () => {
    if (!user) return
    setLoadingCoworkers(true)
    setCoworkersError(null)
    try {
      if (isAdminRole(user.role)) {
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

  function parseCommaSeparatedEmails(value?: string): string[] {
    if (typeof value !== 'string' || !value.trim()) return []
    return [...new Set(value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean))]
  }

  function selectedLogCustomerEmails(): string[] {
    const rawCustomer = typeof activityDetail?.customer === 'string' ? activityDetail.customer.trim() : ''
    if (!rawCustomer) return []
    const match = findCustomerByName(customers, rawCustomer)
    return parseCommaSeparatedEmails(typeof match?.email === 'string' ? match.email : '')
  }

  function isUnsupportedIphoneImage(file: File) {
    const type = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')
  }

  const totalSelectedImageCount = imageUrls.length + pendingImages.length

  const clearPendingImages = useCallback(() => {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview))
      return []
    })
  }, [])

  useEffect(() => {
    return () => {
      setPendingImages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview))
        return []
      })
    }
  }, [])

  function validateImageFile(file: File): string | null {
    if (isUnsupportedIphoneImage(file)) {
      return 'This iPhone image format (HEIC/HEIF) may not display reliably in web preview. Please use JPG/PNG, or set iPhone Camera > Formats > Most Compatible.'
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) return MAX_IMAGE_FILE_ERROR
    return null
  }

  function queuePendingImage(file: File, mode: 'append' | 'replace-first') {
    const validationError = validateImageFile(file)
    if (validationError) {
      setUploadError(validationError)
      return false
    }
    if (totalSelectedImageCount >= MAX_IMAGES_PER_ENTRY) {
      setUploadError(`You can attach up to ${MAX_IMAGES_PER_ENTRY} images per entry.`)
      return false
    }
    setUploadError(null)
    const entry: PendingImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }
    setPendingImages((prev) => {
      if (mode === 'replace-first' && prev.length > 0) {
        URL.revokeObjectURL(prev[0].preview)
        return [entry, ...prev.slice(1)]
      }
      return [...prev, entry]
    })
    return true
  }

  function handleImageInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'append' | 'replace-first'
  ) {
    const file = e.target.files?.[0]
    if (file) queuePendingImage(file, mode)
    e.target.value = ''
  }

  async function uploadPendingImages(): Promise<string[]> {
    if (pendingImages.length === 0) return imageUrls
    const slotsLeft = MAX_IMAGES_PER_ENTRY - imageUrls.length
    if (slotsLeft <= 0) {
      setUploadError(`You can attach up to ${MAX_IMAGES_PER_ENTRY} images per entry.`)
      return imageUrls
    }
    const toUpload = pendingImages.slice(0, slotsLeft)
    if (toUpload.length < pendingImages.length) {
      setUploadError(`Only ${slotsLeft} more image${slotsLeft === 1 ? '' : 's'} can be added (max ${MAX_IMAGES_PER_ENTRY} per entry).`)
    }
    setUploadingImage(true)
    setUploadError(null)
    try {
      const uploaded: string[] = []
      for (const pending of toUpload) {
        const { url } = await api.upload.image(pending.file)
        uploaded.push(url)
      }
      let mergedUrls = imageUrls
      setImageUrls((prev) => {
        mergedUrls = [...prev, ...uploaded]
        return mergedUrls
      })
      const uploadedIds = new Set(toUpload.map((p) => p.id))
      setPendingImages((prev) => {
        const remaining = prev.filter((p) => !uploadedIds.has(p.id))
        prev.filter((p) => uploadedIds.has(p.id)).forEach((p) => URL.revokeObjectURL(p.preview))
        return remaining
      })
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (addImageInputRef.current) addImageInputRef.current.value = ''
      return mergedUrls
    } catch (err) {
      const msg = (err as Error).message || 'Failed to upload images'
      setUploadError(msg)
      throw err
    } finally {
      setUploadingImage(false)
    }
  }

  function openBarcodeModal(payload: NonNullable<typeof barcodeModal>) {
    setBarcodeModal(payload)
    setBarcodeCustomer(payload.customer ?? '')
    setBarcodePartName(payload.partName ?? '')
    setBarcodePartNumber(payload.partNumber ?? '')
    setBarcodeNotes('')
  }

  function closeBarcodeModal() {
    barcodeMergeIntentRef.current = null
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
    try {
      const clarification = await api.barcodes.clarify(code)
      const mapping = clarification.mapping

      const readablePart = mapping?.partName || mapping?.productName || ''
      if (clarification.mode === 'known') {
        toast.info(
          readablePart || mapping?.partNumber || mapping?.customer
            ? `Known barcode: ${readablePart}${mapping?.partNumber ? ` [${mapping.partNumber}]` : ''}${mapping?.customer ? ` (${mapping.customer})` : ''}`.trim()
            : 'Known barcode recognized.'
        )
      } else {
        toast.info('New barcode detected. You can map customer/part after choosing how to attach it to a log.')
      }

      if (clarification.mode === 'known') {
        try {
          await api.barcodes.scan(code)
        } catch {
          /* non-blocking */
        }
      }

      const pending: PendingBarcodeClarification = {
        barcode: code,
        mode: clarification.mode === 'known' ? 'known' : 'unknown',
        mapping,
        prompt: clarification.prompt,
        fields: Array.isArray(clarification.fields) ? clarification.fields : [],
      }
      setPendingBarcodeClarification(pending)
      setBarcodeIntegrationStep('choice')
      setBarcodeIntegrationOpen(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check barcode'
      toast.error(msg)
    }
  }

  function closeBarcodeIntegration() {
    setBarcodeIntegrationOpen(false)
    setBarcodeIntegrationStep('choice')
    setPendingBarcodeClarification(null)
  }

  function cancelBarcodeIntegration() {
    barcodeMergeIntentRef.current = null
    closeBarcodeIntegration()
  }

  function openBarcodeMappingForMerge(
    intent: { kind: 'newLog' } | { kind: 'existingLog'; activityId: string },
    p: PendingBarcodeClarification
  ) {
    barcodeMergeIntentRef.current = intent
    openBarcodeModal({
      barcode: p.barcode,
      mode: p.mode === 'known' ? 'existing' : 'new',
      customer: p.mapping?.customer,
      partName: p.mapping?.partName || p.mapping?.productName,
      partNumber: p.mapping?.partNumber,
      scanCount: p.mapping?.scanCount,
      prompt: p.prompt,
      fields: p.fields,
    })
    closeBarcodeIntegration()
  }

  function applyBarcodeFormHints(hints?: BarcodeFieldHints) {
    if (!hints) return
    if (hints.partNumber?.trim()) setEditPartNumber(hints.partNumber.trim())
    if (hints.partName?.trim()) setEditPartName(hints.partName.trim())
    if (hints.customer?.trim()) {
      const c = hints.customer.trim()
      const matched = findCustomerByName(customers, c)
      setCustomerHint(matched?.name ?? c)
      setSelectedCustomerId(matched?._id ?? '')
    }
    if (hints.notes?.trim()) {
      setEditNotes((prev) => mergeNotesWithScanBlock(prev, hints.notes))
    }
  }

  async function flushBarcodeToNewLog(
    snippet: string,
    hintCustomer?: string,
    barcodeHints?: BarcodeFieldHints
  ) {
    closeBarcodeIntegration()
    resetToNewLog()
    setText(snippet)
    const c = hintCustomer?.trim() || barcodeHints?.customer?.trim() || ''
    if (c) {
      setCustomerHint(c)
      const matched = findCustomerByName(customers, c)
      setSelectedCustomerId(matched?._id ?? '')
    }
    toast.info('Review the extracted log fields, then save to add it to your tracker.')
    const hints: BarcodeFieldHints = {
      customer: c || undefined,
      partNumber: barcodeHints?.partNumber,
      partName: barcodeHints?.partName,
      notes: snippet,
    }
    await handleExtract(snippet, c || undefined, hints)
  }

  async function flushBarcodeToExistingLog(
    activityId: string,
    snippet: string,
    barcodeHints?: BarcodeFieldHints
  ) {
    closeBarcodeIntegration()
    const { merged, detailCustomer } = await handleSelectRecent(activityId, {
      appendSnippet: snippet,
      prepareReExtract: true,
    })
    if (!merged.trim()) {
      toast.error('Could not open that log. Try again or create a new log.')
      return
    }
    toast.info('Barcode text added — review extracted fields, then save to update this log.')
    const hints: BarcodeFieldHints = {
      customer: barcodeHints?.customer || detailCustomer || undefined,
      partNumber: barcodeHints?.partNumber,
      partName: barcodeHints?.partName,
      notes: snippet,
    }
    await handleExtract(merged, detailCustomer, hints)
  }

  async function onBarcodeIntegrationCreateNew() {
    const p = pendingBarcodeClarification
    if (!p) return
    if (needsBarcodeMappingStep(p)) {
      openBarcodeMappingForMerge({ kind: 'newLog' }, p)
      return
    }
    const m = p.mapping
    const snippet = buildBarcodeLogSnippet(
      p.barcode,
      m?.customer,
      m?.partName || m?.productName,
      m?.partNumber,
      undefined
    )
    await flushBarcodeToNewLog(snippet, m?.customer, {
      customer: m?.customer,
      partNumber: m?.partNumber,
      partName: m?.partName || m?.productName,
      notes: snippet,
    })
  }

  function onBarcodeIntegrationAddToExisting() {
    setBarcodeIntegrationStep('pickLog')
    void refreshRecentList({ silent: true })
  }

  async function onPickRecentForBarcode(activityId: string) {
    const p = pendingBarcodeClarification
    if (!p) return
    if (needsBarcodeMappingStep(p)) {
      openBarcodeMappingForMerge({ kind: 'existingLog', activityId }, p)
      return
    }
    const m = p.mapping
    const snippet = buildBarcodeLogSnippet(
      p.barcode,
      m?.customer,
      m?.partName || m?.productName,
      m?.partNumber,
      undefined
    )
    await flushBarcodeToExistingLog(activityId, snippet, {
      customer: m?.customer,
      partNumber: m?.partNumber,
      partName: m?.partName || m?.productName,
      notes: snippet,
    })
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

  /** List refresh; filters applied server-side */
  const refreshRecentList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (!opts?.silent) setLoadingRecent(true)
      try {
        const { activities } = await api.activities.list({
          limit: 100,
          period: datePeriod,
          customers: selectedCustomers.length ? selectedCustomers : undefined,
        })
        setRecentActivities(activities)
      } catch {
      } finally {
        if (!opts?.silent) setLoadingRecent(false)
      }
    },
    [datePeriod, selectedCustomers]
  )

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (dateFilterRef.current && !dateFilterRef.current.contains(t)) setDateMenuOpen(false)
      if (customerFilterRef.current && !customerFilterRef.current.contains(t)) setCustomerMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    void refreshRecentList({ silent: false })
  }, [datePeriod, selectedCustomers, refreshRecentList])

  useEffect(() => {
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
    const matched = findCustomerByName(customers, customerHint)
    if (matched?._id) {
      setSelectedCustomerId(matched._id)
    }
  }, [customers, customerHint, selectedCustomerId])

  useEffect(() => {
    if (!activityDetail?._id) {
      setSharePhotosReady(true)
      return
    }
    const imageCount = activityDetail.images?.length ?? 0
    const fileCount = Array.isArray(activityDetail.attachments)
      ? activityDetail.attachments.filter((a) => a?.url && !isVideoAttachment(a)).length
      : 0
    if (imageCount === 0 && fileCount === 0) {
      setSharePhotosReady(true)
      return
    }
    setSharePhotosReady(areSharePhotosReady(activityDetail))
    let cancelled = false
    void preloadShareImages(activityDetail).then(() => {
      if (!cancelled) setSharePhotosReady(areSharePhotosReady(activityDetail))
    })
    return () => {
      cancelled = true
    }
  }, [activityDetail?._id, activityDetail?.images, activityDetail?.attachments])

  function isShareBlockedForPhotos(): boolean {
    if (!activityDetail || !selectedActivityId) return false
    if (String(activityDetail._id) !== String(selectedActivityId)) return false
    const imageCount = activityDetail.images?.length ?? 0
    const fileCount = Array.isArray(activityDetail.attachments)
      ? activityDetail.attachments.filter((a) => a?.url && !isVideoAttachment(a)).length
      : 0
    if (imageCount === 0 && fileCount === 0) return false
    return !sharePhotosReady || isSharePhotosLoading(activityDetail)
  }

  function resetToNewLog() {
    clearSharedLogHighlight()
    setSelectedActivityId(null)
    setActivityDetail(null)
    setSharePhotosReady(true)
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
    setEditPartNumber('')
    setEditSupplierCode('')
    setEditVehicleLine([])
    setEditLocation('')
    setEditIntent('')
    setEditSeverity(DEFAULT_ISSUE_SEVERITY)
    setEditOutcome('')
    setEditNextActions('')
    setEditNotes('')
    setImageUrls([])
    clearPendingImages()
    setFailedAttachmentVideos({})
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (addImageInputRef.current) addImageInputRef.current.value = ''
    setAttachments([])
    setAttachmentFile(null)
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
    setSavedResultKey(null)
  }

  async function handleExtract(
    overrideText?: string,
    overrideCustomerHint?: string,
    fieldOverrides?: BarcodeFieldHints
  ) {
    const body = (overrideText !== undefined ? overrideText : text).trim()
    if (!body) {
      setError('Please describe the activity before logging with AI.')
      return
    }
    const effectiveCustomerHint = (overrideCustomerHint ?? customerHint).trim()
    if (isEmployee) {
      const hasDropdownChoice = Boolean(selectedCustomerId)
      const hasTypedCustomer = Boolean(effectiveCustomerHint)
      if (!hasDropdownChoice && !hasTypedCustomer) {
        setError('Please select a supplier before logging with AI.')
        return
      }
    }
    setError(null)
    setSaveMessage(null)
    setValidation(null)
    setSavedResultKey(null)
    setLoadingExtract(true)
    try {
      const data = await api.ai.extractActivity(body, effectiveCustomerHint || undefined)
      const structured = { ...((data.structured || {}) as StructuredActivity) }

      // Prefer explicit barcode/mapping overrides over AI guesses.
      if (fieldOverrides?.customer?.trim()) structured.customer = fieldOverrides.customer.trim()
      if (fieldOverrides?.partName?.trim()) structured.part_name = fieldOverrides.partName.trim()
      if (fieldOverrides?.partNumber?.trim()) {
        structured.part_number = fieldOverrides.partNumber.trim()
        delete structured.partNumber
      }
      if (fieldOverrides?.notes?.trim()) {
        structured.notes = mergeNotesWithScanBlock(
          typeof structured.notes === 'string' ? structured.notes : '',
          fieldOverrides.notes
        )
      }

      setResult({ ...data, structured })
      setEditSummary(structured.summary ?? '')
      setEditPartName(structured.part_name ?? structured.partName ?? '')
      setEditPartNumber(readPartNumberFromStructured(structured))
      setEditSupplierCode(readSupplierCodeFromStructured(structured))
      setEditVehicleLine(readVehicleLineFromStructured(structured))
      setEditLocation(normalizeLocationInput(structured.location ?? ''))
      setEditIntent(structured.intent ?? '')
      setEditSeverity(parseIssueSeverity(structured.severity))
      setEditOutcome(structured.outcome ?? '')
      setEditNextActions(structured.next_actions?.join('\n') ?? '')
      setEditNotes(structured.notes ?? '')
      const extractedCustomer =
        (typeof structured.customer === 'string' && structured.customer.trim()) ||
        effectiveCustomerHint ||
        ''
      if (extractedCustomer) {
        const matched = findCustomerByName(customers, extractedCustomer)
        setCustomerHint(matched?.name ?? extractedCustomer)
        setSelectedCustomerId(matched?._id ?? '')
      }
      // Re-apply mapping hints last so React state matches overrides even if AI left fields empty.
      applyBarcodeFormHints(fieldOverrides)
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
      const urlsForValidation =
        pendingImages.length > 0 ? await uploadPendingImages() : imageUrls
      const data = await api.ai.validateActivity(result.structured, result.rawText, urlsForValidation)
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
        setError('Please select a supplier before saving to tracker.')
        return
      }
    }
    setError(null)
    setSaveMessage(null)
    setSaving(true)
    try {
      const urlsForSave = pendingImages.length > 0 ? await uploadPendingImages() : imageUrls
      if (urlsForSave.length > MAX_IMAGES_PER_ENTRY) {
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
      const resolvedPartNumber = editPartNumber.trim() || readPartNumberFromStructured(base) || ''
      const resolvedSupplierCode = normalizeSupplierCodeInput(
        editSupplierCode || readSupplierCodeFromStructured(base) || ''
      )
      const resolvedVehicleLine =
        editVehicleLine.length > 0 ? editVehicleLine : readVehicleLineFromStructured(base)
      const resolvedLocation = normalizeLocationInput(
        editLocation || (typeof base.location === 'string' ? base.location : '') || ''
      )
      const resolvedIntent = editIntent || base.intent || ''
      const resolvedSeverity = editSeverity
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
      const imagesKey = urlsForSave.slice().join('|')
      const attachmentsKey = attachments
        .map((a) => a.url)
        .slice()
        .sort()
        .join('|')
      const currentKey = [
        (result.rawText || '').trim(),
        String(resolvedSummary).trim(),
        String(resolvedPartName).trim(),
        String(resolvedPartNumber).trim(),
        String(resolvedSupplierCode).trim(),
        resolvedVehicleLine.slice().sort().join(','),
        String(resolvedLocation).trim(),
        String(resolvedIntent).trim(),
        String(resolvedSeverity),
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
        part_number: resolvedPartNumber || undefined,
        supplier_code: resolvedSupplierCode || undefined,
        vehicle_line: resolvedVehicleLine.length ? resolvedVehicleLine : undefined,
        location: resolvedLocation || base.location,
        intent: resolvedIntent || base.intent,
        severity: resolvedSeverity,
        outcome: resolvedOutcome || base.outcome,
        next_actions: resolvedNextActions,
        notes: resolvedNotes || base.notes,
      }

      const resolvedRawText = text.trim() || result.rawText

      const { activity } = selectedActivityId
        ? await api.activities.update(selectedActivityId, {
            rawText: resolvedRawText,
            structured: editedStructured,
            images: urlsForSave,
            attachments,
            location: resolvedLocation,
          })
        : await api.activities.create({
            rawText: resolvedRawText,
            structured: editedStructured,
            images: urlsForSave.length ? urlsForSave : undefined,
            attachments: attachments.length ? attachments : undefined,
            location: resolvedLocation || undefined,
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
      if (resolvedCustomer) {
        const matchedAfterSave = findCustomerByName(customers, resolvedCustomer)
        setCustomerHint(matchedAfterSave?.name ?? resolvedCustomer)
        setSelectedCustomerId(matchedAfterSave?._id ?? selectedCustomerId)
      }

      const newId = String((activity as { _id?: string })._id || '')
      if (selectedActivityId && newId) {
        try {
          const refreshed = await api.activities.getOne(selectedActivityId)
          const d = refreshed.activity as ActivityDetail
          setActivityDetail(d)
          setShareSelection((d.sharedWith ?? []).map((s) => s._id))
          clearShareImageCache(String(d._id))
          void preloadShareImages(d)
        } catch {
        }
      } else if (!selectedActivityId && newId) {
        setSelectedActivityId(newId)
        try {
          const refreshed = await api.activities.getOne(newId)
          const d = refreshed.activity as ActivityDetail
          setActivityDetail(d)
          setShareSelection((d.sharedWith ?? []).map((s) => s._id))
          clearShareImageCache(String(d._id))
          void preloadShareImages(d)
        } catch {
          setActivityDetail(activity as ActivityDetail)
        }
      }

      // Keep recent list in sync after create/update.
      setRecentActivities((prev) => {
        const nextItem = {
          _id: (activity as any)._id,
          customer: (activity as any).customer,
          location: (activity as any).location,
          reportingPlant: (activity as any).reportingPlant,
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

  async function handleSelectRecent(
    id: string,
    options?: { appendSnippet?: string; prepareReExtract?: boolean }
  ): Promise<{ merged: string; detailCustomer: string }> {
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
    try {
      const recentListCustomer =
        recentActivities.find((a) => a._id === id)?.customer?.trim() || ''
      const { activity } = await api.activities.getOne(id)
      const detail = activity as ActivityDetail
      setActivityDetail(detail)
      setShareSelection((detail.sharedWith ?? []).map((s) => s._id))

      const structured = (detail.structuredData || {}) as StructuredActivity
      const baseRaw = (detail.rawConversation ?? '').trim()
      const snippet = options?.appendSnippet?.trim() || ''
      const merged =
        snippet && options?.appendSnippet !== undefined
          ? baseRaw
            ? `${baseRaw}\n\n${snippet}`
            : snippet
          : (detail.rawConversation ?? '')

      if (options?.prepareReExtract) {
        setResult(null)
        setValidation(null)
        setEditSummary('')
        setEditPartName('')
        setEditPartNumber('')
        setEditSupplierCode('')
        setEditVehicleLine([])
        setEditLocation('')
        setEditIntent('')
        setEditSeverity(DEFAULT_ISSUE_SEVERITY)
        setEditOutcome('')
        setEditNextActions('')
        setEditNotes('')
      } else {
        setResult({
          structured,
          rawText: merged,
          model: 'from-history',
        })
        setEditSummary(structured.summary ?? '')
        setEditPartName(structured.part_name ?? '')
        setEditPartNumber(readPartNumberFromStructured(structured))
        setEditSupplierCode(readSupplierCodeFromStructured(structured))
        setEditVehicleLine(readVehicleLineFromStructured(structured))
        setEditLocation(
          normalizeLocationInput(
            (typeof detail.location === 'string' && detail.location) ||
              (typeof structured.location === 'string' && structured.location) ||
              ''
          )
        )
        setEditIntent(structured.intent ?? '')
        setEditSeverity(parseIssueSeverity(structured.severity))
        setEditOutcome(structured.outcome ?? '')
        setEditNextActions(structured.next_actions?.join('\n') ?? '')
        setEditNotes(structured.notes ?? '')
      }

      setText(merged)
      setImageUrls(detail.images ?? [])
      clearShareImageCache(String(detail._id))
      void preloadShareImages(detail)
      setAttachments(Array.isArray(detail.attachments) ? detail.attachments : [])
      setAttachmentFile(null)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      clearPendingImages()
      setFailedAttachmentVideos({})
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (addImageInputRef.current) addImageInputRef.current.value = ''
      const detailCustomer =
        (typeof detail.customer === 'string' && detail.customer.trim()) ||
        (typeof structured.customer === 'string' && structured.customer.trim()) ||
        recentListCustomer ||
        ''
      if (detailCustomer) {
        const matchedCustomer = findCustomerByName(customers, detailCustomer)
        setSelectedCustomerId(matchedCustomer?._id ?? '')
        setCustomerHint(matchedCustomer?.name ?? detailCustomer)
      } else {
        setSelectedCustomerId('')
        setCustomerHint('')
      }
      if (!options?.prepareReExtract) {
        const existingKey = [
          merged.trim(),
          String(structured.summary ?? '').trim(),
          String(structured.part_name ?? '').trim(),
          String(readPartNumberFromStructured(structured)).trim(),
          String(readSupplierCodeFromStructured(structured)).trim(),
          readVehicleLineFromStructured(structured).slice().sort().join(','),
          String(
            normalizeLocationInput(
              (typeof detail.location === 'string' && detail.location) ||
                (typeof structured.location === 'string' && structured.location) ||
                ''
            )
          ).trim(),
          String(structured.intent ?? '').trim(),
          String(parseIssueSeverity(structured.severity)),
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
      }

      return { merged, detailCustomer }
    } catch (err) {
      const message = (err as Error).message || 'Failed to load activity'
      setError(message)
      return { merged: '', detailCustomer: '' }
    } finally {
      setLoadingSelected(false)
    }
  }

  function openArchiveConfirmPrompt(opts?: { closeRecentModal?: boolean }) {
    if (!selectedActivityId) {
      toast.error('Select a log from the list before archiving.')
      return
    }
    if (loadingSelected) {
      toast.info('Wait for the log to finish loading, then tap Archive again.')
      return
    }
    if (!canArchiveSelected) {
      toast.error('Only the log owner or an admin can archive this log.')
      return
    }
    setError(null)
    setArchiveCloseRecentModal(Boolean(opts?.closeRecentModal))
    setArchiveConfirmOpen(true)
  }

  async function handleArchiveSelected(opts?: { closeRecentModal?: boolean }) {
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
      setEditPartNumber('')
      setEditSupplierCode('')
      setEditVehicleLine([])
      setEditLocation('')
      setEditIntent('')
      setEditSeverity(DEFAULT_ISSUE_SEVERITY)
      setEditOutcome('')
      setEditNextActions('')
      setEditNotes('')
      setImageUrls([])
      clearPendingImages()
      setFailedAttachmentVideos({})
      setAttachments([])
      setAttachmentFile(null)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (addImageInputRef.current) addImageInputRef.current.value = ''
      setSavedResultKey(null)
      setArchiveConfirmOpen(false)
      if (opts?.closeRecentModal || archiveCloseRecentModal) setRecentModalOpen(false)
      setArchiveCloseRecentModal(false)
    } catch (err) {
      const message = (err as Error).message || 'Failed to archive activity'
      setError(message)
    } finally {
      setArchiving(false)
    }
  }

  async function openEmailConfirmPrompt() {
    if (!selectedActivityId) {
      setError('Select a log from the list before sending email.')
      return
    }
    setEmailRecipientsLoading(true)
    setError(null)
    try {
      const customerEmails = selectedLogCustomerEmails()
      const defaults = await api.ms365.getDefaultRecipients()
      const managerCc = Array.isArray(defaults?.recipients?.cc)
        ? defaults.recipients.cc
            .filter((v) => typeof v === 'string')
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)
        : []
      setEmailCustomerRecipients(customerEmails)
      setSelectedCustomerEmailRecipients(customerEmails)
      setEmailManagerCcRecipients([...new Set(managerCc)])
      setIncludeManagerCcRecipients(managerCc.length > 0)
      setEmailConfirmOpen(true)
    } catch (err) {
      const message = (err as Error).message || 'Failed to prepare email recipients'
      setError(message)
      toast.error(message)
    } finally {
      setEmailRecipientsLoading(false)
    }
  }

  async function handleShareLog() {
    if (!selectedActivityId) {
      setError('Select a log from the list before sharing.')
      return
    }
    if (
      !activityDetail ||
      String(activityDetail._id) !== String(selectedActivityId)
    ) {
      setError('Wait for the log to finish loading, then tap Share again.')
      return
    }
    setSharingLog(true)
    setError(null)
    setSaveMessage(null)
    try {
      const detail = activityDetail
      const imageCount = Array.isArray(detail.images) ? detail.images.length : 0
      const fileCount = Array.isArray(detail.attachments)
        ? detail.attachments.filter((a) => a?.url && !isVideoAttachment(a)).length
        : 0
      const result = await shareActivityLog(detail, resolveSharePreferences(user?.sharePreferences).activityLog)
      if (result.mode === 'native') {
        const parts: string[] = []
        if (result.imageCount > 0) {
          parts.push(`${result.imageCount} photo${result.imageCount === 1 ? '' : 's'}`)
        }
        if (result.fileCount > 0) {
          parts.push(`${result.fileCount} file${result.fileCount === 1 ? '' : 's'}`)
        }
        if (parts.length > 0) {
          toast.success(
            `Share opened with ${parts.join(' and ')} attached. Full-size links are in the message caption.`
          )
        } else {
          toast.success('Share sheet opened.')
        }
        return
      }
      toast.info(
        imageCount > 0 || fileCount > 0
          ? 'Share not available here. Log copied with photo and file links (blank line between each link).'
          : 'Native share is not available here. Log text copied to clipboard.'
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = (err as Error).message || 'Failed to share log'
      setError(message)
      toast.error(message)
    } finally {
      setSharingLog(false)
    }
  }

  async function handleSendLogEmail() {
    if (!selectedActivityId) {
      setError('Select a log from the list before sending email.')
      return
    }
    const to = [...selectedCustomerEmailRecipients]
    const cc = includeManagerCcRecipients ? emailManagerCcRecipients : []
    if (to.length === 0 && cc.length === 0) {
      setError('No recipients selected. Choose at least one recipient before sending.')
      return
    }
    setSendingEmail(true)
    setError(null)
    setSaveMessage(null)
    try {
      const res = await api.activities.sendEmail(selectedActivityId, { to, cc })
      const recipientLabel = res.to.length > 0 ? res.to.join(', ') : 'configured recipients'
      const skippedCount = Array.isArray(res.skipped) ? res.skipped.length : 0
      const extra =
        skippedCount > 0
          ? ` Sent ${res.attachedCount}/${res.sourceCount} files (${skippedCount} skipped due to download or size limits).`
          : ` Sent with ${res.attachedCount} attached file(s).`
      toast.success(`Email sent to ${recipientLabel}.${extra}`)
      setEmailConfirmOpen(false)
    } catch (err) {
      const message = (err as Error).message || 'Failed to send activity email'
      setError(message)
      toast.error(message)
    } finally {
      setSendingEmail(false)
    }
  }

  const filteredActivities = recentActivities
  const mobileRecentPreview = filteredActivities.slice(0, 3)

  function toggleCustomerFilter(name: string) {
    setSelectedCustomers((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    )
  }
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
        {/* Page header: title + description above toolbar */}
        <div className="mb-6 space-y-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#111] flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <MessageSquare className="w-4 h-4" />
              </span>
              AI Chat Logging
            </h1>
            <p className="mt-2 text-sm text-[#666] max-w-3xl leading-relaxed">
              Turn site visits and quality notes into structured logs. Add photos, files, and barcodes, then save them
              to your activity history. Admins can review everything from the Activity screen.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[#fafafa] px-3 py-3 md:px-5">
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center md:justify-between md:gap-2.5">
              <div className="contents md:flex md:flex-wrap md:items-center md:gap-2.5">
            <div ref={dateFilterRef} className="relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setDateMenuOpen((o) => !o)
                  setCustomerMenuOpen(false)
                }}
                className={`flex w-full md:w-auto h-10 md:min-w-[8.5rem] items-center justify-center gap-2 rounded-lg border bg-white px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium shadow-sm transition-colors ${
                  datePeriod !== 'all'
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[#333] hover:border-[#ccc] hover:bg-white'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0 opacity-80" />
                <span className="leading-none truncate min-w-0">{datePeriodLabel}</span>
                <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
              </button>
              {dateMenuOpen && (
                <div className="absolute left-0 right-0 sm:left-auto sm:right-0 z-50 mt-1 min-w-[10rem] rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-lg">
                  {DATE_PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDatePeriod(opt.value)
                        setDateMenuOpen(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-[13px] hover:bg-black/[0.04] ${
                        datePeriod === opt.value ? 'font-semibold text-[var(--color-primary)]' : 'text-[#333]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={customerFilterRef} className="relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setCustomerMenuOpen((o) => !o)
                  setDateMenuOpen(false)
                }}
                className={`flex w-full md:w-auto h-10 md:min-w-[9.5rem] items-center justify-center gap-2 rounded-lg border bg-white px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium shadow-sm transition-colors ${
                  selectedCustomers.length > 0
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[#333] hover:border-[#ccc] hover:bg-white'
                }`}
              >
                <Tag className="w-4 h-4 shrink-0 opacity-80" />
                <span className="leading-none truncate min-w-0">{customerFilterLabel}</span>
                <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
              </button>
              {customerMenuOpen && (
                <div className="absolute left-0 right-0 sm:left-auto sm:right-0 z-50 mt-1 w-full sm:min-w-[14rem] sm:max-w-[18rem] max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomers([])}
                    className="w-full px-3 py-1.5 text-left text-[12px] font-semibold text-[var(--color-primary)] hover:bg-black/[0.04]"
                  >
                    All customers
                  </button>
                  {customers.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[#888]">No customers loaded</p>
                  ) : (
                    customers.map((c) => (
                      <label
                        key={c._id}
                        className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#333] hover:bg-black/[0.04] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(c.name)}
                          onChange={() => toggleCustomerFilter(c.name)}
                          className="rounded border-[var(--color-border)]"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
              </div>

              <div className="contents md:flex md:flex-wrap md:items-center md:gap-2.5">
            <button
              type="button"
              onClick={() => void startScanner()}
              className="flex w-full md:w-auto h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium text-[#333] shadow-sm hover:border-[#ccc] transition-colors"
            >
              <ScanLine className="w-4 h-4 shrink-0 opacity-80" />
              <span className="leading-none truncate min-w-0">Scan barcode</span>
            </button>
            <button
              type="button"
              onClick={() => void openEmailConfirmPrompt()}
              disabled={!selectedActivityId || sendingEmail || emailRecipientsLoading || archiving}
              className={`flex w-full md:w-auto h-10 items-center justify-center gap-2 rounded-lg border px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium shadow-sm transition-colors ${
                !selectedActivityId || sendingEmail || emailRecipientsLoading || archiving
                  ? 'border-[var(--color-border)] bg-[#f3f3f3] text-[#999] cursor-not-allowed shadow-none'
                  : 'border-emerald-300/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
              title={!selectedActivityId ? 'Select a recent log first, then click Email' : 'Email selected AI log'}
            >
              {emailRecipientsLoading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Mail className="w-4 h-4 shrink-0" />}
              <span className="leading-none">Email</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShareLog()}
              disabled={!selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()}
              className={`flex w-full md:w-auto h-10 items-center justify-center gap-2 rounded-lg border px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium shadow-sm transition-colors ${
                !selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()
                  ? 'border-[var(--color-border)] bg-[#f3f3f3] text-[#999] cursor-not-allowed shadow-none'
                  : 'border-sky-300/70 bg-sky-50 text-sky-900 hover:bg-sky-100'
              }`}
              title={
                !selectedActivityId
                  ? 'Select a recent log first, then click Share'
                  : isShareBlockedForPhotos()
                    ? 'Loading photos and files — wait a few seconds'
                    : canUseNativeShare()
                      ? 'Share log with photos and files attached (links for full size below)'
                      : 'Share this log (copies text and links when native share is unavailable)'
              }
            >
              {sharingLog || isShareBlockedForPhotos() ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 shrink-0" />
              )}
              <span className="leading-none">
                {isShareBlockedForPhotos() ? 'Loading…' : 'Share'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openArchiveConfirmPrompt()}
              disabled={archiving}
              className={`flex w-full md:w-auto h-10 items-center justify-center gap-2 rounded-lg border px-2.5 md:px-3.5 text-[12px] md:text-[13px] font-medium shadow-sm transition-colors touch-manipulation ${
                !selectedActivityId || archiving
                  ? 'border-[var(--color-border)] bg-[#f3f3f3] text-[#999] cursor-not-allowed shadow-none'
                  : canArchiveSelected
                    ? 'border-red-300/70 bg-red-50 text-red-900 hover:bg-red-100 active:bg-red-200'
                    : 'border-[var(--color-border)] bg-[#f3f3f3] text-[#777] hover:bg-[#ececec] active:bg-[#e4e4e4]'
              }`}
              title={
                !selectedActivityId
                  ? 'Select a recent log first, then click Archive'
                  : !canArchiveSelected
                    ? 'Only the log owner or an admin can archive team logs'
                    : 'Archive selected AI log'
              }
            >
              {archiving ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Archive className="w-4 h-4 shrink-0" />}
              <span className="leading-none">Archive</span>
            </button>
              </div>
            </div>
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
                  After a scan, you&apos;ll choose whether to start a <strong>new AI log</strong> or attach the code to a{' '}
                  <strong>recent log</strong>. The barcode details are then run through the same AI extract-and-save flow as
                  typed notes.
                </p>
              </div>
            </div>
          </div>
        )}

        {barcodeIntegrationOpen && pendingBarcodeClarification && (
          <div className="fixed inset-0 z-[45] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[var(--color-border)] overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <ScanLine className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#555]">
                      {barcodeIntegrationStep === 'choice' ? 'Use scan in AI log' : 'Pick a recent log'}
                    </p>
                    <p className="text-[11px] text-[#777] font-mono truncate" title={pendingBarcodeClarification.barcode}>
                      {pendingBarcodeClarification.barcode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelBarcodeIntegration}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/5 text-[#666]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {barcodeIntegrationStep === 'choice' ? (
                <div className="px-4 py-4 space-y-4 overflow-y-auto">
                  <p className="text-[13px] text-[#444] leading-relaxed">
                    Connect this scan to your tracker the same way as a voice or text note: it becomes part of an AI log you
                    can validate and save.
                  </p>
                  {pendingBarcodeClarification.mode === 'known' &&
                  (pendingBarcodeClarification.mapping?.partName ||
                    pendingBarcodeClarification.mapping?.customer) ? (
                    <p className="text-[12px] text-[#666] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                      Recognized:{' '}
                      <span className="font-medium text-[#222]">
                        {[
                          pendingBarcodeClarification.mapping?.partName || pendingBarcodeClarification.mapping?.productName,
                          pendingBarcodeClarification.mapping?.partNumber,
                          pendingBarcodeClarification.mapping?.customer,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => void onBarcodeIntegrationCreateNew()}
                      className="w-full text-left rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:bg-[var(--color-bg)] transition-colors"
                    >
                      <span className="text-[13px] font-semibold text-[#111]">Create new log</span>
                      <span className="block text-[12px] text-[#666] mt-0.5">
                        Opens a fresh log with this barcode; AI will extract fields for you to review.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={onBarcodeIntegrationAddToExisting}
                      className="w-full text-left rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:bg-[var(--color-bg)] transition-colors"
                    >
                      <span className="text-[13px] font-semibold text-[#111]">Add to existing log</span>
                      <span className="block text-[12px] text-[#666] mt-0.5">
                        Choose one of your recent logs and append this scan; AI re-runs on the combined text.
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="px-4 pt-3 pb-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBarcodeIntegrationStep('choice')}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Back
                    </button>
                    <p className="text-[12px] text-[#666] mt-2">
                      Pick a log you own (or any log you can edit). The scan is appended and AI extract runs again on the
                      combined text.
                    </p>
                  </div>
                  <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-2">
                    {loadingRecent ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[#666]">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                        Loading recent logs…
                      </div>
                    ) : recentActivitiesEditable.length === 0 ? (
                      <p className="text-[13px] text-[#666] py-6 text-center">
                        No logs available to update. Use <strong>Create new log</strong> first, or save a log and try again.
                      </p>
                    ) : (
                      recentActivitiesEditable.map((act) => (
                        <button
                          key={act._id}
                          type="button"
                          onClick={() => void onPickRecentForBarcode(act._id)}
                          className="w-full text-left rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-medium text-[#111] line-clamp-2">
                              {act.summary || 'Untitled log'}
                            </span>
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#888]">
                              <Clock className="w-3.5 h-3.5" />
                              {formatUsDateTime(act.createdAt)}
                            </span>
                          </div>
                          {act.customer ? (
                            <p className="text-[11px] text-[#666] mt-1">
                              <Tag className="w-3 h-3 inline-block mr-1 align-middle opacity-70" />
                              {act.customer}
                            </p>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
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
                    Supplier name
                  </label>
                  <CustomerTypeahead
                    customers={customers}
                    value={barcodeCustomer}
                    loading={loadingCustomers}
                    placeholder="Bosch"
                    onChange={(name) => setBarcodeCustomer(name)}
                    inputClassName="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[13px] text-[#111] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
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
                    placeholder="Serial number or any notes regarding this part?"
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
                        toast.error('Please provide supplier name for this barcode.')
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

                        const intent = barcodeMergeIntentRef.current
                        barcodeMergeIntentRef.current = null
                        const snippet = buildBarcodeLogSnippet(
                          barcodeModal.barcode,
                          payload.customer,
                          payload.partName,
                          payload.partNumber,
                          barcodeNotes.trim() || undefined
                        )

                        if (intent?.kind === 'newLog') {
                          closeBarcodeModal()
                          await flushBarcodeToNewLog(snippet, payload.customer, {
                            customer: payload.customer,
                            partNumber: payload.partNumber,
                            partName: payload.partName,
                            notes: snippet,
                          })
                          return
                        }
                        if (intent?.kind === 'existingLog') {
                          closeBarcodeModal()
                          await flushBarcodeToExistingLog(intent.activityId, snippet, {
                            customer: payload.customer,
                            partNumber: payload.partNumber,
                            partName: payload.partName,
                            notes: snippet,
                          })
                          return
                        }

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

        {archiveConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-[var(--color-border)] shadow-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-[var(--color-border)]">
                <p className="text-sm font-medium text-[#111]">Archive this AI log?</p>
                <p className="mt-1.5 text-[12px] text-[#666] leading-relaxed">
                  The log will move to the Archived tab on the Activity screen. You can restore it later if needed.
                </p>
              </div>
              <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveConfirmOpen(false)
                    setArchiveCloseRecentModal(false)
                  }}
                  disabled={archiving}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[#444] hover:bg-black/[0.03] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleArchiveSelected({ closeRecentModal: archiveCloseRecentModal })}
                  disabled={archiving}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-700 bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {emailConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white border border-[var(--color-border)] shadow-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#666]">Confirm email</p>
                  <p className="text-sm font-medium text-[#111]">Do you want to email this AI log to:</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailConfirmOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#666] hover:bg-black/[0.04]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 sm:px-5 py-4 space-y-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <span className="text-[13px] font-semibold text-[#222]">Customer recipients</span>
                  {emailCustomerRecipients.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {emailCustomerRecipients.map((email) => {
                        const checked = selectedCustomerEmailRecipients.includes(email)
                        return (
                          <label key={email} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedCustomerEmailRecipients((prev) => {
                                  if (e.target.checked) return [...new Set([...prev, email])]
                                  return prev.filter((item) => item !== email)
                                })
                              }}
                              className="mt-0.5"
                            />
                            <span className="text-[12px] text-[#666] break-all">{email}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="mt-1 block text-[12px] text-[#666]">No customer email linked to this log</span>
                  )}
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={includeManagerCcRecipients}
                    onChange={(e) => setIncludeManagerCcRecipients(e.target.checked)}
                    disabled={emailManagerCcRecipients.length === 0}
                    className="mt-0.5"
                  />
                  <span className="text-[13px] text-[#222]">
                    <span className="font-semibold">Default CC (from settings)</span>
                    <span className="block text-[12px] text-[#666]">
                      {emailManagerCcRecipients.length > 0
                        ? emailManagerCcRecipients.join(', ')
                        : 'No default CC configured'}
                    </span>
                  </span>
                </label>
                <p className="text-[11px] text-[#777]">
                  Attachments from this log (images/files) are included automatically when you use Send.
                </p>
                <p className="text-[11px] text-[#777]">
                  Use Share to open your phone&apos;s share menu (Mail, Messages, WhatsApp, etc.) with log text,
                  photos, and files.
                </p>
              </div>
              <div className="px-4 sm:px-5 py-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmailConfirmOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-semibold text-[#444] hover:bg-black/[0.03]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareLog()}
                  disabled={sharingLog}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[12px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                >
                  {sharingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendLogEmail()}
                  disabled={sendingEmail}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send
                </button>
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

              <div className="relative z-10 shrink-0 flex flex-wrap items-center justify-center gap-2.5 min-w-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] sm:justify-between">
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
                    setEditPartNumber('')
                    setEditSupplierCode('')
                    setEditVehicleLine([])
                    setEditLocation('')
                    setEditIntent('')
                    setEditSeverity(DEFAULT_ISSUE_SEVERITY)
                    setEditOutcome('')
                    setEditNextActions('')
                    setEditNotes('')
                    setImageUrls([])
                    clearPendingImages()
                    setFailedAttachmentVideos({})
                    setAttachments([])
                    setAttachmentFile(null)
                    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                    if (addImageInputRef.current) addImageInputRef.current.value = ''
                    setSavedResultKey(null)
                    setRecentModalOpen(false)
                  }}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03] touch-manipulation"
                  aria-label="New log"
                  title="New log"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => void openEmailConfirmPrompt()}
                  disabled={!selectedActivityId || sendingEmail || archiving}
                  aria-label={sendingEmail ? 'Sending email…' : 'Send email'}
                  title={
                    !selectedActivityId
                      ? 'Select a recent log first, then click to send email'
                      : sendingEmail
                        ? 'Sending…'
                        : 'Send selected recent log by email'
                  }
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors touch-manipulation ${
                    !selectedActivityId || sendingEmail || archiving
                      ? 'border-[var(--color-border)] text-[#777] disabled:opacity-60 disabled:cursor-not-allowed'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100'
                  }`}
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareLog()}
                  disabled={!selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()}
                  aria-label={
                    sharingLog || isShareBlockedForPhotos() ? 'Preparing share…' : 'Share log'
                  }
                  title={
                    !selectedActivityId
                      ? 'Select a recent log first, then click to share'
                      : isShareBlockedForPhotos()
                        ? 'Loading photos and files — wait a few seconds'
                        : sharingLog
                          ? 'Preparing…'
                          : canUseNativeShare()
                            ? 'Share via your phone apps (Mail, Messages, etc.) with photos and files'
                            : 'Share log (copies text when native share is unavailable)'
                  }
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors touch-manipulation ${
                    !selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()
                      ? 'border-[var(--color-border)] text-[#777] disabled:opacity-60 disabled:cursor-not-allowed'
                      : 'border-sky-200 text-sky-700 hover:bg-sky-50 active:bg-sky-100'
                  }`}
                >
                  {sharingLog || isShareBlockedForPhotos() ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openArchiveConfirmPrompt({ closeRecentModal: true })}
                  disabled={archiving}
                  aria-label={archiving ? 'Archiving…' : 'Archive'}
                  title={
                    !selectedActivityId
                      ? 'Select a log first to enable Archive'
                      : !canArchiveSelected
                        ? 'Only the log owner or an admin can archive team logs'
                        : 'Archive selected log'
                  }
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors touch-manipulation ${
                    archiving
                      ? 'border-[var(--color-border)] bg-[#f3f3f3] text-[#999] cursor-not-allowed'
                      : canArchiveSelected && selectedActivityId
                        ? 'border-red-700 bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                        : 'border-[var(--color-border)] bg-white text-[#777] hover:bg-black/[0.03] active:bg-black/[0.06]'
                  }`}
                >
                  {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative z-0 flex-1 min-h-0 overflow-auto divide-y divide-[var(--color-border)]">
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
                              Team
                            </span>
                          )}
                          <span className="truncate">
                            {act.customer || 'Unknown customer'}
                            {act.reportingPlant ? (
                              <> · <span className="font-medium text-[#555]">{act.reportingPlant}</span></>
                            ) : null}
                            {act.location ? <> · <span className="font-mono text-[#444]">{act.location}</span></> : null}
                            {' · '}{formatUsDateTime(act.createdAt)}
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
                        : datePeriod !== 'all' || selectedCustomers.length > 0
                          ? 'Try clearing date or customer filters.'
                          : 'Use the form to add a new activity.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,_330px)_minmax(0,_1fr)]">
          {/* Left: recent activity list */}
          <section
            className={`rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden hidden md:block border bg-white transition-[box-shadow,background-color,border-color] duration-300 ${
              hasRecentSharedHighlight
                ? 'border-sky-400/85 ring-2 ring-sky-300/45 bg-gradient-to-b from-sky-50/95 to-white shadow-[0_10px_28px_rgba(14,165,233,0.2)]'
                : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-3 min-w-0 px-4 py-3 border-b border-[var(--color-border)]">
              <p
                className={`text-xs font-medium uppercase tracking-[0.14em] shrink-0 whitespace-nowrap ${
                  hasRecentSharedHighlight ? 'text-sky-900 font-semibold' : 'text-[#777]'
                }`}
              >
                Recent logs
              </p>
              <div className="flex flex-nowrap items-center justify-end gap-1.5 shrink-0">
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
                    setEditPartNumber('')
                    setEditSupplierCode('')
                    setEditVehicleLine([])
                    setEditLocation('')
                    setEditIntent('')
                    setEditSeverity(DEFAULT_ISSUE_SEVERITY)
                    setEditOutcome('')
                    setEditNextActions('')
                    setEditNotes('')
                    setImageUrls([])
                    clearPendingImages()
                    setFailedAttachmentVideos({})
                    setAttachments([])
                    setAttachmentFile(null)
                    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
                    if (addImageInputRef.current) addImageInputRef.current.value = ''
                    setSavedResultKey(null)
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[#444] hover:bg-black/[0.03] transition-colors"
                  aria-label="New log"
                  title="New log"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void openEmailConfirmPrompt()}
                  disabled={!selectedActivityId || sendingEmail || archiving}
                  aria-label={sendingEmail ? 'Sending email…' : 'Send email'}
                  title={
                    !selectedActivityId
                      ? 'Select a recent log first, then click to send email'
                      : sendingEmail
                        ? 'Sending…'
                        : 'Send selected recent log by email'
                  }
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white transition-colors ${
                    !selectedActivityId || sendingEmail || archiving
                      ? 'border-[var(--color-border)] text-[#777] disabled:opacity-60 disabled:cursor-not-allowed'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100'
                  }`}
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareLog()}
                  disabled={!selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()}
                  aria-label={
                    sharingLog || isShareBlockedForPhotos() ? 'Preparing share…' : 'Share log'
                  }
                  title={
                    !selectedActivityId
                      ? 'Select a recent log first, then click to share'
                      : isShareBlockedForPhotos()
                        ? 'Loading photos and files — wait a few seconds'
                        : sharingLog
                          ? 'Preparing…'
                          : canUseNativeShare()
                            ? 'Share via your phone apps (Mail, Messages, etc.) with photos and files'
                            : 'Share log (copies text when native share is unavailable)'
                  }
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white transition-colors ${
                    !selectedActivityId || sharingLog || archiving || isShareBlockedForPhotos()
                      ? 'border-[var(--color-border)] text-[#777] disabled:opacity-60 disabled:cursor-not-allowed'
                      : 'border-sky-200 text-sky-700 hover:bg-sky-50 active:bg-sky-100'
                  }`}
                >
                  {sharingLog || isShareBlockedForPhotos() ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openArchiveConfirmPrompt()}
                  disabled={archiving}
                  aria-label={archiving ? 'Archiving…' : 'Archive'}
                  title={
                    !selectedActivityId
                      ? 'Select a log first to enable Archive'
                      : !canArchiveSelected
                        ? 'Only the log owner or an admin can archive team logs'
                        : 'Archive selected log'
                  }
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors touch-manipulation ${
                    archiving
                      ? 'border-[var(--color-border)] bg-[#f3f3f3] text-[#999] cursor-not-allowed'
                      : canArchiveSelected && selectedActivityId
                        ? 'border-red-700 bg-red-600 text-white hover:bg-red-700'
                        : 'border-[var(--color-border)] bg-white text-[#777] hover:bg-black/[0.03]'
                  }`}
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
                            Team
                          </span>
                        )}
                        <span className="truncate">
                          {act.customer || 'Unknown customer'}
                          {act.reportingPlant ? (
                            <> · <span className="font-medium text-[#555]">{act.reportingPlant}</span></>
                          ) : null}
                          {act.location ? <> · <span className="font-mono text-[#444]">{act.location}</span></> : null}
                          {' · '}{formatUsDateTime(act.createdAt)}
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
                      : datePeriod !== 'all' || selectedCustomers.length > 0
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
                          Team
                        </span>
                      )}
                      <span className="truncate">
                        {act.customer || 'Unknown customer'}
                        {act.reportingPlant ? (
                          <> · <span className="font-medium text-[#555]">{act.reportingPlant}</span></>
                        ) : null}
                        {act.location ? <> · <span className="font-mono text-[#444]">{act.location}</span></> : null}
                        {' · '}{formatUsDateTime(act.createdAt)}
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
                      : datePeriod !== 'all' || selectedCustomers.length > 0
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
                  disabled={false}
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
                        <textarea
                          rows={3}
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          className="w-full resize-none overflow-y-auto max-h-32 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
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
                          Part number
                        </label>
                        <input
                          type="text"
                          value={editPartNumber}
                          onChange={(e) => setEditPartNumber(e.target.value)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="e.g. BCZM-1023"
                        />
                        <p className="text-[10px] text-[#999] mt-0.5">
                          Filled from barcode scans and AI extraction; you can type or edit anytime.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Supplier name{isEmployee ? ' *' : ''}
                        </label>
                        <CustomerTypeahead
                          customers={customers}
                          value={customerHint}
                          loading={loadingCustomers}
                          placeholder={
                            isEmployee
                              ? 'Type or pick supplier name (required)'
                              : 'Type or pick supplier name'
                          }
                          onChange={(name, customer) => {
                            setCustomerHint(name)
                            setSelectedCustomerId(customer?._id ?? '')
                          }}
                          inputClassName="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Supplier code{' '}
                          <span className="font-normal text-[#999]">(5 characters)</span>
                        </label>
                        <input
                          type="text"
                          value={editSupplierCode}
                          onChange={(e) => setEditSupplierCode(normalizeSupplierCodeInput(e.target.value))}
                          maxLength={MAX_SUPPLIER_CODE_LENGTH}
                          inputMode="text"
                          autoCapitalize="characters"
                          spellCheck={false}
                          className="w-full uppercase tracking-wider rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="AB12C"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold text-[#555] mb-1.5">Vehicle line</span>
                        <div className="flex flex-wrap gap-3">
                          {VEHICLE_LINE_OPTIONS.map((line) => {
                            const checked = editVehicleLine.includes(line)
                            return (
                              <label
                                key={line}
                                className="inline-flex items-center gap-2 text-[12px] text-[#333] cursor-pointer select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setEditVehicleLine((prev) =>
                                      checked ? prev.filter((l) => l !== line) : [...prev, line]
                                    )
                                  }}
                                  className="h-3.5 w-3.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                                />
                                {line}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Location <span className="font-normal text-[#999]">(up to 5 chars — where to find it)</span>
                        </label>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(normalizeLocationInput(e.target.value))}
                          maxLength={MAX_LOCATION_LENGTH}
                          inputMode="text"
                          autoCapitalize="characters"
                          spellCheck={false}
                          className="w-full uppercase tracking-wider rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] placeholder:text-[#aaa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                          placeholder="A12, B-7, ZN102"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#555] mb-1">
                          Severity
                        </label>
                        <select
                          value={editSeverity}
                          onChange={(e) => setEditSeverity(Number(e.target.value) as 0 | 1 | 2 | 3)}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[#222] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                        >
                          <option value={0}>0 — All good (operator discussion / no issue)</option>
                          <option value={1}>1 — Low</option>
                          <option value={2}>2 — Medium</option>
                          <option value={3}>3 — High</option>
                        </select>
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
              {userReportingPlant ? (
                <p className="mb-2 text-[11px] text-[#666]">
                  Reporting plant: <span className="font-semibold text-[#333]">{userReportingPlant}</span>
                  {!selectedActivityId ? (
                    <span className="text-[#999]"> — new logs will be tagged with this plant.</span>
                  ) : null}
                </p>
              ) : (
                <p className="mb-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Set your reporting plant in{' '}
                  <Link to="/profile?edit=1" className="font-semibold underline underline-offset-2">
                    Profile
                  </Link>{' '}
                  so logs can be filtered by OEM in reports.
                </p>
              )}
              <fieldset
                disabled={false}
                className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0 disabled:opacity-[0.85]"
              >
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Example: Spoke with Apex Engineering about line-3 downtime; diagnosed sensor issue and planned follow‑up visit tomorrow at 10:00."
                  className="w-full resize-none overflow-y-auto max-h-40 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                />
                <CustomerTypeahead
                  customers={customers}
                  value={customerHint}
                  loading={loadingCustomers}
                  placeholder={
                    isEmployee
                      ? 'Type or pick supplier name (required) *'
                      : 'Type or pick supplier name (optional)'
                  }
                  onChange={(name, customer) => {
                    setCustomerHint(name)
                    setSelectedCustomerId(customer?._id ?? '')
                  }}
                  inputClassName="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs text-[#222] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                />
                {/* Image upload section */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] sm:text-xs text-[#444] cursor-pointer hover:bg-black/[0.03]">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>
                        {pendingImages.length === 1
                          ? 'Change image'
                          : pendingImages.length > 1
                            ? 'Replace first image'
                            : 'Attach image (optional)'}
                      </span>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageInputChange(
                            e,
                            pendingImages.length === 1 ? 'replace-first' : 'append'
                          )
                        }
                      />
                    </label>
                    {(pendingImages.length > 0 || imageUrls.length > 0) && (
                      <label
                        className={`inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] sm:text-xs text-[#444] hover:bg-black/[0.03] ${
                          totalSelectedImageCount >= MAX_IMAGES_PER_ENTRY
                            ? 'opacity-50 pointer-events-none cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add additional image</span>
                        <input
                          ref={addImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={totalSelectedImageCount >= MAX_IMAGES_PER_ENTRY}
                          onChange={(e) => handleImageInputChange(e, 'append')}
                        />
                      </label>
                    )}
                    {pendingImages.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            clearPendingImages()
                            if (imageInputRef.current) imageInputRef.current.value = ''
                            if (addImageInputRef.current) addImageInputRef.current.value = ''
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[#666] hover:bg-black/[0.03]"
                        >
                          <X className="w-3 h-3" />
                          Clear selected
                        </button>
                        <button
                          type="button"
                          onClick={() => void uploadPendingImages()}
                          disabled={uploadingImage || imageUrls.length >= MAX_IMAGES_PER_ENTRY}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-[var(--color-primary)]/15 disabled:opacity-60"
                        >
                          {uploadingImage
                            ? 'Uploading…'
                            : imageUrls.length >= MAX_IMAGES_PER_ENTRY
                              ? 'Max images reached'
                              : `Upload ${pendingImages.length} image${pendingImages.length !== 1 ? 's' : ''}`}
                        </button>
                      </>
                    )}
                    {totalSelectedImageCount > 0 && (
                      <p className="text-[10px] text-[#777] w-full sm:w-auto">
                        {imageUrls.length} uploaded
                        {pendingImages.length > 0
                          ? ` · ${pendingImages.length} ready to upload`
                          : ''}{' '}
                        ({totalSelectedImageCount}/{MAX_IMAGES_PER_ENTRY})
                      </p>
                    )}
                  </div>
                  {pendingImages.length > 0 && (
                    <p className="text-[10px] text-[#888] leading-snug">
                      On iPhone, pick one photo at a time, then tap &quot;Add additional image&quot; for more. Upload
                      all when ready.
                    </p>
                  )}
                </div>
                {uploadError && (
                  <p className="text-[11px] text-red-600">{uploadError}</p>
                )}
                {(pendingImages.length > 0 || imageUrls.length > 0) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {pendingImages.map((pending, idx) => (
                      <div
                        key={pending.id}
                        className="relative rounded-md overflow-hidden border border-dashed border-[var(--color-primary)]/50 bg-[var(--color-bg)] group"
                      >
                        <img
                          src={pending.preview}
                          alt={`Selected image ${idx + 1}`}
                          className="h-20 w-full object-cover opacity-90"
                        />
                        <span className="absolute bottom-1 left-1 rounded px-1 py-0.5 text-[8px] font-medium bg-black/60 text-white">
                          Not uploaded
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingImages((prev) => {
                              const next = prev.filter((p) => p.id !== pending.id)
                              URL.revokeObjectURL(pending.preview)
                              return next
                            })
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80"
                          aria-label={`Remove selected image ${idx + 1}`}
                          title="Remove selected image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {imageUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] group"
                      >
                        <LazyActivityImage
                          src={url}
                          alt={`Uploaded activity ${idx + 1}`}
                          href={url}
                          linkTitle="Open image"
                          wrapperClassName="block h-20 w-full"
                          className="h-20 w-full object-cover transition-transform group-hover:scale-[1.02]"
                          failedLabel="Image load failed"
                        />
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
                  workstation condition, or before/after repair). Each image may be up to 10 MB. On iPhone you can add
                  several photos one at a time, then upload them together.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-[#999] hidden sm:block">
                    1) Extract JSON, 2) validate the log, 3) save when you&apos;re satisfied.
                  </p>
                  <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleExtract()}
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
                    {activityDetail.reportingPlant ? (
                      <p className="text-[11px] text-[var(--color-text-secondary)] px-0.5">
                        <span className="font-semibold text-[var(--color-text)]">Reporting plant:</span>{' '}
                        {activityDetail.reportingPlant}
                      </p>
                    ) : null}

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
                                  Optional: notify teammates about this log. All team members can view and edit every log
                                  from the list—sharing only controls note notifications.
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
                                          ? `${c.name.trim()}  ·  ${c.email}  ·  ${formatRoleLabel(c.role as 'super_admin' | 'admin' | 'employee')}`
                                          : `${c.email}  ·  ${formatRoleLabel(c.role as 'super_admin' | 'admin' | 'employee')}`}
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
                                          · {n.createdAt ? formatUsDateTime(n.createdAt) : ''}
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

