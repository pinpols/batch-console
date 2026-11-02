import { describe, expect, it } from 'vitest'
import type { BatchDayReplayRangeRequest } from '@/api/batchDayReplay'
import { buildBatchDayReplayRangeRequest } from './batchDayReplayRangeRequest'

type RangeForm = Omit<
  BatchDayReplayRangeRequest,
  'fromDate' | 'throughDate' | 'operationKey' | 'previewToken'
>
const form: RangeForm = {
  tenantId: 'original',
  calendarCode: 'CAL',
  reason: 'reason',
  requestedBy: 'operator',
  scope: 'ALL',
  resultPolicy: 'CREATE_NEW_VERSION',
  configVersionPolicy: 'USE_ORIGINAL_CONFIG',
  autoApprove: false,
  executionMode: 'REPLAY',
  candidateSource: 'EXISTING_INSTANCES',
}
const dates: [string, string] = ['2026-10-20', '2026-10-21']

describe('批次日重放范围请求', () => {
  it('按现有优先级拒绝缺日期、必填字段和倒序日期', () => {
    expect(
      buildBatchDayReplayRangeRequest({ ...form, reason: '' }, null, 'tenant', [], '').error,
    ).toBe('rangeMissingRequired')
    expect(
      buildBatchDayReplayRangeRequest({ ...form, reason: '' }, dates, 'tenant', [], '').error,
    ).toBe('rangeMissingRequired')
    expect(
      buildBatchDayReplayRangeRequest(form, [dates[1], dates[0]], 'tenant', [], '').error,
    ).toBe('invalidRange')
  })
  it('子集和输出范围必须分别提供作业编码和有效版本', () => {
    expect(
      buildBatchDayReplayRangeRequest(
        { ...form, scope: 'SUBSET_JOB_CODES' },
        dates,
        'tenant',
        [],
        '',
      ).error,
    ).toBe('missingJobCodes')
    expect(
      buildBatchDayReplayRangeRequest(
        { ...form, scope: 'OUTPUTS_ONLY' },
        dates,
        'tenant',
        [],
        '1,0',
      ).error,
    ).toBe('missingVersionIds')
  })
  it('以当前租户构造范围，版本按分隔符解析，作业编码独立复制', () => {
    const selected = ['JOB_A']
    const jobs = buildBatchDayReplayRangeRequest(
      { ...form, scope: 'SUBSET_JOB_CODES' },
      dates,
      'tenant',
      selected,
      '2',
    )
    expect(jobs.request).toMatchObject({ tenantId: 'tenant', jobCodes: ['JOB_A'] })
    selected.push('JOB_B')
    expect(jobs.request?.jobCodes).toEqual(['JOB_A'])
    const outputs = buildBatchDayReplayRangeRequest(
      { ...form, scope: 'OUTPUTS_ONLY' },
      dates,
      'tenant',
      [],
      '2, 3',
    )
    expect(outputs.request?.versionIds).toEqual([2, 3])
  })
})
