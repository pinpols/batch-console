import { describe, expect, it } from 'vitest'
import type { UsageSummaryRow } from '@/api/usage'
import { usageDailyTrend, usageTotals } from './usageSummary'

const row = (value: Partial<UsageSummaryRow>): UsageSummaryRow => ({
  statDate: '2026-09-30',
  tenantId: 'ta',
  source: 'OPERATION_AUDIT',
  metricCode: 'operation.job-trigger',
  pageCode: '',
  appVersion: '',
  eventCount: 1,
  successCount: 1,
  failureCount: 0,
  ...value,
})

describe('usageTotals', () => {
  it('does not count frontend events as business successes', () => {
    const rows = [
      row({ source: 'FRONTEND', eventCount: 5, successCount: 5 }),
      row({ source: 'OPERATION_AUDIT', successCount: 0, failureCount: 1 }),
    ]

    expect(usageTotals(rows)).toEqual({ events: 6, success: 0, failure: 1 })
    expect(usageDailyTrend(rows)).toEqual([{ date: '2026-09-30', success: 0, failure: 1 }])
  })

  it('aggregates backend rows by date in chronological order', () => {
    const rows = [
      row({ statDate: '2026-09-30', successCount: 2 }),
      row({ statDate: '2026-09-29', successCount: 0, failureCount: 3 }),
      row({ statDate: '2026-09-30', successCount: 4 }),
    ]

    expect(usageDailyTrend(rows)).toEqual([
      { date: '2026-09-29', success: 0, failure: 3 },
      { date: '2026-09-30', success: 6, failure: 0 },
    ])
  })
})
