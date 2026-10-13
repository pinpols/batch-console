import type { DesignerEdge, DesignerNode, DesignerNodeType } from '../types'

export type AutomaticPlacement =
  { kind: 'standalone' } | { kind: 'append'; sourceId: string } | { kind: 'insert'; edgeId: string }

export type AutomaticPlacementResult =
  | { ok: true; placement: AutomaticPlacement }
  | {
      ok: false
      reason:
        | 'duplicateStart'
        | 'multipleSelection'
        | 'selectInsertionPoint'
        | 'cannotAppendAfterEnd'
        | 'cannotInsertTerminal'
    }

/** 为多个相同类型的节点生成可持续创建的临时编码。 */
export function createUniqueNodeCode(
  nodeType: DesignerNodeType,
  nodes: DesignerNode[],
  related?: string,
): string {
  const prefix = related ? `${nodeType.toLowerCase()}_${related}` : nodeType.toLowerCase()
  const base = `${prefix}_${Date.now().toString(36)}`
  const existing = new Set(nodes.map((node) => node.nodeCode))
  let candidate = base
  let suffix = 2
  while (existing.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  return candidate
}

/**
 * 为“点击添加节点”选择一个不会破坏 DAG 语义的自动连线位置。
 *
 * 规则按显式选择优先：选中边则插入边中间，选中节点则追加到节点之后；
 * 没有选择时仅在图上存在唯一可继续的末端节点时自动追加，避免在分支图里猜错依赖。
 */
export function resolveAutomaticPlacement(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  selectedIds: ReadonlySet<string>,
  nodeType: DesignerNodeType,
): AutomaticPlacementResult {
  if (nodeType === 'START') {
    if (nodes.some((node) => node.nodeType === 'START')) {
      return { ok: false, reason: 'duplicateStart' }
    }
    return { ok: true, placement: { kind: 'standalone' } }
  }

  if (selectedIds.size > 1) return { ok: false, reason: 'multipleSelection' }

  const selectedId = selectedIds.values().next().value as string | undefined
  if (selectedId) {
    const selectedEdge = edges.find((edge) => edge.id === selectedId)
    if (selectedEdge) {
      if (nodeType === 'END') return { ok: false, reason: 'cannotInsertTerminal' }
      return { ok: true, placement: { kind: 'insert', edgeId: selectedEdge.id } }
    }

    const selectedNode = nodes.find((node) => node.id === selectedId)
    if (selectedNode) {
      if (selectedNode.nodeType === 'END') {
        return { ok: false, reason: 'cannotAppendAfterEnd' }
      }
      return { ok: true, placement: { kind: 'append', sourceId: selectedNode.id } }
    }
  }

  if (nodes.length === 0) return { ok: true, placement: { kind: 'standalone' } }

  const sourcesWithOutgoing = new Set(edges.map((edge) => edge.source))
  const openTails = nodes.filter(
    (node) => node.nodeType !== 'END' && !sourcesWithOutgoing.has(node.id),
  )
  if (openTails.length === 1) {
    return { ok: true, placement: { kind: 'append', sourceId: openTails[0]!.id } }
  }

  return { ok: false, reason: 'selectInsertionPoint' }
}

export function automaticNodeCenter(
  placement: AutomaticPlacement,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  fallback: { x: number; y: number },
  direction: 'TB' | 'LR',
): { x: number; y: number } {
  if (placement.kind === 'append') {
    const source = nodes.find((node) => node.id === placement.sourceId)
    if (source) {
      return direction === 'TB'
        ? { x: source.x + 70, y: source.y + 170 }
        : { x: source.x + 260, y: source.y + 30 }
    }
  }

  if (placement.kind === 'insert') {
    const edge = edges.find((item) => item.id === placement.edgeId)
    const source = nodes.find((node) => node.id === edge?.source)
    const target = nodes.find((node) => node.id === edge?.target)
    if (source && target) {
      return {
        x: Math.round((source.x + target.x) / 2 + 70),
        y: Math.round((source.y + target.y) / 2 + 30),
      }
    }
  }

  return fallback
}
