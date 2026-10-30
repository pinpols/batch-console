import { describe, expect, it } from 'vitest'
import { dailyProgressRows } from './dailyProgress'
import type { DailyProgress } from '@/api/dailyProgress'
const data: DailyProgress = {
  tenantId: 'ta',
  bizDate: '2040-04-05',
  generatedAt: '2040-04-05T10:00:00Z',
  coverage: { scheduledDefinitions: 1, uncoveredDefinitions: 1 },
  counts: [
    { scope: 'SCHEDULED_OCCURRENCE', status: 'RUN_SUCCESS', count: 1 },
    { scope: 'SCHEDULED_OCCURRENCE', status: 'MISFIRE_SKIPPED', count: 1 },
    { scope: 'WORKFLOW_RUN', status: 'FAILED', count: 2 },
    { scope: 'WORKFLOW_RUN', status: 'RUNNING', count: 1 },
    { scope: 'JOB_TASK', status: 'SUCCESS', count: 20 },
  ],
}
describe('dailyProgressRows', () => {
  it('keeps the five denominators separate and suppresses incomplete plan percentages', () => {
    const rows = dailyProgressRows(data)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({
      scope: 'SCHEDULED_OCCURRENCE',
      total: 2,
      ended: 2,
      succeeded: 1,
      percentage: null,
    })
    expect(rows[2]).toMatchObject({
      scope: 'WORKFLOW_RUN',
      total: 3,
      ended: 2,
      succeeded: 0,
      percentage: 67,
    })
    expect(rows[4]).toMatchObject({ total: 20, succeeded: 20 })
  })
  it('shows zero as no workload, preserves unknown states, and distinguishes skipped from succeeded', () => {
    const rows = dailyProgressRows({
      ...data,
      coverage: { scheduledDefinitions: 1, uncoveredDefinitions: 0 },
      counts: [
        { scope: 'SCHEDULED_OCCURRENCE', status: 'MISFIRE_SKIPPED', count: 1 },
        { scope: 'JOB_INSTANCE', status: 'FUTURE_STATE', count: 2 },
      ],
    })
    expect(rows[0]).toMatchObject({ percentage: 100, succeeded: 0, skipped: 1 })
    expect(rows[1]).toMatchObject({ total: 0, percentage: null })
    expect(rows[3]).toMatchObject({ total: 2, other: 2, ended: 0 })
  })
})
