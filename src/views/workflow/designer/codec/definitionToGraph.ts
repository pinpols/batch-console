/**
 * `workflow_definition.definition_json` → designer 内部 nodes/edges 结构。
 *
 * Spike 阶段:
 * - START / END / JOB 渲染各自专用 Vue 节点(StartNode / EndNode / JobNode)
 * - GATEWAY / FILE_STEP / APPROVAL 占位为通用矩形(nodeType 透传,下阶段在 codec 不动的前提下接专用节点)
 * - nodeCode 同时作为 X6 node id,保证幂等且与 BE 字段对齐
 */

import type {
  DesignerEdge,
  DesignerNode,
  DesignerNodeType,
  DesignerSnapshot,
  WorkflowDefinitionJson,
} from '../types'

const KNOWN_NODE_TYPES: ReadonlySet<DesignerNodeType> = new Set<DesignerNodeType>([
  'START',
  'END',
  'JOB',
  'FILE_STEP',
  'GATEWAY',
  'APPROVAL',
])

function normalizeNodeType(raw: string): DesignerNodeType {
  const upper = (raw ?? '').toUpperCase()
  return KNOWN_NODE_TYPES.has(upper as DesignerNodeType) ? (upper as DesignerNodeType) : 'JOB'
}

export function definitionToGraph(def: WorkflowDefinitionJson | null | undefined): DesignerSnapshot {
  if (!def) return { nodes: [], edges: [] }
  const nodes: DesignerNode[] = (def.nodes ?? []).map((raw, idx) => ({
    id: raw.nodeCode,
    nodeCode: raw.nodeCode,
    nodeName: raw.nodeName ?? raw.nodeCode,
    nodeType: normalizeNodeType(raw.nodeType),
    x: typeof raw.x === 'number' ? raw.x : 80 + (idx % 5) * 180,
    y: typeof raw.y === 'number' ? raw.y : 80 + Math.floor(idx / 5) * 120,
    attrs: { ...raw },
  }))
  const edges: DesignerEdge[] = (def.edges ?? []).map((raw, idx) => ({
    id: `e_${raw.sourceNodeCode}_${raw.targetNodeCode}_${idx}`,
    source: raw.sourceNodeCode,
    target: raw.targetNodeCode,
    label: typeof raw.label === 'string' ? raw.label : undefined,
  }))
  return { nodes, edges }
}
