type StatusTone = 'success' | 'warning' | 'muted'
type Translate = (key: string) => string
type HasTranslation = (key: string) => boolean

export function configReleaseStatusTone(status?: string | null): StatusTone {
  const normalizedStatus = String(status ?? '').toUpperCase()
  if (normalizedStatus === 'PUBLISHED') return 'success'
  if (['DRAFT', 'GRAY', 'ROLLING_BACK'].includes(normalizedStatus)) return 'warning'
  return 'muted'
}

export function createConfigReleaseStatusLabel(translate: Translate, hasTranslation: HasTranslation) {
  return (status?: string | null): string => {
    const normalizedStatus = String(status ?? '')
    if (!normalizedStatus) return '—'
    const key = `enum.configStatus.${normalizedStatus}`
    return hasTranslation(key) ? translate(key) : normalizedStatus
  }
}
