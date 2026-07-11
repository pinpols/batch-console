/**
 * ADR-020 批次日重放 API。5 个端点:submit / approve / cancel / detail / list-entries。
 * BE 转发到 orchestrator,Console 角色门:
 *   - submit / cancel / detail / entries:ADMIN + TENANT_ADMIN(本租户范围由 BE 校验)
 *   - approve:仅 ADMIN(审批人需要独立于 submit 人)
 *
 * 2026-05-21 联调发现:console-api 透传 orchestrator 响应时是「双层 CommonResponse 嵌套」,
 * client.ts 拦截器只解一层外壳;本 API 手动再解一层。
 */
import { get, post } from './client'
import type { components } from '@/types/api.generated'

export type BatchDayReplaySubmitRequest = components['schemas']['BatchDayReplaySubmitRequest']
export type BatchDayReplayPreview = components['schemas']['BatchDayReplayPreview']
export type BatchDayReplayScope = BatchDayReplaySubmitRequest['scope']
export type ResultPolicy = NonNullable<BatchDayReplaySubmitRequest['resultPolicy']>
export type ConfigVersionPolicy = NonNullable<BatchDayReplaySubmitRequest['configVersionPolicy']>

/** Entry 状态(BE 枚举;生成 schema 里 status 是 string,保留字面量联合供筛选参数)。 */
export type ReplayEntryStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED'

// #801-804 Map 收敛后 BE 暴露真 schema(已逐字段对照 orchestrator BatchDayReplaySessionEntity):
// 计数字段是 totalCount/succeededCount/failedCount/inFlightCount,完成时间是 completedAt。
// 此前手写 shape 猜的 totalEntries/succeededEntries/finishedAt/jobCodes/versionIds/cancelledBy
// 在 wire 上从不存在(读到 undefined 静默显 0),统一切生成类型。
export type BatchDayReplaySession = components['schemas']['BatchDayReplaySession']
export type BatchDayReplayEntry = components['schemas']['BatchDayReplayEntry']

/** 内层 envelope shape(console-api 透传 orchestrator 的 CommonResponse)。 */
interface InnerEnvelope<T> {
  code: string
  message: string
  data: T | null
  meta?: unknown
}

function unwrap<T>(env: InnerEnvelope<T> | null | undefined): T {
  if (!env) throw new Error('empty response')
  if (env.code !== 'SUCCESS') throw new Error(env.message || env.code)
  if (env.data == null) throw new Error('response missing data')
  return env.data
}

export const batchDayReplayApi = {
  async preview(req: BatchDayReplaySubmitRequest): Promise<BatchDayReplayPreview> {
    return unwrap(
      await post<InnerEnvelope<BatchDayReplayPreview>>(
        '/api/console/ops/batch-day-replay/sessions/preview',
        req,
      ),
    )
  },
  async submit(req: BatchDayReplaySubmitRequest): Promise<BatchDayReplaySession> {
    return unwrap(
      await post<InnerEnvelope<BatchDayReplaySession>>(
        '/api/console/ops/batch-day-replay/sessions',
        req,
      ),
    )
  },
  async approve(
    sessionId: number,
    approver: string,
    tenantId?: string,
  ): Promise<BatchDayReplaySession> {
    const qs = new URLSearchParams({ approver })
    if (tenantId) qs.set('tenantId', tenantId)
    return unwrap(
      await post<InnerEnvelope<BatchDayReplaySession>>(
        `/api/console/ops/batch-day-replay/sessions/${sessionId}/approve?${qs.toString()}`,
        null,
      ),
    )
  },
  async cancel(sessionId: number, tenantId?: string): Promise<BatchDayReplaySession> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return unwrap(
      await post<InnerEnvelope<BatchDayReplaySession>>(
        `/api/console/ops/batch-day-replay/sessions/${sessionId}/cancel${qs}`,
        null,
      ),
    )
  },
  async detail(sessionId: number, tenantId?: string): Promise<BatchDayReplaySession> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    return unwrap(
      await get<InnerEnvelope<BatchDayReplaySession>>(
        `/api/console/ops/batch-day-replay/sessions/${sessionId}${qs}`,
      ),
    )
  },
  async entries(
    sessionId: number,
    opts: { status?: ReplayEntryStatus; limit?: number; tenantId?: string } = {},
  ): Promise<BatchDayReplayEntry[]> {
    const qs = new URLSearchParams()
    if (opts.status) qs.set('status', opts.status)
    if (opts.limit != null) qs.set('limit', String(opts.limit))
    if (opts.tenantId) qs.set('tenantId', opts.tenantId)
    const suffix = qs.toString() ? `?${qs}` : ''
    return unwrap(
      await get<InnerEnvelope<BatchDayReplayEntry[]>>(
        `/api/console/ops/batch-day-replay/sessions/${sessionId}/entries${suffix}`,
      ),
    )
  },
}
