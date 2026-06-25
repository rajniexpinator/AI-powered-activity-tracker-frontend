/** US display: mm/dd/yyyy */
export function formatUsDate(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}/${d.getFullYear()}`
}

function formatUsTime(d: Date): string {
  let h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

/** US display: mm/dd/yyyy h:mm AM/PM */
export function formatUsDateTime(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatUsDate(d)} ${formatUsTime(d)}`
}
