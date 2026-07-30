import { getToken } from '@/services/api'
import { formatUsDateTime } from '@/lib/formatDate'
import {
  DEFAULT_ACTIVITY_LOG_SHARE,
  type ActivityLogSharePreferences,
} from '@/constants/sharePreferences'

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
  serialNumber?: string
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
  /** How many document/file attachments were included as share files. */
  attachedFileCount?: number
  /** Per-field share preferences (from user profile). */
  preferences?: ActivityLogSharePreferences
}

type ShareMediaCacheEntry = {
  urlsKey: string
  imageFiles: File[]
  attachmentFiles: File[]
  failedImages?: boolean
  failedAttachments?: boolean
}

const shareMediaCache = new Map<string, ShareMediaCacheEntry>()
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

/** Non-video documents/files (PDF, Office, ZIP, etc.) — candidates for native share File[]. */
function documentAttachmentsFromActivity(activity: ShareableActivity): ShareableAttachment[] {
  if (!Array.isArray(activity.attachments)) return []
  return activity.attachments.filter(
    (a) => a && typeof a.url === 'string' && a.url.trim() && !isVideoAttachment(a)
  )
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function imageUrlsFromActivity(activity: ShareableActivity): string[] {
  return Array.isArray(activity.images)
    ? activity.images.filter((u) => typeof u === 'string' && u.trim())
    : []
}

function imageUrlsKey(urls: string[]): string {
  return urls.join('\n')
}

function attachmentUrlsKey(attachments: ShareableAttachment[]): string {
  return attachments.map((a) => a.url.trim()).filter(Boolean).join('\n')
}

function mediaCacheKey(activity: ShareableActivity): string {
  return `${imageUrlsKey(imageUrlsFromActivity(activity))}\n---\n${attachmentUrlsKey(documentAttachmentsFromActivity(activity))}`
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

function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[^\w.\-() ]+/g, '_').trim().slice(0, 120)
  return cleaned || fallback
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
    shareMediaCache.delete(activityId)
    preloadInFlight.delete(activityId)
    return
  }
  shareMediaCache.clear()
  preloadInFlight.clear()
}

function getCachedShareMedia(activity: ShareableActivity): ShareMediaCacheEntry | null {
  const id = activityCacheId(activity)
  if (!id) return null
  const cached = shareMediaCache.get(id)
  if (!cached || cached.urlsKey !== mediaCacheKey(activity)) return null
  return cached
}

function getCachedShareImageFiles(activity: ShareableActivity): File[] {
  const cached = getCachedShareMedia(activity)
  if (!cached || cached.failedImages) return []
  return cached.imageFiles
}

function getCachedShareAttachmentFiles(activity: ShareableActivity): File[] {
  const cached = getCachedShareMedia(activity)
  if (!cached || cached.failedAttachments) return []
  return cached.attachmentFiles
}

/** True when every photo is downloaded and document preload has finished. */
export function areSharePhotosReady(activity: ShareableActivity): boolean {
  const imageUrls = imageUrlsFromActivity(activity)
  const docs = documentAttachmentsFromActivity(activity)
  if (imageUrls.length === 0 && docs.length === 0) return true

  const id = activityCacheId(activity)
  if (!id) return true
  if (preloadInFlight.has(id)) return false

  const cached = getCachedShareMedia(activity)
  if (!cached) return false
  if (imageUrls.length > 0 && cached.imageFiles.length !== imageUrls.length) return false
  // Document files may partially fail (e.g. over share size limit); ready once preload finished.
  return true
}

export function isSharePhotosLoading(activity: ShareableActivity): boolean {
  const id = activityCacheId(activity)
  if (!id) return false
  return preloadInFlight.has(id)
}

/** Preload photos and document files while viewing a log so Share can open immediately. */
export async function preloadShareImages(activity: ShareableActivity): Promise<void> {
  const id = activityCacheId(activity)
  if (!id) return

  const key = mediaCacheKey(activity)
  const existing = shareMediaCache.get(id)
  if (existing?.urlsKey === key) return

  const pending = preloadInFlight.get(id)
  if (pending) {
    await pending
    return
  }

  const imageUrls = imageUrlsFromActivity(activity)
  const docs = documentAttachmentsFromActivity(activity)

  const task = (async () => {
    const [imageFiles, attachmentFiles] = await Promise.all([
      loadShareImageFiles(imageUrls, id),
      loadShareAttachmentFiles(docs, id),
    ])
    const failedImages = imageUrls.length > 0 && imageFiles.length === 0
    const failedAttachments = docs.length > 0 && attachmentFiles.length === 0
    shareMediaCache.set(id, {
      urlsKey: key,
      imageFiles,
      attachmentFiles,
      failedImages,
      failedAttachments,
    })
  })()

  preloadInFlight.set(id, task)
  try {
    await task
  } finally {
    preloadInFlight.delete(id)
  }
}

