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
  } = deps

  // ─── Edge creation helpers ─────────────────────────────────────────────────

  function suggestDownstreamEdgeType(sourceNode: X6Node): WorkflowEdgeKind {
    const source = sourceNode.getData() as WorkflowNodeDraft
    if (source.nodeType !== 'DECISION') return 'SUCCESS'
    const existingOutgoing = currentWorkflowExportEdges().filter(
      (edge) => edge.fromNodeCode === source.nodeCode,
    )
    return existingOutgoing.some((edge) => edge.edgeType === 'DEFAULT') ? 'CONDITION' : 'DEFAULT'
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

  function addDownstreamNode(kind: Extract<WorkflowNodeKind, 'TASK' | 'DECISION' | 'JOIN'>) {
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

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if (selectedKind.value === 'node' && event.shiftKey) {
      const key = event.key.toLowerCase()
      if (key === 't') {
        event.preventDefault()
        addDownstreamNode('TASK')
        return
      }
      if (key === 'd') {
        event.preventDefault()
        addDownstreamNode('DECISION')
        return
      }
      if (key === 'j') {
        event.preventDefault()
        addDownstreamNode('JOIN')
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
