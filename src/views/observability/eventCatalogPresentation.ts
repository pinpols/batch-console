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

export function hasCatalogSchema(value: unknown): boolean {
  const parsed = parseCatalogSchema(value)
  if (parsed == null) return false
  if (typeof parsed === 'string') return parsed.trim().length > 0 && parsed.trim() !== '—'
  if (Array.isArray(parsed)) return parsed.length > 0
  if (typeof parsed === 'object') return Object.keys(parsed as Record<string, unknown>).length > 0
  return true
}
