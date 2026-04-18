/**
 * Workflow Designer — shared types, constants, theme maps, and pure helper functions.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export type WorkflowNodeKind = 'START' | 'TASK' | 'DECISION' | 'JOIN' | 'END'
export type WorkflowEdgeKind = 'SUCCESS' | 'FAILURE' | 'CONDITION' | 'DEFAULT'
export type SelectedKind = 'workflow' | 'node' | 'edge' | null

export interface WorkflowFormState {
  workflowCode: string
  workflowName: string
  workflowType: string
  enabled: boolean
  description: string
}

export interface NodeFormState {
  nodeCode: string
  nodeName: string
  nodeType: WorkflowNodeKind
  relatedJobCode: string
  relatedPipelineCode: string
  workerGroup: string
  windowCode: string
  nodeOrder: number
  retryPolicy: string
  retryMaxCount: number
  timeoutSeconds: number
  nodeParams: string
  enabled: boolean
}

export interface EdgeFormState {
  fromNodeCode: string
  toNodeCode: string
  edgeType: WorkflowEdgeKind
  conditionExpr: string
  enabled: boolean
  /** 与 X6 port id 一致：top / right / bottom / left */
  sourcePort?: string
  targetPort?: string
}

export interface WorkflowNodeDraft extends NodeFormState {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkflowEdgeDraft extends EdgeFormState {
  id: string
  fromNodeCode: string
  toNodeCode: string
}

export interface WorkflowDraftPayload {
  workflowDefinition: WorkflowFormState & {
    tenantId: string
    version: number
    id?: number | null
  }
  nodes: WorkflowNodeDraft[]
  edges: WorkflowEdgeDraft[]
  savedAt: string
}

export type ValidationIssueLevel = 'error' | 'warning'

export interface ValidationIssue {
  message: string
  level: ValidationIssueLevel
  nodeCode?: string
  edgeId?: string
}

export interface WorkflowNodeTheme {
  bg: string
  border: string
  accent: string
  text: string
  softText: string
  ring: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

/** 画布节点：小方块卡片（与 Shape.HTML.register 一致） */
export const WORKFLOW_NODE_VIEW_W = 64
export const WORKFLOW_NODE_VIEW_H = 64
export const WORKFLOW_PORT_SIDES = ['top', 'right', 'bottom', 'left'] as const
export const WORKFLOW_PORT_SIDE_SET = new Set<string>(WORKFLOW_PORT_SIDES)

// ─── Theme maps ─────────────────────────────────────────────────────────────────

export const nodeThemeMap: Record<WorkflowNodeKind, WorkflowNodeTheme> = {
  START: {
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.85)',
    accent: '#0891b2',
    text: '#0f172a',
    softText: '#155e75',
    ring: 'rgba(6, 182, 212, 0.18)',
  },
  TASK: {
    bg: 'rgba(100, 116, 139, 0.10)',
    border: 'rgba(100, 116, 139, 0.80)',
    accent: '#334155',
    text: '#0f172a',
    softText: '#475569',
    ring: 'rgba(100, 116, 139, 0.16)',
  },
  DECISION: {
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.86)',
    accent: '#ea580c',
    text: '#0f172a',
    softText: '#9a3412',
    ring: 'rgba(249, 115, 22, 0.18)',
  },
  JOIN: {
    bg: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.84)',
    accent: '#4f46e5',
    text: '#0f172a',
    softText: '#312e81',
    ring: 'rgba(99, 102, 241, 0.18)',
  },
  END: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.84)',
    accent: '#dc2626',
    text: '#0f172a',
    softText: '#7f1d1d',
    ring: 'rgba(239, 68, 68, 0.18)',
  },
}

export const edgeThemeMap: Record<WorkflowEdgeKind, { stroke: string; label: string }> = {
  SUCCESS: { stroke: '#2563eb', label: 'SUCCESS' },
  FAILURE: { stroke: '#dc2626', label: 'FAILURE' },
  CONDITION: { stroke: '#ea580c', label: 'CONDITION' },
  DEFAULT: { stroke: '#64748b', label: 'DEFAULT' },
}

// ─── Enum arrays ────────────────────────────────────────────────────────────────

