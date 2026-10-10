import { describe, expect, it } from 'vitest'
import type { BatchDayReplaySubmitRequest } from '@/api/batchDayReplay'
import {
  batchDayReplayRequestKey,
  buildBatchDayReplayRequest,
  isReplayPreviewCurrent,
} from './batchDayReplayForm'

function replayForm(
  overrides: Partial<BatchDayReplaySubmitRequest> = {},
): BatchDayReplaySubmitRequest {
  return {
    calendarCode: 'default',
    bizDate: '2026-09-11',
    scope: 'ALL',
    executionMode: 'REPLAY',
    candidateSource: 'EXISTING_INSTANCES',
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    reason: 'release rehearsal',
    requestedBy: 'operator',
    ...overrides,
  }
}

describe('buildBatchDayReplayRequest', () => {
  it('forces dry-run result isolation and keeps schedule-plan source', () => {
    const result = buildBatchDayReplayRequest(
      replayForm({
        executionMode: 'DRY_RUN',
        candidateSource: 'SCHEDULE_PLAN',
        resultPolicy: 'CREATE_NEW_VERSION',
      }),
      'tenant-a',
      '',
      '',
    )

    expect(result.request).toMatchObject({
      tenantId: 'tenant-a',
      executionMode: 'DRY_RUN',
      candidateSource: 'SCHEDULE_PLAN',
      resultPolicy: 'DRY_RUN_ONLY',
    })
  })

  it('normalizes subset job codes and removes unrelated version ids', () => {
    const result = buildBatchDayReplayRequest(
      replayForm({ scope: 'SUBSET_JOB_CODES', versionIds: [9] }),
      'tenant-a',
      'JOB_A, JOB_B\nJOB_A',
      '',
    )

    expect(result.request?.jobCodes).toEqual(['JOB_A', 'JOB_B', 'JOB_A'])
    expect(result.request?.versionIds).toBeUndefined()
  })

  it('accepts only positive safe integer result-version ids', () => {
    const result = buildBatchDayReplayRequest(
      replayForm({ scope: 'OUTPUTS_ONLY', jobCodes: ['JOB_A'] }),
      'tenant-a',
      '',
      '1, -2 3.5 9007199254740992 4',
    )

    expect(result.request?.versionIds).toEqual([1, 4])
    expect(result.request?.jobCodes).toBeUndefined()
  })

  it.each([
    [replayForm({ reason: '  ' }), '', '', 'missingRequired'],
    [replayForm({ scope: 'SUBSET_JOB_CODES' }), ' , ', '', 'missingJobCodes'],
    [replayForm({ scope: 'OUTPUTS_ONLY' }), '', '0,-1,NaN', 'missingVersionIds'],
  ] as const)('rejects invalid form data', (form, jobCodes, versionIds, error) => {
    expect(buildBatchDayReplayRequest(form, 'tenant-a', jobCodes, versionIds)).toEqual({ error })
  })
})

describe('batchDayReplayRequestKey', () => {
  it('changes when any submitted option changes', () => {
    const request = replayForm({ jobCodes: ['daily-import'], reason: 'late file' })

    expect(batchDayReplayRequestKey(request)).not.toBe(
      batchDayReplayRequestKey({ ...request, reason: 'corrected input' }),
    )
    expect(batchDayReplayRequestKey(request)).not.toBe(
      batchDayReplayRequestKey({ ...request, jobCodes: ['daily-import', 'daily-check'] }),
    )
  })

  it('keeps an unchanged request reusable for its preview', () => {
    const request = replayForm({ jobCodes: ['daily-import'], reason: 'late file' })

    expect(batchDayReplayRequestKey({ ...request })).toBe(batchDayReplayRequestKey(request))
    expect(isReplayPreviewCurrent(request, batchDayReplayRequestKey(request))).toBe(true)
    expect(isReplayPreviewCurrent(request, null)).toBe(false)
    expect(
      isReplayPreviewCurrent({ ...request, autoApprove: true }, batchDayReplayRequestKey(request)),
    ).toBe(false)
  })
})
