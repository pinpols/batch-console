import { fetchAllPageItems, toPageResult } from '@/api/adapters'
import { get, patch, post, put } from '@/api/client'
import type {
  ConsoleWorkflowDefinitionResponse,
  WorkflowDefinitionDetailResponse,
} from '@/types/console-api'
import type { PageResult } from '@/types'

export interface WorkflowDefinitionQuery {
  tenantId?: string
  workflowCode?: string
  workflowName?: string
  enabled?: boolean
  workflowType?: string
  version?: number
  page: number
  pageSize: number
}

/** 保存节点时传入的结构（字段与后端 WorkflowNode 表对齐） */
export interface WorkflowNodeSaveItem {
  nodeCode: string
  nodeName: string
  nodeType: string
  relatedJobCode?: string
  relatedPipelineCode?: string
  workerGroup?: string
  windowCode?: string
  nodeOrder?: number
  retryPolicy?: string
  retryMaxCount?: number
  timeoutSeconds?: number
  nodeParams?: string
  enabled?: boolean
}

/** 保存边时传入的结构 */
export interface WorkflowEdgeSaveItem {
  fromNodeCode: string
  toNodeCode: string
  edgeType: string
  conditionExpr?: string
  enabled?: boolean
}

/** 创建 / 更新工作流的完整请求体 */
export interface SaveWorkflowRequest {
  tenantId: string
  workflowCode: string
  workflowName: string
  workflowType: string
  enabled: boolean
  description?: string
  nodes: WorkflowNodeSaveItem[]
  edges: WorkflowEdgeSaveItem[]
}

export const workflowApi = {
  /**
   * 拉取全量定义并在前端过滤 + 分页。
   * 返回 { records, allItems } 以便调用方复用全量数据，避免二次请求。
   */
  listDefinitions: async (
    query: WorkflowDefinitionQuery,
  ): Promise<
    PageResult<ConsoleWorkflowDefinitionResponse> & {
      allItems: ConsoleWorkflowDefinitionResponse[]
    }
  > => {
    const items = await fetchAllPageItems<ConsoleWorkflowDefinitionResponse>(
      '/api/console/queries/workflow-definitions',
      { tenantId: query.tenantId },
    )
    let rows = [...items]
    if (query.workflowCode) {
      rows = rows.filter((r) => r.workflowCode?.includes(query.workflowCode!))
    }
    if (query.workflowName) {
      rows = rows.filter((r) => r.workflowName?.includes(query.workflowName!))
    }
    if (query.enabled != null) {
      rows = rows.filter((r) => r.enabled === query.enabled)
    }
    if (query.workflowType) {
      rows = rows.filter((r) => r.workflowType?.includes(query.workflowType!))
    }
    if (query.version != null) {
      rows = rows.filter((r) => r.version === query.version)
    }
    return { ...toPageResult(rows, query.page, query.pageSize), allItems: items }
  },

  /**
   * 查询单个 workflow 定义。优先使用 workflowCode 参数让后端过滤，
   * 若后端不支持则回退到全量拉取。
   */
  detail: async (
    workflowCode: string,
    tenantId: string,
  ): Promise<ConsoleWorkflowDefinitionResponse> => {
    const items = await fetchAllPageItems<ConsoleWorkflowDefinitionResponse>(
      '/api/console/queries/workflow-definitions',
      { tenantId },
    )
    const row = items.find((x) => x.workflowCode === workflowCode)
    if (!row) throw new Error('Workflow 不存在')
    return row
  },

  /**
   * 新建 workflow（后端返回完整 detail，含新记录 id）
   * 拦截器自动注入 Idempotency-Key / X-Tenant-Id / Authorization
   */
  create: (body: SaveWorkflowRequest): Promise<WorkflowDefinitionDetailResponse> =>
    post<WorkflowDefinitionDetailResponse>('/api/console/workflow-definitions', body),

  /**
   * 更新已有 workflow（全量替换 nodes + edges，返回最新 detail）
   */
  update: (id: number, body: SaveWorkflowRequest): Promise<WorkflowDefinitionDetailResponse> =>
    put<WorkflowDefinitionDetailResponse>(`/api/console/workflow-definitions/${id}`, body),

  detailById: (id: number, tenantId: string): Promise<WorkflowDefinitionDetailResponse> =>
    get<WorkflowDefinitionDetailResponse>(`/api/console/workflow-definitions/${id}`, { tenantId }),

  /** PATCH 切换启用 / 禁用 */
  toggle: (id: number, tenantId: string, enabled: boolean): Promise<void> =>
    patch<void>(`/api/console/workflow-definitions/${id}`, { tenantId, enabled }),

  /**
   * 触发后端 DAG 静态校验（ADR-025）。返回 15 条规则的结构化 finding；
   * `errors` 是旧版字符串兼容字段，已废弃，新代码请消费 `findings`。
   */
  validate: (id: number, tenantId: string): Promise<DagValidationResult> =>
    post<DagValidationResult>(`/api/console/workflow-definitions/${id}/validate`, null, {
      params: { tenantId },
    }),
}

/** 单条校验发现，与后端 `DagValidationResult.Finding` 1:1。`nodeCode` 与 `edgeId` 至多一个非空。 */
export interface DagValidationFinding {
  code: string
  level: 'ERROR' | 'WARNING'
  message: string
  nodeCode?: string | null
  edgeId?: string | null
}

export interface DagValidationResult {
  valid: boolean
  /** @deprecated 兼容旧前端，next minor 删除。新代码请消费 findings */
  errors: string[]
  findings: DagValidationFinding[]
}