export const nodeKinds: Array<{ kind: WorkflowNodeKind; label: string }> = [
  { kind: 'START', label: '起点' },
  { kind: 'TASK', label: '任务' },
  { kind: 'DECISION', label: '条件分支' },
  { kind: 'JOIN', label: '汇聚' },
  { kind: 'END', label: '终点' },
]

export const edgeKinds: Array<{ kind: WorkflowEdgeKind; label: string }> = [
  { kind: 'SUCCESS', label: '成功边' },
  { kind: 'FAILURE', label: '失败边' },
  { kind: 'CONDITION', label: '条件边' },
  { kind: 'DEFAULT', label: '默认边' },
]

// ─── Pure helper functions ──────────────────────────────────────────────────────

export function edgeLegendColor(kind: WorkflowEdgeKind) {
  return edgeThemeMap[kind]?.stroke ?? '#64748b'
}

export function edgeLabelText(edge: Pick<WorkflowEdgeDraft, 'edgeType' | 'conditionExpr'>) {
  return edge.conditionExpr.trim() || edgeThemeMap[edge.edgeType]?.label || ''
}

export function buildEdgeLabels(edge: Pick<WorkflowEdgeDraft, 'edgeType' | 'conditionExpr'>) {
  const text = edgeLabelText(edge)
  if (!text) return []
  const stroke = edgeThemeMap[edge.edgeType]?.stroke ?? '#64748b'
  return [
    {
      position: { distance: 0.52, offset: { x: 0, y: -12 } },
      attrs: {
        label: {
          text,
          fontSize: 10,
          fontWeight: 700,
          fill: '#0f172a',
        },
        body: {
          fill: '#ffffff',
          fillOpacity: 0.92,
          stroke,
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
      },
    },
  ]
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function toNodeKind(value: string | null | undefined): WorkflowNodeKind {
  const text = String(value ?? '')
    .trim()
    .toUpperCase()
  if (['START', 'SOURCE'].includes(text)) return 'START'
  if (['DECISION', 'GATEWAY', 'BRANCH'].includes(text)) return 'DECISION'
  if (['JOIN', 'MERGE', 'SYNC'].includes(text)) return 'JOIN'
  if (['END', 'STOP', 'TERMINAL'].includes(text)) return 'END'
  return 'TASK'
}

export function toEdgeKind(value: string | null | undefined): WorkflowEdgeKind {
  const text = String(value ?? '')
    .trim()
    .toUpperCase()
  if (['FAIL', 'FAILED', 'ERROR', 'FAILURE'].includes(text)) return 'FAILURE'
  if (['COND', 'CONDITION', 'IF', 'RULE'].includes(text)) return 'CONDITION'
  if (['DEFAULT', 'ELSE', 'FALLBACK'].includes(text)) return 'DEFAULT'
  return 'SUCCESS'
}

export function getTheme(kind: WorkflowNodeKind) {
  return nodeThemeMap[kind] ?? nodeThemeMap.TASK
}

export function defaultNodeForm(kind: WorkflowNodeKind, nodeCode = ''): NodeFormState {
  return {
    nodeCode,
    nodeName: kind === 'TASK' ? '新任务' : `${kind} 节点`,
    nodeType: kind,
    relatedJobCode: '',
    relatedPipelineCode: '',
    workerGroup: '',
    windowCode: '',
    nodeOrder: 0,
    retryPolicy: 'NONE',
    retryMaxCount: 0,
    timeoutSeconds: 0,
    nodeParams: '{}',
    enabled: true,
  }
}

export function defaultEdgeForm(): EdgeFormState {
  return {
    fromNodeCode: '',
    toNodeCode: '',
    edgeType: 'SUCCESS',
    conditionExpr: '',
    enabled: true,
  }
}

export function copyNodeForm(source: NodeFormState, target: NodeFormState) {
  Object.assign(target, source)
}

export function copyEdgeForm(source: EdgeFormState, target: EdgeFormState) {
  Object.assign(target, source)
}

export function copyWorkflowForm(source: WorkflowFormState, target: WorkflowFormState) {
  Object.assign(target, source)
}

export function validationIssueLevelLabel(level: ValidationIssueLevel) {
  return level === 'error' ? '错误' : '警告'
}

export function isValidationIssueActionable(issue: ValidationIssue) {
  return Boolean(issue.nodeCode || issue.edgeId)
}

/** 类型安全的 getData 读取，避免全文大量 as 断言 */
export function getNodeData(cell: import('@antv/x6').Cell): WorkflowNodeDraft {
  return cell.getData() as WorkflowNodeDraft
}

export function getEdgeData(cell: import('@antv/x6').Cell): WorkflowEdgeDraft {
  return cell.getData() as WorkflowEdgeDraft
}

// ─── Edge port resolution helpers ───────────────────────────────────────────────

/** 按两节点中心相对位置选端口：上下关系用下→上，左右用右→左（反向则对称） */
export function pickEdgePortsBetweenDrafts(
  from: WorkflowNodeDraft,
  to: WorkflowNodeDraft,
): { sourcePort: string; targetPort: string } {
  const fw = from.width || WORKFLOW_NODE_VIEW_W
  const fh = from.height || WORKFLOW_NODE_VIEW_H
  const tw = to.width || WORKFLOW_NODE_VIEW_W
  const th = to.height || WORKFLOW_NODE_VIEW_H
  const scx = from.x + fw / 2
  const scy = from.y + fh / 2
  const tcx = to.x + tw / 2
  const tcy = to.y + th / 2
  const dx = tcx - scx
  const dy = tcy - scy
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy > 0) return { sourcePort: 'bottom', targetPort: 'top' }
    return { sourcePort: 'top', targetPort: 'bottom' }
  }
  if (dx > 0) return { sourcePort: 'right', targetPort: 'left' }
  return { sourcePort: 'left', targetPort: 'right' }
}

