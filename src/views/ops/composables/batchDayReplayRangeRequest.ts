import type { BatchDayReplayRangeRequest } from '@/api/batchDayReplay'
import { validateBatchDayReplayFields } from '@/utils/batchDayReplayForm'

type RangeForm = Omit<
  BatchDayReplayRangeRequest,
  'fromDate' | 'throughDate' | 'operationKey' | 'previewToken'
>
type RangeResult =
  { request: BatchDayReplayRangeRequest; error?: never } | { error: string; request?: never }

/** 校验日期范围与选定范围后构造重放请求。 */
export function buildBatchDayReplayRangeRequest(
  form: RangeForm,
  dates: [string, string] | null,
  tenantId: string,
  selectedJobCodes: string[],
  versionIdsText: string,
): RangeResult {
  if (!dates) return { error: 'rangeMissingRequired' }
  const fieldError = validateBatchDayReplayFields(form)
  if (fieldError)
    return { error: fieldError === 'missingRequired' ? 'rangeMissingRequired' : fieldError }
  const [fromDate, throughDate] = dates
  if (fromDate > throughDate) return { error: 'invalidRange' }
  if (form.scope === 'SUBSET_JOB_CODES' && selectedJobCodes.length === 0)
    return { error: 'missingJobCodes' }
  const splitVersionIdTokens = versionIdsText.split(/[\s,]+/)
  const versionIdTokens = splitVersionIdTokens.filter(Boolean)
  const versionIds = versionIdTokens.map(Number)
  const outputVersionIdsAreInvalid =
    form.scope === 'OUTPUTS_ONLY' &&
    (versionIds.length === 0 || versionIds.some((id) => !Number.isSafeInteger(id) || id <= 0))
  if (outputVersionIdsAreInvalid) return { error: 'missingVersionIds' }
  return {
    request: {
      ...form,
      tenantId,
      fromDate,
      throughDate,
      jobCodes: form.scope === 'SUBSET_JOB_CODES' ? [...selectedJobCodes] : undefined,
      versionIds: form.scope === 'OUTPUTS_ONLY' ? versionIds : undefined,
    },
  }
}
