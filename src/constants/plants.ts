export const PLANT_OPTIONS = ['KTP', 'LAP', 'OHAP', 'Oakville', 'Other'] as const

export type PlantOption = (typeof PLANT_OPTIONS)[number]

export function resolveReportingPlant(
  assignedPlant?: string | null,
  assignedPlantOther?: string | null
): string | undefined {
  if (!assignedPlant || !PLANT_OPTIONS.includes(assignedPlant as PlantOption)) return undefined
  if (assignedPlant === 'Other') {
    const custom = assignedPlantOther?.trim()
    return custom || undefined
  }
  return assignedPlant
}

export function formatPlantLabel(
  assignedPlant?: string | null,
  assignedPlantOther?: string | null
): string | undefined {
  return resolveReportingPlant(assignedPlant, assignedPlantOther)
}
