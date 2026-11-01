import { get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type CalendarDependencyWait = components['schemas']['ConsoleCalendarDependencyWaitResponse']
export type JobDependencyWait = components['schemas']['ConsoleJobDependencyWaitResponse']
export type WaitRelationship = components['schemas']['ConsoleWaitRelationshipItem']
export type WaitRelationshipPage = components['schemas']['ConsoleWaitRelationshipPage']
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

export function listWaitRelationships(
  query: {
    tenantId: string
    waitType?: WaitRelationship['waitType']
    waitStatus?: string
    bizDateFrom?: string
    bizDateTo?: string
    cursorType?: WaitRelationship['waitType']
    cursorId?: string
    pageSize?: number
  },
  signal?: AbortSignal,
) {
  return get<WaitRelationshipPage>('/api/console/ops/wait-relationships', query, { signal })
}

export function requestCalendarDependencyWaitAction(
  body: CalendarDependencyWaitManualAction,
  idempotencyKey: string,
) {
  return post<CalendarDependencyWait>(
    '/api/console/calendar-dependency-waits/manual-action',
    body,
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  )
}
