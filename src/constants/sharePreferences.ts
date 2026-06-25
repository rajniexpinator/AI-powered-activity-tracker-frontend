export const ACTIVITY_LOG_SHARE_FIELDS = [
  'customer',
  'createdAt',
  'partName',
  'partNumber',
  'summary',
  'photos',
  'files',
] as const

export type ActivityLogShareField = (typeof ACTIVITY_LOG_SHARE_FIELDS)[number]

export const REPORT_SHARE_FIELDS = ['includeContent', 'includePictures'] as const

export type ReportShareField = (typeof REPORT_SHARE_FIELDS)[number]

export type ActivityLogSharePreferences = Record<ActivityLogShareField, boolean>

export type ReportSharePreferences = Record<ReportShareField, boolean>

export type SharePreferences = {
  activityLog: ActivityLogSharePreferences
  report: ReportSharePreferences
}

export const DEFAULT_ACTIVITY_LOG_SHARE: ActivityLogSharePreferences = {
  customer: true,
  createdAt: true,
  partName: true,
  partNumber: true,
  summary: true,
  photos: true,
  files: true,
}

export const DEFAULT_REPORT_SHARE: ReportSharePreferences = {
  includeContent: true,
  includePictures: true,
}

export const DEFAULT_SHARE_PREFERENCES: SharePreferences = {
  activityLog: { ...DEFAULT_ACTIVITY_LOG_SHARE },
  report: { ...DEFAULT_REPORT_SHARE },
}

export const ACTIVITY_LOG_SHARE_LABELS: Record<ActivityLogShareField, string> = {
  customer: 'Customer',
  createdAt: 'Created date & time',
  partName: 'Part name',
  partNumber: 'Part number',
  summary: 'Summary',
  photos: 'Photos',
  files: 'Files & videos',
}

export const REPORT_SHARE_LABELS: Record<ReportShareField, string> = {
  includeContent: 'Report narrative (text)',
  includePictures: 'Pictures in PDF',
}

function pickBooleans<T extends string>(
  source: Record<string, unknown> | undefined,
  keys: readonly T[],
  defaults: Record<T, boolean>
): Record<T, boolean> {
  const out = { ...defaults }
  if (!source || typeof source !== 'object') return out
  for (const key of keys) {
    if (typeof source[key] === 'boolean') out[key] = source[key] as boolean
  }
  return out
}

export function resolveSharePreferences(raw?: SharePreferences | null): SharePreferences {
  return {
    activityLog: pickBooleans(raw?.activityLog, ACTIVITY_LOG_SHARE_FIELDS, DEFAULT_ACTIVITY_LOG_SHARE),
    report: pickBooleans(raw?.report, REPORT_SHARE_FIELDS, DEFAULT_REPORT_SHARE),
  }
}
