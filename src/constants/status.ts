import type { components } from '@/types/api.generated'
import type {
  FileStatus,
  InstanceStatus,
  LogLevel,
  LogType,
  PartitionStatus,
  WorkerStatus,
  WorkflowRunStatus,
  WorkflowStatus,
} from '@/types'

// ─── 后端 enum schema 的类型化别名(来自 OpenAPI)─────────────────
export type TriggerStatus = components['schemas']['TriggerStatus']
export type WebhookDeliveryStatus = components['schemas']['WebhookDeliveryStatus']
export type NotificationChannelType = components['schemas']['NotificationChannelType']
export type TenantStatus = components['schemas']['TenantStatus']
export type TriggerResourceType = components['schemas']['TriggerResourceType']
export type TenantConfigInitAction = components['schemas']['TenantConfigInitAction']
export type ArrivalState = components['schemas']['ArrivalState']

export type StatusTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

// =====================================================================
// 颜色映射 — 前端专属(UI 决策,后端无关)
//
// label(中文文案)不再由前端维护;`StatusTag` 会从 `/api/console/meta/enums`
// 实时取 label,漏发时回退原始 value。对应的 enum 见每个 map 注释里的
// `/meta/enums` key,`pickMetaEnumGroup(enums, 'xxx')` 可拿到 label+value。
// =====================================================================

/** /meta/enums: `instanceStatus` */
export const instanceStatusColor: Record<InstanceStatus, StatusTagType> = {
  CREATED: 'info',
  WAITING: 'warning',
  READY: 'primary',
  RUNNING: 'primary', // 进行中 = 蓝,与"成功 = 绿"区分
  RETRYING: 'warning',
  SUCCESS: 'success', // 成功 = 绿
  FAILED: 'danger', // 失败 = 红
  FAILED_DRY_RUN: 'danger',
  CANCELLED: 'info',
  TERMINATED: 'danger',
}

/** /meta/enums: `fileStatus` */
export const fileStatusColor: Record<FileStatus, StatusTagType> = {
  RECEIVED: 'info',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  DISPATCHED: 'primary',
}

/** /meta/enums: `partitionStatus` */
export const partitionStatusColor: Record<PartitionStatus, StatusTagType> = {
  CREATED: 'info',
  READY: 'primary',
  WAITING: 'warning',
  RUNNING: 'primary',
  RETRYING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'info',
  TERMINATED: 'danger',
}

/** /meta/enums: `workerStatus` */
export const workerStatusColor: Record<WorkerStatus, StatusTagType> = {
  ONLINE: 'success',
  DRAINING: 'warning',
  OFFLINE: 'info',
}

/** /meta/enums: `workflowRunStatus` */
export const workflowRunStatusColor: Record<WorkflowRunStatus, StatusTagType> = {
  CREATED: 'info',
  RUNNING: 'primary',
  SUCCESS: 'success',
  FAILED: 'danger',
  CANCELLED: 'info',
  TERMINATED: 'danger',
}

/** /meta/enums: `workflowDefinitionStatus` */
export const workflowDefinitionStatusColor: Record<WorkflowStatus, StatusTagType> = {
  DRAFT: 'info',
  PUBLISHED: 'success',
  DISABLED: 'warning',
}

/** /meta/enums: `logType` */
export const logTypeColor: Record<LogType, StatusTagType> = {
  SYSTEM: 'info',
  BUSINESS: 'primary',
  ALARM: 'danger',
}

/** /meta/enums: `approvalStatus` */
export const approvalStatusColor: Record<string, StatusTagType> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'info',
  CLOSED: 'info',
}

/** /meta/enums: `outboxPublishStatus`(取值含别名) */
export const outboxPublishStatusColor: Record<string, StatusTagType> = {
  // 后端 OutboxPublishStatus enum 实际取值
  NEW: 'warning',
  PUBLISHING: 'primary',
  PUBLISHED: 'success',
  GIVE_UP: 'danger',
  // 别名 / 历史契约取值
  PENDING: 'warning',
  SCHEDULED: 'info',
  RETRYING: 'primary',
  SUCCEEDED: 'success',
  SUCCESS: 'success',
  FAILED: 'danger',
  EXHAUSTED: 'danger',
  DEAD_LETTER: 'danger',
  DELIVERED: 'success',
  DISPATCHED: 'primary',
  ACKED: 'success',
}

/** /meta/enums: `severity` */
export const alertSeverityColor: Record<string, StatusTagType> = {
  INFO: 'info',
  WARNING: 'warning',
  WARN: 'warning',
  ERROR: 'danger',
  CRITICAL: 'danger',
}

/** /meta/enums: `alertStatus` */
export const alertStatusColor: Record<string, StatusTagType> = {
  OPEN: 'danger',
  ACKNOWLEDGED: 'primary',
  SILENCED: 'warning',
  CLOSED: 'info',
}

