import { Eye, LayoutDashboard, Pencil, X } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onPreview: () => void
  onAddToDashboard: () => void
  onChangeReport: () => void
  /** On report dashboard, second action is "Save as new" instead of add. */
  dashboardMode?: boolean
  /** Employee: preview + change only (no add to dashboard). */
  employeeMode?: boolean
}

export function ReportActionMenu({
  open,
  title,
  subtitle,
  onClose,
  onPreview,
  onAddToDashboard,
  onChangeReport,
  dashboardMode = false,
  employeeMode = false,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-text-secondary)]">
              Report options
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--color-text)] break-words">{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[var(--color-border)] p-2 hover:bg-[var(--color-bg)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <button
            type="button"
            onClick={onPreview}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/30 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Eye className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-[var(--color-text)]">Preview the report</span>
              <span className="block text-[12px] text-[var(--color-text-secondary)]">Read on screen, share or save PDF</span>
            </span>
          </button>

          {!employeeMode && (
          <button
            type="button"
            onClick={onAddToDashboard}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/30 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <LayoutDashboard className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-[var(--color-text)]">
                {dashboardMode ? 'Save new report to dashboard' : 'Add report to dashboard'}
              </span>
              <span className="block text-[12px] text-[var(--color-text-secondary)]">
                {dashboardMode ? 'Keep this version under a new name' : 'Save with a name for quick access'}
              </span>
            </span>
          </button>
          )}

          <button
            type="button"
            onClick={onChangeReport}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/30 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Pencil className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-[14px] font-semibold text-[var(--color-text)]">Change report</span>
              <span className="block text-[12px] text-[var(--color-text-secondary)]">Customer, dates, severity, AI question</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
