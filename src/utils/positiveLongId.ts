const MAX_LONG = '9223372036854775807'

/** 保留十进制文本的精度；已丢失精度的 number 不能还原。 */
export function positiveLongId(value: string | number): string | null {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null
  const text = String(value)
  if (!/^\d+$/.test(text)) return null
  const normalized = text.replace(/^0+/, '')
  if (!normalized || normalized.length > MAX_LONG.length) return null
  if (normalized.length === MAX_LONG.length && normalized > MAX_LONG) return null
  return normalized
}
