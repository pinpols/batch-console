import { get } from '@/api/client'
import { fetchAllPageItems, toPageResult } from '@/api/adapters'
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

function applyInstanceFilters(rows: ConsoleJobInstanceResponse[], query: InstanceQueryParams) {
  let r = [...rows]
  if (query.jobCode) {
    r = r.filter((x) => x.jobCode?.includes(query.jobCode!))
  }
  if (query.instanceStatus) {
    r = r.filter((x) => x.instanceStatus === query.instanceStatus)
  }
  if (query.startDate) {
    r = r.filter((x) => !x.startedAt || x.startedAt >= query.startDate!)
  }
  if (query.endDate) {
    r = r.filter((x) => !x.startedAt || x.startedAt <= `${query.endDate}T23:59:59`)
  }
  if (query.traceId) {
    r = r.filter((x) => x.traceId?.includes(query.traceId!))
  }
  return r
}

/**
 * GET /api/console/queries/instances — OpenAPI data 为 PageResponse（pageNo/pageSize）。
 * 无筛选时走服务端分页；有筛选时拉全量再端上分页（契约未声明 jobCode 等 query 参数）。
 */
export async function queryJobInstances(
  query: InstanceQueryParams,
): Promise<PageResult<ConsoleJobInstanceResponse>> {
  const hasFilter = !!(
    query.jobCode ||
    query.instanceStatus ||
    query.startDate ||
    query.endDate ||
    query.traceId
  )

  if (!hasFilter) {
    const pr = await get<PageResponse<ConsoleJobInstanceResponse>>(
      '/api/console/queries/instances',
      {
        tenantId: query.tenantId,
        pageNo: query.page,
        pageSize: query.pageSize,
      },
    )
    return {
      records: (pr.items ?? []) as ConsoleJobInstanceResponse[],
      total: pr.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  // 将过滤参数传给后端（后端支持时减少传输量，客户端 applyInstanceFilters 仍做兜底）
  const all = await fetchAllPageItems<ConsoleJobInstanceResponse>(
    '/api/console/queries/instances',
    {
      tenantId: query.tenantId,
      ...(query.jobCode ? { jobCode: query.jobCode } : {}),
      ...(query.instanceStatus ? { instanceStatus: query.instanceStatus } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
      ...(query.traceId ? { traceId: query.traceId } : {}),
    },
  )
  const filtered = applyInstanceFilters(all, query)
  return toPageResult(filtered, query.page, query.pageSize)
}
