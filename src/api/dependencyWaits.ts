import { get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type CalendarDependencyWait =
  components['schemas']['ConsoleCalendarDependencyWaitResponse']
export type JobDependencyWait = components['schemas']['ConsoleJobDependencyWaitResponse']
export type CalendarDependencyWaitManualAction =
  components['schemas']['CalendarDependencyWaitManualActionRequest']

export interface CalendarDependencyWaitQuery {
  tenantId: string
  calendarCode?: string
  waitStatus?: CalendarDependencyWait['waitStatus']
  limit?: number
}

export interface JobDependencyWaitQuery {
  tenantId: string
  jobCode?: string
  waitStatus?: JobDependencyWait['waitStatus']
  limit?: number
}

export function listCalendarDependencyWaits(query: CalendarDependencyWaitQuery) {
  return get<CalendarDependencyWait[]>('/api/console/calendar-dependency-waits', query)
}

export function listJobDependencyWaits(query: JobDependencyWaitQuery) {
  return get<JobDependencyWait[]>('/api/console/job-dependency-waits', query)
}

export function requestCalendarDependencyWaitAction(
  body: CalendarDependencyWaitManualAction,
  idempotencyKey: string,
) {
  return post<CalendarDependencyWait>('/api/console/calendar-dependency-waits/manual-action', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}
