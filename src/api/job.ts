import { get, post, put, patch } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import { launchBatchDayCatchUp } from '@/api/batchDays'
import { instanceApi } from '@/api/instance'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import type { BatchDayCatchUpRequest, ConsoleJobDefinitionResponse } from '@/types/console-api'

export type InstanceQuery = InstanceQueryParams

async function resolveJobDefinitionId(jobCode: string, tenantId: string) {
  // 传入 jobCode 让后端过滤（后端不支持时忽略该参数，回退到全量）
  const rows = await fetchAllPageItems<ConsoleJobDefinitionResponse>(
    '/api/console/queries/job-definitions',
    { tenantId, jobCode },
  )
  const matched = rows.find((row) => row.jobCode === jobCode)
  if (!matched) throw new Error(`Job 定义不存在：${jobCode}`)
  return matched.id
}

export const jobApi = {
  /** OpenAPI 为 PageResponse，聚合全量供列表端上筛选 */
  listDefinitions: (tenantId?: string, jobCode?: string) =>
    fetchAllPageItems<ConsoleJobDefinitionResponse>('/api/console/queries/job-definitions', {
      tenantId,
      ...(jobCode ? { jobCode } : {}),
    }),

  toggleEnabled: async (jobCode: string, tenantId: string, enabled: boolean) => {
    const id = await resolveJobDefinitionId(jobCode, tenantId)
    return patch<void>(`/api/console/job-definitions/${id}`, { tenantId, enabled })
  },

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

  cancel: (instanceId: number, tenantId: string) => instanceApi.cancel(instanceId, tenantId),

  listPartitions: (instanceId: number, tenantId: string) =>
    instanceApi.partitions(instanceId, tenantId),

  /** POST /api/console/jobs/batch-days/{bizDate}/catchup */
  batchDayCatchUp: (bizDate: string, body: BatchDayCatchUpRequest) =>
    launchBatchDayCatchUp(bizDate, body),

  /** POST /api/console/job-definitions/{id}/copy */
  copy: (id: number, tenantId: string, newJobCode: string) =>
    post<number>(`/api/console/job-definitions/${id}/copy`, undefined, {
      params: { tenantId, newJobCode },
    }),

  /** POST /api/console/jobs/tasks/replay */
  replayTask: (body: object) => post<string>('/api/console/jobs/tasks/replay', body),

  /** POST /api/console/jobs/partitions/replay */
  replayPartition: (body: object) => post<string>('/api/console/jobs/partitions/replay', body),

  /** POST /api/console/jobs/batch-trigger */
  batchTrigger: (body: object) => post<string>('/api/console/jobs/batch-trigger', body),

  /** POST /api/console/jobs/catch-up/approve */
  catchUpApprove: (body: object) => post<string>('/api/console/jobs/catch-up/approve', body),

  /** POST /api/console/jobs/compensate */
  compensate: (body: object) => post<string>('/api/console/jobs/compensate', body),

  /** POST /api/console/jobs/compensations — create compensation command */
  createCompensation: (body: object) => post<string>('/api/console/jobs/compensations', body),

  /** POST /api/console/jobs/dead-letters/replay */
  replayDeadLetters: (body: object) => post<string>('/api/console/jobs/dead-letters/replay', body),

  /** GET /api/console/job-definitions/{id} */
  getDefinition: (id: number, tenantId: string) =>
    get<ConsoleJobDefinitionResponse>(`/api/console/job-definitions/${id}`, { tenantId }),

  /** POST /api/console/job-definitions — create */
  createDefinition: (body: object) => post<number>('/api/console/job-definitions', body),

  /** PUT /api/console/job-definitions/{id} — update */
  updateDefinition: (id: number, body: object) =>
    put<void>(`/api/console/job-definitions/${id}`, body),

  /** POST /api/console/jobs/rerun — rerun a failed instance */
  rerun: (body: {
    tenantId: string
    jobCode: string
    bizDate: string
    instanceNo?: string
    reason?: string
  }) => post<string>('/api/console/jobs/rerun', body),

  /** PATCH /api/console/job-definitions/batch */
  batchToggle: (body: { tenantId: string; ids: number[]; enabled: boolean }) =>
    patch<unknown>('/api/console/job-definitions/batch', body),

  /** POST /api/console/job-definitions/{id}/clone */
  clone: (id: number, tenantId: string) =>
    post<number>(`/api/console/job-definitions/${id}/clone`, { tenantId }),
}
