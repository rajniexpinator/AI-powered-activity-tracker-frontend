import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const SESSION_DISMISS = 'pwa-install-dismiss-session'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Captures Chromium’s `beforeinstallprompt` and shows an Install button.
 * The browser often hides the omnibox install icon; this makes install discoverable.
 */
export function PwaInstallBar() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_DISMISS) === '1')
  const [standalone, setStandalone] = useState(isStandalone)

  useEffect(() => {
    setStandalone(isStandalone())
    const mq = window.matchMedia('(display-mode: standalone)')
    const onMq = () => setStandalone(isStandalone())
    mq.addEventListener('change', onMq)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  function dismiss() {
    sessionStorage.setItem(SESSION_DISMISS, '1')
    setDismissed(true)
    setDeferred(null)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  if (standalone || dismissed || !deferred) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100000] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      role="region"
      aria-label="Install app"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--color-text)]">Install app</p>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
            Add AI Activity Tracker to your home screen or taskbar for quicker access.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
