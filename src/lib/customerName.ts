/** Case-insensitive key for matching customer names. */
export function normalizeCustomerName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function customerNamesMatch(a: string, b: string): boolean {
  return normalizeCustomerName(a) === normalizeCustomerName(b)
}

export function filterCustomersByQuery<T extends { name: string }>(
  customers: T[],
  query: string
): T[] {
  const q = normalizeCustomerName(query)
  if (!q) return customers
  return customers.filter((c) => normalizeCustomerName(c.name).includes(q))
}

export function findCustomerByName<T extends { name: string }>(
  customers: T[],
  name: string
): T | undefined {
  const key = normalizeCustomerName(name)
  if (!key) return undefined
  return customers.find((c) => normalizeCustomerName(c.name) === key)
}
