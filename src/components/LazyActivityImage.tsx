import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export type LazyActivityImageProps = {
  src: string
  alt?: string
  /** Classes on the wrapper (`<a>` when href is set, otherwise `<div>`). Include sizing, e.g. `block h-20 w-full`. */
  wrapperClassName?: string
  /** Classes on the `<img>` element. */
  className?: string
  href?: string
  linkTitle?: string
  lazy?: boolean
  failedLabel?: string
  loadingLabel?: string
}

export function LazyActivityImage({
  src,
  alt = '',
  wrapperClassName = '',
  className = 'h-full w-full object-cover transition-opacity duration-300',
  href,
  linkTitle,
  lazy = true,
  failedLabel = 'Image unavailable',
  loadingLabel = 'Loading…',
}: LazyActivityImageProps) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setLoading(true)
    setFailed(false)
  }, [src])

  useEffect(() => {
    const img = imgRef.current
    if (!img?.complete) return
    if (img.naturalWidth > 0) setLoading(false)
    else {
      setFailed(true)
      setLoading(false)
    }
  }, [src])

  const wrapperBase = `relative overflow-hidden bg-[var(--color-bg)] ${wrapperClassName}`.trim()

  const inner = failed ? (
    <div className="flex h-full min-h-[inherit] w-full items-center justify-center px-2 py-3 text-center text-[10px] text-red-600">
      {failedLabel}
    </div>
  ) : (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setFailed(true)
          setLoading(false)
        }}
      />
      {loading ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100/90"
          aria-hidden
        >
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">{loadingLabel}</span>
        </div>
      ) : null}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={wrapperBase}
        title={linkTitle ?? (alt || 'Open full image')}
      >
        {inner}
      </a>
    )
  }

  return <div className={wrapperBase}>{inner}</div>
}
