/**
 * ADR-020 批次日重放 API。端点: list / submit / approve / cancel / detail / list-entries。
 * BE 转发到 orchestrator,Console 角色门:
 *   - submit / cancel / detail / entries:ADMIN + TENANT_ADMIN(本租户范围由 BE 校验)
 *   - approve:仅 ADMIN(审批人需要独立于 submit 人)
 *
 * 2026-05-21 联调发现:console-api 透传 orchestrator 响应时是「双层 CommonResponse 嵌套」,
 * client.ts 拦截器只解一层外壳;本 API 手动再解一层。
 */
import type { AxiosRequestConfig } from 'axios'
import { get, post } from './client'
import type { components } from '@/types/api.generated'
import { createIdempotencyKey } from '@/utils/idempotency'

export type BatchDayReplaySubmitRequest = components['schemas']['BatchDayReplaySubmitRequest']
export type BatchDayReplayPreview = components['schemas']['BatchDayReplayPreview']
export type BatchDayReplayRangeRequest = components['schemas']['BatchDayReplayRangeRequest']
export type ReplayOperationPreview = components['schemas']['ReplayOperationPreview']
export type ReplayOperation = components['schemas']['ReplayOperation']
export type BatchDayReplayScope = BatchDayReplaySubmitRequest['scope']
export type ReplayExecutionMode = NonNullable<BatchDayReplaySubmitRequest['executionMode']>
export type ReplayCandidateSource = NonNullable<BatchDayReplaySubmitRequest['candidateSource']>
export type ResultPolicy = NonNullable<BatchDayReplaySubmitRequest['resultPolicy']>
export type ConfigVersionPolicy = NonNullable<BatchDayReplaySubmitRequest['configVersionPolicy']>
export type ResultVersion = components['schemas']['ResultVersion']

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

function unwrap<T>(env: InnerEnvelope<T> | T | null | undefined): T {
  if (!env) throw new Error('empty response')
  if (typeof env === 'object' && 'code' in env) {
    const envelope = env as InnerEnvelope<T>
    if (envelope.code !== 'SUCCESS') throw new Error(envelope.message || envelope.code)
    if (envelope.data == null) throw new Error('response missing data')
    return envelope.data
  }
  // 共享 Axios 拦截器已拆开 Console CommonResponse。
  return env as T
}

