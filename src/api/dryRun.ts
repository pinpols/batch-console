/**
 * ADR-026 演练(dry-run)API。3 档:L1 CONFIG_VALIDATE / L2 SCHEDULE_PLAN / L3 EXECUTION_PLAN。
 * BE 端点 `POST /api/console/ops/dry-run/plan` 转发到 orchestrator,**不写 instance、不调外部投递**。
 *
 * 2026-05-21 联调发现:console-api 透传 orchestrator 响应时是「双层 CommonResponse 嵌套」。
 * client.ts 的 axios 拦截器只解一层外壳;内层仍是 `{code, message, data, meta}`。
 * 本 API 显式再解一层,FE 拿到 BE 真正的 `DryRunPlanResult`。
 */
import { post } from './client'
import type { components } from '@/types/api.generated'

export type DryRunPlanRequest = components['schemas']['DryRunPlanRequest']
export type DryRunLevel = NonNullable<DryRunPlanRequest['level']>

/**
 * 单条 finding。BE 实际字段(联调确认):
 *   { code, severity, scope, message, detail }
 * severity 是 PASS / WARN / ERROR 三态。
 */
export interface DryRunFinding {
  code: string
  severity: 'PASS' | 'WARN' | 'ERROR'
  scope: string
  message: string
  detail?: string | Record<string, unknown> | null
}

/** dry-run 计划响应。 */
export interface DryRunPlanResult {
  level: DryRunLevel
  success: boolean
  findings?: DryRunFinding[]
  /** L1/L2/L3 各自的 summary,字段视 level 不同;BE 透传任意 shape。 */
  summary?: Record<string, unknown>
  /** L2 / L3 输出的分区计划摘要(若 BE 返回)。 */
  schedulePlan?: Record<string, unknown>
  /** L3 探测结果(JdbcTemplate EXPLAIN / Minio bucketExists / HTTP HEAD)。 */
  probes?: DryRunFinding[]
  /** 未知字段透传,不解读。 */
  [k: string]: unknown
}

export const dryRunApi = {
  async plan(req: DryRunPlanRequest): Promise<DryRunPlanResult> {
    // console-api 已修正为单层 envelope:axios 拦截器解外层后,直接得到 DryRunPlanResult。
    // (此前 BE 双层嵌套是 bug,FE 这里多解一层;BE 修复后改回单层,否则 inner.code=undefined 必抛错。)
    const result = await post<DryRunPlanResult>('/api/console/ops/dry-run/plan', req)
    if (!result) {
      throw new Error('empty dry-run response')
    }
    return result
  },
}
