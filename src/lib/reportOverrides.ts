import type { ReportChangeValues } from '@/components/reports/ReportChangeModal'

export function changeValuesToOverridePayload(values: ReportChangeValues): Record<string, unknown> {
  return {
    customer: values.customer.trim() || undefined,
    from: values.from || undefined,
    to: values.to || undefined,
    period: values.period || undefined,
    dateMode: values.dateMode,
    aiQuestion: values.aiQuestion.trim() || undefined,
    severity: values.severity !== '' ? values.severity : undefined,
    minSeverity: values.minSeverity !== '' ? values.minSeverity : undefined,
  }
}

export function dateOnlyOverridePayload(values: ReportChangeValues): Record<string, unknown> {
  return {
    from: values.from || undefined,
    to: values.to || undefined,
    period: values.period || undefined,
    dateMode: values.dateMode,
  }
}
