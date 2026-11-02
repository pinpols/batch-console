/**
 * Workflow 设计器 Pinia store(MVP 阶段)。
 *
 * 维护 nodes / edges / selectedIds / dirty + undo/redo 双栈(上限 50 步) +
 * BE detail meta(version / workflowCode / workflowName 等) + 锁状态 + 校验错误。
 *
 * 不耦合 X6 实例 —— 画布组件订阅 store 状态渲染,反向通过 action 提交变更,
 * 便于纯逻辑单测(无需 DOM)。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DesignerEdge, DesignerNode, DesignerNodeType, DesignerSnapshot } from '../types'
import type { ValidationError } from '../validators/dagValidators'
import type { AutomaticPlacement } from '../canvas/automaticConnection'

const UNDO_STACK_LIMIT = 50

function cloneSnapshot(nodes: DesignerNode[], edges: DesignerEdge[]): DesignerSnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, attrs: { ...(n.attrs ?? {}) } })),
    edges: edges.map((e) => ({ ...e, attrs: { ...(e.attrs ?? {}) } })),
  }
}

function snapshotFingerprint(nodes: DesignerNode[], edges: DesignerEdge[]): string {
  const snapshot = cloneSnapshot(nodes, edges)
  return JSON.stringify(snapshot)
}

/** BE workflow_definition 元信息(load 时填充,保存时回传) */
export interface DesignerMeta {
  id: number | null
  tenantId: string
  workflowCode: string
  workflowName: string
  workflowType: string
  enabled: boolean
  description?: string
  /** 乐观锁:PUT /full 必传,409 时刷新 */
  version: number
}

/** 锁状态:null = 未尝试 / isMine=true = 自己持锁可编辑 / isMine=false = 他人持锁只读 */
export interface DesignerLockMine {
  isMine: true
  lockedBy: string
  expiresAt: string
}
export interface DesignerLockReadonly {
  isMine: false
  lockedBy: string
  lockedByDisplayName?: string
  expiresAt: string
}
export type DesignerLockState = null | DesignerLockMine | DesignerLockReadonly

export type DependencyMutationResult =
  { ok: true } | { ok: false; reason: 'invalidEndpoint' | 'duplicate' | 'cycle' }

export type InspectorDraftField =
  | 'nodeName'
  | 'nodeSkipExpression'
  | 'edgeCondition'
  | 'nodeMaxRetries'
  | 'nodeTimeoutSeconds'
  | 'gatewayThreshold'
export interface InspectorDraft {
  field: InspectorDraftField
  elementId: string
  base: string
  value: string
}

const EMPTY_META: DesignerMeta = {
  id: null,
  tenantId: '',
  workflowCode: '',
  workflowName: '',
  workflowType: 'DAG',
  enabled: true,
  description: undefined,
  version: 0,
}