export function resolveEdgePortsForDraft(
  edge: WorkflowEdgeDraft,
  fromN: WorkflowNodeDraft | undefined,
  toN: WorkflowNodeDraft | undefined,
): { sourcePort: string; targetPort: string } {
  const sp = edge.sourcePort && WORKFLOW_PORT_SIDE_SET.has(edge.sourcePort) ? edge.sourcePort : null
  const tp = edge.targetPort && WORKFLOW_PORT_SIDE_SET.has(edge.targetPort) ? edge.targetPort : null
  if (sp && tp) return { sourcePort: sp, targetPort: tp }
  if (fromN && toN) return pickEdgePortsBetweenDrafts(fromN, toN)
  return { sourcePort: 'right', targetPort: 'left' }
}

export function pickEdgePortsBetweenNodes(
  source: import('@antv/x6').Node,
  target: import('@antv/x6').Node,
) {
  const sp = source.position()
  const ss = source.size()
  const tp = target.position()
  const ts = target.size()
  const from: WorkflowNodeDraft = {
    ...(source.getData() as WorkflowNodeDraft),
    x: sp.x,
    y: sp.y,
    width: ss.width,
    height: ss.height,
  }
  const to: WorkflowNodeDraft = {
    ...(target.getData() as WorkflowNodeDraft),
    x: tp.x,
    y: tp.y,
    width: ts.width,
    height: ts.height,
  }
  return pickEdgePortsBetweenDrafts(from, to)
}

// ─── Normalize helpers (API → draft) ────────────────────────────────────────────

export function normalizeWorkflowDefinition(
  row: import('@/types/console-api').ConsoleWorkflowDefinitionResponse | null | undefined,
  fallbackTenantId: string,
) {
  return {
    tenantId: row?.tenantId ?? fallbackTenantId,
    workflowCode: row?.workflowCode ?? '',
    workflowName: row?.workflowName ?? '',
    workflowType: row?.workflowType ?? '',
    enabled: row?.enabled ?? true,
    description: row?.description ?? '',
    version: row?.version ?? 1,
    id: row?.id ?? null,
  }
}

