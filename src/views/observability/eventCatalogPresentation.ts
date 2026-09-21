export function filterCatalogRows<T extends object>(rows: T[], keyword: string): T[] {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return rows
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized))
}

export function parseCatalogSchema(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || text === '—') return {}
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}
