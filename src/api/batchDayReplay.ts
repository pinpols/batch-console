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
export type BatchDayReplayScope = BatchDayReplaySubmitRequest['scope']
export type ResultPolicy = NonNullable<BatchDayReplaySubmitRequest['resultPolicy']>
export type ConfigVersionPolicy = NonNullable<BatchDayReplaySubmitRequest['configVersionPolicy']>

/** Session 状态(对齐 BE 枚举)。 */
export type ReplaySessionStatus =
  | 'PENDING_APPROVAL'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

/** Session 实体(BE 返回 Object,这里给 FE 预期 shape)。 */
export interface BatchDayReplaySession {
  id: number
  tenantId: string
  calendarCode: string
  bizDate: string
  scope: BatchDayReplayScope
  jobCodes?: string[]
  versionIds?: number[]
  resultPolicy: ResultPolicy
  configVersionPolicy: ConfigVersionPolicy
  status: ReplaySessionStatus
  requestedBy: string
  approvedBy?: string
  cancelledBy?: string
  reason: string
  totalEntries?: number
  succeededEntries?: number
  failedEntries?: number
  pendingEntries?: number
  createdAt: string
  updatedAt?: string
  finishedAt?: string
}

/** Session entry(实例进度)。 */
export interface BatchDayReplayEntry {
  id: number
  sessionId: number
  jobCode: string
  bizDate: string
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'
  newInstanceId?: number
  newVersionId?: number
  failureReason?: string
  updatedAt?: string
}

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
    opts: { status?: BatchDayReplayEntry['status']; limit?: number; tenantId?: string } = {},
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
