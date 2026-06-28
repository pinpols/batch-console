/**
 * Job 编辑 / 新建表单的本地 state 类型(对齐 BE `JobDefinitionUpdateRequest` 24 字段)。
 *
 * 与 generated `JobDefinitionUpdateRequest` 区别:
 *   - 不含 tenantId(由调用方提交时单独带)
 *   - jobCode / jobType 保留(编辑场景显示用,提交时不传)
 *   - 所有字段非 optional(初始化用 empty string / null,简化双向绑定)
 *
 * 用于:
 *   - JobConfigBasicForm 组件 v-model
 *   - 编辑 drawer state
 *   - 新建作业向导 state(Day 8+)
 */
export type ExecutionMode = 'FULL' | 'INCREMENTAL' | 'CDC'

export interface JobEditFormState {
  /** 仅显示用,提交时不带 */
  jobCode: string
  jobType: string
  /** 可编辑字段 */
  jobName: string
  bizType: string
  scheduleType: string
  scheduleExpr: string
  dependsOnJobCode: string
  timezone: string
  triggerMode: string
  workerGroup: string
  queueCode: string
  calendarCode: string
  windowCode: string
  dagEnabled: boolean
  shardStrategy: string
  executionMode: ExecutionMode
  watermarkField: string
  retryPolicy: string
  retryMaxCount: number
  timeoutSeconds: number
  executionHandler: string
  paramSchema: string
  defaultParams: string
  priority: number
  enabled: boolean
  description: string
}

export function createEmptyJobEditForm(): JobEditFormState {
  return {
    jobCode: '',
    jobType: '',
    jobName: '',
    bizType: '',
    scheduleType: '',
    scheduleExpr: '',
    dependsOnJobCode: '',
    timezone: '',
    triggerMode: '',
    workerGroup: '',
    queueCode: '',
    calendarCode: '',
    windowCode: '',
    dagEnabled: false,
    shardStrategy: '',
    executionMode: 'FULL',
    watermarkField: '',
    retryPolicy: '',
    retryMaxCount: 0,
    timeoutSeconds: 0,
    executionHandler: '',
    paramSchema: '',
    defaultParams: '',
    priority: 5,
    enabled: true,
    description: '',
  }
}

/** 把 Response 行(只读字段)拷贝成可编辑 form 初值 */
export function jobResponseToEditForm(row: {
  jobCode?: string
  jobName?: string
  jobType?: string
  bizType?: string
  scheduleType?: string
  scheduleExpr?: string
  dependsOnJobCode?: string
  timezone?: string
  triggerMode?: string
  workerGroup?: string
  queueCode?: string
  calendarCode?: string
  windowCode?: string
  dagEnabled?: boolean
  shardStrategy?: string
  executionMode?: string
  watermarkField?: string
  retryPolicy?: string
  retryMaxCount?: number
  timeoutSeconds?: number
  executionHandler?: string
  paramSchema?: string
  defaultParams?: string
  priority?: number
  enabled?: boolean
  description?: string
}): JobEditFormState {
  const empty = createEmptyJobEditForm()
  return {
    ...empty,
    jobCode: row.jobCode ?? '',
    jobName: row.jobName ?? '',
    jobType: row.jobType ?? '',
    bizType: row.bizType ?? '',
    scheduleType: row.scheduleType ?? '',
    scheduleExpr: row.scheduleExpr ?? '',
    dependsOnJobCode: row.dependsOnJobCode ?? '',
    timezone: row.timezone ?? '',
    triggerMode: row.triggerMode ?? '',
    workerGroup: row.workerGroup ?? '',
    queueCode: row.queueCode ?? '',
    calendarCode: row.calendarCode ?? '',
    windowCode: row.windowCode ?? '',
    dagEnabled: row.dagEnabled ?? false,
    shardStrategy: row.shardStrategy ?? '',
    executionMode: ((row.executionMode as ExecutionMode | undefined) || 'FULL') as ExecutionMode,
    watermarkField: row.watermarkField ?? '',
    retryPolicy: row.retryPolicy ?? '',
    retryMaxCount: row.retryMaxCount ?? 0,
    timeoutSeconds: row.timeoutSeconds ?? 0,
    executionHandler: row.executionHandler ?? '',
    paramSchema: row.paramSchema ?? '',
    defaultParams: row.defaultParams ?? '',
    priority: row.priority ?? 5,
    enabled: row.enabled ?? true,
    description: row.description ?? '',
  }
}
