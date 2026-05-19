import { get } from '@/api/client'

export interface CronPreviewResult {
  expr: string
  valid: boolean
  error: string | null
  nextRuns: string[]
  timezone: string | null
}

/**
 * GET /api/console/system/cron-preview — 用 BE Quartz CronExpression 校验 + 计算下 N 次执行
 *
 * 与真实调度引擎同一份代码,FE 拿到的时间与触发完全一致。FE 仅负责
 * 输入防抖 + 友好展示。
 */
export async function previewCron(expr: string, count = 3): Promise<CronPreviewResult> {
  const data = await get<CronPreviewResult>('/api/console/system/cron-preview', { expr, count })
  return data
}
