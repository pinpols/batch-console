/**
 * Workflow DAG 编辑器(Spike 阶段)内部类型。
 *
 * 与 BE `workflow_definition` / `workflow_node` / `workflow_edge` 三表的字段映射见
 * `file-batch-system/docs/design/workflow-dag-designer.md` §5。Spike 阶段只覆盖 START / END / JOB,
 * 其余节点(GATEWAY / FILE_STEP / APPROVAL)在 codec 中作为通用矩形渲染,字段透传。
 */

export type DesignerNodeType = 'START' | 'END' | 'JOB' | 'FILE_STEP' | 'GATEWAY' | 'APPROVAL'

export interface DesignerNode {
  id: string
  nodeCode: string
  nodeName: string
  nodeType: DesignerNodeType
  x: number
  y: number
  /** 节点扩展属性(JOB.related_job_code 等),codec 透传 */
  attrs?: Record<string, unknown>
}

export interface DesignerEdge {
  id: string
  source: string
  target: string
  /** GATEWAY 分支条件等(本 Spike 阶段透传) */
  label?: string
  /** 边扩展属性(edgeType / enabled 等),codec 透传，保存时不得丢失。 */
  attrs?: Record<string, unknown>
}

/**
 * BE `workflow_definition.definition_json` 的精简反序列化结构。
 *
 * Spike 阶段只读取/写入 nodes + edges 两个数组;version / workflowCode 等元信息
 * 走上层 `WorkflowDefinition` 而非 definition_json 自身。
 */
export interface WorkflowDefinitionJson {
  nodes: Array<{
    nodeCode: string
    nodeName?: string
    nodeType: string
    x?: number
    y?: number
    [k: string]: unknown
  }>
  edges: Array<{
    sourceNodeCode: string
    targetNodeCode: string
    label?: string
    [k: string]: unknown
  }>
}

export interface DesignerSnapshot {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
}
