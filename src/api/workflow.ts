import { fetchAllPageItems, toPageResult } from '@/api/adapters'
import { get, patch, post, put } from '@/api/client'
import { i18n } from '@/locales'
import type {
  ConsoleWorkflowDefinitionResponse,
  DagValidationFinding,
  DagValidationResult,
  WorkflowDefinitionDetailResponse,
  WorkflowDefinitionSaveRequest,
  WorkflowEdgeSaveItem,
  WorkflowNodeSaveItem,
} from '@/types/console-api'
import type { PageResult } from '@/types'

export type {
  DagValidationFinding,
  DagValidationResult,
  WorkflowEdgeSaveItem,
  WorkflowNodeSaveItem,
}

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

/** 创建 / 更新工作流的完整请求体。字段来自后端 OpenAPI `WorkflowDefinitionSaveRequest`。 */
export type SaveWorkflowRequest = WorkflowDefinitionSaveRequest

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
    if (!row) throw new Error(i18n.global.t('workflowApi.definitionNotFound'))
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
