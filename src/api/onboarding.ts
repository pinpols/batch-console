import { getOpsSummary } from '@/api/ops'
import { jobApi } from '@/api/job'
import { instanceApi } from '@/api/instance'
import { getTenantReadiness } from '@/api/tenants'
import type { OnboardingEvidence } from '@/composables/onboardingModel'

type EvidenceSource = 'summary' | 'jobDefinitions' | 'runs' | 'successfulRuns' | 'readiness'

function resultValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

/**
 * 从既有权威接口聚合接入证据。任一来源失败时保留其它来源，不把接口故障误判为任务未完成。
 */
export async function getOnboardingEvidence(
  tenantId: string,
  options: { includeReadiness: boolean },
): Promise<OnboardingEvidence> {
  const readinessPromise = options.includeReadiness
    ? getTenantReadiness(tenantId)
    : Promise.resolve(null)
  const [summaryResult, definitionsResult, runsResult, successfulRunsResult, readinessResult] =
    await Promise.allSettled([
      getOpsSummary(tenantId),
      jobApi.listDefinitionsPaged({ tenantId, pageNo: 1, pageSize: 1 }),
      instanceApi.list({ tenantId, page: 1, pageSize: 1 }),
      instanceApi.list({
        tenantId,
        instanceStatus: 'SUCCESS',
        page: 1,
        pageSize: 1,
      }),
      readinessPromise,
    ])

  const summary = resultValue(summaryResult)
  const definitions = resultValue(definitionsResult)
  const runs = resultValue(runsResult)
  const successfulRuns = resultValue(successfulRunsResult)
  const readiness = resultValue(readinessResult)
  const failedSources: EvidenceSource[] = []
  if (summaryResult.status === 'rejected') failedSources.push('summary')
  if (definitionsResult.status === 'rejected') failedSources.push('jobDefinitions')
  if (runsResult.status === 'rejected') failedSources.push('runs')
  if (successfulRunsResult.status === 'rejected') failedSources.push('successfulRuns')
  if (options.includeReadiness && readinessResult.status === 'rejected') {
    failedSources.push('readiness')
  }

  return {
    tenantId,
    jobDefinitionCount: definitions?.total ?? null,
    runCount: runs?.total ?? null,
    successfulRunCount: successfulRuns?.total ?? null,
    onlineWorkerCount: summary?.onlineWorkers ?? null,
    readiness: readiness ?? null,
    readinessSupported: options.includeReadiness,
    failedSources,
  }
}
