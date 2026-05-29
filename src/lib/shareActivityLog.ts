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

export type BuildShareTextOptions = {
  /** How many photos were attached as files for inline display (e.g. WhatsApp). */
  attachedImageCount?: number
}

type ShareImageCacheEntry = {
  urlsKey: string
  files: File[]
  failed?: boolean
}

const shareImageCache = new Map<string, ShareImageCacheEntry>()
const preloadInFlight = new Map<string, Promise<void>>()

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

function imageUrlsFromActivity(activity: ShareableActivity): string[] {
  return Array.isArray(activity.images)
    ? activity.images.filter((u) => typeof u === 'string' && u.trim())
    : []
}

function imageUrlsKey(urls: string[]): string {
  return urls.join('\n')
}

function activityCacheId(activity: ShareableActivity): string | undefined {
  return activity._id ? String(activity._id) : undefined
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

/** Browser fetch to S3/CDN URLs fails CORS; always proxy non-API URLs when we have an activity id. */
function shouldProxyMediaUrl(absolute: string, activityId?: string): boolean {
  if (!activityId || !API_BASE) return false
  return !isApiOrigin(absolute)
}

function shareMediaProxyUrl(activityId: string, absoluteUrl: string): string {
  const base = API_BASE.replace(/\/$/, '')
  return `${base}/api/activities/${encodeURIComponent(activityId)}/share-media?url=${encodeURIComponent(absoluteUrl)}`
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

/** Join blocks with a blank line between each (WhatsApp-friendly link spacing). */
function joinWithBlankLines(blocks: string[]): string {
  return blocks.map((b) => b.trim()).filter(Boolean).join('\n\n')
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function clearShareImageCache(activityId?: string): void {
  if (activityId) {
    shareImageCache.delete(activityId)
    preloadInFlight.delete(activityId)
    return
  }
  shareImageCache.clear()
  preloadInFlight.clear()
}

function getCachedShareFiles(activity: ShareableActivity): File[] {
  const id = activityCacheId(activity)
  if (!id) return []
  const urls = imageUrlsFromActivity(activity)
  const cached = shareImageCache.get(id)
  if (!cached || cached.urlsKey !== imageUrlsKey(urls) || cached.failed) return []
  return cached.files
}

/** True when every photo is downloaded and ready to attach (required for WhatsApp inline images). */
export function areSharePhotosReady(activity: ShareableActivity): boolean {
  const urls = imageUrlsFromActivity(activity)
  if (urls.length === 0) return true
  const files = getCachedShareFiles(activity)
  return files.length === urls.length
}

export function isSharePhotosLoading(activity: ShareableActivity): boolean {
  const id = activityCacheId(activity)
  if (!id) return false
  return preloadInFlight.has(id)
}

/** Preload photos while viewing a log so Share can open immediately (iOS user-gesture rule). */
export async function preloadShareImages(activity: ShareableActivity): Promise<void> {
  const id = activityCacheId(activity)
  if (!id) return

  const imageUrls = imageUrlsFromActivity(activity)
  const key = imageUrlsKey(imageUrls)
  const existing = shareImageCache.get(id)
  if (existing?.urlsKey === key) return

  const pending = preloadInFlight.get(id)
  if (pending) {
    await pending
    return
  }

  const task = (async () => {
    const files = await loadShareImageFiles(imageUrls, id)
    const failed = imageUrls.length > 0 && files.length === 0
    shareImageCache.set(id, { urlsKey: key, files, failed })
  })()

  preloadInFlight.set(id, task)
  try {
    await task
  } finally {
    preloadInFlight.delete(id)
  }
}

function buildLogBody(activity: ShareableActivity): string[] {
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

  return [
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
}

function buildPhotoLinksSection(
  imageUrls: string[],
  attachedImageCount: number
): string[] {
  const links = imageUrls.map(resolveAbsoluteUrl).filter(Boolean)
  if (links.length === 0) return []

  const header =
    attachedImageCount > 0
      ? 'Photos are attached above in this message. Tap a link below for full resolution:'
      : 'Photos (tap a link to open full size):'

  return ['', '—', header, joinWithBlankLines(links)]
}

function buildVideoLinksSection(videos: ShareableAttachment[]): string[] {
  if (videos.length === 0) return []

  const blocks = videos.map((v) => {
    const link = resolveAbsoluteUrl(v.url)
    if (!link) return ''
    const label = asText(v.name)
    return label ? `${label}\n${link}` : link
  })

  return ['', '—', 'Videos (tap a link to open):', joinWithBlankLines(blocks)]
}

export function buildActivityShareText(
  activity: ShareableActivity,
  options: BuildShareTextOptions = {}
): { title: string; text: string } {
  const attachedImageCount = options.attachedImageCount ?? 0
  const imageUrls = imageUrlsFromActivity(activity)

  const lines = [
    ...buildLogBody(activity),
    ...buildPhotoLinksSection(imageUrls, attachedImageCount),
    ...buildVideoLinksSection(videoAttachmentsFromActivity(activity)),
  ]

  const structured =
    activity.structuredData && typeof activity.structuredData === 'object'
      ? activity.structuredData
      : {}
  const customer = asText(activity.customer) || asText(structured.customer) || 'Unknown customer'
  const datePart = activity.createdAt
    ? new Date(activity.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return {
    title: `AI log - ${customer} - ${datePart}`,
    text: lines.join('\n'),
  }
}

async function fetchImageAsFile(
  url: string,
  index: number,
  activityId?: string
): Promise<File | null> {
  const absolute = resolveAbsoluteUrl(url)
  if (!absolute) return null

  try {
    const headers: HeadersInit = {}
    const token = getToken()
    const fetchUrl =
      activityId && shouldProxyMediaUrl(absolute, activityId)
        ? shareMediaProxyUrl(activityId, absolute)
        : absolute

    if (token && (isApiOrigin(absolute) || fetchUrl.includes('/share-media'))) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(fetchUrl, { headers, mode: 'cors' })
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

async function loadShareImageFiles(imageUrls: string[], activityId?: string): Promise<File[]> {
  const results = await Promise.all(
    imageUrls.map((url, index) => fetchImageAsFile(url, index, activityId))
  )
  return results.filter((f): f is File => f !== null)
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

/**
 * Share with photo files. Does not fall back to text-only (WhatsApp would show links only).
 * iOS Safari often reports canShare=false for files even when share() works — we still try.
 */
async function invokeNativeShareWithFiles(text: string, files: File[]): Promise<void> {
  const attempts: ShareData[] = [{ files, text }, { files }]
  let lastError: unknown = new Error('Could not share photos')

  for (const data of attempts) {
    try {
      await navigator.share(data)
      return
    } catch (err) {
      lastError = err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not share photos')
}

async function invokeNativeShareTextOnly(text: string): Promise<void> {
  const attempts: ShareData[] = [{ text }]
  let lastError: unknown = new Error('Share not supported on this device')

  for (const data of attempts) {
    if (!canSharePayload(data)) continue
    try {
      await navigator.share(data)
      return
    } catch (err) {
      lastError = err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Share failed')
}

export type ShareActivityResult =
  | { mode: 'native'; imageCount: number; usedCachedImages: boolean }
  | { mode: 'clipboard'; imageCount: number }

export async function shareActivityLog(activity: ShareableActivity): Promise<ShareActivityResult> {
  const imageUrls = imageUrlsFromActivity(activity)

  if (!canUseNativeShare()) {
    const { text } = buildActivityShareText(activity, { attachedImageCount: 0 })
    await copyTextFallback(text)
    return { mode: 'clipboard', imageCount: imageUrls.length }
  }

  const cachedFiles = getCachedShareFiles(activity)
  const hasImages = imageUrls.length > 0

  if (hasImages && cachedFiles.length === 0) {
    throw new Error(
      'Photos are not ready yet. Wait a few seconds after opening the log, then tap Share again.'
    )
  }

  if (hasImages && cachedFiles.length < imageUrls.length) {
    throw new Error(
      `Only ${cachedFiles.length} of ${imageUrls.length} photos loaded. Check your connection and try again.`
    )
  }

  const { text } = buildActivityShareText(activity, {
    attachedImageCount: cachedFiles.length,
  })

  if (cachedFiles.length > 0) {
    await invokeNativeShareWithFiles(text, cachedFiles)
    return { mode: 'native', imageCount: cachedFiles.length, usedCachedImages: true }
  }

  try {
    await invokeNativeShareTextOnly(text)
    return { mode: 'native', imageCount: 0, usedCachedImages: false }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    await copyTextFallback(text)
    return { mode: 'clipboard', imageCount: 0 }
  }
}
