import {
  ACTIVITY_LOG_SHARE_FIELDS,
  ACTIVITY_LOG_SHARE_LABELS,
  REPORT_SHARE_FIELDS,
  REPORT_SHARE_LABELS,
  type ActivityLogShareField,
  type ActivityLogSharePreferences,
  type ReportShareField,
  type ReportSharePreferences,
} from '@/constants/sharePreferences'

type ShareFieldCheckboxProps = {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

function ShareFieldCheckbox({ id, label, checked, disabled, onChange }: ShareFieldCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius)] border text-[13px] font-medium cursor-pointer transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${
        checked
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
      />
      {label}
    </label>
  )
}

type ActivityLogShareFieldsProps = {
  value: ActivityLogSharePreferences
  onChange: (next: ActivityLogSharePreferences) => void
  disabled?: boolean
  idPrefix?: string
}

export function ActivityLogShareFields({
  value,
  onChange,
  disabled = false,
  idPrefix = 'share-log',
}: ActivityLogShareFieldsProps) {
  function toggle(field: ActivityLogShareField, checked: boolean) {
    onChange({ ...value, [field]: checked })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ACTIVITY_LOG_SHARE_FIELDS.map((field) => (
        <ShareFieldCheckbox
          key={field}
          id={`${idPrefix}-${field}`}
          label={ACTIVITY_LOG_SHARE_LABELS[field]}
          checked={value[field]}
          disabled={disabled}
          onChange={(checked) => toggle(field, checked)}
        />
      ))}
    </div>
  )
}

type ReportShareFieldsProps = {
  value: ReportSharePreferences
  onChange: (next: ReportSharePreferences) => void
  disabled?: boolean
  idPrefix?: string
}

export function ReportShareFields({
  value,
  onChange,
  disabled = false,
  idPrefix = 'share-report',
}: ReportShareFieldsProps) {
  function toggle(field: ReportShareField, checked: boolean) {
    onChange({ ...value, [field]: checked })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {REPORT_SHARE_FIELDS.map((field) => (
        <ShareFieldCheckbox
          key={field}
          id={`${idPrefix}-${field}`}
          label={REPORT_SHARE_LABELS[field]}
          checked={value[field]}
          disabled={disabled}
          onChange={(checked) => toggle(field, checked)}
        />
      ))}
    </div>
  )
}
