import { get, post } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type {
  ConsoleConfigReleaseResponse,
  ConsoleConfigChangeLogResponse,
  ConsoleSecretVersionResponse,
} from '@/types/console-api'

export function listConfigReleases(tenantId: string) {
  return get<ConsoleConfigReleaseResponse[]>('/api/console/config/releases', { tenantId })
}

/** POST /api/console/config/releases — create a config release */
export function createConfigRelease(body: {
  tenantId: string
  configType?: string
  configCode?: string
  releaseNote?: string
}) {
  return post<number>('/api/console/config/releases', body)
}

export function publishRelease(
  releaseId: number,
  body: { tenantId: string; operatorId?: string; reason?: string; traceId?: string },
) {
  return post<string>(`/api/console/config/releases/${releaseId}/publish`, body)
}

export function grayRelease(
  releaseId: number,
  body: {
    tenantId: string
    operatorId?: string
    reason?: string
    grayScopeJson?: string
  },
) {
  return post<string>(`/api/console/config/releases/${releaseId}/gray`, body)
}

export function rollbackRelease(
  releaseId: number,
  body: { tenantId: string; operatorId?: string; reason?: string; traceId?: string },
) {
  return post<string>(`/api/console/config/releases/${releaseId}/rollback`, body)
}

/** GET /api/console/config/releases/{releaseId} */
export function getConfigRelease(releaseId: number, tenantId: string) {
  return get<ConsoleConfigReleaseResponse>(`/api/console/config/releases/${releaseId}`, {
    tenantId,
  })
}

/** GET /api/console/config/change-logs */
export function listConfigChangeLogs(tenantId: string) {
  return fetchAllPageItems<ConsoleConfigChangeLogResponse>('/api/console/config/change-logs', {
    tenantId,
  })
}

/** GET /api/console/config/secrets */
export function listSecrets(tenantId: string) {
  return fetchAllPageItems<ConsoleSecretVersionResponse>('/api/console/config/secrets', {
    tenantId,
  })
}

/** GET /api/console/config/secrets/{secretVersionId} */
export function getSecretVersion(secretVersionId: number, tenantId: string) {
  return get<ConsoleSecretVersionResponse>(`/api/console/config/secrets/${secretVersionId}`, {
    tenantId,
  })
}

/** POST /api/console/config/secrets/rotate */
export function rotateSecret(body: { tenantId: string; secretRef: string; reason?: string }) {
  return post<string>('/api/console/config/secrets/rotate', body)
}

/** GET /api/console/config/dependencies?tenantId=&configType=&configCode= */
export function listConfigDependencies(tenantId: string, configType: string, configCode: string) {
  return get<unknown>('/api/console/config/dependencies', { tenantId, configType, configCode })
}

/** GET /api/console/config/releases/diff?tenantId=&releaseIdA=&releaseIdB= */
export function diffConfigReleases(tenantId: string, releaseIdA: number, releaseIdB: number) {
  return get<unknown>('/api/console/config/releases/diff', { tenantId, releaseIdA, releaseIdB })
}

/** GET /api/console/config/releases/{releaseId}/approval — get approval detail */
export function getReleaseApproval(releaseId: number, tenantId: string) {
  return get<unknown>(`/api/console/config/releases/${releaseId}/approval`, { tenantId })
}

/** POST /api/console/config/releases/{releaseId}/submit-approval — submit for approval */
export function submitReleaseApproval(
  releaseId: number,
  body: { tenantId: string; operatorId?: string; reason?: string },
) {
  return post<string>(`/api/console/config/releases/${releaseId}/submit-approval`, body)
}

/** POST /api/console/config/approvals/{approvalId}/approve */
export function approveConfigApproval(
  approvalId: number,
  body: { tenantId: string; operatorId?: string; reason?: string },
) {
  return post<string>(`/api/console/config/approvals/${approvalId}/approve`, body)
}

/** POST /api/console/config/approvals/{approvalId}/reject */
export function rejectConfigApproval(
  approvalId: number,
  body: { tenantId: string; operatorId?: string; reason?: string },
) {
  return post<string>(`/api/console/config/approvals/${approvalId}/reject`, body)
}

/** POST /api/console/config/sync/export */
export function exportConfigSync(body: { tenantId: string; configTypes?: string[] }) {
  return post<unknown>('/api/console/config/sync/export', body)
}

/** POST /api/console/config/sync/preview */
export function previewConfigSync(body: { tenantId: string; payload: unknown }) {
  return post<unknown>('/api/console/config/sync/preview', body)
}

/** POST /api/console/config/sync/import */
export function importConfigSync(body: { tenantId: string; payload: unknown; mode?: string }) {
  return post<unknown>('/api/console/config/sync/import', body)
}

/** GET /api/console/config/sync/logs */
export function listConfigSyncLogs(tenantId: string) {
  return get<unknown>('/api/console/config/sync/logs', { tenantId })
}
