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

/** POST /api/console/config/tenant-init */
export function batchInitTenantConfig(body: {
  targetTenantIds: string[]
  spec: Record<string, unknown>
  configTypes?: ConfigType[]
  mode?: 'SKIP_EXISTING' | 'UPSERT'
  dryRun?: boolean
}) {
  return post<unknown>('/api/console/config/tenant-init', body)
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
