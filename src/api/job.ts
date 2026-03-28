import { get, post } from '@/api/client'
import { instanceApi } from '@/api/instance'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import type { JobDefinition } from '@/types'

export type InstanceQuery = InstanceQueryParams

export const jobApi = {
  listDefinitions: (tenantId?: string) =>
    get<JobDefinition[]>('/api/console/query/job-definitions', { tenantId }),

  toggleEnabled: (_jobCode: string, _tenantId: string, _enabled: boolean) =>
    Promise.reject(new Error('Job 启停：请对接配置发布或专用命令 API')),

  trigger: (jobCode: string, tenantId: string, payload?: object) =>
    post<string>('/api/console/jobs/trigger', {
      tenantId,
      jobCode,
      bizDate: new Date().toISOString().slice(0, 10),
      triggerType: 'MANUAL',
      payload: payload ? JSON.stringify(payload) : '{}',
    }),

  listInstances: (query: InstanceQuery) => queryJobInstances(query),

  instanceDetail: (instanceId: number, tenantId: string) =>
    instanceApi.detail(instanceId, tenantId),

  retry: (instanceNo: string, tenantId: string, jobCode: string, bizDate: string) =>
    instanceApi.retry(instanceNo, tenantId, jobCode, bizDate),

  cancel: (_instanceId: number, _tenantId: string) =>
    Promise.reject(new Error('取消实例：待后端命令 API')),

  listPartitions: (instanceId: number, tenantId: string) =>
    instanceApi.partitions(instanceId, tenantId),
}
