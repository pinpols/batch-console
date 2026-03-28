import { get } from '@/api/client'
import type { JobInstance, PageResult } from '@/types'

export interface InstanceQueryParams {
  tenantId: string
  jobCode?: string
  instanceStatus?: string
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

/** GET /api/console/query/instances — OpenAPI 当前 data 为数组，此处做前端分页与筛选。 */
export async function queryJobInstances(query: InstanceQueryParams): Promise<PageResult<JobInstance>> {
  const items = await get<JobInstance[]>('/api/console/query/instances', {
    tenantId: query.tenantId,
  })

  let rows = [...items]
  if (query.jobCode) {
    rows = rows.filter((r) => r.jobCode?.includes(query.jobCode))
  }
  if (query.instanceStatus) {
    rows = rows.filter((r) => r.instanceStatus === query.instanceStatus)
  }
  if (query.startDate) {
    rows = rows.filter((r) => !r.startedAt || r.startedAt >= query.startDate!)
  }
  if (query.endDate) {
    rows = rows.filter((r) => !r.startedAt || r.startedAt <= `${query.endDate}T23:59:59`)
  }

  const total = rows.length
  const start = (query.page - 1) * query.pageSize
  const records = rows.slice(start, start + query.pageSize)

  return {
    records,
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}
