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
    const runtimeTimezones = supportedValuesOf('timeZone')
    const allTimezones = [...fallback, ...runtimeTimezones]
    const uniqueTimezones = new Set(allTimezones)
    const timezoneList = Array.from(uniqueTimezones)
    return timezoneList.sort()
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
  const sourceDateTime = dayjs(instant).tz(sourceTimezone)
  const year = sourceDateTime.year()
  return {
    instant,
    rows: targetTimezones.map((timezone) => {
      const targetDateTime = dayjs(instant).tz(timezone)
      const januaryOffset = dayjs.tz(`${year}-01-15 12:00:00`, timezone).utcOffset()
      const julyOffset = dayjs.tz(`${year}-07-15 12:00:00`, timezone).utcOffset()
      const wallTime = apiInstantToWallTime(instant, timezone)
      const offset = targetDateTime.format('Z')
      const offsetVariesThisYear = januaryOffset !== julyOffset
      const currentOffset = targetDateTime.utcOffset()
      const higherSeasonalOffset = Math.max(januaryOffset, julyOffset)
      return {
        timezone,
        wallTime,
        offset,
        offsetVariesThisYear,
        higherSeasonalOffset: currentOffset === higherSeasonalOffset,
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
  const textWithoutBom = text.replace(/^\uFEFF/, '')
  const allLines = textWithoutBom.split(/\r\n|\n|\r/)
  const lines = allLines.slice(0, 20)
  const nonEmptyLines = lines.filter((line) => line.trim())
  const candidates = [',', '\t', ';', '|'] as const
  const delimiterStats = candidates.map((delimiter) => {
    const sampleLines = nonEmptyLines.slice(0, 8)
    const counts = sampleLines.map((line) => countOccurrences(line, delimiter))
    const first = counts[0] ?? 0
    return {
      delimiter,
      count: first,
      consistent: first > 0 && counts.every((count) => count === first),
    }
  })
  const consistentDelimiters = delimiterStats.filter((candidate) => candidate.consistent)
  const ranked = consistentDelimiters.sort((a, b) => b.count - a.count)

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
  const fileBytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', fileBytes)
  const digestByteView = new Uint8Array(digest)
  const digestBytes = Array.from(digestByteView)
  const hexBytes = digestBytes.map((byte) => {
    const hexByte = byte.toString(16)
    return hexByte.padStart(2, '0')
  })
  return hexBytes.join('')
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
  const jitterRatioAtMostOne = Math.min(input.jitterRatio, 1)
  const jitter = Math.max(0, jitterRatioAtMostOne)
  const flooredMaxRetries = Math.floor(input.maxRetries)
  const maxRetries = Math.max(0, flooredMaxRetries)
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let rawDelay: number
    if (input.policy === 'EXPONENTIAL') {
      const fixedDelaySeconds = input.fixedDelaySeconds
      const multiplierAtLeastOne = Math.max(1, input.multiplier)
      const exponentialFactor = Math.pow(multiplierAtLeastOne, attempt - 1)
      rawDelay = fixedDelaySeconds * exponentialFactor
    } else {
      rawDelay = input.fixedDelaySeconds
    }
    const nonNegativeMaximumDelay = Math.max(0, input.maxDelaySeconds)
    const nonNegativeRawDelay = Math.max(0, rawDelay)
    const delaySeconds = Math.min(nonNegativeMaximumDelay, nonNegativeRawDelay)
    let earliestDelay: number
    if (delaySeconds <= 0) {
      earliestDelay = 0
    } else {
      const flooredEarliestDelay = Math.floor(delaySeconds * (1 - jitter))
      earliestDelay = Math.max(1, flooredEarliestDelay)
    }
    let latestDelay: number
    if (delaySeconds <= 0) {
      latestDelay = 0
    } else {
      const ceiledLatestDelay = Math.ceil(delaySeconds * (1 + jitter))
      latestDelay = Math.max(1, ceiledLatestDelay)
    }
    earliest = earliest.add(earliestDelay, 'second')
    const nominalDelaySeconds = Math.floor(delaySeconds)
    nominal = nominal.add(nominalDelaySeconds, 'second')
    latest = latest.add(latestDelay, 'second')
    const earliestAt = earliest.toISOString()
    const nominalAt = nominal.toISOString()
    const latestAt = latest.toISOString()
    rows.push({
      attempt,
      delaySeconds,
      earliestAt,
      nominalAt,
      latestAt,
    })
  }
  return rows
}
