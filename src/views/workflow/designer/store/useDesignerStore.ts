/**
 * Workflow 设计器 Pinia store(Spike 阶段)。
 *
 * 维护 nodes / edges / selectedIds / dirty + undo/redo 双栈(上限 50 步)。
 * 不耦合 X6 实例 —— 画布组件订阅 store 状态渲染,反向通过 action 提交变更,
 * 便于纯逻辑单测(无需 DOM)。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DesignerEdge,
  DesignerNode,
  DesignerNodeType,
  DesignerSnapshot,
} from '../types'

const UNDO_STACK_LIMIT = 50

function cloneSnapshot(nodes: DesignerNode[], edges: DesignerEdge[]): DesignerSnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, attrs: { ...(n.attrs ?? {}) } })),
    edges: edges.map((e) => ({ ...e })),
  }
}

export const useDesignerStore = defineStore('workflowDesigner', () => {
  const nodes = ref<DesignerNode[]>([])
  const edges = ref<DesignerEdge[]>([])
  const selectedIds = ref<Set<string>>(new Set())
  const dirty = ref(false)
  const undoStack = ref<DesignerSnapshot[]>([])
  const redoStack = ref<DesignerSnapshot[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const snapshot = computed<DesignerSnapshot>(() =>
    cloneSnapshot(nodes.value, edges.value),
  )

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
  }

  function addNode(input: {
    nodeCode: string
    nodeName?: string
    nodeType: DesignerNodeType
    x: number
    y: number
  }) {
    pushUndo()
    nodes.value.push({
      id: input.nodeCode,
      nodeCode: input.nodeCode,
      nodeName: input.nodeName ?? input.nodeCode,
      nodeType: input.nodeType,
      x: input.x,
      y: input.y,
      attrs: {},
    })
    dirty.value = true
  }

  function addEdge(input: { source: string; target: string; label?: string }) {
    // 平凡校验:同节点 / 已存在 → 静默忽略(不污染 undoStack)
    if (input.source === input.target) return
    const exists = edges.value.some(
      (e) => e.source === input.source && e.target === input.target,
    )
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

  function moveNode(id: string, x: number, y: number) {
    const n = nodes.value.find((nn) => nn.id === id)
    if (!n) return
    // 拖拽期间不挂 undo(避免每帧推栈);调用方负责在拖结束统一 push
    n.x = x
    n.y = y
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

  return {
    // state
    nodes,
    edges,
    selectedIds,
    dirty,
    undoStack,
    redoStack,
    // getters
    canUndo,
    canRedo,
    snapshot,
    // actions
    reset,
    addNode,
    addEdge,
    deleteNode,
    deleteEdge,
    moveNode,
    setSelection,
    undo,
    redo,
    markClean,
  }
})
