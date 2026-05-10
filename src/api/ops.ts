import { get, post, put } from '@/api/client'

export type ConfigType =
  | 'JOB_DEFINITION'
  | 'WORKFLOW_DEFINITION'
  | 'PIPELINE_DEFINITION'
  | 'FILE_CHANNEL'
  | 'FILE_TEMPLATE'
  | 'RESOURCE_QUEUE'
  | 'BATCH_WINDOW'
  | 'BUSINESS_CALENDAR'
  | 'QUOTA_POLICY'
  | 'ALERT_ROUTING'
import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

/** 运营概览 — GET /api/console/ops/summary?tenantId= */
export function getOpsSummary(tenantId: string) {
  return get<ConsoleOpsSummaryResponse>('/api/console/ops/summary', { tenantId })
}

/** GET /api/console/ops/governance */
export function listGovernanceParams(tenantId: string) {
  return get<unknown>('/api/console/ops/governance', { tenantId })
}

/** POST /api/console/ops/governance — update a parameter */
export function updateGovernanceParam(tenantId: string, body: { key: string; value: string }) {
  return post<void>('/api/console/ops/governance', body, { params: { tenantId } })
}

/** POST /api/console/ops/governance/reset — reset to default */
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
  PIPELINE_DEFINITION: 'pipelineDefinitions',
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
  const flattened: Record<string, unknown> = { targetTenantIds, mode, dryRun }
  for (const [k, v] of Object.entries(spec)) {
    if (allowedKeys && !allowedKeys.has(k)) continue
    flattened[k] = v
  }
  return post<unknown>('/api/console/config/tenant-init', flattened)
}

/** GET /api/console/ops/summary/events — SSE stream */
export function getOpsSummaryEvents(tenantId: string) {
  return get<unknown>('/api/console/ops/summary/events', { tenantId })
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

/** POST /api/console/ops/outbox/republish */
export function republishOutbox(tenantId: string, eventIds?: number[]) {
  return post<unknown>('/api/console/ops/outbox/republish', eventIds ?? [], {
    params: { tenantId },
  })
}

/** POST /api/console/config/tenant-copy */
export function copyTenantConfig(body: {
  sourceTenantId: string
  targetTenantIds: string[]
  configTypes?: ConfigType[]
  mode?: 'SKIP_EXISTING' | 'UPSERT'
  dryRun?: boolean
}) {
  return post<unknown>('/api/console/config/tenant-copy', body)
}
