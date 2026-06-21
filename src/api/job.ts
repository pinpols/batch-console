import { get, post, put, patch } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import { launchBatchDayCatchUp } from '@/api/batchDays'
import { instanceApi } from '@/api/instance'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import type {
  BatchDayCatchUpRequest,
  ConfigSyncBundlePayload,
  ConsoleJobDefinitionResponse,
  JobBundleCreateRequest,
  JobBundleImportRequest,
} from '@/types/console-api'

export type InstanceQuery = InstanceQueryParams

export type ExecutionMode = 'FULL' | 'INCREMENTAL' | 'CDC'

/** 与 BE `JobDefinitionCreateRequest` (Java DTO) 对齐;BE openapi.yaml 同步补 schema。 */
export interface JobDefinitionCreateRequest {
  tenantId: string
  jobCode: string
  jobType: string
  scheduleType: string
  jobName?: string
  bizType?: string
  scheduleExpr?: string
  timezone?: string
  triggerMode?: string
  workerGroup?: string
  queueCode?: string
  calendarCode?: string
  windowCode?: string
  dagEnabled?: boolean
  shardStrategy?: string
  executionMode?: ExecutionMode
  watermarkField?: string
  retryPolicy?: string
  retryMaxCount?: number
  timeoutSeconds?: number
  executionHandler?: string
  paramSchema?: string
  defaultParams?: string
  priority?: number
  enabled?: boolean
  description?: string
}

/** PUT 接收任意子集(BE 用 null/未传区分"不改"),与 JobDefinitionUpdateRequest Java DTO 对齐。 */
export interface JobDefinitionUpdateRequest {
  tenantId: string
  jobName?: string
  bizType?: string
  scheduleType?: string
  scheduleExpr?: string
  timezone?: string
  triggerMode?: string
  workerGroup?: string
  queueCode?: string
  calendarCode?: string
  windowCode?: string
  dagEnabled?: boolean
  shardStrategy?: string
  executionMode?: ExecutionMode
  watermarkField?: string
  retryPolicy?: string
  retryMaxCount?: number
  timeoutSeconds?: number
  executionHandler?: string
  paramSchema?: string
  defaultParams?: string
  priority?: number
  enabled?: boolean
  description?: string
}

export type JobBundlePayload = ConfigSyncBundlePayload

async function resolveJobDefinitionId(jobCode: string, tenantId: string) {
  // 传入 jobCode 让后端过滤（后端不支持时忽略该参数，回退到全量）
  const rows = await fetchAllPageItems<ConsoleJobDefinitionResponse>(
    '/api/console/queries/job-definitions',
    { tenantId, jobCode },
  )
  const matched = rows.find((row) => row.jobCode === jobCode)
  if (!matched) throw new Error(`作业定义不存在：${jobCode}`)
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

  /** GET /api/console/job-definitions/{id} */
  getDefinition: (id: number, tenantId: string) =>
    get<ConsoleJobDefinitionResponse>(`/api/console/job-definitions/${id}`, { tenantId }),

  /** POST /api/console/job-definitions — create */
  createDefinition: (body: JobDefinitionCreateRequest) =>
    post<number>('/api/console/job-definitions', body),

  /** PUT /api/console/job-definitions/{id} — update (PUT 语义为整体替换,但 BE 实际接受任意子集) */
  updateDefinition: (id: number, body: JobDefinitionUpdateRequest) =>
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

  /** POST /api/console/job-definitions/{id}/clone — newJobCode 必填(BE @NotBlank) */
  clone: (id: number, tenantId: string, newJobCode: string) =>
    post<number>(`/api/console/job-definitions/${id}/clone`, { tenantId, newJobCode }),

  createBundle: (body: JobBundleCreateRequest) =>
    post<Record<string, unknown>>('/api/console/jobs/bundle/create', body),

  exportBundle: (tenantId: string, jobCode: string) =>
    get<Record<string, unknown>>('/api/console/jobs/bundle/export', { tenantId, jobCode }),

  importBundle: (body: JobBundleImportRequest) =>
    post<Record<string, unknown>>('/api/console/jobs/bundle/import', body),
}
