import { get, post } from '@/api/client'
import type {
  ConsoleSchedulerSnapshotHistoryResponse,
  ConsoleSchedulerSnapshotResponse,
} from '@/types/console-api'

export function getSchedulerSnapshot(tenantId: string) {
  return get<ConsoleSchedulerSnapshotResponse>('/api/console/scheduler/snapshot', { tenantId })
}

export function getSchedulerSnapshotHistory(tenantId: string, limit?: number) {
  return get<ConsoleSchedulerSnapshotHistoryResponse[]>('/api/console/scheduler/snapshot/history', {
    tenantId,
    ...(limit != null ? { limit } : {}),
  })
}

/** GET /api/console/scheduler/status */
export function getSchedulerStatus(tenantId: string) {
  return get<unknown>('/api/console/scheduler/status', { tenantId })
}

/** POST /api/console/scheduler/pause-all */
export function pauseAllSchedulers() {
  return post<string>('/api/console/scheduler/pause-all', undefined)
}

/** POST /api/console/scheduler/resume-all */
export function resumeAllSchedulers() {
  return post<string>('/api/console/scheduler/resume-all', undefined)
}
