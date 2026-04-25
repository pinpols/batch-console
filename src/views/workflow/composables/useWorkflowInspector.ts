/**
 * Workflow Designer — inspector forms (nodeForm, edgeForm, workflowForm),
 * selection state, and apply/sync functions.
 */
import { computed, nextTick, reactive, ref, type ShallowRef } from 'vue'
import type { Cell, Edge as X6Edge, Node as X6Node, Graph } from '@antv/x6'
import { ElMessage } from 'element-plus'
import {
  type SelectedKind,
  type NodeFormState,
  type EdgeFormState,
  type WorkflowFormState,
  type WorkflowNodeDraft,
  type WorkflowEdgeDraft,
  type ValidationIssue,
  type WorkflowNodeKind,
  defaultNodeForm,
  defaultEdgeForm,
  copyNodeForm,
  copyEdgeForm,
  getTheme,
  edgeThemeMap,
  buildEdgeLabels,
  nodeThemeMap,
} from './workflowConstants'
import { useAppStore } from '@/stores/app'

export function useWorkflowInspector(deps: {
  graph: ShallowRef<Graph | null>
  graphReady: ReturnType<typeof ref<boolean>>
  graphVersion: ReturnType<typeof ref<number>>
  selectedCellId: ReturnType<typeof ref<string>>
  syncGraphDerivedState: () => void
  scheduleEdgeZOrder: () => void
}) {
  const {
    graph,
    graphReady,
    graphVersion,
    selectedCellId,
    syncGraphDerivedState,
    scheduleEdgeZOrder,
  } = deps
  const app = useAppStore()

  const selectedKind = ref<SelectedKind>('workflow')
  const workflowForm = reactive<WorkflowFormState>({
    workflowCode: '',
    workflowName: '',
    workflowType: '',
    enabled: true,
    description: '',
  })
  const nodeForm = reactive<NodeFormState>({
    nodeCode: '',
    nodeName: '',
    nodeType: 'TASK',
    relatedJobCode: '',
    relatedPipelineCode: '',
    workerGroup: '',
    windowCode: '',
    nodeOrder: 0,
    retryPolicy: 'NONE',
    retryMaxCount: 0,
    timeoutSeconds: 0,
    nodeParams: '',
    enabled: true,
  })
  const edgeForm = reactive<EdgeFormState>({
    fromNodeCode: '',
    toNodeCode: '',
    edgeType: 'SUCCESS',
    conditionExpr: '',
    enabled: true,
  })

  /** 选中描边：随深浅色与主色 token 对齐 */
  function selectionAccent() {
    return app.theme === 'dark' ? 'rgba(147, 197, 253, 0.95)' : 'rgb(22 119 255 / 88%)'
  }

  function setNodeStyle(cell: X6Node, selected = false) {
    const data = cell.getData() as WorkflowNodeDraft
    const theme = getTheme(data.nodeType)
    const bodyStroke = selected ? selectionAccent() : theme.border
    cell.attr({
      body: {
        fill: theme.bg,
        stroke: bodyStroke,
        strokeWidth: selected ? 2.5 : 1.5,
      },
      title: { fill: theme.text },
      meta: { fill: theme.softText },
      footer: { fill: theme.softText },
    })
  }

  function setEdgeStyle(cell: X6Edge, selected = false) {
    const data = cell.getData() as WorkflowEdgeDraft
    const theme = edgeThemeMap[data.edgeType] ?? edgeThemeMap.SUCCESS
    const dash = data.edgeType === 'FAILURE' ? '6 4' : data.edgeType === 'CONDITION' ? '4 4' : ''
    cell.attr({
      line: {
        stroke: selected ? selectionAccent() : theme.stroke,
        strokeWidth: selected ? 2.8 : 2.2,
        strokeDasharray: dash,
        targetMarker: {
          name: 'block',
          width: 10,
          height: 7,
          fill: selected ? selectionAccent() : theme.stroke,
          stroke: selected ? selectionAccent() : theme.stroke,
        },
      },
    })
  }

  function escapeForCssSelector(id: string) {
    try {
      return CSS.escape(id)
    } catch {
      return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
  }

  /**
   * HTML 节点在 foreignObject 内，scoped :deep 常匹配不到；用画布根节点 + data-cell-id 查找。
   * 再回退 X6 foContent，避免 findViewByCell 时机或 container 结构差异导致 class 挂不上。
   */
  function syncWorkflowHtmlNodeSelectedClass(node: X6Node, selected: boolean) {
    if (node.shape !== 'workflow-node' || !graph.value) return
    const host = graph.value.container
    if (host) {
      const root = host.querySelector(
        `g[data-cell-id="${escapeForCssSelector(node.id)}"] .workflow-node`,
      )
      if (root) {
        root.classList.toggle('workflow-node--selected', selected)
        return
      }
    }
    const view = graph.value.findViewByCell(node) as unknown as
      | { selectors?: { foContent?: HTMLElement | null } }
      | null
      | undefined
    const fo = view?.selectors?.foContent
    const el = fo?.querySelector('.workflow-node') ?? fo?.firstElementChild
    if (el instanceof HTMLElement) el.classList.toggle('workflow-node--selected', selected)
  }

  function renderCellAppearance(cell: Cell, selected = false) {
    if (cell.isNode()) {
      const n = cell as X6Node
      syncWorkflowHtmlNodeSelectedClass(n, selected)
      if (n.shape === 'workflow-node') {
        // HTML 节点内部 DOM 在首帧可能尚未 patch,nextTick 兜底一次。
        // 注:回调里守卫 graph 是否已销毁,避免组件卸载后触发 findViewByCell。
        void nextTick(() => {
          if (!graph.value) return
          syncWorkflowHtmlNodeSelectedClass(n, selected)
        })
      }
      setNodeStyle(n, selected)
    } else if (cell.isEdge()) setEdgeStyle(cell as X6Edge, selected)
  }

  function clearSelectionAppearance() {
    if (!graph.value) return
    const previous = graph.value.getCellById(selectedCellId.value)
    if (previous) renderCellAppearance(previous, false)
  }

  function setSelectedCell(cell: Cell | null) {
    clearSelectionAppearance()
    if (!cell) {
      selectedKind.value = 'workflow'
      selectedCellId.value = ''
      return
    }
    selectedCellId.value = cell.id
    renderCellAppearance(cell, true)
    if (cell.isEdge()) {
      ;(cell as X6Edge).toFront({ deep: true })
    }
    if (cell.isNode()) {
      ;(cell as X6Node).toFront({ deep: true })
      const data = cell.getData() as WorkflowNodeDraft
      selectedKind.value = 'node'
      copyNodeForm(data, nodeForm)
    } else if (cell.isEdge()) {
      const data = cell.getData() as WorkflowEdgeDraft
      selectedKind.value = 'edge'
      copyEdgeForm(data, edgeForm)
    } else {
      selectedKind.value = 'workflow'
    }
  }

  function findTerminalNode(kind: Extract<WorkflowNodeKind, 'START' | 'END'>, excludeId = '') {
    if (!graph.value) return null
    return (
      graph.value
        .getNodes()
        .find(
          (cell) =>
            cell.id !== excludeId && (cell.getData() as WorkflowNodeDraft).nodeType === kind,
        ) ?? null
    )
  }

  function ensureSingleTerminal(kind: WorkflowNodeKind, excludeId = '') {
    if (kind !== 'START' && kind !== 'END') return true
    const existing = findTerminalNode(kind, excludeId)
    if (!existing) return true
    ElMessage.warning(`已经存在 ${kind} 节点`)
    setSelectedCell(existing)
    return false
  }

  function focusValidationIssue(issue: ValidationIssue) {
    if (!graph.value) return
    const targetId = issue.nodeCode || issue.edgeId
    if (!targetId) return
    const cell = graph.value.getCellById(targetId)
    if (!cell) return
    setSelectedCell(cell)
    graph.value.centerCell(cell)
  }

  function applyGraphGridTheme() {
    if (!graph.value) return
    const dark = app.theme === 'dark'
    graph.value.grid.draw({
      visible: true,
      size: 12,
      type: 'dot',
      args: {
        color: dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.2)',
      },
    })
  }

  function refreshGraphTheme() {
    applyGraphGridTheme()
    if (!graph.value) return
    for (const cell of graph.value.getCells()) {
      renderCellAppearance(cell, cell.id === selectedCellId.value)
    }
  }

  function applyNodeForm() {
    if (!graph.value || selectedKind.value !== 'node' || !selectedCellId.value) return
    const cell = graph.value.getCellById(selectedCellId.value)
    if (!cell || !cell.isNode()) return
    // nodeCode 合法性校验
    const trimmedCode = nodeForm.nodeCode.trim()
    if (!trimmedCode) {
      ElMessage.error('节点编码不能为空')
      return
    }
    if (/[^a-zA-Z0-9_\-]/.test(trimmedCode)) {
      ElMessage.error('节点编码只允许字母、数字、下划线和连字符')
      return
    }
    // 检查 nodeCode 是否与其他节点重复（排除当前节点）
    if (trimmedCode !== cell.id) {
      const existing = graph.value.getCellById(trimmedCode)
      if (existing) {
        ElMessage.error(`节点编码「${trimmedCode}」已被其他节点使用`)
        return
      }
    }
    if (!ensureSingleTerminal(nodeForm.nodeType, cell.id)) return
    let parsedParams = nodeForm.nodeParams.trim()
    if (parsedParams) {
      try {
        JSON.parse(parsedParams)
      } catch {
        ElMessage.error('扩展参数 JSON 格式不正确')
        return
      }
    } else {
      parsedParams = '{}'
    }
    const updated: WorkflowNodeDraft = {
      ...nodeForm,
      nodeParams: parsedParams,
      x: cell.position().x,
      y: cell.position().y,
      width: cell.size().width,
      height: cell.size().height,
    }
    cell.setData(updated)
    renderCellAppearance(cell, true)
    syncGraphDerivedState()
    ElMessage.success('节点属性已更新')
  }

  function applyEdgeForm() {
    if (!graph.value || selectedKind.value !== 'edge' || !selectedCellId.value) return
    const cell = graph.value.getCellById(selectedCellId.value)
    if (!cell || !cell.isEdge()) return
    const e = cell as X6Edge
    const prev = cell.getData() as WorkflowEdgeDraft
    const updated: WorkflowEdgeDraft = {
      ...prev,
      ...edgeForm,
      // 保留 edge:connected 时分配的业务 ID（data.id），不用 X6 内部 cell.id 覆盖
      id: prev.id,
      fromNodeCode: edgeForm.fromNodeCode,
      toNodeCode: edgeForm.toNodeCode,
      sourcePort: edgeForm.sourcePort ?? prev.sourcePort ?? e.getSourcePortId(),
      targetPort: edgeForm.targetPort ?? prev.targetPort ?? e.getTargetPortId(),
    }
    cell.setData(updated)
    cell.setLabels(buildEdgeLabels(updated))
    renderCellAppearance(cell, true)
    syncGraphDerivedState()
    ElMessage.success('边属性已更新')
  }

  function selectFallbackAfterDelete() {
    if (!graph.value) return
    const first = graph.value.getNodes()[0] ?? graph.value.getEdges()[0] ?? null
    if (first) setSelectedCell(first)
    else setSelectedCell(null)
  }

  const stats = computed(() => {
    void graphVersion.value
    return {
      nodes: graph.value?.getNodes().length ?? 0,
      edges: graph.value?.getEdges().length ?? 0,
    }
  })

  /** 缩略图旁：选中节点或全部内容区在图坐标中的中心，便于对照「大图」位置 */
  const minimapCoordsTitle = '图坐标：原点为画布左上角，单位与节点位置一致'
  const minimapCoordsLabel = computed(() => {
    if (!graph.value || !graphReady.value) return ''
    void graphVersion.value
    const g = graph.value
    if (selectedKind.value === 'node' && selectedCellId.value) {
      const cell = g.getCellById(selectedCellId.value)
      if (cell?.isNode()) {
        const { x, y, width, height } = cell.getBBox()
        return `节点中心 (${Math.round(x + width / 2)}, ${Math.round(y + height / 2)})`
      }
    }
    const area = g.getContentArea()
    if (!area.width && !area.height) return '内容区 · —'
    return `内容区中心 (${Math.round(area.x + area.width / 2)}, ${Math.round(area.y + area.height / 2)})`
  })

  return {
    selectedKind,
    workflowForm,
    nodeForm,
    edgeForm,
    stats,
    minimapCoordsTitle,
    minimapCoordsLabel,
    setSelectedCell,
    ensureSingleTerminal,
    focusValidationIssue,
    applyNodeForm,
    applyEdgeForm,
    applyGraphGridTheme,
    refreshGraphTheme,
    renderCellAppearance,
    setNodeStyle,
    setEdgeStyle,
    selectionAccent,
    selectFallbackAfterDelete,
  }
}

export type WorkflowInspectorReturn = ReturnType<typeof useWorkflowInspector>
