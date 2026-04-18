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

export type StatusTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusMeta {
  label: string
  type: StatusTagType
}

export const instanceStatusMap: Record<InstanceStatus, StatusMeta> = {
  CREATED: { label: '已创建', type: 'info' },
  WAITING: { label: '等待中', type: 'warning' },
  RUNNING: { label: '运行中', type: 'success' },
  COMPLETED: { label: '已完成', type: 'primary' },
  FAILED: { label: '失败', type: 'danger' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export const fileStatusMap: Record<FileStatus, StatusMeta> = {
  RECEIVED: { label: '已接收', type: 'info' },
  PROCESSING: { label: '处理中', type: 'warning' },
  COMPLETED: { label: '已完成', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
  DISPATCHED: { label: '已分发', type: 'primary' },
}

export const partitionStatusMap: Record<PartitionStatus, StatusMeta> = {
  CREATED: { label: '已创建', type: 'info' },
  READY: { label: '就绪', type: 'primary' },
  WAITING: { label: '等待中', type: 'warning' },
  RUNNING: { label: '运行中', type: 'success' },
  COMPLETED: { label: '已完成', type: 'primary' },
  FAILED: { label: '失败', type: 'danger' },
}

export const workerStatusMap: Record<WorkerStatus, StatusMeta> = {
  ONLINE: { label: '在线', type: 'success' },
  DRAINING: { label: '排空中', type: 'warning' },
  OFFLINE: { label: '离线', type: 'info' },
}

export const workflowRunStatusMap: Record<WorkflowRunStatus, StatusMeta> = {
  CREATED: { label: '已创建', type: 'info' },
  RUNNING: { label: '运行中', type: 'success' },
  COMPLETED: { label: '已完成', type: 'primary' },
  FAILED: { label: '失败', type: 'danger' },
}

export const logLevelMap: Record<LogLevel, StatusMeta> = {
  INFO: { label: 'INFO', type: 'info' },
  WARN: { label: 'WARN', type: 'warning' },
  ERROR: { label: 'ERROR', type: 'danger' },
}

/** 以下均为 string 键，兼容后端未枚举化字段；未知值回退为 info + 原文 */

export const approvalStatusMap: Record<string, StatusMeta> = {
  PENDING: { label: '待审批', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已拒绝', type: 'danger' },
  CANCELLED: { label: '已取消', type: 'info' },
  CLOSED: { label: '已关闭', type: 'info' },
}

export const outboxPublishStatusMap: Record<string, StatusMeta> = {
  PENDING: { label: '待处理', type: 'warning' },
  SCHEDULED: { label: '已调度', type: 'info' },
  RETRYING: { label: '重试中', type: 'primary' },
  SUCCEEDED: { label: '成功', type: 'success' },
  SUCCESS: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
  EXHAUSTED: { label: '重试耗尽', type: 'danger' },
  DEAD_LETTER: { label: '死信', type: 'danger' },
  DELIVERED: { label: '已投递', type: 'success' },
  DISPATCHED: { label: '已派发', type: 'primary' },
  ACKED: { label: '已确认', type: 'success' },
}

export const alertSeverityMap: Record<string, StatusMeta> = {
  INFO: { label: '信息', type: 'info' },
  WARNING: { label: '警告', type: 'warning' },
  WARN: { label: '警告', type: 'warning' },
  ERROR: { label: '错误', type: 'danger' },
  CRITICAL: { label: '严重', type: 'danger' },
}

export const alertStatusMap: Record<string, StatusMeta> = {
  OPEN: { label: '未处理', type: 'danger' },
  ACKNOWLEDGED: { label: '已确认', type: 'primary' },
  SILENCED: { label: '已静默', type: 'warning' },
  CLOSED: { label: '已关闭', type: 'info' },
}

export const batchDayStatusMap: Record<string, StatusMeta> = {
  OPEN: { label: '开窗', type: 'success' },
  CLOSED: { label: '关窗', type: 'info' },
  PROCESSING: { label: '处理中', type: 'primary' },
  PENDING: { label: '待开窗', type: 'warning' },
}

export const slaStatusMap: Record<string, StatusMeta> = {
  OK: { label: '正常', type: 'success' },
  HEALTHY: { label: '正常', type: 'success' },
  WARNING: { label: '预警', type: 'warning' },
  BREACH: { label: '违规', type: 'danger' },
  VIOLATED: { label: '违规', type: 'danger' },
}

export const arrivalStateMap: Record<string, StatusMeta> = {
  PENDING: { label: '待到达', type: 'warning' },
  WAITING: { label: '等待中', type: 'warning' },
  COMPLETE: { label: '已齐套', type: 'success' },
  COMPLETED: { label: '已齐套', type: 'success' },
  PARTIAL: { label: '部分', type: 'info' },
  FAILED: { label: '失败', type: 'danger' },
}

export const operationResultMap: Record<string, StatusMeta> = {
  SUCCESS: { label: '成功', type: 'success' },
  SUCCEEDED: { label: '成功', type: 'success' },
  OK: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
  FAILURE: { label: '失败', type: 'danger' },
  ERROR: { label: '错误', type: 'danger' },
}

export const configStatusMap: Record<string, StatusMeta> = {
  DRAFT: { label: '草稿', type: 'info' },
  PUBLISHED: { label: '已发布', type: 'success' },
  GRAY: { label: '灰度', type: 'warning' },
  ROLLING_BACK: { label: '回滚中', type: 'warning' },
  ROLLED_BACK: { label: '已回滚', type: 'info' },
  DEPRECATED: { label: '已废弃', type: 'info' },
}

export const ynStatusMap: Record<string, StatusMeta> = {
  true: { label: '是', type: 'success' },
  false: { label: '否', type: 'info' },
}

export const tenantStatusMap: Record<string, StatusMeta> = {
  ACTIVE: { label: '启用', type: 'success' },
  SUSPENDED: { label: '已暂停', type: 'info' },
}

export const workflowDefinitionStatusMap: Record<WorkflowStatus, StatusMeta> = {
  DRAFT: { label: '草稿', type: 'info' },
  PUBLISHED: { label: '已发布', type: 'success' },
  DISABLED: { label: '已停用', type: 'warning' },
}

export const logTypeMap: Record<LogType, StatusMeta> = {
  SYSTEM: { label: '系统', type: 'info' },
  BUSINESS: { label: '业务', type: 'primary' },
  ALARM: { label: '告警', type: 'danger' },
}

/** OpenAPI `resourceType` on trigger/config 相关 payload */
export const triggerResourceTypeMap: Record<string, StatusMeta> = {
  JOB: { label: 'Job', type: 'primary' },
  WORKFLOW: { label: 'Workflow', type: 'success' },
  FILE_CHANNEL: { label: '文件通道', type: 'info' },
  FILE_TEMPLATE: { label: '文件模板', type: 'info' },
}

/** TenantConfigInitItemStats.details[].action */
export const tenantConfigInitActionMap: Record<string, StatusMeta> = {
  CREATED: { label: '新建', type: 'success' },
  UPDATED: { label: '更新', type: 'primary' },
  SKIPPED: { label: '跳过', type: 'info' },
  FAILED: { label: '失败', type: 'danger' },
}

/** 通知渠道类型(NotificationChannel.channelType) */
export const channelTypeMap: Record<string, StatusMeta> = {
  EMAIL: { label: '邮件', type: 'primary' },
  WEBHOOK: { label: 'Webhook', type: 'info' },
  DINGTALK: { label: '钉钉', type: 'success' },
  WECHAT: { label: '企业微信', type: 'success' },
  SMS: { label: '短信', type: 'warning' },
}

/**
 * Trigger 状态 — 后端 `/api/console/triggers` 未在 OpenAPI 声明枚举,
 * 使用常见 Quartz 状态 + 兜底。未知值由 StatusTag 回退为原文。
 */
export const triggerStatusMap: Record<string, StatusMeta> = {
  NORMAL: { label: '正常', type: 'success' },
  REGISTERED: { label: '已注册', type: 'success' },
  ACTIVE: { label: '运行中', type: 'success' },
  PAUSED: { label: '已暂停', type: 'warning' },
  BLOCKED: { label: '阻塞', type: 'warning' },
  ERROR: { label: '错误', type: 'danger' },
  COMPLETE: { label: '已完成', type: 'info' },
  UNREGISTERED: { label: '未注册', type: 'info' },
  NONE: { label: '无', type: 'info' },
}

/** 通知投递状态(NotificationDeliveryLog.deliveryStatus) */
export const deliveryStatusMap: Record<string, StatusMeta> = {
  PENDING: { label: '待投递', type: 'warning' },
  SENDING: { label: '投递中', type: 'primary' },
  SUCCESS: { label: '成功', type: 'success' },
  SUCCEEDED: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
  RETRYING: { label: '重试中', type: 'primary' },
  SKIPPED: { label: '已跳过', type: 'info' },
}
