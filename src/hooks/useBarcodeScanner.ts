import { useCallback, useEffect, useRef, useState } from 'react'

function isAppleMobileWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  const nav = navigator as Navigator & { maxTouchPoints?: number }
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1
}

async function loadZXingFromCDN() {
  if ((window as unknown as { ZXing?: unknown }).ZXing) {
    return (window as unknown as { ZXing: unknown }).ZXing
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-zxing="true"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve((window as unknown as { ZXing: unknown }).ZXing))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.setAttribute('data-zxing', 'true')
    script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
    script.async = true
    script.onload = () => resolve((window as unknown as { ZXing: unknown }).ZXing)
    script.onerror = () => reject(new Error('Failed to load ZXing fallback scanner'))
    document.head.appendChild(script)
  })
}

type UseBarcodeScannerOptions = {
  onDetected: (code: string) => void | Promise<void>
}

/**
 * Camera + ZXing barcode/QR scanner used by Mapping and Bulk pages.
 */
export function useBarcodeScanner({ onDetected }: UseBarcodeScannerOptions) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualBarcodeSubmitting, setManualBarcodeSubmitting] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  const stopScanner = useCallback(() => {
    setScanning(false)
    scanningRef.current = false
    setScannerOpen(false)
    setManualBarcode('')
    setManualBarcodeSubmitting(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => () => stopScanner(), [stopScanner])

  const handleDetected = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed) return
      stopScanner()
      await onDetectedRef.current(trimmed)
    },
    [stopScanner]
  )

  const startScanner = useCallback(async () => {
    setScannerError(null)
    setScannerOpen(true)
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const hasBarcodeDetector = Boolean((window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector)
      const useZxingOnApple = isAppleMobileWebKit()
      const preferZxingImmediately = !hasBarcodeDetector || useZxingOnApple
      const zxingIntervalMs = preferZxingImmediately ? 400 : 1200
      setScanning(true)
      scanningRef.current = true

      let detector: { detect: (source: HTMLCanvasElement) => Promise<{ rawValue?: string }[]> } | null = null
      if (hasBarcodeDetector && !useZxingOnApple) {
        const BD = (window as unknown as {
          BarcodeDetector: new (opts?: { formats?: string[] }) => {
            detect: (source: HTMLCanvasElement) => Promise<{ rawValue?: string }[]>
          }
          getSupportedFormats?: () => Promise<string[]>
        }).BarcodeDetector
        const desiredFormats = ['qr_code', 'data_matrix', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
        const supportedFormats =
          typeof (BD as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats ===
          'function'
            ? await (BD as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats()
            : desiredFormats
        const formats = desiredFormats.filter((f) => supportedFormats.includes(f))
        detector = formats.length ? new BD({ formats }) : new BD()
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
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
            const maxDim = preferZxingImmediately ? 1024 : 900
            const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
            canvas.width = Math.max(1, Math.floor(video.videoWidth * scale))
            canvas.height = Math.max(1, Math.floor(video.videoHeight * scale))
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            if (now - lastPrimaryDetectAt > 350) {
              lastPrimaryDetectAt = now
              if (detector) {
                const barcodes = await detector.detect(canvas)
                const raw = barcodes?.[0]?.rawValue?.trim()
                if (raw) {
                  await handleDetected(raw)
                  return
                }
              }
            }

            if (!fallbackStarted && now - lastPrimaryDetectAt > 1500) fallbackStarted = true
            if (fallbackStarted && !zxingBusy && now - lastZxingAttemptAt > zxingIntervalMs) {
              lastZxingAttemptAt = now
              zxingBusy = true
              try {
                const ZXing = (await loadZXingFromCDN()) as {
                  BrowserMultiFormatReader: new () => {
                    decodeFromImageElement: (img: HTMLImageElement) => Promise<{ getText: () => string }>
                  }
                }
                const reader = new ZXing.BrowserMultiFormatReader()
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
                const img = new Image()
                img.src = dataUrl
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve()
                  img.onerror = () => reject(new Error('image load failed'))
                })
                const result = await reader.decodeFromImageElement(img)
                const text = result?.getText()?.trim()
                if (text) {
                  await handleDetected(text)
                  return
                }
              } catch {
                /* keep scanning */
              } finally {
                zxingBusy = false
              }
            }
          } catch {
            /* keep scanning */
          }
        }
        if (scanningRef.current) requestAnimationFrame(() => void loop())
      }
      requestAnimationFrame(() => void loop())
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setScannerError('Camera permission denied. Allow camera access and try again.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setScannerError('No camera found on this device.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setScannerError('Camera is busy in another app. Close other camera apps and try again.')
      } else {
        setScannerError('Unable to access camera. Check browser permissions.')
      }
      setScanning(false)
      scanningRef.current = false
    }
  }, [handleDetected])

  const submitManual = useCallback(async () => {
    const code = manualBarcode.trim()
    if (!code) return
    setManualBarcodeSubmitting(true)
    try {
      await handleDetected(code)
    } finally {
      setManualBarcodeSubmitting(false)
    }
  }, [handleDetected, manualBarcode])

  return {
    scannerOpen,
    scanning,
    scannerError,
    manualBarcode,
    setManualBarcode,
    manualBarcodeSubmitting,
    videoRef,
    startScanner,
    stopScanner,
    submitManual,
  }
}
