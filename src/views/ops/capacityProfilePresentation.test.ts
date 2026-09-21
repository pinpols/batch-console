import { describe, expect, it } from 'vitest'
import type { CapacityProfileReport, CapacityProfileRow } from '@/api/capacityProfile'
import {
  buildCapacityBuckets,
  buildCapacityTrend,
  buildLatencyComparison,
  buildThroughputRanking,
} from './capacityProfilePresentation'

function row(overrides: Partial<CapacityProfileRow>): CapacityProfileRow {
  return {
    instanceCount: 0,
    taskCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
    wallClockDurationMs: 0,
    avgDurationMs: 0,
    p95DurationMs: 0,
    totalFileBytes: 0,
    processedRecords: 0,
    recordsPerSecond: 0,
    mbPerSecond: 0,
    ...overrides,
  }
}

describe('capacityProfilePresentation', () => {
  it('splits a long range into at most seven contiguous buckets', () => {
    const buckets = buildCapacityBuckets(['2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z'])
    expect(buckets).toHaveLength(7)
    expect(buckets[0].from).toBe('2026-09-01T00:00:00Z')
    expect(buckets.at(-1)?.to).toBe('2026-09-08T00:00:00Z')
    expect(buckets[0].to).toBe(buckets[1].from)
  })

  it('maps partial bucket responses to truthful zero-filled trend points', () => {
    const buckets = buildCapacityBuckets(['2026-09-01T00:00:00Z', '2026-09-01T02:00:00Z'])
    const report = {
      totals: { instanceCount: 4, taskCount: 9 },
    } as CapacityProfileReport
    expect(buildCapacityTrend(buckets, [report, null])).toMatchObject([
      { instanceCount: 4, taskCount: 9 },
      { instanceCount: 0, taskCount: 0 },
    ])
  })

  it('builds dimension-aware throughput and P95 rankings', () => {
    const rows = [
      row({ jobCode: 'slow', recordsPerSecond: 2, avgDurationMs: 80, p95DurationMs: 900 }),
      row({ jobCode: 'fast', recordsPerSecond: 20, avgDurationMs: 20, p95DurationMs: 100 }),
    ]
    expect(buildThroughputRanking(rows, 'JOB', 'ta')).toEqual([
      { name: 'slow', value: 2 },
      { name: 'fast', value: 20 },
    ])
    expect(buildLatencyComparison(rows, 'JOB', 'ta')).toEqual({
      labels: ['slow', 'fast'],
      average: [80, 20],
      p95: [900, 100],
    })
  })
})
