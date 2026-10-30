import { describe, expect, it } from 'vitest'
import { normalizeDashboardBundle } from './dashboard'

describe('normalizeDashboardBundle', () => {
  it('preserves the SLA denominator when a terminal row has no finish time', () => {
    const bundle = normalizeDashboardBundle({
      jobStats: {},
      triggerStats: {},
      alertStats: {},
      workerStats: {},
      slaStats: {
        onTime: 1,
        breached: 1,
        totalWithSla: 3,
        dailyTrend: [{ day: '2026-10-26', onTime: 1, breached: 1 }],
      },
    })

    expect(bundle.sla.totalWithSla).toBe(3)
    expect(bundle.sla.series.onTime).toEqual([1])
    expect(bundle.sla.series.violation).toEqual([1])
  })
})
