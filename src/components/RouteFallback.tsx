import { Loader2 } from 'lucide-react'

/** Shown while lazy route chunks load (Phase 9: perf / perceived performance). */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] w-full items-center justify-center px-4 py-16"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <Loader2 className="h-9 w-9 animate-spin text-[var(--color-primary)]" aria-hidden />
    </div>
  )
}
