// ─── 统一响应体（对齐 console-api CommonResponse）────────────────
export interface CommonMeta {
  requestId: string
  traceId: string
  timestamp: string
}

export interface CommonResponse<T = unknown> {
  code: string | number
  message: string
  data: T
  meta?: CommonMeta
}

/** @deprecated 使用 CommonResponse */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** OpenAPI PageRequest */
export interface PageRequest {
  pageNo: number
  pageSize: number
}

/** OpenAPI PageResponse */
export interface PageResponse<T> {
  total: number
  pageNo: number
  pageSize: number
  items: T[]
}

/** 列表页兼容（records/page 命名 — 逐步迁到 PageResponse） */
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  pageSize: number
}

// ─── 权限 ─────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER'

export interface UserInfo {
  userId: string
  username: string
  role: Role
  permissions: string[]
}

// ─── 文件中心 ─────────────────────────────────────────────────
export type FileStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DISPATCHED'

export interface FileRecord {
  id: number
  tenantId: string
  fileName: string
  fileFormatType: string
  fileStatus: FileStatus
  storageType: string
  storagePath: string
  storageBucket: string
  bizType: string
  bizDate: string
  fileSize: number
  traceId: string
  createdAt: string
  updatedAt: string
}

export interface FileGroupArrival {
  fileGroupCode: string
  tenantId: string
  arrivalState: string
  requiredFileSet: string
  expectedArrivalTime: string
  latestTolerableTime: string
  triggerOnComplete: boolean
}

// ─── 任务管理 ─────────────────────────────────────────────────
export interface JobDefinition {
  id: number
  tenantId: string
  jobCode: string
  jobName: string
  workerType: string
  workerGroup: string
  queueCode: string
  enabled: boolean
  cronExpression: string
  priority: number
  maxRetries: number
  expectedDurationSeconds: number
  createdAt: string
}

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'DISABLED'

export interface WorkflowDefinition {
  id: number
  tenantId: string
  workflowCode: string
  workflowName: string
  workflowStatus: WorkflowStatus
  version: number
  dagJson: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// ─── 执行监控 ─────────────────────────────────────────────────
export type InstanceStatus =
  | 'CREATED'
  | 'WAITING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface JobInstance {
  id: number
  tenantId: string
  instanceNo: string
  jobCode: string
  instanceStatus: InstanceStatus
  priority: number
  workerGroup: string
  queueCode: string
  expectedPartitionCount: number
  completedPartitionCount: number
  failedPartitionCount: number
  traceId: string
  startedAt: string
  finishedAt: string
  deadlineAt: string
  slaAlertedAt: string
  createdAt: string
}

export type PartitionStatus = 'CREATED' | 'READY' | 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface JobPartition {
  id: number
  tenantId: string
  jobInstanceId: number
  partitionIndex: number
  partitionStatus: PartitionStatus
  workerGroup: string
  leaseExpireAt: string
  createdAt: string
  updatedAt: string
}

export type WorkflowRunStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface WorkflowRun {
  id: number
  tenantId: string
  workflowCode: string
  runStatus: WorkflowRunStatus
  currentNodeCode: string
  startedAt: string
  finishedAt: string
  createdAt: string
}

// ─── 日志 & 告警 ──────────────────────────────────────────────
export type LogLevel = 'INFO' | 'WARN' | 'ERROR'
export type LogType = 'SYSTEM' | 'BUSINESS' | 'ALARM'

export interface ExecutionLog {
  id: number
  tenantId: string
  jobInstanceId: number
  logLevel: LogLevel
  logType: LogType
  traceId: string
  message: string
  detailRef: string
  extraJson: string
  createdAt: string
}

// ─── Worker 管理 ──────────────────────────────────────────────
export type WorkerStatus = 'ONLINE' | 'DRAINING' | 'OFFLINE'

export interface WorkerRegistry {
  workerId: string
  tenantId: string
  workerType: string
  workerGroup: string
  host: string
  port: number
  workerStatus: WorkerStatus
  lastHeartbeatAt: string
  drainDeadlineAt: string
  registeredAt: string
}

export interface DispatchChannel {
  channelCode: string
  tenantId: string
  channelType: string
  enabled: boolean
  config: Record<string, unknown>
}

// ─── 调度治理 ─────────────────────────────────────────────────
export interface TenantQuotaPolicy {
  tenantId: string
  policyCode: string
  fairShareGroup: string
  maxRunningJobsPerTenant: number
  burstLimit: number
  enabled: boolean
}

export interface SchedulerSnapshot {
  tenantId: string
  generatedAt: string
  activeJobs: number
  activePartitions: number
  effectiveTenantJobCap: number
  groupActiveJobs: number
  onlineWorkerCount: number
}
