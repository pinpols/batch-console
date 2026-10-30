import type { AxiosRequestConfig } from 'axios'
import { get } from './client'
import type { components } from '@/types/api.generated'
export type PipelineProgressSnapshot = components['schemas']['PipelineProgressSnapshot']
export function getPipelineProgressSnapshot(scope: string, tenantId: string) {
  return get<PipelineProgressSnapshot>(
    '/api/console/pipeline-progress',
    { tenantId, pipelineInstanceIds: scope },
    { _silent: true } as AxiosRequestConfig,
  )
}
