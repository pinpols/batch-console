import { describe, expect, it } from 'vitest'
import { jobLineageEvidenceLink, jobResultBusinessKey } from './lineageLinks'

describe('血缘证据链接', () => {
  it('作业结果版本的业务键为 job:{jobCode}:{bizDate}', () => {
    expect(jobResultBusinessKey('DAILY_EXPORT', '2026-11-01')).toBe('job:DAILY_EXPORT:2026-11-01')
  })

  it('有作业编码和业务日时链到血缘证据并编码业务键', () => {
    expect(jobLineageEvidenceLink('DAILY EXPORT', '2026-11-01')).toBe(
      '/observability/lineage?businessKey=job%3ADAILY%20EXPORT%3A2026-11-01',
    )
  })

  it('缺少作业编码或业务日时不给链接', () => {
    expect(jobLineageEvidenceLink('DAILY_EXPORT', '')).toBeNull()
    expect(jobLineageEvidenceLink(undefined, '2026-11-01')).toBeNull()
  })
})
