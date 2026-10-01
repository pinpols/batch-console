import { fetchAllPageItems } from '@/api/adapters'
import { get, post } from '@/api/client'
import type { PageResponse } from '@/types'
import type { operations } from '@/types/api.generated'
import type {
  ConsoleAuditLogResponse,
  ConsoleDeadLetterTaskResponse,
  ConsoleAlertEventResponse,
  ConsoleFilePipelineResponse,
  ConsoleFileRecordResponse,
  ConsoleJobExecutionLogResponse,
  ConsoleJobInstanceResponse,
  ConsoleOperationAuditResponse,
  DeadLetterReplayRequest,
  ConsoleOutboxDeliveryLogResponse,
  ConsoleOutboxRetryLogResponse,
  ConsoleRetryScheduleResponse,
  ConsoleWorkflowNodeRunResponse,
  ConsoleWorkflowRunResponse,
  ConsoleTraceTimelineItem,
  ConsoleTraceSnapshotResponse,
  AiAuditLogResponse,
} from '@/types/console-api'

type AuditQuery = NonNullable<operations['queryAuditLogs']['parameters']['query']>
export type AuditQueryFilters = Omit<AuditQuery, 'tenantId' | 'pageNo' | 'pageSize'>

export interface ExecutionLogFilters {
  traceId?: string
  operationType?: string
  operationResult?: string
}

export interface OutboxRetryFilters {
  /** 精确匹配 */
  eventType?: string
  /** 精确匹配 */
  eventKey?: string
  /** 精确匹配 */
  retryStatus?: string
}

export interface OutboxDeliveryFilters {
  /** 精确匹配 */
  eventType?: string
  /** 精确匹配 */
  eventKey?: string
  /** 精确匹配 */
  deliveryStatus?: string
  /** 模糊匹配 */
  targetTopic?: string
  /** 精确匹配 */
  traceId?: string
}

export interface AiAuditFilters {
  traceId?: string
  operatorId?: string
  promptCategory?: string
}

export type TraceSnapshotResponse = ConsoleTraceSnapshotResponse

export function queryTraceSnapshot(
  tenantId: string,
  traceId: string,
): Promise<TraceSnapshotResponse> {
  return get<TraceSnapshotResponse>('/api/console/queries/trace-snapshot', {
    tenantId,
    traceId,
  })
}

/**
 * 服务端分页查询审计日志(P5:替代 queryAudits 的端上全量聚合)。
 * 后端 /api/console/queries/audits 全维度筛选均已支持(operationType/operationResult/
 * operatorId/fileId/traceId/startTime/endTime),直接传后端 + 服务端 total/page。
 */
export function queryAuditsPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: AuditQueryFilters,
): Promise<PageResponse<ConsoleAuditLogResponse>> {
  return get<PageResponse<ConsoleAuditLogResponse>>('/api/console/queries/audits', {
    tenantId,
    pageNo,
    pageSize,
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    ...(filters?.operationType ? { operationType: filters.operationType } : {}),
    ...(filters?.operatorId ? { operatorId: filters.operatorId } : {}),
    ...(filters?.fileId ? { fileId: filters.fileId } : {}),
    ...(filters?.operationResult ? { operationResult: filters.operationResult } : {}),
    ...(filters?.startTime ? { startTime: filters.startTime } : {}),
    ...(filters?.endTime ? { endTime: filters.endTime } : {}),
  })
}

export function queryOutboxRetries(tenantId: string, filters?: OutboxRetryFilters) {
  return fetchAllPageItems<ConsoleOutboxRetryLogResponse>('/api/console/queries/outbox-retries', {
    tenantId,
    ...(filters?.eventType ? { eventType: filters.eventType } : {}),
    ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
    ...(filters?.retryStatus ? { retryStatus: filters.retryStatus } : {}),
  })
}

