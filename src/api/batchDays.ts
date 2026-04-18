import { get, post } from '@/api/client'
import type { PageResponse } from '@/types'
import type {
  BatchDayCatchUpRequest,
  ConsoleBatchDayCatchUpResponse,
  ConsoleBatchDayResponse,
  ConsoleBatchDayWindowResponse,
} from '@/types/console-api'

export interface BatchDayListParams {
  tenantId: string
  calendarCode: string
  from?: string
  to?: string
  pageNo: number
  pageSize: number
}

/** GET /api/console/queries/batch-days — 分页，data 为 PageResponse */
export function queryBatchDays(params: BatchDayListParams) {
  return get<PageResponse<ConsoleBatchDayResponse>>('/api/console/queries/batch-days', {
    tenantId: params.tenantId,
    calendarCode: params.calendarCode,
    from: params.from,
    to: params.to,
    pageNo: params.pageNo,
    pageSize: params.pageSize,
  })
}

/** GET /api/console/queries/batch-days/{bizDate}/window */
export function queryBatchDayWindow(tenantId: string, calendarCode: string, bizDate: string) {
  return get<ConsoleBatchDayWindowResponse>(
    `/api/console/queries/batch-days/${encodeURIComponent(bizDate)}/window`,
    { tenantId, calendarCode },
  )
}

/** POST /api/console/jobs/batch-days/{bizDate}/catchup */
export function launchBatchDayCatchUp(bizDate: string, body: BatchDayCatchUpRequest) {
  return post<ConsoleBatchDayCatchUpResponse>(
    `/api/console/jobs/batch-days/${encodeURIComponent(bizDate)}/catchup`,
    body,
  )
}
