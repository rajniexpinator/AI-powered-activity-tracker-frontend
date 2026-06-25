export function buildQualityReportTitle(opts: {
  customer?: string | null
  oem?: string | null
  title?: string | null
}): string {
  if (opts.title?.trim()) return opts.title.trim()

  const cust = opts.customer?.trim() || ''
  const plant = opts.oem?.trim() || ''

  if (cust && plant) return `Quality Report for ${cust} at ${plant}`
  if (cust) return `Quality Report for ${cust}`
  if (plant) return `Quality Report at ${plant}`
  return 'Quality Report'
}
