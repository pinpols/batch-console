import type {
  FileStatus,
  InstanceStatus,
  LogLevel,
  PartitionStatus,
  WorkerStatus,
  WorkflowRunStatus,
} from '@/types'

export type StatusTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusMeta {
  label: string
  type: StatusTagType
}

export const instanceStatusMap: Record<InstanceStatus, StatusMeta> = {
  CREATED: { label: '已创建', type: 'info' },
  WAITING: { label: '等待中', type: 'warning' },
  RUNNING: { label: '运行中', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'success' },
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
  RUNNING: { label: '运行中', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
}

export const workerStatusMap: Record<WorkerStatus, StatusMeta> = {
  ONLINE: { label: '在线', type: 'success' },
  DRAINING: { label: '排空中', type: 'warning' },
  OFFLINE: { label: '离线', type: 'info' },
}

export const workflowRunStatusMap: Record<WorkflowRunStatus, StatusMeta> = {
  CREATED: { label: '已创建', type: 'info' },
  RUNNING: { label: '运行中', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'success' },
  FAILED: { label: '失败', type: 'danger' },
}

export const logLevelMap: Record<LogLevel, StatusMeta> = {
  INFO: { label: 'INFO', type: 'info' },
  WARN: { label: 'WARN', type: 'warning' },
  ERROR: { label: 'ERROR', type: 'danger' },
}

