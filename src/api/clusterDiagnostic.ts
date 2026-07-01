import { get } from '@/api/client'

/** GET /api/console/ops/cluster-diagnostic */
export function getClusterDiagnostic(tenantId: string) {
  return get<unknown>('/api/console/ops/cluster-diagnostic', { tenantId })
}

/** GET /api/console/ops/cluster-diagnostic/shedlock */
export function getShedLockStatus(tenantId: string) {
  return get<unknown>('/api/console/ops/cluster-diagnostic/shedlock', { tenantId })
}

/** GET /api/console/ops/cluster-diagnostic/workers */
export function getWorkerConsistency(tenantId: string) {
  return get<unknown>('/api/console/ops/cluster-diagnostic/workers', { tenantId })
}

/** GET /api/console/ops/cluster-diagnostic/outbox */
export function getOutboxHealth(tenantId: string) {
  return get<unknown>('/api/console/ops/cluster-diagnostic/outbox', { tenantId })
}

/** GET /api/console/ops/cluster-diagnostic/instances/{id} */
export function diagnoseJobInstance(instanceId: number, tenantId: string) {
  return get<Record<string, unknown>>(
    `/api/console/ops/cluster-diagnostic/instances/${instanceId}`,
    {
      tenantId,
    },
  )
}
