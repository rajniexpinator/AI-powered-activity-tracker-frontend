import { getToken } from '@/services/api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type ShareableAttachment = {
  url: string
  name?: string
  mime?: string
  size?: number
}

export type ShareableActivity = {
  _id?: string
  customer?: string
  location?: string
  summary?: string
  rawConversation?: string
  createdAt?: string
  structuredData?: Record<string, unknown>
  images?: string[]
  attachments?: ShareableAttachment[]
}

function isVideoAttachment(a: ShareableAttachment): boolean {
  const mime = (a.mime ?? '').toLowerCase()
  if (mime.startsWith('video/')) return true
  const path = `${a.name ?? ''} ${a.url ?? ''}`.toLowerCase()
  return /\.(mp4|mov|webm|m4v|ogv|ogg)(\?|#|$)/.test(path)
}

function videoAttachmentsFromActivity(activity: ShareableActivity): ShareableAttachment[] {
  if (!Array.isArray(activity.attachments)) return []
  return activity.attachments.filter(
    (a) => a && typeof a.url === 'string' && a.url.trim() && isVideoAttachment(a)
  )
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function severityLabel(raw: unknown): string {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (n === 0) return '0 — All good'
  if (n === 1) return '1 — Low'
  if (n === 2) return '2 — Medium'
  if (n === 3) return '3 — High'
  return ''
}

function resolveAbsoluteUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (!API_BASE) return trimmed
  return `${API_BASE}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

function isApiOrigin(url: string): boolean {
  if (!API_BASE) return false
  try {
    return new URL(url).origin === new URL(API_BASE).origin
  } catch {
    return false
  }
}

function filenameFromUrl(rawUrl: string, fallback: string): string {
  try {
    const decoded = decodeURIComponent(new URL(rawUrl).pathname.split('/').pop() || '')
    const cleaned = decoded.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
    return cleaned || fallback
  } catch {
    return fallback
  }
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function buildActivityShareText(activity: ShareableActivity): { title: string; text: string } {
  const structured =
    activity.structuredData && typeof activity.structuredData === 'object'
      ? activity.structuredData
      : {}

  const customer = asText(activity.customer) || asText(structured.customer) || 'Unknown customer'
  const location = asText(activity.location) || asText(structured.location)
  const summary = asText(activity.summary) || asText(structured.summary) || 'No summary'
  const partName = asText(structured.part_name) || asText(structured.partName)
  const partNumber = asText(structured.part_number) || asText(structured.partNumber)
  const supplierCode = asText(structured.supplier_code) || asText(structured.supplierCode)
  const vehicleLineRaw = structured.vehicle_line ?? structured.vehicleLine
  const vehicleLine = Array.isArray(vehicleLineRaw)
    ? vehicleLineRaw.map((v) => String(v).trim()).filter(Boolean)
    : []
  const intent = asText(structured.intent)
  const outcome = asText(structured.outcome)
  const severity = severityLabel(structured.severity)
  const notes = asText(structured.notes)
  const rawText = asText(activity.rawConversation)

  const createdLabel = activity.createdAt
    ? new Date(activity.createdAt).toLocaleString()
    : 'Unknown date'

  const lines = [
    'Apex Quality — AI activity log',
    '',
    `Customer: ${customer}`,
    ...(location ? [`Location: ${location}`] : []),
    `Created: ${createdLabel}`,
    `Summary: ${summary}`,
    ...(partName ? [`Part name: ${partName}`] : []),
    ...(partNumber ? [`Part number: ${partNumber}`] : []),
    ...(supplierCode ? [`Supplier code: ${supplierCode}`] : []),
    ...(vehicleLine.length ? [`Vehicle line: ${vehicleLine.join(', ')}`] : []),
    ...(severity ? [`Severity: ${severity}`] : []),
    ...(intent ? [`Intent: ${intent}`] : []),
    ...(outcome ? [`Outcome: ${outcome}`] : []),
    '',
    'Notes:',
    rawText || '(none)',
    ...(notes ? ['', 'Additional notes:', notes] : []),
  ]

  const images = Array.isArray(activity.images)
    ? activity.images.filter((u) => typeof u === 'string' && u.trim())
    : []
  if (images.length > 0) {
    lines.push('', `Photos (${images.length}):`)
    for (const url of images) {
      lines.push(resolveAbsoluteUrl(url))
    }
  }

  const videos = videoAttachmentsFromActivity(activity)
  if (videos.length > 0) {
    lines.push('', `Videos (${videos.length}):`)
    for (const v of videos) {
      const label = asText(v.name)
      const link = resolveAbsoluteUrl(v.url)
      lines.push(label ? `${label}: ${link}` : link)
    }
  }

  const datePart = activity.createdAt
    ? new Date(activity.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return {
    title: `AI log - ${customer} - ${datePart}`,
    text: lines.join('\n'),
  }
}

async function fetchImageAsFile(url: string, index: number): Promise<File | null> {
  const absolute = resolveAbsoluteUrl(url)
  if (!absolute) return null

  try {
    const headers: HeadersInit = {}
    const token = getToken()
    if (token && isApiOrigin(absolute)) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(absolute, { headers, mode: 'cors' })
    if (!response.ok) return null

    const blob = await response.blob()
    if (!blob.size) return null

    const mime =
      blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const name = filenameFromUrl(absolute, `activity-photo-${index + 1}.${ext}`)

    return new File([blob], name, { type: mime })
  } catch {
    return null
  }
}

async function loadShareImageFiles(imageUrls: string[]): Promise<File[]> {
  const files: File[] = []
  for (let i = 0; i < imageUrls.length; i += 1) {
    const file = await fetchImageAsFile(imageUrls[i], i)
    if (file) files.push(file)
  }
  return files
}

function canSharePayload(data: ShareData): boolean {
  if (typeof navigator.canShare !== 'function') return true
  try {
    return navigator.canShare(data)
  } catch {
    return false
  }
}

async function copyTextFallback(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', 'true')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}

export type ShareActivityResult =
  | { mode: 'native'; imageCount: number }
  | { mode: 'clipboard'; imageCount: number }

export async function shareActivityLog(activity: ShareableActivity): Promise<ShareActivityResult> {
  const { title, text } = buildActivityShareText(activity)
  const imageUrls = Array.isArray(activity.images)
    ? activity.images.filter((u) => typeof u === 'string' && u.trim())
    : []

  if (!canUseNativeShare()) {
    await copyTextFallback(text)
    return { mode: 'clipboard', imageCount: imageUrls.length }
  }

  const imageFiles = await loadShareImageFiles(imageUrls)

  const withFiles: ShareData = {
    title,
    text,
    ...(imageFiles.length > 0 ? { files: imageFiles } : {}),
  }

  if (imageFiles.length > 0 && !canSharePayload(withFiles)) {
    const textOnly: ShareData = { title, text }
    if (canSharePayload(textOnly)) {
      await navigator.share(textOnly)
      return { mode: 'native', imageCount: 0 }
    }
  }

  await navigator.share(withFiles)
  return { mode: 'native', imageCount: imageFiles.length }
}
