import type { components } from '@/types/api.generated'

type BatchInitResult = components['schemas']['TenantConfigBatchInitResponse']

function itemHasFailures(item: BatchInitResult['results'][number]): boolean {
  return Object.values(item).some(
    (value) =>
      value !== null &&
      typeof value === 'object' &&
      'failed' in value &&
      typeof value.failed === 'number' &&
      value.failed > 0,
  )
}

export interface BatchInitOutcome {
  result: BatchInitResult
  successfulTenantIds: string[]
  failedTenantIds: string[]
  hasFailedItems: boolean
  fullySuccessful: boolean
}

export function assessBatchInitOutcome(result: BatchInitResult): BatchInitOutcome {
  const successfulResults = result.results.filter((item) => item.success === true)
  const successfulTenantIdCandidates = successfulResults.map((item) => item.tenantId ?? '')
  const successfulTenantIds = successfulTenantIdCandidates.filter(Boolean)

  const failedResults = result.results.filter(
    (item) => item.success !== true || itemHasFailures(item),
  )
  const failedTenantIdCandidates = failedResults.map((item) => item.tenantId ?? '')
  const failedTenantIds = failedTenantIdCandidates.filter(Boolean)

  return {
    result,
    successfulTenantIds,
    failedTenantIds,
    hasFailedItems: result.results.some(itemHasFailures),
    fullySuccessful:
      result.totalTenants > 0 &&
      result.failureTenants === 0 &&
      result.successTenants === result.totalTenants &&
      result.results.length === result.totalTenants &&
      result.results.every(
        (item) => item.success === true && !itemHasFailures(item),
      ),
  }
}
