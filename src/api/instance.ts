import { get, post } from '@/api/client'
import { fetchAllPageItems, toPageResult } from '@/api/adapters'
import { queryJobInstances, type InstanceQueryParams } from '@/api/queries/instances'
import type {
  ConsoleJobInstanceResponse,
  ConsoleJobStepInstanceResponse,
  ConsoleWorkflowRunResponse,
} from '@/types/console-api'
import type { PageResponse, PageResult } from '@/types'

export type InstanceQuery = InstanceQueryParams

export interface WorkflowRunQuery {
  tenantId?: string
  /** 由 workflowCode 在页面侧解析为 definitionId 后传入 */
  workflowDefinitionId?: number
  /** exact match */
  runStatus?: string
  /** partial match */
  traceId?: string
  page: number
  pageSize: number
}

export const instanceApi = {
  list: (query: InstanceQuery) => queryJobInstances(query),

  detail: (instanceId: number, tenantId: string) =>
    get<ConsoleJobInstanceResponse>(`/api/console/queries/instances/${instanceId}`, { tenantId }),

  retry: (instanceNo: string, tenantId: string, jobCode: string, bizDate: string) =>
    post<string>('/api/console/jobs/rerun', {
      tenantId,
      targetInstanceNo: instanceNo,
      jobCode,
      bizDate,
      reason: 'console rerun',
    }),

  cancel: (instanceId: number, tenantId: string) =>
    post<string>(`/api/console/instances/${instanceId}/cancel`, undefined, {
      params: { tenantId },
    }),

  partitions: async (instanceId: number, tenantId: string) => {
    // 传入 jobInstanceId 参数让后端过滤（后端不支持时会忽略该参数，回退到全量）
    const rows = await fetchAllPageItems<ConsoleJobStepInstanceResponse>(
      '/api/console/queries/job-step-instances',
      { tenantId, jobInstanceId: instanceId },
    )
    return rows.filter((r) => r.jobInstanceId === instanceId)
  },

  workflowRuns: async (query: WorkflowRunQuery) => {
    const hasFilter =
      query.workflowDefinitionId != null ||
      !!(query.runStatus && query.runStatus.trim()) ||
      !!(query.traceId && query.traceId.trim())

    if (!hasFilter) {
      const pr = await get<PageResponse<ConsoleWorkflowRunResponse>>(
        '/api/console/queries/workflow-runs',
        {
          tenantId: query.tenantId,
          pageNo: query.page,
          pageSize: query.pageSize,
        },
      )
      return {
        records: (pr.items ?? []) as ConsoleWorkflowRunResponse[],
        total: pr.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      } satisfies PageResult<ConsoleWorkflowRunResponse>
    }

    // 将过滤参数传给后端（后端支持时减少传输量，客户端仍做兜底过滤）
    const items = await fetchAllPageItems<ConsoleWorkflowRunResponse>(
      '/api/console/queries/workflow-runs',
      {
        tenantId: query.tenantId,
        ...(query.workflowDefinitionId != null
          ? { workflowDefinitionId: query.workflowDefinitionId }
          : {}),
        ...(query.runStatus?.trim() ? { runStatus: query.runStatus.trim() } : {}),
        ...(query.traceId?.trim() ? { traceId: query.traceId.trim() } : {}),
      },
    )
    let rows = [...items]
    if (query.workflowDefinitionId != null) {
      rows = rows.filter((r) => r.workflowDefinitionId === query.workflowDefinitionId)
    }
    if (query.runStatus?.trim()) {
      rows = rows.filter((r) => r.runStatus === query.runStatus)
    }
    if (query.traceId?.trim()) {
      rows = rows.filter((r) => r.traceId?.includes(query.traceId!.trim()))
    }
    return toPageResult(rows, query.page, query.pageSize)
  },

  workflowRunDetail: (runId: number, tenantId: string) =>
    get<ConsoleWorkflowRunResponse>(`/api/console/queries/workflow-runs/${runId}`, { tenantId }),

  /** POST /api/console/instances/{id}/terminate */
  terminate: (instanceId: number, tenantId: string) =>
    post<string>(`/api/console/instances/${instanceId}/terminate`, undefined, {
      params: { tenantId },
    }),

  /** GET /api/console/queries/instances/batch-status */
  batchStatus: (tenantId: string, instanceNos: string[]) =>
    get<unknown>('/api/console/queries/instances/batch-status', { tenantId, instanceNos }),

  /** POST /api/console/instances/partitions/{id}/cancel */
  cancelPartition: (partitionId: number, tenantId: string) =>
    post<string>(`/api/console/instances/partitions/${partitionId}/cancel`, undefined, {
      params: { tenantId },
    }),

  /** POST /api/console/instances/partitions/{id}/retry */
  retryPartition: (partitionId: number, tenantId: string) =>
    post<string>(`/api/console/instances/partitions/${partitionId}/retry`, undefined, {
      params: { tenantId },
    }),
}
