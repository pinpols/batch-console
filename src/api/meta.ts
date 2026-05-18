import { get } from '@/api/client'

/**
 * 控制台元数据 API（OpenAPI `Meta` 标签）。
 *
 * - `GET /api/console/meta/enums`：后端返回的分组包括
 *   triggerType, scheduleType, triggerMode, catchUpPolicy,
 *   jobType, shardStrategy, retryPolicy, taskStatus, partitionStatus, instanceStatus,
 *   workflowType, workflowNodeType, edgeType, workflowRunStatus,
 *   pipelineType, channelType, authType, receiptPolicy,
 *   fileTemplateType, fileTemplateFormat,
 *   endStrategy, outOfWindowAction, holidayStrategy, dayType,
 *   queueType, priorityPolicy, severity, alertStatus,
 *   approvalStatus, approvalType, configStatus, workerStatus,
 *   outboxPublishStatus, aiPromptCategory。
 *   operationType, operationResult, fileStatus。
 * - `GET /api/console/meta/biz-types?tenantId=`：租户维度业务类型（独立接口）。
 */
export interface MetaOption {
  label: string
  value: string
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeOption(item: unknown): MetaOption | null {
  const row = toObject(item)
  const value = row.code ?? row.value ?? row.id
  if (typeof value !== 'string' || !value) return null
  const label = row.label
  return {
    value,
    label: typeof label === 'string' && label ? label : value,
  }
}

function toOptions(payload: unknown): MetaOption[] {
  return Array.isArray(payload)
    ? payload.map((item) => normalizeOption(item)).filter((item): item is MetaOption => !!item)
    : []
}

/**
 * 注:`get<T>()` 已由 axios 拦截器(`interceptors.ts:213`)解包过 CommonResponse,
 * 返回的就是 envelope 的 `data` 字段内容,不要再 `.data` 一次,否则全空。
 */
export async function getMetaEnums(): Promise<Record<string, MetaOption[]>> {
  const data = toObject(await get<unknown>('/api/console/meta/enums'))
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toOptions(value)]))
}

export async function getMetaQueues(tenantId: string): Promise<MetaOption[]> {
  return toOptions(await get<unknown>('/api/console/meta/queues', { tenantId }))
}

export async function getMetaCalendars(tenantId: string): Promise<MetaOption[]> {
  return toOptions(await get<unknown>('/api/console/meta/calendars', { tenantId }))
}

export async function getMetaWindows(tenantId: string): Promise<MetaOption[]> {
  return toOptions(await get<unknown>('/api/console/meta/windows', { tenantId }))
}

export async function getMetaWorkerGroups(tenantId: string): Promise<MetaOption[]> {
  return toOptions(await get<unknown>('/api/console/meta/worker-groups', { tenantId }))
}

export async function getMetaBizTypes(tenantId: string): Promise<MetaOption[]> {
  return toOptions(await get<unknown>('/api/console/meta/biz-types', { tenantId }))
}

/**
 * Pipeline 9 stages 白名单,按 jobType 分组(IMPORT / EXPORT / PROCESS / DISPATCH)。
 * 返回 { IMPORT: ['RECEIVE','PREPROCESS',...], EXPORT: [...], ... }。
 */
export async function getMetaPipelineStages(): Promise<Record<string, string[]>> {
  const data = await get<unknown>('/api/console/meta/pipeline-stages')
  if (!data || typeof data !== 'object') return {}
  const result: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(v)) result[k] = v.filter((x): x is string => typeof x === 'string')
  }
  return result
}

/** step_registry 已注册的 impl_code 白名单。module=IMPORT/EXPORT/PROCESS/DISPATCH;不传返回全部。 */
export async function getMetaStepImpls(module?: string): Promise<string[]> {
  const params: Record<string, string> = {}
  if (module) params.module = module
  const data = await get<unknown>('/api/console/meta/step-impls', params)
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
}
