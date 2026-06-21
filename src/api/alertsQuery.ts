import { get } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type { PageResponse } from '@/types'
import type { ConsoleAlertEventResponse } from '@/types/console-api'

/**
 * 告警列表筛选维度。与后端 /api/console/queries/alerts 契约对齐(BE 2026-06-21 修正双向漂移):
 * severity / status / alertType / traceId 后端精确过滤;startDate / endDate 按 last_seen_at 范围。
 * 旧的 `acknowledged` 布尔已废弃 —— 直接传 `status` 的真值(OPEN/ACKED/SUPPRESSED/CLOSED)。
 */
export interface AlertQueryFilters {
  /** 严重级别精确过滤(severity enum) */
  severity?: string
  /** 告警状态精确过滤(alertStatus enum:OPEN/ACKED/SUPPRESSED/CLOSED) */
  status?: string
  /** 告警类型精确过滤 */
  alertType?: string
  /** traceId 精确过滤 */
  traceId?: string
  /** last_seen_at 范围起(ISO date 或 datetime) */
  startDate?: string
  /** last_seen_at 范围止(ISO date 或 datetime) */
  endDate?: string
}

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
 * @deprecated 端上全量聚合(大租户告警上万会卡 + 4000 截断);新代码用 queryAlertsPage 服务端分页。
 *             仅保留给过渡调用方。
 */
export function queryAlertsAll(tenantId: string, filters?: AlertQueryFilters) {
  return fetchAllPageItems<ConsoleAlertEventResponse>('/api/console/queries/alerts', {
    tenantId,
    ...toQuery(filters),
  })
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