export function normalizeWorkflowNode(
  row: import('@/types/console-api').ConsoleWorkflowNodeResponse,
): WorkflowNodeDraft {
  return {
    nodeCode: row.nodeCode,
    nodeName: row.nodeName ?? row.nodeCode,
    nodeType: toNodeKind(row.nodeType),
    relatedJobCode: row.relatedJobCode ?? '',
    relatedPipelineCode: row.relatedPipelineCode ?? '',
    workerGroup: row.workerGroup ?? '',
    windowCode: row.windowCode ?? '',
    nodeOrder: row.nodeOrder ?? 0,
    retryPolicy: row.retryPolicy ?? 'NONE',
    retryMaxCount: row.retryMaxCount ?? 0,
    timeoutSeconds: row.timeoutSeconds ?? 0,
    nodeParams: row.nodeParams ?? '',
    enabled: row.enabled ?? true,
    x: 0,
    y: 0,
    width: WORKFLOW_NODE_VIEW_W,
    height: WORKFLOW_NODE_VIEW_H,
  }
}

export function normalizeWorkflowEdge(
  row: import('@/types/console-api').ConsoleWorkflowEdgeResponse,
): WorkflowEdgeDraft {
  return {
    id: String(row.id ?? `${row.fromNodeCode}-${row.toNodeCode}-${row.edgeType}`),
    fromNodeCode: row.fromNodeCode,
    toNodeCode: row.toNodeCode,
    edgeType: toEdgeKind(row.edgeType),
    conditionExpr: row.conditionExpr ?? '',
    enabled: row.enabled ?? true,
  }
}

// ─── Layout algorithm ───────────────────────────────────────────────────────────

export function layoutWorkflowNodes(nodes: WorkflowNodeDraft[], edges: WorkflowEdgeDraft[]) {
  const byCode = new Map(nodes.map((node) => [node.nodeCode, node]))
  const incoming = new Map<string, Set<string>>()
  const outgoing = new Map<string, Set<string>>()
  const indegree = new Map<string, number>()
  const level = new Map<string, number>()

  for (const node of nodes) {
    incoming.set(node.nodeCode, new Set())
    outgoing.set(node.nodeCode, new Set())
    indegree.set(node.nodeCode, 0)
    level.set(node.nodeCode, 0)
  }

  for (const edge of edges) {
    if (!byCode.has(edge.fromNodeCode) || !byCode.has(edge.toNodeCode)) continue
    incoming.get(edge.toNodeCode)?.add(edge.fromNodeCode)
    outgoing.get(edge.fromNodeCode)?.add(edge.toNodeCode)
    indegree.set(edge.toNodeCode, (indegree.get(edge.toNodeCode) ?? 0) + 1)
  }

  const queue = nodes
    .filter((node) => (indegree.get(node.nodeCode) ?? 0) === 0)
    .sort((a, b) => a.nodeOrder - b.nodeOrder || a.nodeCode.localeCompare(b.nodeCode))
    .map((node) => node.nodeCode)

  const visited = new Set<string>()
  while (queue.length) {
    const code = queue.shift() as string
    if (visited.has(code)) continue
    visited.add(code)
    const currentLevel = level.get(code) ?? 0
    for (const target of outgoing.get(code) ?? []) {
      level.set(target, Math.max(level.get(target) ?? 0, currentLevel + 1))
      indegree.set(target, (indegree.get(target) ?? 0) - 1)
      if ((indegree.get(target) ?? 0) <= 0) {
        queue.push(target)
      }
    }
  }

  const buckets = new Map<number, WorkflowNodeDraft[]>()
  for (const node of nodes) {
    const l = level.get(node.nodeCode) ?? 0
    const list = buckets.get(l) ?? []
    list.push(node)
    buckets.set(l, list)
  }

  const sortedLevels = [...buckets.keys()].sort((a, b) => a - b)
  const result: WorkflowNodeDraft[] = []
  const xGap = Math.max(292, WORKFLOW_NODE_VIEW_W + 40)
  const yGap = 150
  const baseX = 80
  const baseY = 80

  for (const l of sortedLevels) {
    const list = (buckets.get(l) ?? []).sort(
      (a, b) => a.nodeOrder - b.nodeOrder || a.nodeCode.localeCompare(b.nodeCode),
    )
    list.forEach((node, idx) => {
      result.push({
        ...node,
        x: baseX + l * xGap,
        y: baseY + idx * yGap,
      })
    })
  }

  return result
}
