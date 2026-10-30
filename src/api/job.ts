import { get, post, put, patch } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import { launchBatchDayCatchUp } from '@/api/batchDays'
import { instanceApi } from '@/api/instance'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import { workflowApi } from '@/api/workflow'
import { i18n } from '@/locales'
import { todayBusinessDate } from '@/utils/datetime'
import type { components } from '@/types/api.generated'
import type {
  BatchDayCatchUpRequest,
  ConfigSyncBundlePayload,
  CodeNameOption,
  ConsoleJobDefinitionResponse,
  JobBundleCreateRequest,
  JobBundleImportRequest,
  JobDefinitionCreateRequest,
  JobDefinitionUpdateRequest,
} from '@/types/console-api'

export type {
  JobBundleCreateRequest,
  JobBundleImportRequest,
  JobDefinitionCreateRequest,
  JobDefinitionUpdateRequest,
}

export type InstanceQuery = InstanceQueryParams

export type ExecutionMode = NonNullable<JobDefinitionCreateRequest['executionMode']>
export type JobBundlePayload = ConfigSyncBundlePayload

async function resolveJobDefinitionId(jobCode: string, tenantId: string) {
  // 传入 jobCode 让后端过滤（后端不支持时忽略该参数，回退到全量）
  const rows = await fetchAllPageItems<ConsoleJobDefinitionResponse>(
    '/api/console/queries/job-definitions',
    { tenantId, jobCode },
  )
  const matched = rows.find((row) => row.jobCode === jobCode)
  if (!matched) throw new Error(i18n.global.t('jobApi.definitionNotFound', { code: jobCode }))
  return matched.id
}

export interface JobDefinitionListParams {
  tenantId: string
  pageNo: number
  pageSize: number
  jobCode?: string
  scheduleType?: 'CRON' | 'FIXED_RATE' | 'MANUAL'
  triggerMode?: 'SCHEDULED' | 'API' | 'MANUAL' | 'EVENT' | 'MIXED'
  hasUpstreamDependency?: boolean
  monitoringCategory?: 'SCHEDULED' | 'DEPENDENCY' | 'RUNTIME_ONLY'
  exactJobCode?: string
  dependsOnJobCode?: string
  includeDisabled?: boolean
  /** undefined = 后端默认仅 enabled=true；显式传 false = 只看停用；true = 只看启用 */
  enabled?: boolean
}

export const jobApi = {
  /** 设计器 JOB 节点使用的轻量编码列表。 */
  listCodes: (tenantId: string) =>
    get<CodeNameOption[]>('/api/console/queries/job-definitions/codes', { tenantId }),

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
   * 服务端分页版本。后端 OpenAPI `queryJobDefinitions` 支持调度类型、启停状态等筛选。
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
      ...(params.exactJobCode ? { exactJobCode: params.exactJobCode } : {}),
      ...(params.dependsOnJobCode ? { dependsOnJobCode: params.dependsOnJobCode } : {}),
      ...(params.includeDisabled ? { includeDisabled: true } : {}),
      ...(params.scheduleType ? { scheduleType: params.scheduleType } : {}),
      ...(params.triggerMode ? { triggerMode: params.triggerMode } : {}),
      ...(params.hasUpstreamDependency != null
        ? { hasUpstreamDependency: params.hasUpstreamDependency }
        : {}),
      ...(params.monitoringCategory ? { monitoringCategory: params.monitoringCategory } : {}),
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

  trigger: async (workflowDefinitionId: number, tenantId: string, payload?: object) => {
    if (!Number.isSafeInteger(workflowDefinitionId) || workflowDefinitionId <= 0) {
      throw new Error('Job has no managed Workflow')
    }
    const bizDate = todayBusinessDate()
    const serializedPayload = payload ? JSON.stringify(payload) : '{}'
    return workflowApi.trigger(workflowDefinitionId, {
      tenantId,
      bizDate,
      triggerType: 'MANUAL',
      payload: serializedPayload,
    })
  },

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

  /** POST /api/console/job-definitions — 创建作业定义 */
  createDefinition: (body: JobDefinitionCreateRequest) =>
    post<number>('/api/console/job-definitions', body),

  /** PUT /api/console/job-definitions/{id} — update (PUT 语义为整体替换,但 BE 实际接受任意子集) */
  updateDefinition: (id: number, body: JobDefinitionUpdateRequest) =>
    put<void>(`/api/console/job-definitions/${id}`, body),

  /** POST /api/console/jobs/rerun — 重跑失败实例 */
  rerun: (body: {
    tenantId: string
    jobCode: string
    bizDate: string
    instanceNo?: string
    reason?: string
  }) => post<string>('/api/console/jobs/rerun', body),

  /** POST /api/console/jobs/compensations：为精确失败的 Workflow JOB 节点重放提交审批。 */
  previewFailedWorkflowJobNode: (body: {
    tenantId: string
    workflowRunId: number
    workflowNodeRunId: number
    reason: string
  }) => post<components['schemas']['ConsoleWorkflowNodeReplayPreviewResponse']>(
    '/api/console/jobs/workflow-node/replay-preview', body,
  ),

  replayFailedWorkflowJobNode: (body: {
    tenantId: string
    jobCode: string
    bizDate: string
    compensationType: 'WORKFLOW_NODE'
    targetId: number
    sourceWorkflowRunId: number
    sourceWorkflowNodeRunId: number
    reason: string
    operationKey: string
    previewToken: string
    resultPolicy: string
    configVersionPolicy: string
    configVersion?: number
  }) => post<string>('/api/console/jobs/compensations', body),

  /** PATCH /api/console/job-definitions/batch */
  batchToggle: (body: { tenantId: string; ids: number[]; enabled: boolean }) =>
    patch<unknown>('/api/console/job-definitions/batch', body),

  /** POST /api/console/job-definitions/{id}/clone — newJobCode 必填(BE @NotBlank) */
  clone: (id: number, tenantId: string, newJobCode: string) =>
    post<number>(`/api/console/job-definitions/${id}/clone`, { tenantId, newJobCode }),

  createBundle: (body: JobBundleCreateRequest) =>
    post<components['schemas']['JobBundleResultResponse']>('/api/console/jobs/bundle/create', body),

  exportBundle: (tenantId: string, jobCode: string) =>
    get<Record<string, unknown>>('/api/console/jobs/bundle/export', { tenantId, jobCode }),

  importBundle: (body: JobBundleImportRequest) =>
    post<components['schemas']['JobBundleResultResponse']>('/api/console/jobs/bundle/import', body),
}
