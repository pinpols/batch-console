import { get } from '@/api/client'
import { fetchAllPageItems } from '@/api/adapters'
import type {
  ConsoleWorkflowDefinitionResponse,
  ConsoleWorkflowEdgeResponse,
  ConsoleWorkflowNodeResponse,
  ConsoleWorkflowNodeRunResponse,
  ConsoleWorkflowRunResponse,
  ConsoleWorkflowTopologyResponse,
} from '@/types/console-api'
import type { PageResponse, PageResult } from '@/types'

/** OpenAPI data 为 PageResponse，此处聚合全量供 DAG / 筛选使用 */
export function queryWorkflowDefinitions(tenantId: string) {
  return fetchAllPageItems<ConsoleWorkflowDefinitionResponse>(
    '/api/console/queries/workflow-definitions',
    {
      tenantId,
    },
  )
}

export function queryWorkflowNodes(tenantId: string, workflowDefinitionId?: number) {
  return fetchAllPageItems<ConsoleWorkflowNodeResponse>('/api/console/queries/workflow-nodes', {
    tenantId,
    ...(workflowDefinitionId != null ? { workflowDefinitionId } : {}),
  })
}

export function queryWorkflowEdges(tenantId: string, workflowDefinitionId?: number) {
  return fetchAllPageItems<ConsoleWorkflowEdgeResponse>('/api/console/queries/workflow-edges', {
    tenantId,
    ...(workflowDefinitionId != null ? { workflowDefinitionId } : {}),
  })
}

export function queryWorkflowRuns(
  tenantId: string,
  workflowDefinitionId?: number,
  runStatus?: string,
) {
  return fetchAllPageItems<ConsoleWorkflowRunResponse>('/api/console/queries/workflow-runs', {
    tenantId,
    ...(workflowDefinitionId != null ? { workflowDefinitionId } : {}),
    ...(runStatus ? { runStatus } : {}),
  })
}

export function queryWorkflowNodeRuns(tenantId: string, workflowRunId?: number) {
  return fetchAllPageItems<ConsoleWorkflowNodeRunResponse>(
    '/api/console/queries/workflow-node-runs',
    {
      tenantId,
      ...(workflowRunId != null ? { workflowRunId } : {}),
    },
  )
}

export async function queryWorkflowNodeRunsPaged(query: {
  tenantId: string
  page: number
  pageSize: number
  workflowRunId?: number
  nodeCode?: string
  nodeStatus?: string
}): Promise<PageResult<ConsoleWorkflowNodeRunResponse>> {
  const pr = await get<PageResponse<ConsoleWorkflowNodeRunResponse>>(
    '/api/console/queries/workflow-node-runs',
    {
      tenantId: query.tenantId,
      pageNo: query.page,
      pageSize: query.pageSize,
      ...(query.workflowRunId != null ? { workflowRunId: query.workflowRunId } : {}),
      ...(query.nodeCode?.trim() ? { nodeCode: query.nodeCode.trim() } : {}),
      ...(query.nodeStatus?.trim() ? { nodeStatus: query.nodeStatus.trim() } : {}),
    },
  )
  return {
    records: (pr.items ?? []) as ConsoleWorkflowNodeRunResponse[],
    total: pr.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** GET /api/console/queries/workflow-topology — 协议约定五段：definition / nodes / edges / workflowRuns / nodeRuns */
export function queryWorkflowTopology(tenantId: string) {
  return get<ConsoleWorkflowTopologyResponse>('/api/console/queries/workflow-topology', {
    tenantId,
  })
}
