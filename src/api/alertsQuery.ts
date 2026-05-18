import { fetchAllPageItems } from '@/api/adapters'
import type { ConsoleAlertEventResponse } from '@/types/console-api'

export interface AlertQueryFilters {
  /** true = non-OPEN, false = OPEN */
  acknowledged?: boolean
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
}

export function queryAlertsAll(tenantId: string, filters?: AlertQueryFilters) {
  return fetchAllPageItems<ConsoleAlertEventResponse>('/api/console/queries/alerts', {
    tenantId,
    ...(filters?.acknowledged != null ? { acknowledged: filters.acknowledged } : {}),
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
  })
}
