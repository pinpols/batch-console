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

/** OpenAPI PageResponse(ADR-031 双轨:cursor 模式下 total=0,看 nextCursor/hasMore) */
export interface PageResponse<T> {
  total: number
  pageNo: number
  pageSize: number
  items: T[]
  /** ADR-031:cursor 模式响应字段;offset 模式 null */
  nextCursor?: string | null
  /** ADR-031:offset 模式据 total 计算,cursor 模式据本次取到 size==pageSize 判定 */
  hasMore?: boolean
}

/** 列表页兼容（records/page 命名 — 逐步迁到 PageResponse） */
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  pageSize: number
  /** ADR-031:cursor 模式回填 */
  nextCursor?: string | null
  hasMore?: boolean
}

// ─── 权限 ─────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER'

/** 由后端 ConsoleMenuRegistry 下发（已按 authorities 过滤）。icon 为字符串标识，前端解析成 Component。 */
export interface MenuItem {
  title: string
  path: string
  icon: string
  minRole: Role
}

export interface MenuGroup {
  key: string
  title: string
  icon: string
  minRole: Role
  children: MenuItem[]
}

export interface UserInfo {
  userId: string
  username: string
  role: Role
  permissions: string[]
  /** 后端下发的侧边栏菜单（已按当前 authorities 过滤） */
  menus?: MenuGroup[]
  /**
   * P1 待 BE 实施:首次登录 / admin reset 后强制改密码。
   * BE 在 console_user_account 加 password_must_change BOOLEAN,
   * /auth/login + /auth/me response 带此字段。
   * 字段缺失时视为 false(向后兼容老 BE 版本)。
   */
  mustChangePassword?: boolean
  /**
   * P3 待 BE 实施:密码距离过期剩余天数。
   * BE schema 加 password_expires_at,login response 计算返回。
   * < 7 时 FE banner 提示;≤ 0 时强制改(同 mustChangePassword 路径)。
   */
  passwordExpiringIn?: number
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
  | 'READY'
  | 'RUNNING'
  | 'RETRYING'
  | 'SUCCESS'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'FAILED_DRY_RUN'
  | 'CANCELLED'
  | 'TERMINATED'

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

export type PartitionStatus =
  | 'CREATED'
  | 'READY'
  | 'WAITING'
  | 'RUNNING'
  | 'RETRYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TERMINATED'

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

export type WorkflowRunStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TERMINATED'

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
