import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { api } from '@/services/api'
import { CustomerTypeahead, type CustomerOption } from '@/components/customers/CustomerTypeahead'
import {
  REPORT_SECTION_KEYS,
  REPORT_SECTION_LABELS,
  type ReportSections,
} from '@/constants/reportSections'

export type ReportChangeValues = {
  customer: string
  from: string
  to: string
  period: string
  dateMode: 'fixed' | 'today'
  severity: string
  minSeverity: string
  aiQuestion: string
  reportSections: ReportSections
  includeReportPictures: boolean
  hideSeverity: boolean
}

type Props = {
  open: boolean
  title: string
  initial: ReportChangeValues
  saving: boolean
  onClose: () => void
  onApply: (values: ReportChangeValues) => void
  /** Employee dashboard: dates / period / today only */
  datesOnly?: boolean
}

export function ReportChangeModal({ open, title, initial, saving, onClose, onApply, datesOnly = false }: Props) {
  const [values, setValues] = useState<ReportChangeValues>(initial)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  useEffect(() => {
    if (open) setValues(initial)
  }, [open, initial])

  useEffect(() => {
    if (!open || datesOnly) return
    let cancelled = false
    setLoadingCustomers(true)
    api.customers
      .list()
      .then(({ customers: rows }) => {
        if (!cancelled) {
          setCustomers(
            rows.map((c) => ({
              _id: c._id,
              name: c.name,
              email: typeof c.email === 'string' ? c.email : undefined,
            }))
          )
        }
      })
      .catch(() => {
        if (!cancelled) setCustomers([])
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, datesOnly])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-white border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">Change report</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{title}</p>
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

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {!datesOnly && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Customer
            </label>
            <div className="mt-1.5">
              <CustomerTypeahead
                customers={customers}
                value={values.customer}
                loading={loadingCustomers}
                disabled={saving}
                placeholder="Type to search customers…"
                onChange={(name) => setValues((v) => ({ ...v, customer: name }))}
                inputClassName="w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px]"
              />
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                Leave empty for all customers. Search is not case-sensitive.
              </p>
            </div>
          </div>
          )}

          {datesOnly && (
            <p className="text-[12px] text-[var(--color-text-secondary)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              Customer and filters are fixed for your saved report. You can change dates only.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                From
              </label>
              <input
                type="date"
                value={values.from}
                onChange={(e) => setValues((v) => ({ ...v, from: e.target.value }))}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px]"
                disabled={saving || values.dateMode === 'today'}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                To
              </label>
              <input
                type="date"
                value={values.to}
                onChange={(e) => setValues((v) => ({ ...v, to: e.target.value }))}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px]"
                disabled={saving || values.dateMode === 'today'}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Quick period
            </label>
            <select
              value={values.period}
              onChange={(e) => setValues((v) => ({ ...v, period: e.target.value }))}
              className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px] bg-white"
              disabled={saving || values.dateMode === 'today'}
            >
              <option value="">Custom dates above</option>
              <option value="today">Today</option>
              <option value="3days">Last 3 days</option>
              <option value="week">Last 7 days</option>
              <option value="2weeks">Last 2 weeks</option>
              <option value="month">Last month</option>
            </select>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.dateMode === 'today'}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  dateMode: e.target.checked ? 'today' : 'fixed',
                  period: e.target.checked ? 'today' : v.period,
                }))
              }
              disabled={saving}
              className="mt-1"
            />
            <span className="text-[13px] text-[var(--color-text)]">
              <span className="font-medium">Always use today&apos;s date</span>
              <span className="block text-[12px] text-[var(--color-text-secondary)]">
                Re-runs use the calendar day you open the report (good for &quot;logs from today&quot;).
              </span>
            </span>
          </label>

          {!datesOnly && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Report preferences
            </p>
            <div className="mt-2 grid gap-1.5">
              {REPORT_SECTION_KEYS.map((key) => (
                <label key={key} className="flex items-start gap-2 text-[12px] text-[var(--color-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={values.reportSections[key]}
                    disabled={saving}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        reportSections: { ...v.reportSections, [key]: e.target.checked },
                      }))
                    }
                  />
                  <span>{REPORT_SECTION_LABELS[key]}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 grid gap-1.5 border-t border-[var(--color-border)] pt-2">
              <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.includeReportPictures}
                  disabled={saving}
                  onChange={(e) => setValues((v) => ({ ...v, includeReportPictures: e.target.checked }))}
                />
                <span>Include pictures in report</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--color-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.hideSeverity}
                  disabled={saving}
                  onChange={(e) => setValues((v) => ({ ...v, hideSeverity: e.target.checked }))}
                />
                <span>Hide severity on report</span>
              </label>
            </div>
          </div>
          )}

          {!datesOnly && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Severity (exact)
              </label>
              <select
                value={values.severity}
                onChange={(e) => setValues((v) => ({ ...v, severity: e.target.value, minSeverity: '' }))}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px] bg-white"
                disabled={saving}
              >
                <option value="">Any</option>
                <option value="0">0 — All good</option>
                <option value="1">1 — Low</option>
                <option value="2">2 — Medium</option>
                <option value="3">3 — High</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Min severity
              </label>
              <select
                value={values.minSeverity}
                onChange={(e) => setValues((v) => ({ ...v, minSeverity: e.target.value, severity: '' }))}
                className="mt-1.5 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px] bg-white"
                disabled={saving}
              >
                <option value="">Any</option>
                <option value="2">2+ (medium & high)</option>
                <option value="1">1+</option>
                <option value="0">All</option>
              </select>
            </div>
          </div>
          )}

          {!datesOnly && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              AI question (optional)
            </label>
            <textarea
              value={values.aiQuestion}
              onChange={(e) => setValues((v) => ({ ...v, aiQuestion: e.target.value }))}
              rows={3}
              placeholder="e.g. All Inoac issues from today"
              className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-[13px] resize-y"
              disabled={saving}
            />
          </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex gap-2 justify-end shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-[12px] font-semibold hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onApply(values)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-[12px] font-semibold disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {datesOnly ? 'Preview with new dates' : 'Re-run report'}
          </button>
        </div>
      </div>
    </div>
  )
}
