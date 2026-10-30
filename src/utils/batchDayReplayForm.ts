import type { BatchDayReplayRangeRequest, BatchDayReplaySubmitRequest } from '@/api/batchDayReplay'

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
    const versionTokens = splitTokens(versionIdsText)
    const numericVersionIds = versionTokens.map(Number)
    const validVersionIds = numericVersionIds.filter(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
    const uniqueVersionIds = new Set(validVersionIds)
    request.versionIds = Array.from(uniqueVersionIds)
    if (request.versionIds.length === 0) {
      return { error: 'missingVersionIds' }
    }
  } else {
    request.versionIds = undefined
  }

  return { request }
}

export function batchDayReplayRequestKey(request: BatchDayReplaySubmitRequest): string {
  return JSON.stringify(request)
}

export function isReplayPreviewCurrent(
  request: BatchDayReplaySubmitRequest,
  previewRequestKey: string | null,
): boolean {
  return previewRequestKey !== null && previewRequestKey === batchDayReplayRequestKey(request)
}

export function batchDayReplayRangeRequestKey(request: BatchDayReplayRangeRequest): string {
  return JSON.stringify(request)
}

export function isReplayRangePreviewCurrent(
  request: BatchDayReplayRangeRequest,
  previewRequestKey: string | null,
): boolean {
  return previewRequestKey !== null && previewRequestKey === batchDayReplayRangeRequestKey(request)
}

function splitTokens(value: string): string[] {
  const tokens = value.split(/[\s,]+/)
  const trimmedTokens = tokens.map((item) => item.trim())
  return trimmedTokens.filter(Boolean)
}
