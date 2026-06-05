import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'

type Props = {
  open: boolean
  reportTitle: string
  saving: boolean
  onClose: () => void
  onSave: (displayName: string) => void
}

export function AddToDashboardModal({ open, reportTitle, saving, onClose, onSave }: Props) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">Name report</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)] break-words">{reportTitle}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          className="p-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            onSave(trimmed)
          }}
        >
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Report name (unique)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inoac issues from today"
              className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              autoFocus
              disabled={saving}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-[12px] font-semibold hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-[12px] font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save to dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
