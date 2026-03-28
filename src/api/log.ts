import { get, post } from '@/api/client'
import { toPageResult } from '@/api/adapters'
import type { ExecutionLog, PageResult } from '@/types'

export interface LogQuery {
  tenantId?: string
  jobInstanceId?: number
  traceId?: string
  logLevel?: string
  logType?: string
  keyword?: string
  startTime?: string
  endTime?: string
  page: number
  pageSize: number
}

export interface AlertQuery {
  tenantId?: string
  acknowledged?: boolean
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

export const logApi = {
  list: async (query: LogQuery) => {
    const items = await get<ExecutionLog[]>('/api/console/query/audits', { tenantId: query.tenantId })
    return toPageResult(items, query.page, query.pageSize) as PageResult<ExecutionLog>
  },

  alerts: async (query: AlertQuery) => {
    const items = await get<ExecutionLog[]>('/api/console/query/alerts', { tenantId: query.tenantId })
    return toPageResult(items, query.page, query.pageSize) as PageResult<ExecutionLog>
  },

  acknowledge: (_logId: number, _tenantId: string) =>
    Promise.reject(new Error('请使用告警/审批命令 API')),

  silence: (_logId: number, _tenantId: string, _minutes: number) =>
    Promise.reject(new Error('请使用告警命令 API')),
}
