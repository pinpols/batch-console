export function jobTypePillStyle(value?: string | null): Record<string, string> {
  const palette: Record<string, string> = {
    ATOMIC: '#8b5cf6',
    PROCESS: 'var(--color-primary)',
    IMPORT: '#0891b2',
    EXPORT: 'var(--color-warning)',
    WORKFLOW: '#7c3aed',
    GENERAL: 'var(--color-text-secondary)',
  }
  const color = palette[String(value || 'GENERAL').toUpperCase()] ?? palette.GENERAL
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 32%, var(--color-border) 68%)`,
  }
}
