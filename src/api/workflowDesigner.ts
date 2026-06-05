/**
 * Workflow 设计器(MVP)端点封装 —— 与 BE PR #366 真实路径一致(与设计书旧路径不同)。
 *
 * - `getFull(id)` → `GET /api/console/workflow-definitions/{id}` 拉取 detail + nodes + edges
 * - `putFull(id, body)` → `PUT /api/console/workflow-definitions/{id}/full` 全量替换(乐观锁)
 * - 锁三件套:`acquireLock` / `releaseLock` / `renewLock` 对应 `PUT|DELETE|PUT .../lock[/renew]`
 *
 * 409 语义(由调用方按 `code` / `message` 分流):
 *   - 锁占用 → `lockedBy` 字段在 response.data
 *   - 版本冲突 → `expectedVersion` 不匹配
 */

import { get, put, del } from '@/api/client'
import type { WorkflowDefinitionDetailResponse } from '@/types/console-api'

/** PUT /full 请求体:与 BE `WorkflowDefinitionFullUpdateRequest` 对齐(nested:definition 包 nodes/edges) */
export interface WorkflowDefinitionFullUpdateRequest {
  definition: {
    tenantId: string
    workflowCode: string
    workflowName: string
    workflowType: string
    enabled: boolean
    nodes: Array<{
      nodeCode: string
      nodeName: string
      nodeType: string
      relatedJobCode?: string
      relatedPipelineCode?: string
      nodeParams?: string
      nodeOrder?: number
      retryMaxCount?: number
      timeoutSeconds?: number
      enabled?: boolean
    }>
    edges: Array<{
      fromNodeCode: string
      toNodeCode: string
      edgeType: string
      conditionExpr?: string
      enabled?: boolean
    }>
  }
  expectedVersion: number
  lockToken?: string
}

/** 锁信息:isMine=true 表示当前用户持有锁,可编辑 */
export interface WorkflowLockInfo {
  workflowDefinitionId: number
  lockedBy: string
  lockedByDisplayName?: string
  acquiredAt: string
  expiresAt: string
  isMine: boolean
}

/** 锁占用 409 响应体(BE PR #366 约定) */
export interface WorkflowLockConflict {
  lockedBy: string
  lockedByDisplayName?: string
  expiresAt: string
}

export const workflowDesignerApi = {
  getFull: (id: number, tenantId: string): Promise<WorkflowDefinitionDetailResponse> =>
    get<WorkflowDefinitionDetailResponse>(`/api/console/workflow-definitions/${id}`, { tenantId }),

  putFull: (
    id: number,
    body: WorkflowDefinitionFullUpdateRequest,
  ): Promise<WorkflowDefinitionDetailResponse> =>
    put<WorkflowDefinitionDetailResponse>(
      `/api/console/workflow-definitions/${id}/full`,
      body,
    ),

  // tenantId 是 BE @RequestParam(query 必填),必须走 config.params;
  // put() 第 2 参是 body(会被 BE 当请求体丢弃 → 400「tenantId not present」),故传 undefined。
  acquireLock: (id: number, tenantId: string): Promise<WorkflowLockInfo> =>
    put<WorkflowLockInfo>(`/api/console/workflow-definitions/${id}/lock`, undefined, {
      params: { tenantId },
    }),

  renewLock: (id: number, tenantId: string): Promise<WorkflowLockInfo> =>
    put<WorkflowLockInfo>(`/api/console/workflow-definitions/${id}/lock/renew`, undefined, {
      params: { tenantId },
    }),

  releaseLock: (id: number, tenantId: string): Promise<void> =>
    del<void>(`/api/console/workflow-definitions/${id}/lock`, { params: { tenantId } }),
}
