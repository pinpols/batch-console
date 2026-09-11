import type { BatchDayReplaySubmitRequest } from '@/api/batchDayReplay'

export type BatchDayReplayFormError = 'missingRequired' | 'missingJobCodes' | 'missingVersionIds'

export type BatchDayReplayFormResult =
  | { request: BatchDayReplaySubmitRequest; error?: never }
  | { request?: never; error: BatchDayReplayFormError }

export function buildBatchDayReplayRequest(
  form: BatchDayReplaySubmitRequest,
  tenantId: string,
  jobCodesText: string,
  versionIdsText: string,
): BatchDayReplayFormResult {
  if (!form.bizDate || !form.reason.trim()) {
    return { error: 'missingRequired' }
  }

  const request: BatchDayReplaySubmitRequest = { ...form, tenantId }
  if (request.executionMode === 'DRY_RUN') {
    request.resultPolicy = 'DRY_RUN_ONLY'
  }

  if (request.scope === 'SUBSET_JOB_CODES') {
    request.jobCodes = splitTokens(jobCodesText)
    if (request.jobCodes.length === 0) {
      return { error: 'missingJobCodes' }
    }
  } else {
    request.jobCodes = undefined
  }

  if (request.scope === 'OUTPUTS_ONLY') {
    request.versionIds = splitTokens(versionIdsText)
      .map(Number)
      .filter((value) => Number.isSafeInteger(value) && value > 0)
    if (request.versionIds.length === 0) {
      return { error: 'missingVersionIds' }
    }
  } else {
    request.versionIds = undefined
  }

  return { request }
}

function splitTokens(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}
