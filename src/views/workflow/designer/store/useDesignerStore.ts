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

const UNDO_STACK_LIMIT = 50

function cloneSnapshot(nodes: DesignerNode[], edges: DesignerEdge[]): DesignerSnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, attrs: { ...(n.attrs ?? {}) } })),
    edges: edges.map((e) => ({ ...e, attrs: { ...(e.attrs ?? {}) } })),
  }
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

const EMPTY_META: DesignerMeta = {
  id: null,
  tenantId: '',
  workflowCode: '',
  workflowName: '',
  workflowType: 'STANDARD',
  enabled: true,
  description: undefined,
  version: 0,
}

export const useDesignerStore = defineStore('workflowDesigner', () => {
  const nodes = ref<DesignerNode[]>([])
  const edges = ref<DesignerEdge[]>([])
  const selectedIds = ref<Set<string>>(new Set())
  const dirty = ref(false)
  const undoStack = ref<DesignerSnapshot[]>([])
  const redoStack = ref<DesignerSnapshot[]>([])
  const meta = ref<DesignerMeta>({ ...EMPTY_META })
  const lock = ref<DesignerLockState>(null)
  const validationErrors = ref<ValidationError[]>([])

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

  /** 在变更前 push 当前快照到 undoStack,清空 redoStack。 */
  function pushUndo() {
    undoStack.value.push(cloneSnapshot(nodes.value, edges.value))
    if (undoStack.value.length > UNDO_STACK_LIMIT) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function applySnapshot(snap: DesignerSnapshot) {
    nodes.value = snap.nodes.map((n) => ({ ...n, attrs: { ...(n.attrs ?? {}) } }))
    edges.value = snap.edges.map((e) => ({ ...e }))
  }

  function reset(snap: DesignerSnapshot = { nodes: [], edges: [] }) {
    applySnapshot(snap)
    selectedIds.value = new Set()
    dirty.value = false
    undoStack.value = []
    redoStack.value = []
    validationErrors.value = []
  }

  function setMeta(next: Partial<DesignerMeta>) {
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
    })
    dirty.value = true
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
    redoStack.value.push(cloneSnapshot(nodes.value, edges.value))
    applySnapshot(prev)
    dirty.value = true
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const next = redoStack.value.pop()!
    undoStack.value.push(cloneSnapshot(nodes.value, edges.value))
    applySnapshot(next)
    dirty.value = true
  }

  function markClean() {
    dirty.value = false
  }

  function markDirty() {
    dirty.value = true
  }

  return {
    // state
    nodes,
    edges,
    selectedIds,
    dirty,
    undoStack,
    redoStack,
    meta,
    lock,
    validationErrors,
    // getters
    canUndo,
    canRedo,
    snapshot,
    editable,
    errorNodeIds,
    // actions
    reset,
    setMeta,
    setLock,
    setValidationErrors,
    addNode,
    addEdge,
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
