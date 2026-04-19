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

export interface JobDefinitionListParams {
  tenantId: string
  pageNo: number
  pageSize: number
  jobCode?: string
  /** undefined = 后端默认仅 enabled=true；显式传 false = 只看停用；true = 只看启用 */
  enabled?: boolean
}

export const jobApi = {
  /**
   * @deprecated 仅限需要全量聚合的特殊场景（如 meta 下拉）。列表页请改用
   * {@link jobApi.listDefinitionsPaged}，避免 fetchAllPageItems 最大 20000 条的客户端聚合。
   */
  listDefinitions: (tenantId?: string, jobCode?: string) =>
    fetchAllPageItems<ConsoleJobDefinitionResponse>('/api/console/queries/job-definitions', {
      tenantId,
      ...(jobCode ? { jobCode } : {}),
    }),

  /**
   * 服务端分页版本。后端 OpenAPI `queryJobDefinitions` 支持 tenantId / pageNo /
   * pageSize / jobCode / enabled 五个过滤参数。页面次要过滤（jobName / workerGroup 等
   * 后端尚未暴露）仍在当前页内做前端过滤——后端扩展后可进一步下推。
   */
  listDefinitionsPaged: async (params: JobDefinitionListParams) => {
    const { pageNo, pageSize } = params
    const res = await get<{
      total: number
      pageNo: number
      pageSize: number
      items: ConsoleJobDefinitionResponse[]
    }>('/api/console/queries/job-definitions', {
      tenantId: params.tenantId,
      pageNo,
      pageSize,
      ...(params.jobCode ? { jobCode: params.jobCode } : {}),
      ...(params.enabled != null ? { enabled: params.enabled } : {}),
    })
    return {
      records: res.items ?? [],
      total: res.total ?? 0,
      page: res.pageNo ?? pageNo,
      pageSize: res.pageSize ?? pageSize,
    }
  },

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
