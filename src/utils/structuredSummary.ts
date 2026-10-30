import { safeParseJson } from '@/utils/safeJson'

const PRIORITY_KEYS = [
  'jobCode',
  'instanceNo',
  'fileId',
  'resourceType',
  'resourceId',
  'action',
  'operation',
  'status',
  'result',
  'message',
  'reason',
] as const

export function decodeHtmlEntities(value: string): string {
  const decodedQuotes = value.replace(/&quot;|&#34;/g, '"')
  const decodedApostrophes = decodedQuotes.replace(/&#39;|&apos;/g, "'")
  const decodedLessThan = decodedApostrophes.replace(/&lt;/g, '<')
  const decodedGreaterThan = decodedLessThan.replace(/&gt;/g, '>')
  return decodedGreaterThan.replace(/&amp;/g, '&')
}

function concise(value: unknown, maxLength: number): string {
  const rawText = String(value ?? '')
  const normalizedWhitespace = rawText.replace(/\s+/g, ' ')
  const text = normalizedWhitespace.trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

/** 将结构化审计载荷转换为易浏览的列表摘要，同时保留抽屉中的原始数据。 */
export function structuredSummary(value: unknown, maxLength = 180): string {
  if (value == null) return ''
  const rawText = String(value)
  const decoded = decodeHtmlEntities(rawText)
  const parsed = safeParseJson(decoded)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return concise(decoded, maxLength)

  const record = parsed as Record<string, unknown>
  const orderedKeys = [
    ...PRIORITY_KEYS.filter((key) => key in record),
    ...Object.keys(record).filter(
      (key) => !PRIORITY_KEYS.includes(key as (typeof PRIORITY_KEYS)[number]),
    ),
  ]
  const scalarKeys = orderedKeys.filter((key) => {
    const item = record[key]
    return item != null && ['string', 'number', 'boolean'].includes(typeof item)
  })
  const displayedKeys = scalarKeys.slice(0, 4)
  const parts = displayedKeys.map((key) => `${key}=${concise(record[key], 56)}`)

  const summaryText = parts.length ? parts.join(' · ') : decoded
  return concise(summaryText, maxLength)
}
