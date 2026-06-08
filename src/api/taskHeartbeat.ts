/**
 * 任务心跳详情(`/api/console/tasks/{taskId}/heartbeat-details`,API-P3-1 / PR #228)。
 * worker 上报的 progress / checkpoint 快照,details 为 null 即"暂无心跳"。
 */
import { get } from '@/api/client'

export interface TaskHeartbeatDetails {
  taskId: number
  taskStatus: string
  /** worker 上报的进度/checkpoint 快照;null 表示该 task 尚未上报过带 details 的心跳 */
  details: Record<string, unknown> | null
  /** ISO-8601(可能为 null) */
  heartbeatAt: string | null
  cancelRequested: boolean
}

/**
 * GET /api/console/tasks/{taskId}/heartbeat-details
 *
 * @returns null 表示 404(task 不存在或不属于当前租户),便于调用方走"任务不可见"分支
 */
export async function getTaskHeartbeatDetails(
  taskId: number,
  tenantId?: string,
): Promise<TaskHeartbeatDetails | null> {
  try {
    // 必须显式带 tenantId query:该端点的租户守卫读 query 参数,只靠拦截器注的 X-Tenant-Id 头会 400「租户参数缺失」。
    const url = `/api/console/tasks/${encodeURIComponent(String(taskId))}/heartbeat-details`
    return await (tenantId
      ? get<TaskHeartbeatDetails>(url, { tenantId })
      : get<TaskHeartbeatDetails>(url))
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw err
  }
}

/**
 * 从 details 中提取常见 progress 进度百分比。SDK ProgressReporter 默认 key 是 `percent`(0-100)
 * 或 `progress`(0-100 / 0-1)。无可识别字段时返回 null,调用方走纯 JSON 展示。
 */
export function extractProgressPercent(
  details: Record<string, unknown> | null | undefined,
): number | null {
  if (!details) return null
  const candidates = ['percent', 'progress', 'progressPercent', 'percentage']
  for (const key of candidates) {
    const v = details[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      // 0-1 视为分数,放大到百分比;>1 当作 0-100。
      const pct = v <= 1 ? v * 100 : v
      if (pct >= 0 && pct <= 100) return Math.round(pct * 10) / 10
    }
  }
  return null
}