export function queryOutboxRetriesPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: OutboxRetryFilters,
): Promise<PageResponse<ConsoleOutboxRetryLogResponse>> {
  return get<PageResponse<ConsoleOutboxRetryLogResponse>>('/api/console/queries/outbox-retries', {
    tenantId,
    pageNo,
    pageSize,
    ...(filters?.eventType ? { eventType: filters.eventType } : {}),
    ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
    ...(filters?.retryStatus ? { retryStatus: filters.retryStatus } : {}),
  })
}

export function queryOutboxDeliveries(tenantId: string, filters?: OutboxDeliveryFilters) {
  return fetchAllPageItems<ConsoleOutboxDeliveryLogResponse>(
    '/api/console/queries/outbox-deliveries',
    {
      tenantId,
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
      ...(filters?.deliveryStatus ? { deliveryStatus: filters.deliveryStatus } : {}),
      ...(filters?.targetTopic ? { targetTopic: filters.targetTopic } : {}),
      ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    },
  )
}

export function queryOutboxDeliveriesPage(
  tenantId: string,
  pageNo: number,
  pageSize: number,
  filters?: OutboxDeliveryFilters,
): Promise<PageResponse<ConsoleOutboxDeliveryLogResponse>> {
  return get<PageResponse<ConsoleOutboxDeliveryLogResponse>>(
    '/api/console/queries/outbox-deliveries',
    {
      tenantId,
      pageNo,
      pageSize,
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
      ...(filters?.deliveryStatus ? { deliveryStatus: filters.deliveryStatus } : {}),
      ...(filters?.targetTopic ? { targetTopic: filters.targetTopic } : {}),
      ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    },
  )
}

export function queryAiAuditsPage(
  tenantId: string,
  pageSize: number,
  cursor: string | null,
  filters?: AiAuditFilters,
): Promise<PageResponse<AiAuditLogResponse>> {
  return get<PageResponse<AiAuditLogResponse>>('/api/console/queries/ai-audits', {
    tenantId,
    pageSize,
    cursor: cursor ?? '',
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    ...(filters?.operatorId ? { operatorId: filters.operatorId } : {}),
    ...(filters?.promptCategory ? { promptCategory: filters.promptCategory } : {}),
  })
}

/** GET /api/console/queries/dead-letters */
export function queryDeadLetters(tenantId: string, filters?: { traceId?: string }) {
  return fetchAllPageItems<ConsoleDeadLetterTaskResponse>(
    '/api/console/queries/dead-letters',
    {
      tenantId,
      ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    },
    { devWarnThreshold: 5000 },
  )
}

/** POST /api/console/jobs/dead-letters/replay — 重放单条死信 */
export function replayDeadLetter(tenantId: string, deadLetterId: number, reason?: string) {
  const body: DeadLetterReplayRequest = { tenantId, deadLetterId }
  if (reason) body.reason = reason
  return post<string>('/api/console/jobs/dead-letters/replay', body)
}

/** GET /api/console/queries/retries */
export function queryRetries(tenantId: string) {
  return fetchAllPageItems<ConsoleRetryScheduleResponse>('/api/console/queries/retries', {
    tenantId,
  })
}

/** GET /api/console/queries/execution-logs */
export function queryExecutionLogs(tenantId: string, filters?: ExecutionLogFilters) {
  return fetchAllPageItems<Record<string, unknown>>(
    '/api/console/queries/execution-logs',
    {
      tenantId,
      ...(filters?.traceId ? { traceId: filters.traceId } : {}),
      ...(filters?.operationType ? { operationType: filters.operationType } : {}),
      ...(filters?.operationResult ? { operationResult: filters.operationResult } : {}),
    },
    { devWarnThreshold: 5000 },
  )
}

/** GET /api/console/queries/channel-receipts */
export function queryChannelReceipts(tenantId: string) {
  return fetchAllPageItems<Record<string, unknown>>('/api/console/queries/channel-receipts', {
    tenantId,
  })
}
