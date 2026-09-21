import { describe, expect, it } from 'vitest'
import type { ConsoleBatchDayResponse } from '@/types/console-api'
import { indexBatchDays, monthDateRange, summarizeBatchDays } from './batchDayPresentation'

function row(overrides: Partial<ConsoleBatchDayResponse>): ConsoleBatchDayResponse {
  return {
    tenantId: 'ta',
    calendarCode: 'DEFAULT',
    bizDate: '2026-09-01',
    dayStatus: 'OPEN',
    slaStatus: 'NORMAL',
    totalJobCount: 0,
    successJobCount: 0,
    failedJobCount: 0,
    inFlightJobCount: 0,
    lateCount: 0,
    catchupCount: 0,
    openAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

describe('batchDayPresentation', () => {
  it('builds leap-year month boundaries in local time', () => {
    expect(monthDateRange(new Date(2028, 1, 12))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('indexes days and aggregates calendar totals', () => {
    const rows = [
      row({ bizDate: '2026-09-01', totalJobCount: 4, successJobCount: 3, failedJobCount: 1 }),
      row({ bizDate: '2026-09-02', totalJobCount: 5, inFlightJobCount: 2, lateCount: 1 }),
    ]

    expect(indexBatchDays(rows).get('2026-09-02')?.inFlightJobCount).toBe(2)
    expect(summarizeBatchDays(rows)).toEqual({
      days: 2,
      totalJobs: 9,
      success: 3,
      failed: 1,
      inFlight: 2,
      late: 1,
    })
  })
})
