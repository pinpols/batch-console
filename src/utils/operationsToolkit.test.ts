import { describe, expect, it } from 'vitest'
import { buildRetryTimeline, convertWallTime, inspectFileSample } from './operationsToolkit'

describe('convertWallTime', () => {
  it('converts one wall time into multiple IANA timezones', () => {
    const result = convertWallTime('2026-09-27 09:00:00', 'Asia/Shanghai', [
      'UTC',
      'America/New_York',
    ])

    expect(result?.instant).toBe('2026-09-27T01:00:00.000Z')
    expect(result?.rows.map((row) => row.wallTime)).toEqual([
      '2026-09-27 01:00:00',
      '2026-09-26 21:00:00',
    ])
  })
})

describe('inspectFileSample', () => {
  it('recognizes a UTF-8 BOM CSV with CRLF line endings', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b\r\n1,2\r\n')])

    expect(inspectFileSample(bytes)).toMatchObject({
      encoding: 'UTF-8 BOM',
      lineEnding: 'CRLF',
      delimiter: ',',
      hasBom: true,
      likelyBinary: false,
    })
  })
})

describe('buildRetryTimeline', () => {
  it('builds a capped exponential timeline with jitter boundaries', () => {
    const rows = buildRetryTimeline({
      startAt: '2026-09-27T00:00:00Z',
      policy: 'EXPONENTIAL',
      maxRetries: 3,
      fixedDelaySeconds: 60,
      multiplier: 2,
      maxDelaySeconds: 100,
      jitterRatio: 0.1,
    })

    expect(rows.map((row) => row.delaySeconds)).toEqual([60, 100, 100])
    expect(rows[0]).toMatchObject({
      earliestAt: '2026-09-27T00:00:54.000Z',
      nominalAt: '2026-09-27T00:01:00.000Z',
      latestAt: '2026-09-27T00:01:06.000Z',
    })
  })
})
