import { fetchAllPageItems, toPageResult } from '@/api/adapters'
import { get } from '@/api/client'
import { acknowledgeAlert, silenceAlert } from '@/api/alertsCommands'
import type { PageResponse, PageResult } from '@/types'
import type { ConsoleAlertActionResponse, ConsoleAlertEventResponse } from '@/types/console-api'

export interface AlertQuery {
  tenantId?: string
  /** true = non-OPEN, false = OPEN */
  acknowledged?: boolean
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
  page: number
  pageSize: number
}

/** 告警查询 DTO 与 ExecutionLog 不完全一致，列表页后续换专用类型 */
export const alertApi = {
  list: async (query: AlertQuery) => {
    const hasFilter = !!(query.acknowledged != null || query.startDate || query.endDate)

    if (!hasFilter) {
      const pr = await get<PageResponse<ConsoleAlertEventResponse>>('/api/console/queries/alerts', {
        tenantId: query.tenantId,
        pageNo: query.page,
        pageSize: query.pageSize,
      })
      return {
        records: (pr.items ?? []) as ConsoleAlertEventResponse[],
        total: pr.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      } as PageResult<ConsoleAlertEventResponse>
    }

    const items = await fetchAllPageItems<ConsoleAlertEventResponse>(
      '/api/console/queries/alerts',
      {
        tenantId: query.tenantId,
        ...(query.acknowledged != null ? { acknowledged: query.acknowledged } : {}),
        ...(query.startDate ? { startDate: query.startDate } : {}),
        ...(query.endDate ? { endDate: query.endDate } : {}),
      },
    )
    let rows = [...items]
    if (query.acknowledged === true) {
      rows = rows.filter((row) => String(row.status ?? '').toUpperCase() !== 'OPEN')
    } else if (query.acknowledged === false) {
      rows = rows.filter((row) => String(row.status ?? '').toUpperCase() === 'OPEN')
    }
    if (query.startDate) {
      rows = rows.filter((row) => String(row.createdAt ?? '') >= `${query.startDate}T00:00:00`)
    }
    if (query.endDate) {
      rows = rows.filter((row) => String(row.createdAt ?? '') <= `${query.endDate}T23:59:59`)
    }
    return toPageResult(rows, query.page, query.pageSize) as PageResult<ConsoleAlertEventResponse>
  },

  acknowledge: (logId: number, tenantId: string): Promise<ConsoleAlertActionResponse> =>
    acknowledgeAlert(logId, { tenantId, reason: 'legacy alertApi acknowledge' }),

  silence: (
    logId: number,
    tenantId: string,
    minutes: number,
  ): Promise<ConsoleAlertActionResponse> =>
    silenceAlert(logId, {
      tenantId,
      reason:
        minutes > 0 ? `legacy alertApi silence request (${minutes}m)` : 'legacy alertApi silence',
    }),
}
