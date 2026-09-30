import { get } from '@/api/client'
import type { PageResponse } from '@/types'
import type { operations } from '@/types/api.generated'
import type { ConsoleAlertEventResponse } from '@/types/console-api'

/**
 * 告警列表筛选维度。与后端 /api/console/queries/alerts 契约对齐(BE 2026-06-21 修正双向漂移):
 * severity / status / alertType / traceId 后端精确过滤;startDate / endDate 按 last_seen_at 范围。
 * 旧的 `acknowledged` 布尔已废弃 —— 直接传 `status` 的真值(OPEN/ACKED/SUPPRESSED/CLOSED)。
 */
type AlertQuery = NonNullable<operations['queryAlerts']['parameters']['query']>
export type AlertQueryFilters = Omit<AlertQuery, 'tenantId' | 'pageNo' | 'pageSize'>

function toQuery(filters?: AlertQueryFilters): Record<string, string> {
  return {
    ...(filters?.severity ? { severity: filters.severity } : {}),
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.alertType ? { alertType: filters.alertType } : {}),
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    ...(filters?.startDate ? { startDate: filters.startDate } : {}),
    ...(filters?.endDate ? { endDate: filters.endDate } : {}),
  }
}

/**
 * 服务端分页查询告警列表。severity / status / alertType / traceId / 时间范围全部由后端过滤
 * (BE 已支持全维度,前端不再做"当前页局部过滤")。
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
    ...toQuery(filters),
  })
}
