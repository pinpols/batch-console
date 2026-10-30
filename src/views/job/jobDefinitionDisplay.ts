export function jobTypePillStyle(value?: string | null): Record<string, string> {
  const palette: Record<string, string> = {
    ATOMIC: '#8b5cf6',
    PROCESS: 'var(--color-primary)',
    IMPORT: '#0891b2',
    EXPORT: 'var(--color-warning)',
    GENERAL: 'var(--color-text-secondary)',
  }
  const typeValue = value || 'GENERAL'
  const typeText = String(typeValue)
  const normalizedType = typeText.toUpperCase()
  const color = palette[normalizedType] ?? palette.GENERAL
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 32%, var(--color-border) 68%)`,
  }
}
