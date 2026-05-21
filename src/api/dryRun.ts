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

/** 内层 envelope shape(console-api 透传 orchestrator 的 CommonResponse)。 */
interface InnerEnvelope<T> {
  code: string
  message: string
  data: T | null
  meta?: unknown
}

export const dryRunApi = {
  async plan(req: DryRunPlanRequest): Promise<DryRunPlanResult> {
    const inner = await post<InnerEnvelope<DryRunPlanResult>>('/api/console/ops/dry-run/plan', req)
    // 双层 envelope:外层 axios 拦截器已解,内层手动解
    if (!inner) {
      throw new Error('empty dry-run response')
    }
    if (inner.code !== 'SUCCESS') {
      throw new Error(inner.message || 'dry-run failed: ' + inner.code)
    }
    if (!inner.data) {
      throw new Error('dry-run response missing data')
    }
    return inner.data
  },
}
