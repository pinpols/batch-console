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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function concise(value: unknown, maxLength: number): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

/** Convert structured audit payloads into a scan-friendly list summary without losing raw drawer data. */
export function structuredSummary(value: unknown, maxLength = 180): string {
  if (value == null) return ''
  const decoded = decodeHtmlEntities(String(value))
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
  const parts = orderedKeys
    .filter((key) => {
      const item = record[key]
      return item != null && ['string', 'number', 'boolean'].includes(typeof item)
    })
    .slice(0, 4)
    .map((key) => `${key}=${concise(record[key], 56)}`)

  return concise(parts.length ? parts.join(' · ') : decoded, maxLength)
}
