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

type RawCommonResponse = {
  data?: unknown
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

export async function getMetaEnums() {
  const response = await get<RawCommonResponse>('/api/console/meta/enums')
  const data = toObject(response.data)
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.map((item) => normalizeOption(item)).filter((item): item is MetaOption => !!item)
        : [],
    ]),
  ) as Record<string, MetaOption[]>
}

export async function getMetaQueues(tenantId: string) {
  const response = await get<RawCommonResponse>('/api/console/meta/queues', { tenantId })
  return Array.isArray(response.data)
    ? response.data
        .map((item) => normalizeOption(item))
        .filter((item): item is MetaOption => !!item)
    : []
}

export async function getMetaCalendars(tenantId: string) {
  const response = await get<RawCommonResponse>('/api/console/meta/calendars', { tenantId })
  return Array.isArray(response.data)
    ? response.data
        .map((item) => normalizeOption(item))
        .filter((item): item is MetaOption => !!item)
    : []
}

export async function getMetaWindows(tenantId: string) {
  const response = await get<RawCommonResponse>('/api/console/meta/windows', { tenantId })
  return Array.isArray(response.data)
    ? response.data
        .map((item) => normalizeOption(item))
        .filter((item): item is MetaOption => !!item)
    : []
}

export async function getMetaWorkerGroups(tenantId: string) {
  const response = await get<RawCommonResponse>('/api/console/meta/worker-groups', { tenantId })
  return Array.isArray(response.data)
    ? response.data
        .map((item) => normalizeOption(item))
        .filter((item): item is MetaOption => !!item)
    : []
}

export async function getMetaBizTypes(tenantId: string) {
  const response = await get<RawCommonResponse>('/api/console/meta/biz-types', { tenantId })
  return Array.isArray(response.data)
    ? response.data
        .map((item) => normalizeOption(item))
        .filter((item): item is MetaOption => !!item)
    : []
}