export const useDesignerStore = defineStore('workflowDesigner', () => {
  const nodes = ref<DesignerNode[]>([])
  const edges = ref<DesignerEdge[]>([])
  const selectedIds = ref<Set<string>>(new Set())
  const dirty = ref(false)
  const cleanFingerprint = ref(snapshotFingerprint([], []))
  const undoStack = ref<DesignerSnapshot[]>([])
  const redoStack = ref<DesignerSnapshot[]>([])
  const meta = ref<DesignerMeta>({ ...EMPTY_META })
  const lock = ref<DesignerLockState>(null)
  const validationErrors = ref<ValidationError[]>([])
  // 输入中的局部草稿不进入画布快照；失锁或检查器卸载时仍属于当前画布。
  const inspectorDrafts = ref<InspectorDraft[]>([])
  const inspectorScope = ref(0)

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const snapshot = computed<DesignerSnapshot>(() => cloneSnapshot(nodes.value, edges.value))
  /** 当前是否可编辑:锁状态为自己持有 才允许提交变更(只读态下 UI 禁用) */
  const editable = computed(() => lock.value !== null && lock.value.isMine === true)
  /** 节点级错误索引,供画布高亮使用 */
  const errorNodeIds = computed<Set<string>>(() => {
    const s = new Set<string>()
    for (const e of validationErrors.value) {
      if (e.nodeId) s.add(e.nodeId)
    }
    return s
  })
  /** 连线级错误索引,供画布语义线高亮使用 */
  const errorEdgeIds = computed<Set<string>>(() => {
    const s = new Set<string>()
    for (const e of validationErrors.value) {
      if (e.edgeId) s.add(e.edgeId)
    }
    return s
  })

  /** 在变更前 push 当前快照到 undoStack,清空 redoStack。 */
  function pushUndo() {
    const currentSnapshot = cloneSnapshot(nodes.value, edges.value)
    undoStack.value.push(currentSnapshot)
    if (undoStack.value.length > UNDO_STACK_LIMIT) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function applySnapshot(snap: DesignerSnapshot) {
    nodes.value = snap.nodes.map((n) => ({ ...n, attrs: { ...(n.attrs ?? {}) } }))
    edges.value = snap.edges.map((e) => ({ ...e, attrs: { ...(e.attrs ?? {}) } }))
  }

  function refreshDirtyFromBaseline() {
    dirty.value = snapshotFingerprint(nodes.value, edges.value) !== cleanFingerprint.value
  }

  function reset(snap: DesignerSnapshot = { nodes: [], edges: [] }) {
    inspectorScope.value += 1
    applySnapshot(snap)
    inspectorDrafts.value = []
    cleanFingerprint.value = snapshotFingerprint(nodes.value, edges.value)
    selectedIds.value = new Set()
    dirty.value = false
    undoStack.value = []
    redoStack.value = []
    validationErrors.value = []
  }

  /** JSON 应用清除画布历史，但不把未保存内容当成保存基线。 */
  function replaceGraphFromJson(snap: DesignerSnapshot) {
    if (inspectorDrafts.value.length) return false
    const savedFingerprint = cleanFingerprint.value
    reset(snap)
    cleanFingerprint.value = savedFingerprint
    refreshDirtyFromBaseline()
    return true
  }

  function inspectorValue(field: InspectorDraftField, elementId: string): string | null {
    if (field === 'edgeCondition') {
      const edge = edges.value.find((item) => item.id === elementId)
      return edge ? (edge.label ?? '') : null
    }
    const node = nodes.value.find((item) => item.id === elementId)
    if (!node) return null
    if (field === 'nodeName') return node.nodeName
    const key =
      field === 'nodeSkipExpression'
        ? 'skipExpression'
        : field === 'nodeMaxRetries'
          ? 'maxRetries'
          : field === 'nodeTimeoutSeconds'
            ? 'timeoutSeconds'
            : 'joinThreshold'
    const value = node.attrs?.[key]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  function normalizeDraft(field: InspectorDraftField, value: string): string {
    return field === 'edgeCondition' ? value.trim() : value
  }

  function getInspectorDraft(field: InspectorDraftField, elementId: string) {
    return inspectorDrafts.value.find(
      (draft) => draft.field === field && draft.elementId === elementId,
    )
  }

  function setInspectorDraft(
    field: InspectorDraftField,
    elementId: string,
    value: string,
    scope = inspectorScope.value,
  ) {
    if (scope !== inspectorScope.value) return
    const current = inspectorValue(field, elementId)
    if (current === null) return
    const existing = getInspectorDraft(field, elementId)
    if (normalizeDraft(field, value) === normalizeDraft(field, current)) {
      inspectorDrafts.value = inspectorDrafts.value.filter((draft) => draft !== existing)
      return
    }
    if (existing) existing.value = value
    else inspectorDrafts.value.push({ field, elementId, base: current, value })
  }

  function validInspectorDraft(draft: InspectorDraft) {
    if (!['nodeMaxRetries', 'nodeTimeoutSeconds', 'gatewayThreshold'].includes(draft.field))
      return true
    if (!draft.value.trim()) return draft.field !== 'gatewayThreshold'
    if (!/^\d+$/.test(draft.value.trim())) return false
    const value = Number(draft.value)
    if (!Number.isSafeInteger(value)) return false
    if (draft.field === 'nodeMaxRetries') return value <= 10
    if (draft.field === 'nodeTimeoutSeconds') return value >= 0
    const node = nodes.value.find((item) => item.id === draft.elementId)
    if (String(node?.attrs?.joinMode ?? '').toUpperCase() !== 'N_OF') return false
    const incoming = edges.value.filter((edge) => edge.target === draft.elementId).length
    return value >= 1 && value <= incoming
  }

  const inspectorDraftConflicts = computed(() =>
    inspectorDrafts.value.filter((draft) => {
      const current = inspectorValue(draft.field, draft.elementId)
      return (
        !validInspectorDraft(draft) ||
        current === null ||
        (normalizeDraft(draft.field, current) !== normalizeDraft(draft.field, draft.base) &&
          normalizeDraft(draft.field, current) !== normalizeDraft(draft.field, draft.value))
      )
    }),
  )

  function applyInspectorDraft(draft: InspectorDraft) {
    if (draft.field === 'edgeCondition') {
      updateEdge(draft.elementId, { label: draft.value.trim() || undefined })
    } else if (draft.field === 'nodeName') {
      updateNode(draft.elementId, { nodeName: draft.value })
    } else if (draft.field === 'nodeSkipExpression') {
      updateNode(draft.elementId, { attrs: { skipExpression: draft.value } })
    } else {
      const key =
        draft.field === 'nodeMaxRetries'
          ? 'maxRetries'
          : draft.field === 'nodeTimeoutSeconds'
            ? 'timeoutSeconds'
            : 'joinThreshold'
      const value = draft.value.trim() === '' ? undefined : Number(draft.value)
      updateNode(draft.elementId, { attrs: { [key]: value } })
    }
  }

  function resolveInspectorDraft(
    field: InspectorDraftField,
    elementId: string,
    action: 'apply' | 'discard',
  ) {
    const draft = getInspectorDraft(field, elementId)
    if (!draft) return false
    if (action === 'apply') {
      if (
        !editable.value ||
        !validInspectorDraft(draft) ||
        inspectorValue(field, elementId) === null
      )
        return false
      applyInspectorDraft(draft)
    }
    inspectorDrafts.value = inspectorDrafts.value.filter((item) => item !== draft)
    return true
  }

  function applyInspectorDrafts(elementId?: string) {
    if (!editable.value) return false
    const drafts = inspectorDrafts.value.filter(
      (draft) => !elementId || draft.elementId === elementId,
    )
    if (drafts.some((draft) => inspectorDraftConflicts.value.includes(draft))) return false
    const nodePatches = new Map<string, { nodeName?: string; attrs?: Record<string, unknown> }>()
    for (const draft of drafts) {
      if (inspectorValue(draft.field, draft.elementId) === normalizeDraft(draft.field, draft.value))
        continue
      if (draft.field === 'edgeCondition') {
        applyInspectorDraft(draft)
        continue
      }
      const patch = nodePatches.get(draft.elementId) ?? {}
      if (draft.field === 'nodeName') patch.nodeName = draft.value
      else {
        const key =
          draft.field === 'nodeSkipExpression'
            ? 'skipExpression'
            : draft.field === 'nodeMaxRetries'
              ? 'maxRetries'
              : draft.field === 'nodeTimeoutSeconds'
                ? 'timeoutSeconds'
                : 'joinThreshold'
        const value =
          draft.field === 'nodeSkipExpression'
            ? draft.value
            : draft.value.trim() === ''
              ? undefined
              : Number(draft.value)
        patch.attrs = { ...(patch.attrs ?? {}), [key]: value }
      }
      nodePatches.set(draft.elementId, patch)
    }
    for (const [id, patch] of nodePatches) updateNode(id, patch)
    inspectorDrafts.value = inspectorDrafts.value.filter((draft) => !drafts.includes(draft))
    return true
  }

  function setMeta(next: Partial<DesignerMeta>) {
    const tenantChanged = next.tenantId !== undefined && next.tenantId !== meta.value.tenantId
    const existingWorkflowChanged =
      meta.value.id !== null && next.id !== undefined && next.id !== meta.value.id
    if (tenantChanged || existingWorkflowChanged) {
      inspectorScope.value += 1
      inspectorDrafts.value = []
    }
    meta.value = { ...meta.value, ...next }
  }

  function setLock(next: DesignerLockState) {
    lock.value = next
  }

  function setValidationErrors(errs: ValidationError[]) {
    validationErrors.value = errs
  }

  function addNode(input: {
    nodeCode: string
    nodeName?: string
    nodeType: DesignerNodeType
    x: number
    y: number
    attrs?: Record<string, unknown>
  }) {
    pushUndo()
    nodes.value.push({
      id: input.nodeCode,
      nodeCode: input.nodeCode,
      nodeName: input.nodeName ?? input.nodeCode,
      nodeType: input.nodeType,
      x: input.x,
      y: input.y,
      attrs: { ...(input.attrs ?? {}) },
    })
    // 新增节点后自动选中,让右侧 inspector 立即聚焦该节点(drop 路径同样受益)
    selectedIds.value = new Set([input.nodeCode])
    dirty.value = true
  }

  function addEdge(input: { source: string; target: string; label?: string }) {
    // 平凡校验:同节点 / 已存在 → 静默忽略(不污染 undoStack)
    if (input.source === input.target) return
    const exists = edges.value.some((e) => e.source === input.source && e.target === input.target)
    if (exists) return
    pushUndo()
    edges.value.push({
      id: `e_${input.source}_${input.target}_${Date.now()}`,
      source: input.source,
      target: input.target,
      label: input.label,
      attrs: { edgeType: 'SUCCESS', enabled: true },
    })
    dirty.value = true
  }

  function nextEdgeId(source: string, target: string): string {
    const base = `e_${source}_${target}`
    let suffix = edges.value.length
    let candidate = `${base}_${suffix}`
    while (edges.value.some((edge) => edge.id === candidate)) {
      suffix += 1
      candidate = `${base}_${suffix}`
    }
    return candidate
  }

  function createEdge(
    source: string,
    target: string,
    semantic?: Pick<DesignerEdge, 'label' | 'attrs'>,
  ): DesignerEdge {
    return {
      id: nextEdgeId(source, target),
      source,
      target,
      label: semantic?.label,
      attrs: semantic?.attrs ? { ...semantic.attrs } : { edgeType: 'SUCCESS', enabled: true },
    }
  }

  function validateDependency(
    sourceId: string,
    targetId: string,
    ignoredEdgeId?: string,
  ): DependencyMutationResult {
    const source = nodes.value.find((node) => node.id === sourceId)
    const target = nodes.value.find((node) => node.id === targetId)
    const hasInvalidEndpoint =
      !source ||
      !target ||
      source.id === target.id ||
      source.nodeType === 'END' ||
      target.nodeType === 'START'
    if (hasInvalidEndpoint) {
      return { ok: false, reason: 'invalidEndpoint' }
    }
    if (
      edges.value.some(
        (edge) => edge.id !== ignoredEdgeId && edge.source === sourceId && edge.target === targetId,
      )
    ) {
      return { ok: false, reason: 'duplicate' }
    }

    const outgoing = new Map<string, string[]>()
    for (const node of nodes.value) outgoing.set(node.id, [])
    for (const edge of edges.value) {
      if (edge.id === ignoredEdgeId) continue
      outgoing.get(edge.source)?.push(edge.target)
    }
    const visited = new Set<string>()
    const pending = [targetId]
    while (pending.length > 0) {
      const current = pending.pop()!
      if (current === sourceId) return { ok: false, reason: 'cycle' }
      if (visited.has(current)) continue
      visited.add(current)
      pending.push(...(outgoing.get(current) ?? []))
    }
    return { ok: true }
  }

  function addDependency(input: {
    source: string
    target: string
    label?: string
    attrs?: Record<string, unknown>
  }): DependencyMutationResult {
    const validation = validateDependency(input.source, input.target)
    if (!validation.ok) return validation
    pushUndo()
    const dependencyEdges = edges.value
    const dependency = createEdge(input.source, input.target, {
      label: input.label,
      attrs: input.attrs ?? { edgeType: 'SUCCESS', enabled: true },
    })
    dependencyEdges.push(dependency)
    dirty.value = true
    return { ok: true }
  }

  function rewireDependency(
    edgeId: string,
    source: string,
    target: string,
  ): DependencyMutationResult {
    const edge = edges.value.find((item) => item.id === edgeId)
    if (!edge) return { ok: false, reason: 'invalidEndpoint' }
    if (edge.source === source && edge.target === target) return { ok: true }
    const validation = validateDependency(source, target, edgeId)
    if (!validation.ok) return validation
    pushUndo()
    edge.source = source
    edge.target = target
    dirty.value = true
    return { ok: true }
  }

  /**
   * 新增节点并按结构化插入点自动接线。节点、删旧边、补新边共用一个撤销快照，
   * 避免用户撤销一次后只剩半条依赖。
   */
  function addConnectedNode(
    input: {
      nodeCode: string
      nodeName?: string
      nodeType: DesignerNodeType
      x: number
      y: number
      attrs?: Record<string, unknown>
    },
    placement: AutomaticPlacement,
  ): boolean {
    if (nodes.value.some((node) => node.id === input.nodeCode)) return false

    const source =
      placement.kind === 'append'
        ? nodes.value.find((node) => node.id === placement.sourceId)
        : undefined
    const splitEdge =
      placement.kind === 'insert'
        ? edges.value.find((edge) => edge.id === placement.edgeId)
        : undefined

    const appendPlacementHasNoValidSource =
      placement.kind === 'append' && (!source || source.nodeType === 'END')
    if (appendPlacementHasNoValidSource) return false
    if (placement.kind !== 'standalone' && input.nodeType === 'START') return false
    const insertPlacementHasNoSplittableEdge =
      placement.kind === 'insert' && (!splitEdge || input.nodeType === 'END')
    if (insertPlacementHasNoSplittableEdge) return false

    pushUndo()
    nodes.value.push({
      id: input.nodeCode,
      nodeCode: input.nodeCode,
      nodeName: input.nodeName ?? input.nodeCode,
      nodeType: input.nodeType,
      x: input.x,
      y: input.y,
      attrs: { ...(input.attrs ?? {}) },
    })

    if (source) {
      const currentEdges = edges.value
      const createdEdge = createEdge(source.id, input.nodeCode)
      currentEdges.push(createdEdge)
    } else if (splitEdge) {
      edges.value = edges.value.filter((edge) => edge.id !== splitEdge.id)
      // 原依赖条件属于原上游节点，保留在“原上游 → 新节点”这一段。
      const currentEdges = edges.value
      const upstreamEdge = createEdge(splitEdge.source, input.nodeCode, splitEdge)
      const downstreamEdge = createEdge(input.nodeCode, splitEdge.target)
      currentEdges.push(upstreamEdge, downstreamEdge)
    }

    selectedIds.value = new Set([input.nodeCode])
    dirty.value = true
    return true
  }

  function deleteNode(id: string) {
    const idx = nodes.value.findIndex((n) => n.id === id)
    if (idx < 0) return
    pushUndo()
    nodes.value.splice(idx, 1)
    // 级联删除关联边
    edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
    selectedIds.value.delete(id)
    dirty.value = true
  }

  function deleteEdge(id: string) {
    const idx = edges.value.findIndex((e) => e.id === id)
    if (idx < 0) return
    pushUndo()
    edges.value.splice(idx, 1)
    selectedIds.value.delete(id)
    dirty.value = true
  }

  function updateEdge(id: string, patch: { label?: string; attrs?: Record<string, unknown> }) {
    const edge = edges.value.find((item) => item.id === id)
    if (!edge) return
    pushUndo()
    if (Object.hasOwn(patch, 'label')) edge.label = patch.label
    if (patch.attrs) {
      edge.attrs = { ...(edge.attrs ?? {}), ...patch.attrs }
    }
    dirty.value = true
  }

  function moveNode(id: string, x: number, y: number) {
    const n = nodes.value.find((nn) => nn.id === id)
    if (!n) return
    // 拖拽期间不挂 undo(避免每帧推栈);调用方负责在拖结束统一 push
    n.x = x
    n.y = y
    dirty.value = true
  }

  /**
   * 更新节点字段(nodeName / attrs.* 等)。inspector 表单失焦回写走此入口,
   * 会 pushUndo,可由 Ctrl+Z 撤销。
   */
  function updateNode(id: string, patch: { nodeName?: string; attrs?: Record<string, unknown> }) {
    const n = nodes.value.find((nn) => nn.id === id)
    if (!n) return
    pushUndo()
    if (patch.nodeName !== undefined) n.nodeName = patch.nodeName
    if (patch.attrs) {
      n.attrs = { ...(n.attrs ?? {}), ...patch.attrs }
    }
    dirty.value = true
  }

  function setSelection(ids: string[]) {
    selectedIds.value = new Set(ids)
  }

  function undo() {
    if (undoStack.value.length === 0) return
    const prev = undoStack.value.pop()!
    const currentSnapshot = cloneSnapshot(nodes.value, edges.value)
    redoStack.value.push(currentSnapshot)
    applySnapshot(prev)
    refreshDirtyFromBaseline()
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const next = redoStack.value.pop()!
    const currentSnapshot = cloneSnapshot(nodes.value, edges.value)
    undoStack.value.push(currentSnapshot)
    applySnapshot(next)
    refreshDirtyFromBaseline()
  }

  /** 保存回包以实际提交的快照更新基线，保留请求期间新增的编辑。 */
  function markClean(savedSnapshot?: DesignerSnapshot) {
    cleanFingerprint.value = savedSnapshot
      ? snapshotFingerprint(savedSnapshot.nodes, savedSnapshot.edges)
      : snapshotFingerprint(nodes.value, edges.value)
    refreshDirtyFromBaseline()
  }

  function markDirty() {
    dirty.value = true
  }

  return {
    // 状态
    nodes,
    edges,
    selectedIds,
    dirty,
    undoStack,
    redoStack,
    meta,
    lock,
    validationErrors,
    inspectorDrafts,
    inspectorScope,
    // 派生状态
    canUndo,
    canRedo,
    snapshot,
    editable,
    inspectorDraftConflicts,
    errorNodeIds,
    errorEdgeIds,
    // 操作
    reset,
    replaceGraphFromJson,
    setMeta,
    setLock,
    setValidationErrors,
    getInspectorDraft,
    inspectorValue,
    setInspectorDraft,
    validInspectorDraft,
    resolveInspectorDraft,
    applyInspectorDrafts,
    addNode,
    addConnectedNode,
    addEdge,
    addDependency,
    rewireDependency,
    deleteNode,
    deleteEdge,
    updateEdge,
    moveNode,
    updateNode,
    setSelection,
    undo,
    redo,
    markClean,
    markDirty,
    pushUndo,
  }
})
