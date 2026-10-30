import { describe, expect, it } from 'vitest'
import { slaAttainmentRows } from './slaAttainment'

describe('slaAttainmentRows', () => {
  it('uses all SLA samples as the denominator, including unclassified finish times', () => {
    expect(
      slaAttainmentRows([
        { jobCode: 'job-a', slaOnTime: 1, slaTotalWithSla: 3 },
        { jobCode: 'job-b', slaOnTime: 2, slaTotalWithSla: 2 },
      ]),
    ).toEqual([
      { name: 'job-a', value: 33.3 },
      { name: 'job-b', value: 100 },
    ])
  })

  it('omits jobs without an SLA sample', () => {
    expect(
      slaAttainmentRows([{ jobCode: 'no-deadline', slaOnTime: 0, slaTotalWithSla: 0 }]),
    ).toEqual([])
  })
})
