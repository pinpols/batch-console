import { get, post } from '@/api/client'
import { toPageResult } from '@/api/adapters'
import type { ExecutionLog, PageResult } from '@/types'

export interface AlertQuery {
  tenantId?: string
  acknowledged?: boolean
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

/** 告警查询 DTO 与 ExecutionLog 不完全一致，列表页后续换专用类型 */
export const alertApi = {
  list: async (query: AlertQuery) => {
    const items = await get<ExecutionLog[]>('/api/console/query/alerts', {
      tenantId: query.tenantId,
    })
    return toPageResult(items, query.page, query.pageSize) as PageResult<ExecutionLog>
  },

  acknowledge: (_logId: number, _tenantId: string) =>
    Promise.reject(new Error('告警确认：对接审批/告警命令 API')),

  silence: (_logId: number, _tenantId: string, _minutes: number) =>
    Promise.reject(new Error('告警静默：待后端 API')),
}