export const batchDayReplayApi = {
  async resultVersions(
    tenantId: string,
    businessKey: string,
    limit = 50,
  ): Promise<ResultVersion[]> {
    const response = await get<InnerEnvelope<ResultVersion[]>>('/api/console/result-versions', {
      tenantId,
      businessKey,
      limit,
    })
    return unwrap(response)
  },
  async effectiveResultVersion(
    tenantId: string,
    businessKey: string,
  ): Promise<ResultVersion | null> {
    const response = await get<InnerEnvelope<ResultVersion | null> | ResultVersion | null>(
      '/api/console/result-versions/effective',
      { tenantId, businessKey },
      { _silent: true } as AxiosRequestConfig & { _silent: boolean },
    )
    if (response && typeof response === 'object' && 'code' in response) {
      const envelope = response as InnerEnvelope<ResultVersion | null>
      if (envelope.code !== 'SUCCESS') throw new Error(envelope.message || envelope.code)
      return envelope.data
    }
    return response as ResultVersion | null
  },
  async resultVersionDetail(id: number, tenantId: string): Promise<ResultVersion> {
    const response = await get<InnerEnvelope<ResultVersion>>(
      `/api/console/result-versions/${id}?tenantId=${encodeURIComponent(tenantId)}`,
    )
    return unwrap(response)
  },
  async promoteResultVersion(id: number, tenantId: string): Promise<ResultVersion> {
    return this.resultVersionAction(id, tenantId, 'promote')
  },
  async rejectResultVersion(id: number, tenantId: string): Promise<ResultVersion> {
    return this.resultVersionAction(id, tenantId, 'reject')
  },
  async resultVersionAction(
    id: number,
    tenantId: string,
    action: 'promote' | 'reject',
  ): Promise<ResultVersion> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const response = await post<InnerEnvelope<ResultVersion>>(
      `/api/console/result-versions/${id}/${action}?tenantId=${encodeURIComponent(tenantId)}`,
      undefined,
      config,
    )
    return unwrap(response)
  },
  async preview(req: BatchDayReplaySubmitRequest): Promise<BatchDayReplayPreview> {
    const response = await post<InnerEnvelope<BatchDayReplayPreview>>(
      '/api/console/ops/batch-day-replay/sessions/preview',
      req,
    )
    return unwrap(response)
  },
  async previewRange(req: BatchDayReplayRangeRequest): Promise<ReplayOperationPreview> {
    const response = await post<InnerEnvelope<ReplayOperationPreview>>(
      '/api/console/ops/batch-day-replay/operations/date-range/preview',
      req,
    )
    return unwrap(response)
  },
  async submit(req: BatchDayReplaySubmitRequest): Promise<BatchDayReplaySession> {
    const response = await post<InnerEnvelope<BatchDayReplaySession>>(
      '/api/console/ops/batch-day-replay/sessions',
      req,
    )
    return unwrap(response)
  },
  async submitRange(req: BatchDayReplayRangeRequest): Promise<ReplayOperation> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const response = await post<InnerEnvelope<ReplayOperation>>(
      '/api/console/ops/batch-day-replay/operations/date-range',
      req,
      config,
    )
    return unwrap(response)
  },
  async resolveRangeSubmitOutcome(req: BatchDayReplayRangeRequest): Promise<ReplayOperation> {
    return this.submitRange(req)
  },
  async operationDetail(operationId: number, tenantId?: string): Promise<ReplayOperation> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const response = await get<InnerEnvelope<ReplayOperation>>(
      `/api/console/ops/batch-day-replay/operations/${operationId}${qs}`,
    )
    return unwrap(response)
  },
  async operationSessions(operationId: number, tenantId?: string): Promise<BatchDayReplaySession[]> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const response = await get<InnerEnvelope<BatchDayReplaySession[]>>(
      `/api/console/ops/batch-day-replay/operations/${operationId}/sessions${qs}`,
    )
    return unwrap(response)
  },
  async operations(opts: { tenantId?: string; limit?: number } = {}): Promise<ReplayOperation[]> {
    const response = await get<InnerEnvelope<ReplayOperation[]>>(
      '/api/console/ops/batch-day-replay/operations',
      opts,
      { _silent: true } as AxiosRequestConfig & { _silent: boolean },
    )
    return unwrap(response)
  },
  async approveOperation(
    operationId: number,
    approver: string,
    tenantId?: string,
  ): Promise<ReplayOperation> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const qs = new URLSearchParams({ approver })
    if (tenantId) qs.set('tenantId', tenantId)
    const response = await post<InnerEnvelope<ReplayOperation>>(
      `/api/console/ops/batch-day-replay/operations/${operationId}/approve?${qs.toString()}`,
      undefined,
      config,
    )
    return unwrap(response)
  },
  async cancelOperation(operationId: number, tenantId?: string): Promise<ReplayOperation> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const response = await post<InnerEnvelope<ReplayOperation>>(
      `/api/console/ops/batch-day-replay/operations/${operationId}/cancel${qs}`,
      null,
      config,
    )
    return unwrap(response)
  },
  async resolveSubmitOutcome(req: BatchDayReplaySubmitRequest): Promise<BatchDayReplaySession> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const response = await post<InnerEnvelope<BatchDayReplaySession>>(
      '/api/console/ops/batch-day-replay/sessions',
      req,
      config,
    )
    return unwrap(response)
  },
  async list(opts: { tenantId?: string; status?: string; limit?: number } = {}) {
    const response = await get<InnerEnvelope<BatchDayReplaySession[]>>(
      '/api/console/ops/batch-day-replay/sessions',
      opts,
      { _silent: true } as AxiosRequestConfig & { _silent: boolean },
    )
    return unwrap(response)
  },
  async approve(
    sessionId: number,
    approver: string,
    tenantId?: string,
  ): Promise<BatchDayReplaySession> {
    const qs = new URLSearchParams({ approver })
    if (tenantId) qs.set('tenantId', tenantId)
    const response = await post<InnerEnvelope<BatchDayReplaySession>>(
      `/api/console/ops/batch-day-replay/sessions/${sessionId}/approve?${qs.toString()}`,
      undefined,
    )
    return unwrap(response)
  },
  async cancel(sessionId: number, tenantId?: string): Promise<BatchDayReplaySession> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const response = await post<InnerEnvelope<BatchDayReplaySession>>(
      `/api/console/ops/batch-day-replay/sessions/${sessionId}/cancel${qs}`,
      null,
    )
    return unwrap(response)
  },
  async detail(sessionId: number, tenantId?: string): Promise<BatchDayReplaySession> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const response = await get<InnerEnvelope<BatchDayReplaySession>>(
      `/api/console/ops/batch-day-replay/sessions/${sessionId}${qs}`,
    )
    return unwrap(response)
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
    const response = await get<InnerEnvelope<BatchDayReplayEntry[]>>(
      `/api/console/ops/batch-day-replay/sessions/${sessionId}/entries${suffix}`,
    )
    return unwrap(response)
  },
  async retryFailedSubmission(
    sessionId: number,
    entryId: number,
    tenantId: string,
    reason: string,
  ): Promise<BatchDayReplaySession> {
    const config: AxiosRequestConfig = {
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    }
    const query = new URLSearchParams({ tenantId, reason })
    const response = await post<InnerEnvelope<BatchDayReplaySession>>(
      `/api/console/ops/batch-day-replay/sessions/${sessionId}/entries/${entryId}/retry-submission?${query.toString()}`,
      null,
      config,
    )
    return unwrap(response)
  },
}
