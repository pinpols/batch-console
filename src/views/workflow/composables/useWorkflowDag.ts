/**
 * Workflow Designer — DAG operations: add/remove/duplicate nodes,
 * add/remove edges, auto-layout, context menu actions, keyboard shortcuts.
 */
import type { Ref, ShallowRef } from 'vue'
import type { Cell, Edge as X6Edge, Node as X6Node, Graph } from '@antv/x6'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  type WorkflowNodeKind,
  type WorkflowEdgeKind,
  type WorkflowNodeDraft,
  type WorkflowEdgeDraft,
  type SelectedKind,
  type ValidationIssue,
  WORKFLOW_NODE_VIEW_W,
  WORKFLOW_NODE_VIEW_H,
  defaultNodeForm,
  buildEdgeLabels,
  pickEdgePortsBetweenNodes,
  layoutWorkflowNodes,
} from './workflowConstants'

export interface DagDeps {
  graph: ShallowRef<Graph | null>
  graphReady: Ref<boolean>
  selectedKind: Ref<SelectedKind>
  selectedCellId: Ref<string>
  canvasContextMenu: { visible: boolean; cellId: string }
  setSelectedCell: (cell: Cell | null) => void
  ensureSingleTerminal: (kind: WorkflowNodeKind, excludeId?: string) => boolean
  selectFallbackAfterDelete: () => void
  setNodeStyle: (cell: X6Node, selected: boolean) => void
  setEdgeStyle: (cell: X6Edge, selected: boolean) => void
  syncGraphDerivedState: (opts?: { queueDraft?: boolean; skipValidation?: boolean }) => void
  scheduleEdgeZOrder: () => void
  closeCanvasContextMenu: () => void
  allocateNodeCodeForGraph: (kind: WorkflowNodeKind, g: Graph) => string
  allocateEdgeId: (fromId: string, toId: string, edgeType: WorkflowEdgeKind) => string
  currentWorkflowExportNodes: () => WorkflowNodeDraft[]
  currentWorkflowExportEdges: () => WorkflowEdgeDraft[]
  /** Clipboard 操作：由 useWorkflowGraph 提供 */
  copySelection: () => void
  cutSelection: () => void
  pasteFromClipboard: () => void
  duplicateSelection: () => void
}

