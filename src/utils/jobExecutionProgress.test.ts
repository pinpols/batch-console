import { describe, expect, it } from 'vitest'
import { jobExecutionCounts } from './jobExecutionProgress'
import type { JobExecutionProgress } from '@/api/jobProgress'
const sample = (expectedPartitions = 4): JobExecutionProgress => ({
  tenantId: 'owned',
  jobInstanceId: 42,
  jobCode: 'import',
  instanceStatus: 'RUNNING',
  generatedAt: '2026-10-25T10:00:00Z',
  expectedPartitions,
  stageGraphAvailable: false,
  stages: [],
  counts: [
    { scope: 'PARTITION', status: 'SUCCESS', count: 1 },
    { scope: 'PARTITION', status: 'FAILED', count: 1 },
    { scope: 'PARTITION', status: 'RUNNING', count: 1 },
    { scope: 'TASK', status: 'SUCCESS', count: 2 },
    { scope: 'TASK', status: 'RUNNING', count: 1 },
  ],
})
describe('jobExecutionCounts', () => {
  it('keeps planned partitions separate from created tasks and closure from success', () => {
    const [partitions, tasks] = jobExecutionCounts(sample())
    expect(partitions).toMatchObject({
      total: 4,
      created: 3,
      closed: 2,
      succeeded: 1,
      percentage: 50,
    })
    expect(tasks).toMatchObject({ total: 3, closed: 2, succeeded: 2, percentage: 67 })
  })
  it('keeps unknown or inconsistent partition denominators visible without a false percentage', () => {
    expect(jobExecutionCounts(sample(0))[0].percentage).toBeNull()
    expect(jobExecutionCounts(sample(1))[0].percentage).toBeNull()
  })
  it('does not count unknown states as successfully closed', () => {
    const value = sample()
    value.counts = [{ scope: 'TASK', status: 'NEW_STATUS', count: 4 }]
    expect(jobExecutionCounts(value)[1]).toMatchObject({
      created: 4,
      closed: 0,
      succeeded: 0,
      percentage: 0,
    })
  })
})
