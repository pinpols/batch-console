import { get } from '@/api/client'
import type { PageResponse } from '@/types'
import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'
import type { operations } from '@/types/api.generated'

export type JobStepInstancePageQuery = NonNullable<
  operations['queryJobStepInstances']['parameters']['query']
>

export function queryJobStepInstancePage(query: JobStepInstancePageQuery) {
  return get<PageResponse<ConsoleJobStepInstanceResponse>>(
    '/api/console/queries/job-step-instances',
    query,
  )
}
