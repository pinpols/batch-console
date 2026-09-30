import { get, post } from '@/api/client'
import type { AxiosRequestConfig } from 'axios'
import type {
  ConsoleSchedulerSnapshotHistoryResponse,
  ConsoleSchedulerSnapshotResponse,
  SchedulerCommandResponse,
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
export function getSchedulerStatus(silent = false) {
  const config = silent ? ({ _silent: true } as AxiosRequestConfig) : undefined
  return get<SchedulerCommandResponse>('/api/console/scheduler/status', undefined, config)
}

/** POST /api/console/scheduler/pause-all */
export function pauseAllSchedulers() {
  return post<SchedulerCommandResponse>('/api/console/scheduler/pause-all', undefined)
}

/** POST /api/console/scheduler/resume-all */
export function resumeAllSchedulers() {
  return post<SchedulerCommandResponse>('/api/console/scheduler/resume-all', undefined)
}