function buildLogBody(activity: ShareableActivity, prefs: ActivityLogSharePreferences): string[] {
  const structured =
    activity.structuredData && typeof activity.structuredData === 'object'
      ? activity.structuredData
      : {}

  const customer = asText(activity.customer) || asText(structured.customer) || 'Unknown customer'
  const summary = asText(activity.summary) || asText(structured.summary) || 'No summary'
  const partName = asText(structured.part_name) || asText(structured.partName)
  const partNumber = asText(structured.part_number) || asText(structured.partNumber)
  const notes = asText(structured.notes)
  const rawText = asText(activity.rawConversation)

  const createdLabel = activity.createdAt
    ? formatUsDateTime(activity.createdAt)
    : 'Unknown date'

  const lines = ['Apex Quality — AI activity log', '']

  if (prefs.customer) lines.push(`Customer: ${customer}`)
  if (prefs.createdAt) lines.push(`Created: ${createdLabel}`)
  if (prefs.summary) lines.push(`Summary: ${summary}`)
  if (prefs.partName && partName) lines.push(`Part name: ${partName}`)
  if (prefs.partNumber && partNumber) lines.push(`Part number: ${partNumber}`)
  if (prefs.summary) {
    lines.push('', 'Notes:', rawText || '(none)')
    if (notes) lines.push('', 'Additional notes:', notes)
  } else if (notes) {
    lines.push('', 'Additional notes:', notes)
  }

  return lines
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

function buildFileLinksSection(
  files: ShareableAttachment[],
  attachedFileCount: number
): string[] {
  if (files.length === 0) return []

  const blocks = files.map((f) => {
    const link = resolveAbsoluteUrl(f.url)
    if (!link) return ''
    const label = asText(f.name)
    return label ? `${label}\n${link}` : link
  })

  const header =
    attachedFileCount > 0
      ? 'Files are attached above in this message. Tap a link below if a file is missing:'
      : 'Files (tap a link to open):'

  return ['', '—', header, joinWithBlankLines(blocks)]
}

export function buildActivityShareText(
  activity: ShareableActivity,
  options: BuildShareTextOptions = {}
): { title: string; text: string } {
  const prefs = options.preferences ?? DEFAULT_ACTIVITY_LOG_SHARE
  const attachedImageCount = options.attachedImageCount ?? 0
  const attachedFileCount = options.attachedFileCount ?? 0
  const imageUrls = imageUrlsFromActivity(activity)
  const docs = documentAttachmentsFromActivity(activity)

  const lines = [
    ...buildLogBody(activity, prefs),
    ...(prefs.photos ? buildPhotoLinksSection(imageUrls, attachedImageCount) : []),
    ...(prefs.files ? buildFileLinksSection(docs, attachedFileCount) : []),
    ...(prefs.files ? buildVideoLinksSection(videoAttachmentsFromActivity(activity)) : []),
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

async function fetchBlobViaShareProxy(
  url: string,
  activityId?: string
): Promise<{ blob: Blob; absolute: string } | null> {
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
    return { blob, absolute }
  } catch {
    return null
  }
}

async function fetchImageAsFile(
  url: string,
  index: number,
  activityId?: string
): Promise<File | null> {
  const result = await fetchBlobViaShareProxy(url, activityId)
  if (!result) return null

  const { blob, absolute } = result
  const mime =
    blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const name = filenameFromUrl(absolute, `activity-photo-${index + 1}.${ext}`)

  return new File([blob], name, { type: mime })
}

async function fetchAttachmentAsFile(
  attachment: ShareableAttachment,
  index: number,
  activityId?: string
): Promise<File | null> {
  const result = await fetchBlobViaShareProxy(attachment.url, activityId)
  if (!result) return null

  const { blob, absolute } = result
  const preferredMime = asText(attachment.mime)
  const mime =
    preferredMime ||
    (blob.type && blob.type !== 'application/octet-stream' ? blob.type : '') ||
    'application/octet-stream'
  const fallback = `activity-file-${index + 1}`
  const name = sanitizeFileName(
    asText(attachment.name) || filenameFromUrl(absolute, fallback),
    fallback
  )

  return new File([blob], name, { type: mime })
}

async function loadShareImageFiles(imageUrls: string[], activityId?: string): Promise<File[]> {
  const results = await Promise.all(
    imageUrls.map((url, index) => fetchImageAsFile(url, index, activityId))
  )
  return results.filter((f): f is File => f !== null)
}

async function loadShareAttachmentFiles(
  attachments: ShareableAttachment[],
  activityId?: string
): Promise<File[]> {
  const results = await Promise.all(
    attachments.map((a, index) => fetchAttachmentAsFile(a, index, activityId))
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
 * Share with photo/document files. Does not fall back to text-only (WhatsApp would show links only).
 * iOS Safari often reports canShare=false for files even when share() works — we still try.
 */
async function invokeNativeShareWithFiles(text: string, files: File[]): Promise<void> {
  const attempts: ShareData[] = [{ files, text }, { files }]
  let lastError: unknown = new Error('Could not share attachments')

  for (const data of attempts) {
    try {
      await navigator.share(data)
      return
    } catch (err) {
      lastError = err
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not share attachments')
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
  | { mode: 'native'; imageCount: number; fileCount: number; usedCachedImages: boolean }
  | { mode: 'clipboard'; imageCount: number; fileCount: number }

export async function shareActivityLog(
  activity: ShareableActivity,
  preferences?: ActivityLogSharePreferences
): Promise<ShareActivityResult> {
  const prefs = preferences ?? DEFAULT_ACTIVITY_LOG_SHARE
  const imageUrls = imageUrlsFromActivity(activity)
  const docs = documentAttachmentsFromActivity(activity)
  const wantsPhotos = prefs.photos && imageUrls.length > 0
  const wantsFiles = prefs.files && docs.length > 0

  if (!canUseNativeShare()) {
    const { text } = buildActivityShareText(activity, {
      attachedImageCount: 0,
      attachedFileCount: 0,
      preferences: prefs,
    })
    await copyTextFallback(text)
    return { mode: 'clipboard', imageCount: imageUrls.length, fileCount: docs.length }
  }

  const cachedImageFiles = wantsPhotos ? getCachedShareImageFiles(activity) : []
  const cachedAttachmentFiles = wantsFiles ? getCachedShareAttachmentFiles(activity) : []

  if (wantsPhotos && cachedImageFiles.length === 0) {
    throw new Error(
      'Photos are not ready yet. Wait a few seconds after opening the log, then tap Share again.'
    )
  }

  if (wantsPhotos && cachedImageFiles.length < imageUrls.length) {
    throw new Error(
      `Only ${cachedImageFiles.length} of ${imageUrls.length} photos loaded. Check your connection and try again.`
    )
  }

  if (wantsFiles && docs.length > 0 && cachedAttachmentFiles.length === 0) {
    // Preload may still be running, or all files exceeded the share size limit.
    if (isSharePhotosLoading(activity) || !getCachedShareMedia(activity)) {
      throw new Error(
        'Files are not ready yet. Wait a few seconds after opening the log, then tap Share again.'
      )
    }
    // Preload finished but nothing downloaded (e.g. all over 50 MB) — continue with links only.
  }

  const shareFiles = [...cachedImageFiles, ...cachedAttachmentFiles]
  const { text } = buildActivityShareText(activity, {
    attachedImageCount: cachedImageFiles.length,
    attachedFileCount: cachedAttachmentFiles.length,
    preferences: prefs,
  })

  if (shareFiles.length > 0) {
    await invokeNativeShareWithFiles(text, shareFiles)
    return {
      mode: 'native',
      imageCount: cachedImageFiles.length,
      fileCount: cachedAttachmentFiles.length,
      usedCachedImages: true,
    }
  }

  try {
    await invokeNativeShareTextOnly(text)
    return { mode: 'native', imageCount: 0, fileCount: 0, usedCachedImages: false }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    await copyTextFallback(text)
    return { mode: 'clipboard', imageCount: 0, fileCount: 0 }
  }
}
