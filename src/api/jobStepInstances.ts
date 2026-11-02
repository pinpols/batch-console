import { get } from '@/api/client'
import type { PageResponse } from '@/types'
import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'
import type { operations } from '@/types/api.generated'

type GeneratedJobStepInstancePageQuery = NonNullable<
  operations['queryJobStepInstances']['parameters']['query']
>

// 查询参数按十进制原文传输 Long，避免超过 JavaScript 安全整数时被截断。
export type JobStepInstancePageQuery = Omit<GeneratedJobStepInstancePageQuery, 'jobInstanceId'> & {
  jobInstanceId?: number | string
}

export function queryJobStepInstancePage(query: JobStepInstancePageQuery) {
  return get<PageResponse<ConsoleJobStepInstanceResponse>>(
    '/api/console/queries/job-step-instances',
    query,
  )
}
