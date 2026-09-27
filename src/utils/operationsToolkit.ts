import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { apiInstantToWallTime, wallTimeToApiInstant } from './datetime'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

export type TimezoneConversionRow = {
  timezone: string
  wallTime: string
  offset: string
  offsetVariesThisYear: boolean
  higherSeasonalOffset: boolean
}

export function listSupportedTimezones(fallback: readonly string[]): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
  ).supportedValuesOf
  if (!supportedValuesOf) return [...fallback]
  try {
    return Array.from(new Set([...fallback, ...supportedValuesOf('timeZone')])).sort()
  } catch {
    return [...fallback]
  }
}

export function convertWallTime(
  wallTime: string,
  sourceTimezone: string,
  targetTimezones: string[],
): { instant: string; rows: TimezoneConversionRow[] } | null {
  const instant = wallTimeToApiInstant(wallTime, sourceTimezone)
  if (!instant) return null
  const year = dayjs(instant).tz(sourceTimezone).year()
  return {
    instant,
    rows: targetTimezones.map((timezone) => {
      const value = dayjs(instant).tz(timezone)
      const januaryOffset = dayjs.tz(`${year}-01-15 12:00:00`, timezone).utcOffset()
      const julyOffset = dayjs.tz(`${year}-07-15 12:00:00`, timezone).utcOffset()
      return {
        timezone,
        wallTime: apiInstantToWallTime(instant, timezone),
        offset: value.format('Z'),
        offsetVariesThisYear: januaryOffset !== julyOffset,
        higherSeasonalOffset: value.utcOffset() === Math.max(januaryOffset, julyOffset),
      }
    }),
  }
}

export type FileSampleInspection = {
  encoding: 'UTF-8' | 'UTF-8 BOM' | 'UTF-16 LE' | 'UTF-16 BE' | 'UNKNOWN'
  lineEnding: 'CRLF' | 'LF' | 'CR' | 'MIXED' | 'NONE'
  delimiter: ',' | '\t' | ';' | '|' | null
  sampledLines: number
  emptyLines: number
  hasBom: boolean
  likelyBinary: boolean
}

function countOccurrences(value: string, token: string): number {
  return value.split(token).length - 1
}

export function inspectFileSample(bytes: Uint8Array): FileSampleInspection {
  const hasUtf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const hasUtf16LeBom = bytes[0] === 0xff && bytes[1] === 0xfe
  const hasUtf16BeBom = bytes[0] === 0xfe && bytes[1] === 0xff
  let encoding: FileSampleInspection['encoding'] = 'UNKNOWN'
  let text = ''
  try {
    if (hasUtf16LeBom) {
      encoding = 'UTF-16 LE'
      text = new TextDecoder('utf-16le').decode(bytes)
    } else if (hasUtf16BeBom) {
      encoding = 'UTF-16 BE'
      const swapped = Uint8Array.from(bytes, (_, index) =>
        index % 2 === 0 ? (bytes[index + 1] ?? 0) : (bytes[index - 1] ?? 0),
      )
      text = new TextDecoder('utf-16le').decode(swapped)
    } else {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      encoding = hasUtf8Bom ? 'UTF-8 BOM' : 'UTF-8'
    }
  } catch {
    text = new TextDecoder('utf-8').decode(bytes)
  }

  const nulCount = countOccurrences(text, '\u0000')
  const likelyBinary = text.length > 0 && nulCount / text.length > 0.01
  const crlf = countOccurrences(text, '\r\n')
  const withoutCrlf = text.replace(/\r\n/g, '')
  const lf = countOccurrences(withoutCrlf, '\n')
  const cr = countOccurrences(withoutCrlf, '\r')
  const lineEndingKinds = [crlf, lf, cr].filter((count) => count > 0).length
  const lineEnding: FileSampleInspection['lineEnding'] =
    lineEndingKinds > 1 ? 'MIXED' : crlf ? 'CRLF' : lf ? 'LF' : cr ? 'CR' : 'NONE'
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .slice(0, 20)
  const nonEmptyLines = lines.filter((line) => line.trim())
  const candidates = [',', '\t', ';', '|'] as const
  const ranked = candidates
    .map((delimiter) => {
      const counts = nonEmptyLines.slice(0, 8).map((line) => countOccurrences(line, delimiter))
      const first = counts[0] ?? 0
      return {
        delimiter,
        count: first,
        consistent: first > 0 && counts.every((count) => count === first),
      }
    })
    .filter((candidate) => candidate.consistent)
    .sort((a, b) => b.count - a.count)

  return {
    encoding,
    lineEnding,
    delimiter: likelyBinary ? null : (ranked[0]?.delimiter ?? null),
    sampledLines: lines.length,
    emptyLines: lines.filter((line) => !line.trim()).length,
    hasBom: hasUtf8Bom || hasUtf16LeBom || hasUtf16BeBom,
    likelyBinary,
  }
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type RetryTimelineItem = {
  attempt: number
  delaySeconds: number
  earliestAt: string
  nominalAt: string
  latestAt: string
}

export function buildRetryTimeline(input: {
  startAt: string
  policy: 'NONE' | 'FIXED' | 'EXPONENTIAL'
  maxRetries: number
  fixedDelaySeconds: number
  multiplier: number
  maxDelaySeconds: number
  jitterRatio: number
}): RetryTimelineItem[] {
  if (input.policy === 'NONE') return []
  const rows: RetryTimelineItem[] = []
  const start = dayjs(input.startAt)
  if (!start.isValid()) return rows
  let earliest = start
  let nominal = start
  let latest = start
  const jitter = Math.max(0, Math.min(input.jitterRatio, 1))
  for (let attempt = 1; attempt <= Math.max(0, Math.floor(input.maxRetries)); attempt += 1) {
    const rawDelay =
      input.policy === 'EXPONENTIAL'
        ? input.fixedDelaySeconds * Math.pow(Math.max(1, input.multiplier), attempt - 1)
        : input.fixedDelaySeconds
    const delaySeconds = Math.min(Math.max(0, input.maxDelaySeconds), Math.max(0, rawDelay))
    const earliestDelay =
      delaySeconds <= 0 ? 0 : Math.max(1, Math.floor(delaySeconds * (1 - jitter)))
    const latestDelay = delaySeconds <= 0 ? 0 : Math.max(1, Math.ceil(delaySeconds * (1 + jitter)))
    earliest = earliest.add(earliestDelay, 'second')
    nominal = nominal.add(Math.floor(delaySeconds), 'second')
    latest = latest.add(latestDelay, 'second')
    rows.push({
      attempt,
      delaySeconds,
      earliestAt: earliest.toISOString(),
      nominalAt: nominal.toISOString(),
      latestAt: latest.toISOString(),
    })
  }
  return rows
}
