/**
 * Workflow DAG 编辑器内部类型。
 *
 * 与后端三张工作流表的字段映射见 `file-batch-system/docs/design/workflow-dag-designer.md` §5。
 * 起止、作业、网关、文件节点由 codec 统一保真，未展示字段透传。
 */

export type DesignerNodeType = 'START' | 'END' | 'JOB' | 'FILE_STEP' | 'GATEWAY'

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
  /** GATEWAY 分支条件等，codec 透传 */
  label?: string
  /** 边扩展属性(edgeType / enabled 等),codec 透传，保存时不得丢失。 */
  attrs?: Record<string, unknown>
}

/**
 * BE `workflow_definition.definition_json` 的精简反序列化结构。
 *
 * definition_json 只读取/写入 nodes + edges 两个数组;version / workflowCode 等元信息
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
