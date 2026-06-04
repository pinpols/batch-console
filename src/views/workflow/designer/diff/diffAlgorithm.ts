/**
 * Workflow definition_json diff 算法(Polish 阶段)。
 *
 * 输入两个 `WorkflowDefinitionJson`(from / to),输出每个节点/边的状态:
 * - added:to 有但 from 没有
 * - removed:from 有但 to 没有
 * - modified:两侧都有,但 nodeName / nodeType / 关键 attrs 不同(节点);label 不同(边)
 * - unchanged:两侧完全一致
 *
 * 节点身份键 = `nodeCode`(BE 唯一)。边身份键 = `${source}->${target}`。
 */
import type { WorkflowDefinitionJson } from '../types'

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface NodeDiffEntry {
  nodeCode: string
  status: DiffStatus
  fromNode?: WorkflowDefinitionJson['nodes'][number]
  toNode?: WorkflowDefinitionJson['nodes'][number]
}

export interface EdgeDiffEntry {
  edgeKey: string
  status: DiffStatus
  fromEdge?: WorkflowDefinitionJson['edges'][number]
  toEdge?: WorkflowDefinitionJson['edges'][number]
}

export interface DefinitionDiff {
  nodes: NodeDiffEntry[]
  edges: EdgeDiffEntry[]
  summary: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

function edgeKey(e: { sourceNodeCode: string; targetNodeCode: string }): string {
  return `${e.sourceNodeCode}->${e.targetNodeCode}`
}

function nodesEqual(
  a: WorkflowDefinitionJson['nodes'][number],
  b: WorkflowDefinitionJson['nodes'][number],
): boolean {
  if (a.nodeType !== b.nodeType) return false
  if ((a.nodeName ?? '') !== (b.nodeName ?? '')) return false
  // 跳过 x/y 纯排版坐标
  const keys = new Set<string>()
  for (const k of Object.keys(a)) if (k !== 'x' && k !== 'y') keys.add(k)
  for (const k of Object.keys(b)) if (k !== 'x' && k !== 'y') keys.add(k)
  for (const k of keys) {
    if (k === 'nodeCode' || k === 'nodeName' || k === 'nodeType') continue
    const av = (a as Record<string, unknown>)[k]
    const bv = (b as Record<string, unknown>)[k]
    if (JSON.stringify(av ?? null) !== JSON.stringify(bv ?? null)) return false
  }
  return true
}

function edgesEqual(
  a: WorkflowDefinitionJson['edges'][number],
  b: WorkflowDefinitionJson['edges'][number],
): boolean {
  return (a.label ?? '') === (b.label ?? '')
}

export function diffDefinitions(
  from: WorkflowDefinitionJson | null | undefined,
  to: WorkflowDefinitionJson | null | undefined,
): DefinitionDiff {
  const fromNodes = from?.nodes ?? []
  const toNodes = to?.nodes ?? []
  const fromEdges = from?.edges ?? []
  const toEdges = to?.edges ?? []

  const fromNodeMap = new Map(fromNodes.map((n) => [n.nodeCode, n]))
  const toNodeMap = new Map(toNodes.map((n) => [n.nodeCode, n]))
  const allCodes = new Set([...fromNodeMap.keys(), ...toNodeMap.keys()])

  const nodes: NodeDiffEntry[] = []
  for (const code of allCodes) {
    const f = fromNodeMap.get(code)
    const t = toNodeMap.get(code)
    if (f && !t) nodes.push({ nodeCode: code, status: 'removed', fromNode: f })
    else if (!f && t) nodes.push({ nodeCode: code, status: 'added', toNode: t })
    else if (f && t) {
      nodes.push({
        nodeCode: code,
        status: nodesEqual(f, t) ? 'unchanged' : 'modified',
        fromNode: f,
        toNode: t,
      })
    }
  }

  const fromEdgeMap = new Map(fromEdges.map((e) => [edgeKey(e), e]))
  const toEdgeMap = new Map(toEdges.map((e) => [edgeKey(e), e]))
  const allEdgeKeys = new Set([...fromEdgeMap.keys(), ...toEdgeMap.keys()])

  const edges: EdgeDiffEntry[] = []
  for (const k of allEdgeKeys) {
    const f = fromEdgeMap.get(k)
    const t = toEdgeMap.get(k)
    if (f && !t) edges.push({ edgeKey: k, status: 'removed', fromEdge: f })
    else if (!f && t) edges.push({ edgeKey: k, status: 'added', toEdge: t })
    else if (f && t) {
      edges.push({
        edgeKey: k,
        status: edgesEqual(f, t) ? 'unchanged' : 'modified',
        fromEdge: f,
        toEdge: t,
      })
    }
  }

  const summary = { added: 0, removed: 0, modified: 0, unchanged: 0 }
  for (const n of nodes) summary[n.status]++
  for (const e of edges) summary[e.status]++

  return { nodes, edges, summary }
}

/** 给定 nodeCode 在 from/to 侧的状态(用于 readonly canvas 上色) */
export function statusOfNodeInSide(
  diff: DefinitionDiff,
  nodeCode: string,
  side: 'from' | 'to',
): DiffStatus {
  const entry = diff.nodes.find((n) => n.nodeCode === nodeCode)
  if (!entry) return 'unchanged'
  if (entry.status === 'added' && side === 'from') return 'unchanged'
  if (entry.status === 'removed' && side === 'to') return 'unchanged'
  return entry.status
}
