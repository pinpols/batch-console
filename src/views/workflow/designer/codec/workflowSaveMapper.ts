/**
 * 设计器图模型到 WorkflowDefinitionSaveRequest 的无损映射。
 *
 * 后端 full update 会在一个事务中删除并重写所有节点与边；因此这里必须显式回传
 * 所有持久化语义字段，不能只保留画布当前展示的 job/pipeline/条件信息。
 */

import type { WorkflowDefinitionJson } from '../types'

type WorkflowNode = WorkflowDefinitionJson['nodes'][number]
type WorkflowEdge = WorkflowDefinitionJson['edges'][number]

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function optionalInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function toWorkflowSaveNodes(nodes: WorkflowNode[]) {
  return nodes.map((node) => {
    const raw = node as Record<string, unknown>
    return {
      nodeCode: node.nodeCode,
      nodeName: node.nodeName ?? node.nodeCode,
      nodeType: node.nodeType,
      relatedJobCode: optionalString(raw.jobCode) ?? optionalString(raw.relatedJobCode),
      relatedPipelineCode:
        optionalString(raw.pipelineCode) ?? optionalString(raw.relatedPipelineCode),
      workerGroup: optionalString(raw.workerGroup),
      windowCode: optionalString(raw.windowCode),
      nodeOrder: optionalInteger(raw.nodeOrder),
      retryPolicy: optionalString(raw.retryPolicy),
      retryMaxCount: optionalInteger(raw.maxRetries) ?? optionalInteger(raw.retryMaxCount),
      timeoutSeconds: optionalInteger(raw.timeoutSeconds),
      nodeParams: JSON.stringify(raw),
      crossDayDependencies: optionalString(raw.crossDayDependencies),
      crossDayDependencyTimeoutSeconds: optionalInteger(raw.crossDayDependencyTimeoutSeconds),
      enabled: optionalBoolean(raw.enabled),
    }
  })
}

export function toWorkflowSaveEdges(edges: WorkflowEdge[]) {
  return edges.map((edge) => {
    const raw = edge as Record<string, unknown>
    return {
      fromNodeCode: edge.sourceNodeCode,
      toNodeCode: edge.targetNodeCode,
      edgeType: optionalString(raw.edgeType) ?? 'SUCCESS',
      conditionExpr: typeof edge.label === 'string' ? edge.label : undefined,
      enabled: optionalBoolean(raw.enabled),
    }
  })
}
