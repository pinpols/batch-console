import { get } from '@/api/client'
import type { ConsoleJobInstanceResponse } from '@/types/console-api'
import type { PageResponse, PageResult } from '@/types'

export interface InstanceQueryParams {
  tenantId: string
  /** partial match */
  jobCode?: string
  /** exact match,instanceStatuses 非空时被忽略 */
  instanceStatus?: string
  /** CSV 多状态(如 "FAILED,PARTIAL_FAILED"),优先于 instanceStatus 单值 */
  instanceStatuses?: string
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
  /** partial match */
  traceId?: string
  /** SLA 违约过滤:服务端按 deadline_at<now AND active status 判定 */
  slaBreached?: boolean
  page: number
  pageSize: number
  /**
   * 双轨分页(ADR-031):cursor 非空时 BE 走 cursor 模式,响应里 total/pageNo 为 0,
   * 看 nextCursor + hasMore。FE 通常通过 usePagination 间接传入。
   */
  cursor?: string | null
}

/**
 * GET /api/console/queries/instances — 服务端分页 + 服务端过滤。
 * 后端 JobInstanceMapper 支持 jobCode/instanceStatus/startDate/endDate/traceId 全部过滤。
 */
export async function queryJobInstances(
  query: InstanceQueryParams,
): Promise<PageResult<ConsoleJobInstanceResponse>> {
  const pr = await get<PageResponse<ConsoleJobInstanceResponse>>('/api/console/queries/instances', {
    tenantId: query.tenantId,
    pageNo: query.page,
    pageSize: query.pageSize,
    ...(query.jobCode ? { jobCode: query.jobCode } : {}),
    ...(query.instanceStatuses
      ? { instanceStatuses: query.instanceStatuses }
      : query.instanceStatus
        ? { instanceStatus: query.instanceStatus }
        : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
    ...(query.traceId ? { traceId: query.traceId } : {}),
    ...(query.slaBreached ? { slaBreached: true } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  })
  return {
    records: (pr.items ?? []) as ConsoleJobInstanceResponse[],
    total: pr.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    nextCursor: pr.nextCursor ?? null,
    hasMore: pr.hasMore ?? (pr.total != null && query.page * query.pageSize < pr.total),
  }
}
