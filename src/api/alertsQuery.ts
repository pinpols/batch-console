import { fetchAllPageItems } from '@/api/adapters'
import { get } from '@/api/client'
import type { ConsoleAlertEventResponse } from '@/types/console-api'
import type { PageResponse } from '@/types'

export interface AlertQueryFilters {
  /** true = non-OPEN, false = OPEN */
  acknowledged?: boolean
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
}

/** GET /api/console/queries/alerts — OpenAPI data 为 PageResponse */
export function queryAlertsPaged(tenantId: string, pageNo: number, pageSize: number) {
  return get<PageResponse<ConsoleAlertEventResponse>>('/api/console/queries/alerts', {
    tenantId,
    pageNo,
    pageSize,
  })
}

export function queryAlertsAll(tenantId: string, filters?: AlertQueryFilters) {
  return fetchAllPageItems<ConsoleAlertEventResponse>('/api/console/queries/alerts', {
    tenantId,
    ...(filters?.acknowledged != null ? { acknowledged: filters.acknowledged } : {}),
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
  })
}
