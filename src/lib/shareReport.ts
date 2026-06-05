import { getToken } from '@/services/api'

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  if (path.startsWith('http')) return path
  return base ? `${base}${path}` : path
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function canShareFiles(files: File[]): boolean {
  if (!canUseNativeShare()) return false
  if (typeof navigator.canShare !== 'function') {
    return /iphone|ipad|ipod|android/i.test(navigator.userAgent || '')
  }
  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

function isJsonContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase()
  return ct.includes('application/json') || ct.includes('+json')
}

export async function validatePdfBlob(blob: Blob): Promise<void> {
  if (!blob.size) {
    throw new Error('PDF is empty. The report may have no content.')
  }
  const header = await blob.slice(0, 5).text()
  if (!header.startsWith('%PDF')) {
    throw new Error('Server did not return a valid PDF. Try again or use Download PDF.')
  }
}

function parseFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header)
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"/g, '').trim())
    } catch {
      return match[1].replace(/"/g, '').trim()
    }
  }
  return fallback
}

export async function fetchReportPdfBlob(reportId: string): Promise<{ blob: Blob; filename: string }> {
  const url = apiUrl(`/api/reports/${encodeURIComponent(reportId)}/pdf`)
  const token = getToken()
  const headers: HeadersInit = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(url, { headers, method: 'GET' })
  } catch {
    throw new Error('Could not reach the server. Check your connection and API URL.')
  }

  const contentType = (res.headers.get('Content-Type') || '').toLowerCase()

  if (!res.ok) {
    let message = `Failed to load PDF (${res.status})`
    try {
      if (isJsonContentType(contentType)) {
        const data = (await res.json()) as { error?: string }
        if (typeof data?.error === 'string' && data.error.trim()) message = data.error.trim()
      } else {
        const text = await res.text()
        if (text.trim()) message = text.slice(0, 200)
      }
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  if (isJsonContentType(contentType)) {
    throw new Error('Server did not return a PDF. Try again or contact support.')
  }

  const blob = await res.blob()
  await validatePdfBlob(blob)

  const filename = parseFilenameFromDisposition(
    res.headers.get('Content-Disposition'),
    `weekly-report-${reportId.slice(-6)}.pdf`
  )
  return { blob, filename }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/** Open PDF in a new tab (works after async fetch; avoids popup blockers). */
function openPdfInNewTab(blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
}

export type ShareReportResult = { mode: 'native' } | { mode: 'preview' }

/**
 * Share report PDF — never triggers a file download.
 * Mobile: native share sheet. Desktop: opens PDF in a new browser tab.
 */
export async function shareReportPdf(reportId: string, title?: string): Promise<ShareReportResult> {
  const { blob, filename } = await fetchReportPdfBlob(reportId)
  const file = new File([blob], filename, { type: 'application/pdf' })
  const shareTitle = title?.trim() || 'Weekly quality report'

  if (canShareFiles([file])) {
    try {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: shareTitle,
      })
      return { mode: 'native' }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // fall through to preview tab
    }
  }

  openPdfInNewTab(blob)
  return { mode: 'preview' }
}

export async function downloadReportPdf(reportId: string): Promise<{ filename: string }> {
  const { blob, filename } = await fetchReportPdfBlob(reportId)
  downloadBlob(blob, filename)
  return { filename }
}

/** Share an already-fetched PDF blob (dashboard). Never downloads. */
export async function sharePdfBlob(blob: Blob, filename: string, title?: string): Promise<ShareReportResult> {
  const file = new File([blob], filename, { type: 'application/pdf' })
  const shareTitle = title?.trim() || 'Report'

  if (canShareFiles([file])) {
    try {
      await navigator.share({
        files: [file],
        title: shareTitle,
        text: shareTitle,
      })
      return { mode: 'native' }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  openPdfInNewTab(blob)
  return { mode: 'preview' }
}

// Back-compat for pages that still check this
export function canSharePdfFiles(): boolean {
  return canUseNativeShare() || typeof window !== 'undefined'
}
