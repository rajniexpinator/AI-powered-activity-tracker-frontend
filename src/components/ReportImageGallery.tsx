import { ImageIcon } from 'lucide-react'
import { LazyActivityImage } from '@/components/LazyActivityImage'
import { formatUsDateTime } from '@/lib/formatDate'

export type ReportImageGalleryEntry = {
  activityId?: string
  customer?: string
  summary?: string
  createdAt?: string
  imageUrls?: string[]
}

type Props = {
  entries: ReportImageGalleryEntry[] | null | undefined
  className?: string
}

export function ReportImageGallery({ entries, className = '' }: Props) {
  if (!entries || entries.length === 0) return null

  return (
    <div className={`border-t border-[var(--color-border)] pt-5 mt-5 ${className}`.trim()}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <ImageIcon className="w-4 h-4" />
        </span>
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Photos from included logs</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Thumbnails from activity entries that had images. Click an image to open the full file.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {entries.map((entry, gi) => {
          const urls = (entry.imageUrls || []).filter(Boolean)
          if (urls.length === 0) return null
          const cap = entry.customer?.trim() || 'Activity'
          const when = entry.createdAt ? formatUsDateTime(entry.createdAt) : ''
          return (
            <div
              key={entry.activityId ? String(entry.activityId) : `g-${gi}`}
              className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm"
            >
              <p className="text-[12px] font-semibold text-[var(--color-text)]">{cap}</p>
              {when ? (
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{when}</p>
              ) : null}
              {entry.summary?.trim() ? (
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 line-clamp-2">{entry.summary}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {urls.map((url, ui) => {
                  const key = `${gi}-${ui}-${url.slice(0, 48)}`
                  return (
                    <LazyActivityImage
                      key={key}
                      src={url}
                      alt=""
                      href={url}
                      linkTitle="Open full image"
                      wrapperClassName="block aspect-square rounded-lg border border-[var(--color-border)] group"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      failedLabel="Image unavailable"
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
