export function filterCatalogRows<T extends object>(rows: T[], keyword: string): T[] {
  const trimmedKeyword = keyword.trim()
  const normalized = trimmedKeyword.toLowerCase()
  if (!normalized) return rows
  return rows.filter((row) => {
    const serializedRow = JSON.stringify(row)
    const searchableRow = serializedRow.toLowerCase()
    return searchableRow.includes(normalized)
  })
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
  if (typeof parsed === 'string') {
    const trimmedParsed = parsed.trim()
    return trimmedParsed.length > 0 && trimmedParsed !== '—'
  }
  if (Array.isArray(parsed)) return parsed.length > 0
  if (typeof parsed === 'object') return Object.keys(parsed as Record<string, unknown>).length > 0
  return true
}
