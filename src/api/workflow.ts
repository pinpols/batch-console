import { fetchAllPageItems } from '@/api/adapters'
import { get, patch, post, put } from '@/api/client'
import type {
  ConsoleWorkflowDefinitionResponse,
  WorkflowDefinitionDetailResponse,
} from '@/types/console-api'
import type { PageResponse, PageResult } from '@/types'
import type { components } from '@/types/api.generated'

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
export type WorkflowNodeSaveItem = components['schemas']['WorkflowDefinitionSaveNodeItem']

/** 保存边时传入的结构 */
export type WorkflowEdgeSaveItem = components['schemas']['WorkflowDefinitionSaveEdgeItem']

/** 创建 / 更新工作流的完整请求体——复用 OpenAPI 生成类型。重新生成:`npm run gen:api`。 */
export type SaveWorkflowRequest = components['schemas']['WorkflowDefinitionSaveRequest']

export const workflowApi = {
  /** 工作流定义列表直接使用后端过滤和分页，避免随定义数量增长聚合全量页。 */
  listDefinitions: async (
    query: WorkflowDefinitionQuery,
  ): Promise<PageResult<ConsoleWorkflowDefinitionResponse>> => {
    const result = await get<PageResponse<ConsoleWorkflowDefinitionResponse>>(
      '/api/console/queries/workflow-definitions',
      {
        tenantId: query.tenantId,
        pageNo: query.page,
        pageSize: query.pageSize,
        workflowCode: query.workflowCode,
        workflowName: query.workflowName,
        enabled: query.enabled,
        workflowType: query.workflowType,
        version: query.version,
      },
    )
    return {
      records: result.items ?? [],
      total: result.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  },

  /**
   * 按编码查询单个 workflow 定义。该点查入口仍兼容同编码的历史版本，
   * 因而保留有上限的定义聚合；主列表不再依赖该方法。
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
    post<DagValidationResult>(`/api/console/workflow-definitions/${id}/validate`, undefined, {
      params: { tenantId },
    }),

  /**
   * 拉取 workflow 渲染好的 mermaid flowchart 文本。供 viewer / docs / PR review 共用,
   * 后端纯函数渲染,无 DB 状态副作用。
   */
  mermaid: (id: number, tenantId: string): Promise<{ mermaid: string }> =>
    get<{ mermaid: string }>(`/api/console/workflow-definitions/${id}/mermaid`, { tenantId }),
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
