import { get } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type { PageResponse } from '@/types'
import type { ConsoleAlertEventResponse } from '@/types/console-api'

export interface AlertQueryFilters {
  /** true = non-OPEN, false = OPEN */
  acknowledged?: boolean
  /** ISO date range start */
  startDate?: string
  /** ISO date range end */
  endDate?: string
  /** exact match */
  traceId?: string
}

/**
 * @deprecated 全量拉回前端切片,大租户告警上万会卡;新代码用 queryAlertsPage(服务端分页)。
 *             仅保留给已有调用方过渡。
 */
export function queryAlertsAll(tenantId: string, filters?: AlertQueryFilters) {
  return fetchAllPageItems<ConsoleAlertEventResponse>('/api/console/queries/alerts', {
    tenantId,
    ...(filters?.acknowledged != null ? { acknowledged: filters.acknowledged } : {}),
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
  })
}

/**
 * 服务端分页查询告警列表。BE 仅支持 acknowledged / startDate / endDate 三个过滤维度,
 * severity / alertType / status / traceId 等客户端过滤需在调用方按当前页结果上做(局部过滤),
 * 不可在端上做"跨页全量过滤"——大租户量级会卡爆。
 */
export function queryAlertsPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: AlertQueryFilters,
): Promise<PageResponse<ConsoleAlertEventResponse>> {
  return get<PageResponse<ConsoleAlertEventResponse>>('/api/console/queries/alerts', {
    tenantId,
    pageNo,
    pageSize,
    ...(filters?.acknowledged != null ? { acknowledged: filters.acknowledged } : {}),
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
  })
}
