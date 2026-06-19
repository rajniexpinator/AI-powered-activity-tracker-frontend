import { PLANT_OPTIONS, type PlantOption } from '@/constants/plants'

type PlantSelectorProps = {
  value: PlantOption | ''
  otherValue: string
  onChange: (plant: PlantOption | '') => void
  onOtherChange: (text: string) => void
  disabled?: boolean
  idPrefix?: string
}

export function PlantSelector({
  value,
  otherValue,
  onChange,
  onOtherChange,
  disabled = false,
  idPrefix = 'plant',
}: PlantSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PLANT_OPTIONS.map((plant) => {
          const selected = value === plant
          return (
            <label
              key={plant}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius)] border text-[13px] font-medium cursor-pointer transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              } ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-reporting-plant`}
                value={plant}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(plant)}
                className="sr-only"
              />
              {plant}
            </label>
          )
        })}
      </div>
      {value === 'Other' ? (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter plant name (e.g. KCAP)"
          className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
        />
      ) : null}
      <p className="text-[12px] text-[var(--color-text-secondary)]">
        Select the plant you are reporting to. New AI logs will be tagged with this plant for reporting.
      </p>
    </div>
  )
}
