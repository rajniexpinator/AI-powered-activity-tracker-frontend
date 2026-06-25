export const REPORT_SECTION_KEYS = [
  'customersVisited',
  'visitSummary',
  'keyActions',
  'risks',
  'nextSteps',
] as const

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number]

export type ReportSections = Record<ReportSectionKey, boolean>

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  customersVisited: '1. Customers and Plants Visited',
  visitSummary: '2. Summary of Visits and Issues',
  keyActions: '3. Key Actions Taken',
  risks: '4. Risks and Recommended Follow-Ups',
  nextSteps: '5. Next Steps / Closing',
}

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  customersVisited: true,
  visitSummary: true,
  keyActions: true,
  risks: true,
  nextSteps: true,
}
