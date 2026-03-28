import { get, post } from '@/api/client'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import type { JobInstance, JobPartition, PageResult, WorkflowRun } from '@/types'

export type InstanceQuery = InstanceQueryParams

export interface WorkflowRunQuery {
  tenantId?: string
  workflowCode?: string
  runStatus?: string
  page: number
  pageSize: number
}

export const instanceApi = {
  list: (query: InstanceQuery) => queryJobInstances(query),

  detail: async (instanceId: number, tenantId: string) => {
    const list = await get<JobInstance[]>('/api/console/query/instances', { tenantId })
    const row = list.find((x) => x.id === instanceId)
    if (!row) {
      throw new Error('实例不存在')
    }
    return row
  },

  /** 对齐 OpenAPI 后改为独立命令 DTO（需 instanceNo / jobCode / bizDate 等） */
  retry: (instanceNo: string, tenantId: string, jobCode: string, bizDate: string) =>
    post<string>('/api/console/jobs/rerun', {
      tenantId,
      targetInstanceNo: instanceNo,
      jobCode,
      bizDate,
      reason: 'console rerun',
    }),

  cancel: (_instanceId: number, _tenantId: string) =>
    Promise.reject(new Error('取消实例：请对齐后端命令 API 后实现')),

  partitions: async (instanceId: number, tenantId: string) => {
    const rows = await get<JobPartition[]>('/api/console/query/job-step-instances', { tenantId })
    return rows.filter((r) => r.jobInstanceId === instanceId)
  },

  workflowRuns: async (query: WorkflowRunQuery) => {
    const items = await get<WorkflowRun[]>('/api/console/query/workflow-runs', {
      tenantId: query.tenantId,
    })
    let rows = [...items]
    if (query.workflowCode) {
      rows = rows.filter((r) => r.workflowCode?.includes(query.workflowCode))
    }
    if (query.runStatus) {
      rows = rows.filter((r) => r.runStatus === query.runStatus)
    }
    const total = rows.length
    const start = (query.page - 1) * query.pageSize
    return {
      records: rows.slice(start, start + query.pageSize),
      total,
      page: query.page,
      pageSize: query.pageSize,
    } satisfies PageResult<WorkflowRun>
  },

  workflowRunDetail: async (runId: number, tenantId: string) => {
    const list = await get<WorkflowRun[]>('/api/console/query/workflow-runs', { tenantId })
    const row = list.find((x) => x.id === runId)
    if (!row) {
      throw new Error('Workflow Run 不存在')
    }
    return row
  },
}
