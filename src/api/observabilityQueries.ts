import { fetchAllPageItems } from '@/api/adapters'
import { get } from '@/api/client'
import type {
  ConsoleAuditLogResponse,
  ConsoleDeadLetterTaskResponse,
  ConsoleOutboxDeliveryLogResponse,
  ConsoleOutboxRetryLogResponse,
  ConsoleRetryScheduleResponse,
} from '@/types/console-api'

export interface AuditQueryFilters {
  traceId?: string
  operationType?: string
  operatorId?: string
  fileId?: number | string
  operationResult?: string
  startTime?: string
  endTime?: string
}

export interface ExecutionLogFilters {
  traceId?: string
  operationType?: string
  operationResult?: string
}

export interface OutboxRetryFilters {
  /** exact match */
  eventType?: string
  /** exact match */
  eventKey?: string
  /** exact match */
  retryStatus?: string
}

export interface OutboxDeliveryFilters {
  /** exact match */
  eventType?: string
  /** exact match */
  eventKey?: string
  /** exact match */
  deliveryStatus?: string
  /** partial match */
  targetTopic?: string
}

/** OpenAPI data 均为 PageResponse；将过滤参数传给后端（后端支持时减少传输量，客户端仍做兜底过滤） */
export function queryAudits(tenantId: string, filters?: AuditQueryFilters) {
  return fetchAllPageItems<ConsoleAuditLogResponse>('/api/console/queries/audits', {
    tenantId,
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

export function queryOutboxDeliveries(tenantId: string, filters?: OutboxDeliveryFilters) {
  return fetchAllPageItems<ConsoleOutboxDeliveryLogResponse>(
    '/api/console/queries/outbox-deliveries',
    {
      tenantId,
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
      ...(filters?.deliveryStatus ? { deliveryStatus: filters.deliveryStatus } : {}),
      ...(filters?.targetTopic ? { targetTopic: filters.targetTopic } : {}),
    },
  )
}

/** GET /api/console/queries/dead-letters */
export function queryDeadLetters(tenantId: string) {
  return fetchAllPageItems<ConsoleDeadLetterTaskResponse>('/api/console/queries/dead-letters', {
    tenantId,
  })
}

/** GET /api/console/queries/retries */
export function queryRetries(tenantId: string) {
  return fetchAllPageItems<ConsoleRetryScheduleResponse>('/api/console/queries/retries', {
    tenantId,
  })
}

/** GET /api/console/queries/execution-logs */
export function queryExecutionLogs(tenantId: string, filters?: ExecutionLogFilters) {
  return fetchAllPageItems<Record<string, unknown>>('/api/console/queries/execution-logs', {
    tenantId,
    ...(filters?.traceId ? { traceId: filters.traceId } : {}),
    ...(filters?.operationType ? { operationType: filters.operationType } : {}),
    ...(filters?.operationResult ? { operationResult: filters.operationResult } : {}),
  })
}

/** GET /api/console/queries/channel-receipts */
export function queryChannelReceipts(tenantId: string) {
  return fetchAllPageItems<Record<string, unknown>>('/api/console/queries/channel-receipts', {
    tenantId,
  })
}

/** GET /api/console/queries/workflow-node-runs/{id} */
export function getWorkflowNodeRunDetail(id: number, tenantId: string) {
  return get<unknown>(`/api/console/queries/workflow-node-runs/${id}`, { tenantId })
}

/** GET /api/console/queries/job-step-instances/{id} */
export function getJobStepInstanceDetail(id: number, tenantId: string) {
  return get<unknown>(`/api/console/queries/job-step-instances/${id}`, { tenantId })
}