/** /meta/enums: `arrivalState`;保留旧契约 PENDING/COMPLETED/FAILED 兼容别名 */
export const arrivalStateColor: Record<ArrivalState, StatusTagType> &
  Record<string, StatusTagType> = {
  WAITING: 'warning',
  PARTIAL: 'info',
  COMPLETE: 'success',
  TIMEOUT: 'danger',
  TRIGGERED: 'primary',
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
}

/** /meta/enums: `operationResult` */
export const operationResultColor: Record<string, StatusTagType> = {
  SUCCESS: 'success',
  SUCCEEDED: 'success',
  OK: 'success',
  FAILED: 'danger',
  FAILURE: 'danger',
  ERROR: 'danger',
}

/** /meta/enums: `configStatus` */
export const configStatusColor: Record<string, StatusTagType> = {
  DRAFT: 'info',
  PUBLISHED: 'success',
  GRAY: 'warning',
  ROLLING_BACK: 'warning',
  ROLLED_BACK: 'info',
  DEPRECATED: 'info',
}

/** /meta/enums: `tenantStatus` */
export const tenantStatusColor: Record<TenantStatus, StatusTagType> = {
  ACTIVE: 'success',
  SUSPENDED: 'info',
}

/** /meta/enums: `triggerStatus` */
export const triggerStatusColor: Record<TriggerStatus, StatusTagType> = {
  NORMAL: 'success',
  REGISTERED: 'success',
  PAUSED: 'warning',
  BLOCKED: 'warning',
  ERROR: 'danger',
  COMPLETE: 'info',
  UNREGISTERED: 'info',
}

/** /meta/enums: `triggerResourceType` */
export const triggerResourceTypeColor: Record<TriggerResourceType, StatusTagType> = {
  JOB: 'primary',
  WORKFLOW: 'success',
  FILE_CHANNEL: 'info',
  FILE_TEMPLATE: 'info',
}

/** TenantConfigInitItemStats.details[].action(未暴露为 /meta/enums 分组) */
export const tenantConfigInitActionColor: Record<TenantConfigInitAction, StatusTagType> = {
  CREATED: 'success',
  UPDATED: 'primary',
  SKIPPED: 'info',
  FAILED: 'danger',
}

/** /meta/enums: `channelType` */
export const channelTypeColor: Record<NotificationChannelType, StatusTagType> = {
  EMAIL: 'primary',
  WEBHOOK: 'info',
  DINGTALK: 'success',
  WECHAT: 'success',
  SMS: 'warning',
}

/** /meta/enums: `webhookDeliveryStatus` */
export const deliveryStatusColor: Record<WebhookDeliveryStatus, StatusTagType> = {
  SUCCESS: 'success',
  FAILED: 'danger',
  EXHAUSTED: 'danger',
}

/** /meta/enums: `executionMode`(FULL=info / INCREMENTAL=primary / CDC=warning) */
export const executionModeColor: Record<string, StatusTagType> = {
  FULL: 'info',
  INCREMENTAL: 'primary',
  CDC: 'warning',
}

// =====================================================================
// 前端专属分类(无 /meta/enums 对应 key)— 同时维护 label 与 color
// =====================================================================

export interface LocalStatusMeta {
  label: string
  type: StatusTagType
}

/** 布尔 true/false 专用(UI 概念) */
export const ynStatusMeta: Record<string, LocalStatusMeta> = {
  true: { label: '是', type: 'success' },
  false: { label: '否', type: 'info' },
}

/** 日志等级(UI 概念,后端只透传 INFO/WARN/ERROR 原文) */
export const logLevelMeta: Record<LogLevel, LocalStatusMeta> = {
  INFO: { label: 'INFO', type: 'info' },
  WARN: { label: 'WARN', type: 'warning' },
  ERROR: { label: 'ERROR', type: 'danger' },
}

/** 批次日窗口(非标准 enum,控制台自定义状态) */
export const batchDayStatusMeta: Record<string, LocalStatusMeta> = {
  OPEN: { label: '开窗', type: 'success' },
  CLOSED: { label: '关窗', type: 'info' },
  PROCESSING: { label: '处理中', type: 'primary' },
  PENDING: { label: '待开窗', type: 'warning' },
}

/** SLA 评估结果(派生状态,后端不建模) */
export const slaStatusMeta: Record<string, LocalStatusMeta> = {
  OK: { label: '正常', type: 'success' },
  HEALTHY: { label: '正常', type: 'success' },
  WARNING: { label: '预警', type: 'warning' },
  BREACH: { label: '违规', type: 'danger' },
  VIOLATED: { label: '违规', type: 'danger' },
}

/** API Key 状态(UI 概念,后端实体字段组合: enabled + revokedAt) */
export const apiKeyStatusMeta: Record<string, LocalStatusMeta> = {
  ENABLED: { label: '启用', type: 'success' },
  DISABLED: { label: '停用', type: 'info' },
  REVOKED: { label: '已吊销', type: 'danger' },
}
