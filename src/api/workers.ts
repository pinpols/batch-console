import { get, post } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'

/** OpenAPI 为 PageResponse，聚合为列表供 Worker 页展示 */
export function queryWorkers(tenantId: string) {
  return fetchAllPageItems<ConsoleWorkerRegistryResponse>('/api/console/queries/workers', {
    tenantId,
  })
}

export function drainWorker(
  workerCode: string,
  body: { tenantId: string; timeoutSeconds?: number; reason?: string },
) {
  return post<ConsoleWorkerRegistryResponse>(
    `/api/console/workers/${encodeURIComponent(workerCode)}/drain`,
    body,
  )
}

export function forceWorkerOffline(
  workerCode: string,
  body: { tenantId: string; reason?: string },
) {
  return post<ConsoleWorkerRegistryResponse>(
    `/api/console/workers/${encodeURIComponent(workerCode)}/force-offline`,
    body,
  )
}

/** POST /api/console/workers/{workerCode}/takeover */
export function takeoverWorker(workerCode: string, body: { tenantId: string; reason?: string }) {
  return post<ConsoleWorkerRegistryResponse>(
    `/api/console/workers/${encodeURIComponent(workerCode)}/takeover`,
    body,
  )
}

/** GET /api/console/workers/{workerCode}/claimed-tasks */
export function getWorkerClaimedTasks(workerCode: string, tenantId: string) {
  return get<unknown>(`/api/console/workers/${encodeURIComponent(workerCode)}/claimed-tasks`, {
    tenantId,
  })
}

/** POST /api/console/workers/{workerCode}/warmup */
export function warmupWorker(workerCode: string, tenantId: string) {
  return post<unknown>(`/api/console/workers/${encodeURIComponent(workerCode)}/warmup`, undefined, {
    params: { tenantId },
  })
}