export function useWorkflowDag(deps: DagDeps) {
  const {
    graph,
    selectedKind,
    selectedCellId,
    canvasContextMenu,
    setSelectedCell,
    ensureSingleTerminal,
    selectFallbackAfterDelete,
    setNodeStyle,
    setEdgeStyle,
    syncGraphDerivedState,
    scheduleEdgeZOrder,
    closeCanvasContextMenu,
    allocateNodeCodeForGraph,
    allocateEdgeId,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    duplicateSelection,
  } = deps

  // ─── Edge creation helpers ─────────────────────────────────────────────────

  function suggestDownstreamEdgeType(sourceNode: X6Node): WorkflowEdgeKind {
    const source = sourceNode.getData() as WorkflowNodeDraft
    if (source.nodeType !== 'GATEWAY') return 'SUCCESS'
    const existingOutgoing = currentWorkflowExportEdges().filter(
      (edge) => edge.fromNodeCode === source.nodeCode,
    )
    // GATEWAY 出边惯用：先 CONDITION 表达分支，最后挂一条 ALWAYS 兜底
    return existingOutgoing.some((edge) => edge.edgeType === 'ALWAYS') ? 'CONDITION' : 'ALWAYS'
  }

  function createEdgeBetween(sourceNode: X6Node, targetNode: X6Node, edgeType: WorkflowEdgeKind) {
    if (!graph.value) return
    const edgeId = allocateEdgeId(sourceNode.id, targetNode.id, edgeType)
    const { sourcePort, targetPort } = pickEdgePortsBetweenNodes(sourceNode, targetNode)
    const edge = graph.value.createEdge({
      id: edgeId,
      shape: 'workflow-edge',
      source: { cell: sourceNode.id, port: sourcePort },
      target: { cell: targetNode.id, port: targetPort },
      labels: buildEdgeLabels({
        id: edgeId,
        fromNodeCode: sourceNode.id,
        toNodeCode: targetNode.id,
        edgeType,
        conditionExpr: '',
        enabled: true,
        sourcePort,
        targetPort,
      }),
      data: {
        id: edgeId,
        fromNodeCode: sourceNode.id,
        toNodeCode: targetNode.id,
        edgeType,
        conditionExpr: '',
        enabled: true,
        sourcePort,
        targetPort,
      } satisfies WorkflowEdgeDraft,
    })
    graph.value.addEdge(edge)
    setEdgeStyle(edge, false)
  }

  // ─── Add node ──────────────────────────────────────────────────────────────

  function addNode(
    kind: WorkflowNodeKind,
    options: { x?: number; y?: number; sourceNode?: X6Node | null } = {},
  ) {
    if (!graph.value) return
    if (!ensureSingleTerminal(kind)) return

    const nodeCode = allocateNodeCodeForGraph(kind, graph.value)

    const bbox = graph.value.getContentBBox()
    const x =
      options.x ?? (Number.isFinite(bbox.width) && bbox.width > 0 ? bbox.x + bbox.width + 120 : 80)
    const y = options.y ?? (Number.isFinite(bbox.height) && bbox.height > 0 ? bbox.y + 80 : 80)
    const data = defaultNodeForm(kind, nodeCode)
    const node = graph.value.createNode({
      id: nodeCode,
      shape: 'workflow-node',
      x,
      y,
      width: WORKFLOW_NODE_VIEW_W,
      height: WORKFLOW_NODE_VIEW_H,
      data: {
        ...data,
        x,
        y,
        width: WORKFLOW_NODE_VIEW_W,
        height: WORKFLOW_NODE_VIEW_H,
      },
    })
    graph.value.addNode(node)
    if (options.sourceNode) {
      createEdgeBetween(options.sourceNode, node, suggestDownstreamEdgeType(options.sourceNode))
    }
    setNodeStyle(node, false)
    setSelectedCell(node)
    syncGraphDerivedState()
    scheduleEdgeZOrder()
  }

  function addDownstreamNode(kind: Extract<WorkflowNodeKind, 'TASK' | 'GATEWAY' | 'JOB'>) {
    if (!graph.value || selectedKind.value !== 'node' || !selectedCellId.value) return
    const cell = graph.value.getCellById(selectedCellId.value)
    if (!cell || !cell.isNode()) return
    const source = cell as X6Node
    const sourceData = source.getData() as WorkflowNodeDraft
    if (sourceData.nodeType === 'END') {
      ElMessage.warning('END 节点不能继续新增下游')
      return
    }
    const outgoingCount = currentWorkflowExportEdges().filter(
      (edge) => edge.fromNodeCode === source.id,
    ).length
    addNode(kind, {
      sourceNode: source,
      x: source.position().x + WORKFLOW_NODE_VIEW_W + 140,
      y: source.position().y + outgoingCount * (WORKFLOW_NODE_VIEW_H + 32),
    })
  }

  // ─── Duplicate ─────────────────────────────────────────────────────────────

  function duplicateNodeCell(cell: X6Node) {
    if (!graph.value || !cell.isNode()) return
    const data = cell.getData() as WorkflowNodeDraft
    const bbox = graph.value.getContentBBox()
    const offsetX = Number.isFinite(bbox.width) && bbox.width > 0 ? 120 : 80
    const offsetY = 40
    let index = 2
    let nodeCode = `${data.nodeCode}_copy`
    while (graph.value.getCellById(nodeCode)) {
      nodeCode = `${data.nodeCode}_copy_${index}`
      index += 1
    }
    const clone = graph.value.createNode({
      id: nodeCode,
      shape: 'workflow-node',
      x: cell.position().x + offsetX,
      y: cell.position().y + offsetY,
      width: cell.size().width,
      height: cell.size().height,
      data: {
        ...data,
        nodeCode,
        nodeName: `${data.nodeName} 副本`,
        x: cell.position().x + offsetX,
        y: cell.position().y + offsetY,
        width: cell.size().width,
        height: cell.size().height,
      },
    })
    graph.value.addNode(clone)
    setSelectedCell(clone)
    syncGraphDerivedState()
    scheduleEdgeZOrder()
  }

  function duplicateSelectedNode() {
    if (!graph.value || selectedKind.value !== 'node' || !selectedCellId.value) return
    const cell = graph.value.getCellById(selectedCellId.value)
    if (!cell || !cell.isNode()) return
    duplicateNodeCell(cell)
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function deleteGraphCell(cell: Cell, skipConfirm = false) {
    if (!graph.value) return
    if (!skipConfirm) {
      const label = cell.isNode()
        ? `节点「${(cell.getData() as WorkflowNodeDraft).nodeName || cell.id}」`
        : `连线「${cell.id}」`
      try {
        await ElMessageBox.confirm(`确认删除${label}？此操作不可撤销。`, '删除确认', {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
        })
      } catch {
        return
      }
    }
    const id = cell.id
    const wasSelected = selectedCellId.value === id
    graph.value.removeCell(cell)
    if (wasSelected) {
      selectedCellId.value = ''
      selectedKind.value = 'workflow'
    }
    syncGraphDerivedState()
    ElMessage.success('已删除')
    if (wasSelected) {
      selectFallbackAfterDelete()
    }
    scheduleEdgeZOrder()
  }

  function removeSelected() {
    if (!graph.value || !selectedCellId.value) return
    const cell = graph.value.getCellById(selectedCellId.value)
    if (!cell) return
    deleteGraphCell(cell)
  }

  // ─── Context menu actions ──────────────────────────────────────────────────

  function ctxMenuEditNode() {
    const id = canvasContextMenu.cellId
    closeCanvasContextMenu()
    const c = graph.value?.getCellById(id)
    if (c?.isNode()) setSelectedCell(c)
  }

  function ctxMenuDuplicateFromContext() {
    const id = canvasContextMenu.cellId
    closeCanvasContextMenu()
    const c = graph.value?.getCellById(id)
    if (c?.isNode()) duplicateNodeCell(c as X6Node)
  }

  function ctxMenuDeleteNodeFromContext() {
    const id = canvasContextMenu.cellId
    closeCanvasContextMenu()
    const c = graph.value?.getCellById(id)
    if (c?.isNode()) deleteGraphCell(c)
  }

  function ctxMenuEditEdge() {
    const id = canvasContextMenu.cellId
    closeCanvasContextMenu()
    const c = graph.value?.getCellById(id)
    if (c?.isEdge()) setSelectedCell(c)
  }

  function ctxMenuDeleteEdgeFromContext() {
    const id = canvasContextMenu.cellId
    closeCanvasContextMenu()
    const c = graph.value?.getCellById(id)
    if (c?.isEdge()) deleteGraphCell(c)
  }

  // ─── Re-layout ────────────────────────────────────────────────────────────

  function reLayout() {
    if (!graph.value) return
    const nodes = currentWorkflowExportNodes()
    const edges = currentWorkflowExportEdges()
    const positions = layoutWorkflowNodes(nodes, edges)
    for (const node of positions) {
      const cell = graph.value.getCellById(node.nodeCode)
      if (cell && cell.isNode()) {
        cell.position(node.x, node.y)
        cell.setData({
          ...(cell.getData() as WorkflowNodeDraft),
          x: node.x,
          y: node.y,
        })
      }
    }
    graph.value.getEdges().forEach((e) => e.router())
    graph.value.centerContent()
    syncGraphDerivedState()
    ElMessage.success('已重新布局')
  }

  // ─── Keyboard handler ─────────────────────────────────────────────────────

  function isAnyElModalVisible(): boolean {
    // Element Plus 的 .el-overlay 即使关闭也留在 DOM 里,通过 inline style
    // `display:none` 控制显隐,所以 querySelector(.el-overlay) 会误判为打开。
    // 检查 inline style 非 none 的 overlay 才算真正可见。
    const overlays = document.querySelectorAll('.el-overlay')
    for (const el of overlays) {
      if (el instanceof HTMLElement && el.style.display !== 'none') return true
    }
    return false
  }

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if (target?.isContentEditable) return
    // 防穿透:任意 Element Plus 模态态(dialog / drawer / message-box) 可见时,
    // Backspace / Delete / Shift+T 等都不该作用到画布,避免误删选中节点。
    if (isAnyElModalVisible()) return
    // Ctrl/Cmd + Z 撤销 / Ctrl+Shift+Z / Ctrl+Y 重做 / Ctrl+A 全选
    const mod = event.ctrlKey || event.metaKey
    if (mod) {
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        if (graph.value?.canUndo()) {
          event.preventDefault()
          graph.value.undo()
        }
        return
      }
      if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (graph.value?.canRedo()) {
          event.preventDefault()
          graph.value.redo()
        }
        return
      }
      if (key === 'a') {
        const g = graph.value
        if (g) {
          event.preventDefault()
          g.select(g.getCells())
        }
        return
      }
      if (key === 'c') {
        event.preventDefault()
        copySelection()
        return
      }
      if (key === 'x') {
        event.preventDefault()
        cutSelection()
        return
      }
      if (key === 'v') {
        event.preventDefault()
        pasteFromClipboard()
        return
      }
      if (key === 'd') {
        event.preventDefault()
        duplicateSelection()
        return
      }
    }
    if (selectedKind.value === 'node' && event.shiftKey) {
      const key = event.key.toLowerCase()
      if (key === 't') {
        event.preventDefault()
        addDownstreamNode('TASK')
        return
      }
      if (key === 'g') {
        // Shift+G → GATEWAY（原 Shift+D 改 G，与后端命名对齐；分支语义保留）
        event.preventDefault()
        addDownstreamNode('GATEWAY')
        return
      }
      if (key === 'j') {
        // Shift+J → JOB（原 JOIN 已折叠到 GATEWAY；J 现指 JOB 节点）
        event.preventDefault()
        addDownstreamNode('JOB')
        return
      }
    }
    if (event.key === 'Escape') {
      if (canvasContextMenu.visible) {
        closeCanvasContextMenu()
        event.preventDefault()
      }
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedKind.value === 'workflow') return
      event.preventDefault()
      removeSelected()
    }
  }

  return {
    addNode,
    addDownstreamNode,
    duplicateNodeCell,
    duplicateSelectedNode,
    deleteGraphCell,
    removeSelected,
    reLayout,
    onKeydown,

    // context menu
    ctxMenuEditNode,
    ctxMenuDuplicateFromContext,
    ctxMenuDeleteNodeFromContext,
    ctxMenuEditEdge,
    ctxMenuDeleteEdgeFromContext,
  }
}

export type WorkflowDagReturn = ReturnType<typeof useWorkflowDag>
