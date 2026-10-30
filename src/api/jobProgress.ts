import type { AxiosRequestConfig } from 'axios'
import { get } from './client'
import type { components } from '@/types/api.generated'
export type JobExecutionProgress = components['schemas']['JobExecutionProgress']
export function getJobExecutionProgress(id: number, tenantId: string) {
  return get<JobExecutionProgress>(
    `/api/console/job-instances/${id}/execution-progress`,
    {
      tenantId,
    },
    { _silent: true } as AxiosRequestConfig,
  )
}
