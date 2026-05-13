import { get } from '@/api/client'
import type { ConsoleJobInstanceResponse } from '@/types/console-api'
import type { PageResponse, PageResult } from '@/types'

export interface InstanceQueryParams {
  tenantId: string
  /** partial match */
  jobCode?: string
  /** exact match */
  instanceStatus?: string
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
  /** partial match */
  traceId?: string
  page: number
  pageSize: number
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
    ...(query.instanceStatus ? { instanceStatus: query.instanceStatus } : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
    ...(query.traceId ? { traceId: query.traceId } : {}),
  })
  return {
    records: (pr.items ?? []) as ConsoleJobInstanceResponse[],
    total: pr.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}
