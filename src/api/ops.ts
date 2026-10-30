import { apiClient, get, post, put } from '@/api/client'
import type { components } from '@/types/api.generated'
import { positiveLongId } from '@/utils/positiveLongId'

export type ConfigType =
  | 'JOB_DEFINITION'
  | 'WORKFLOW_DEFINITION'
  | 'FILE_CHANNEL'
  | 'FILE_TEMPLATE'
  | 'RESOURCE_QUEUE'
  | 'BATCH_WINDOW'
  | 'BUSINESS_CALENDAR'
  | 'QUOTA_POLICY'
  | 'ALERT_ROUTING'
import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

export type TenantConfigCopyRequest = components['schemas']['TenantConfigCopyRequest']
export type TenantConfigPreviewRequest = components['schemas']['TenantConfigPreviewRequest']
export type TenantConfigMatrixRequest = components['schemas']['TenantConfigMatrixRequest']
export type TenantConfigDiffPreviewResponse =
  components['schemas']['TenantConfigDiffPreviewResponse']
export type TenantConfigMatrixResponse = components['schemas']['TenantConfigMatrixResponse']
export type TenantConfigCopyResponse = components['schemas']['TenantConfigBatchInitResponse']

/** 运营概览 — GET /api/console/ops/summary?tenantId= */
export function getOpsSummary(tenantId: string) {
  return get<ConsoleOpsSummaryResponse>('/api/console/ops/summary', { tenantId })
}

/** GET /api/console/ops/governance */
export function listGovernanceParams(tenantId: string) {
  return get<unknown>('/api/console/ops/governance', { tenantId })
}

/** POST /api/console/ops/governance — 更新参数 */
export function updateGovernanceParam(tenantId: string, body: { key: string; value: string }) {
  return post<void>('/api/console/ops/governance', body, { params: { tenantId } })
}

/** POST /api/console/ops/governance/reset — 恢复默认值 */
export function resetGovernanceParam(tenantId: string, body: { key: string }) {
  return post<void>('/api/console/ops/governance/reset', body, { params: { tenantId } })
}

/** GET /api/console/ops/archive-policies */
export function listArchivePolicies(tenantId: string) {
  return get<unknown>('/api/console/ops/archive-policies', { tenantId })
}

/** PUT /api/console/ops/archive-policies */
export function upsertArchivePolicy(
  tenantId: string,
  body: {
    targetTable: string
    retentionDays: number
    archiveEnabled: boolean
    cleanupEnabled: boolean
    batchSize: number
    description?: string
  },
) {
  return put<void>('/api/console/ops/archive-policies', body, { params: { tenantId } })
}

/** ConfigType 枚举 → BE TenantConfigBatchInitRequest 顶层 List 字段名 */
const CONFIG_TYPE_TO_KEY: Record<ConfigType, string> = {
  JOB_DEFINITION: 'jobDefinitions',
  WORKFLOW_DEFINITION: 'workflowDefinitions',
  FILE_CHANNEL: 'fileChannels',
  FILE_TEMPLATE: 'fileTemplates',
  RESOURCE_QUEUE: 'resourceQueues',
  BATCH_WINDOW: 'batchWindows',
  BUSINESS_CALENDAR: 'businessCalendars',
  QUOTA_POLICY: 'quotaPolicies',
  ALERT_ROUTING: 'alertRoutings',
}

/**
 * POST /api/console/config/tenant-init
 *
 * BE TenantConfigBatchInitRequest 把各类配置直接放在顶层(jobDefinitions/workflowDefinitions/...)。
 * FE 调用方传 spec(完整 JSON 内容)+ 可选 configTypes(白名单)— 这里展开 spec 到顶层,
 * 并用 configTypes 过滤(若提供)。原先嵌在 spec 字段下,BE 反序列化时丢弃,初始化无效。
 */
export function batchInitTenantConfig(body: {
  targetTenantIds: string[]
  spec: Record<string, unknown>
  configTypes?: ConfigType[]
  mode?: 'SKIP_EXISTING' | 'UPSERT'
  dryRun?: boolean
}) {
  const { targetTenantIds, spec, configTypes, mode, dryRun } = body
  const allowedKeys = configTypes?.length
    ? new Set(configTypes.map((t) => CONFIG_TYPE_TO_KEY[t]))
    : null
  const flattened: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(spec)) {
    if (allowedKeys && !allowedKeys.has(k)) continue
    flattened[k] = v
  }
  // 手写配置正文不能覆盖界面已经选择的写入目标、覆盖模式或试运行边界。
  return post<TenantConfigCopyResponse>('/api/console/config/tenant-init', {
    ...flattened,
    targetTenantIds,
    mode,
    dryRun,
  })
}

/** GET /api/console/ops/kafka-lag */
export function getKafkaLag(_tenantId: string, groupId?: string) {
  return get<unknown>('/api/console/ops/kafka-lag', {
    ...(groupId ? { groupId } : {}),
  })
}

/** GET /api/console/ops/outbox/stats */
export function getOutboxStats(tenantId: string) {
  return get<unknown>('/api/console/ops/outbox/stats', { tenantId })
}

/** POST /api/console/ops/outbox/cleanup */
export function cleanupOutbox(tenantId: string, retainDays?: number) {
  return post<unknown>('/api/console/ops/outbox/cleanup', undefined, {
    params: { tenantId, ...(retainDays != null ? { retainDays } : {}) },
  })
}

/** 重投结果以服务端实际重置行数为准，不能将 HTTP 成功等同于事件已重置。 */
export interface OutboxRepublishResult {
  tenantId: string
  requestedCount: number
  resetCount: number
}

/** POST /api/console/ops/outbox/republish */
export async function republishOutbox(tenantId: string, eventIds: Array<number | string> = []) {
  const ids = eventIds.map(positiveLongId)
  if (!ids.length || ids.some((id) => id === null)) {
    throw new Error('Invalid outbox event ID')
  }
  // 仅拼接校验过的十进制整数，保留 JSON 数字契约和 64 位精度。
  const body = `[${ids.join(',')}]`
  const response = await apiClient.post<OutboxRepublishResult>(
    '/api/console/ops/outbox/republish',
    body,
    {
      params: { tenantId },
    },
  )
  return response.data
}

/** POST /api/console/config/tenant-copy */
export function copyTenantConfig(body: {
  sourceTenantId: string
  targetTenantIds: string[]
  configTypes?: ConfigType[]
  jobCodes?: string[]
  mode?: 'SKIP_EXISTING' | 'UPSERT'
  dryRun?: boolean
}) {
  return post<TenantConfigCopyResponse>('/api/console/config/tenant-copy', body)
}

/** POST /api/console/config/tenant-copy/preview */
export function previewTenantConfigCopy(body: TenantConfigPreviewRequest) {
  return post<TenantConfigDiffPreviewResponse>('/api/console/config/tenant-copy/preview', body)
}

/** POST /api/console/config/tenant-overlay/preview */
export function previewTenantConfigOverlay(body: TenantConfigPreviewRequest) {
  return post<TenantConfigDiffPreviewResponse>('/api/console/config/tenant-overlay/preview', body)
}

/** POST /api/console/config/tenant-config-matrix */
export function compareTenantJobConfigMatrix(body: TenantConfigMatrixRequest) {
  return post<TenantConfigMatrixResponse>('/api/console/config/tenant-config-matrix', body)
}
