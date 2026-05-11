/**
 * Workflow Designer — X6 Graph creation, Dnd, minimap, zoom, event bindings,
 * port config, HTML node registration.
 */
import { computed, nextTick, onScopeDispose, reactive, ref, shallowRef, type Ref } from 'vue'
import { Dnd, Graph, Shape, type Cell, type Edge as X6Edge, type Node as X6Node } from '@antv/x6'
import { History } from '@antv/x6/es/plugin/history'
import { Selection } from '@antv/x6/es/plugin/selection'
import { FixedMiniMap } from '../graph/FixedMiniMap'
import { ElMessage } from 'element-plus'
import { purifyHtml } from '@/utils/safeHtml'
import {
  type WorkflowNodeKind,
  type WorkflowEdgeKind,
  type WorkflowNodeDraft,
  type WorkflowEdgeDraft,
  WORKFLOW_NODE_VIEW_W,
  WORKFLOW_NODE_VIEW_H,
  escapeHtml,
  getTheme,
  defaultNodeForm,
  nodeKinds,
  buildEdgeLabels,
  resolveEdgePortsForDraft,
} from './workflowConstants'

export interface GraphDeps {
  canvasRef: Ref<HTMLDivElement | null>
  minimapHostRef: Ref<HTMLDivElement | null>
  dndPaletteRef: Ref<HTMLDivElement | null>
  selectedCellId: Ref<string>
}

export interface InspectorCallbacks {
  setSelectedCell: (cell: Cell | null) => void
  setNodeStyle: (cell: X6Node, selected: boolean) => void
  setEdgeStyle: (cell: X6Edge, selected: boolean) => void
  renderCellAppearance: (cell: Cell, selected: boolean) => void
}

export function useWorkflowGraph(deps: GraphDeps) {
  const { canvasRef, minimapHostRef, dndPaletteRef, selectedCellId } = deps

  /**
   * Inspector 依赖 graph(构造时 graph 还没建 → 无法反向传),graph 的事件
   * 处理又要调 inspector 的 setSelectedCell/setNodeStyle/... 才能更新选中
   * 态。原来的做法是父组件用 `let _setSelectedCell = () => {}` 占位,创建
   * graph 模块时传包装,创建 inspector 后再赋值;占位期的误用很难看出来。
   *
   * 换成显式 bindInspectorCallbacks:父组件创建 inspector 后统一调一次。
   * graph 内部用 _X 局部变量闭包,不再对 deps 里的 setX 有依赖。
   */
  let _setSelectedCell: (cell: Cell | null) => void = () => {}
  let _setNodeStyle: (cell: X6Node, selected: boolean) => void = () => {}
  let _setEdgeStyle: (cell: X6Edge, selected: boolean) => void = () => {}
  let _renderCellAppearance: (cell: Cell, selected: boolean) => void = () => {}

  function bindInspectorCallbacks(callbacks: InspectorCallbacks) {
    _setSelectedCell = callbacks.setSelectedCell
    _setNodeStyle = callbacks.setNodeStyle
    _setEdgeStyle = callbacks.setEdgeStyle
    _renderCellAppearance = callbacks.renderCellAppearance
  }

  const graph = shallowRef<Graph | null>(null)
  const graphReady = ref(false)
  /** 撤销/重做按钮 disabled 状态驱动 tick — graph.canUndo()/canRedo() 不是响应式，靠 history:change 推 */
  const historyTick = ref(0)
  const canUndo = computed(() => {
    void historyTick.value
    return graph.value?.canUndo() ?? false
  })
  const canRedo = computed(() => {
    void historyTick.value
    return graph.value?.canRedo() ?? false
  })
  /** 切换画布内容时短暂隐藏，避免 resetCells→zoomToFit 之间的中间帧闪烁 */
  const canvasResetting = ref(false)
  /** 触发缩放百分比展示刷新 */
  const graphZoomUiTick = ref(0)
  /**
   * 画布状态变化版本号,分两档驱动下游 recompute:
   *   - graphVersionLight: 位置/帧级轻改动都加,stats / minimapCoords 等
   *     廉价读(O(节点数)级 DOM 读取)跟这个
   *   - graphVersion (heavy): 结构改动(增删节点/边、属性变动等)才加,
   *     dslPreview / validation 这种要 JSON.stringify 整张图的昂贵读
   *     跟这个。拖动 300ms 内只发 light,debounce 结束才发 heavy。
   */
  const graphVersionLight = ref(0)
  const graphVersion = ref(0)

  const canvasContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    type: null as 'node' | 'edge' | null,
    cellId: '',
  })
  const canvasContextMenuRef = ref<HTMLDivElement | null>(null)

  let paletteGraph: Graph | null = null
  let stencilDnd: Dnd | null = null

  const graphZoomPercentLabel = computed(() => {
    void graphZoomUiTick.value
    const z = graph.value?.zoom()
    if (z == null || Number.isNaN(z)) return '—'
    return `${Math.round(z * 100)}%`
  })

  // ─── Context menu ──────────────────────────────────────────────────────────

  function closeCanvasContextMenu() {
    canvasContextMenu.visible = false
    canvasContextMenu.type = null
    canvasContextMenu.cellId = ''
  }

  function openCanvasContextMenu(
    clientX: number,
    clientY: number,
    type: 'node' | 'edge',
    cellId: string,
  ) {
    const menuW = 168
    const menuH = type === 'node' ? 118 : 78
    canvasContextMenu.x = Math.max(6, Math.min(clientX, window.innerWidth - menuW - 8))
    canvasContextMenu.y = Math.max(6, Math.min(clientY, window.innerHeight - menuH - 8))
    canvasContextMenu.type = type
    canvasContextMenu.cellId = cellId
    canvasContextMenu.visible = true
  }

  function preventCtxEvent(e: { preventDefault?: () => void }) {
    e.preventDefault?.()
  }

  function onDocumentPointerCloseContextMenu(e: MouseEvent) {
    if (!canvasContextMenu.visible) return
    const el = canvasContextMenuRef.value
    if (el && e.target instanceof Node && el.contains(e.target)) return
    closeCanvasContextMenu()
  }

  // ─── Zoom ──────────────────────────────────────────────────────────────────

  function nudgeGraphZoom(direction: -1 | 1) {
    if (!graph.value) return
    const cur = graph.value.zoom()
    const step = 0.12
    const next = Math.min(1.6, Math.max(0.45, cur + direction * step))
    graph.value.zoomTo(next)
    graphZoomUiTick.value += 1
  }

  /**
   * 容器 clientWidth/Height 为 0 时,zoomToFit 会算出 NaN 矩阵分量 →
   * "Failed to set the 'a' property on 'SVGMatrix': non-finite"。
   * 首帧布局还没就绪 / 栏目被折叠都可能命中,这里统一兜底。
   */
  function canvasHasPaintableSize(): boolean {
    const el = canvasRef.value
    return !!el && el.clientWidth > 0 && el.clientHeight > 0
  }

  function fitGraphZoom() {
    if (!graph.value || !canvasHasPaintableSize()) return
    graph.value.zoomToFit({ padding: 40, maxScale: 1.25, minScale: 0.45 })
    graphZoomUiTick.value += 1
  }

  // ─── Edge Z-order ──────────────────────────────────────────────────────────

  /** 保证所有边渲染在节点之上，避免新增节点盖住连线。 */
  function normalizeEdgeZOrder() {
    if (!graph.value) return
    graph.value.batchUpdate(() => {
      const nodes = graph.value!.getNodes()
      const edges = graph.value!.getEdges()
      nodes.forEach((n, i) => n.setZIndex(i + 1))
      const base = nodes.length + 2
      edges.forEach((e, i) => e.setZIndex(base + i))
    })
  }

  /** rAF 节流版：同一帧内多次触发只执行一次，大图下不卡顿。 */
  let _edgeZOrderRaf: number | null = null
  function scheduleEdgeZOrder() {
    if (_edgeZOrderRaf !== null) return
    _edgeZOrderRaf = requestAnimationFrame(() => {
      _edgeZOrderRaf = null
      normalizeEdgeZOrder()
    })
  }
  function cancelEdgeZOrderRaf() {
    if (_edgeZOrderRaf !== null) {
      cancelAnimationFrame(_edgeZOrderRaf)
      _edgeZOrderRaf = null
    }
  }

  // ─── syncGraphDerivedState + draft queue ───────────────────────────────────

  /** Will be set by useWorkflowData after graph creation */
  let _validateGraph: () => import('./workflowConstants').ValidationIssue[] = () => []
  let _queueDraftSave: () => void = () => {}
  let _validationIssuesRef: Ref<import('./workflowConstants').ValidationIssue[]> | null = null

  function bindDerivedStateCallbacks(
    validateGraph: () => import('./workflowConstants').ValidationIssue[],
    queueDraftSave: () => void,
    validationIssues: Ref<import('./workflowConstants').ValidationIssue[]>,
  ) {
    _validateGraph = validateGraph
    _queueDraftSave = queueDraftSave
    _validationIssuesRef = validationIssues
  }

  function syncGraphDerivedState(options: { queueDraft?: boolean; skipValidation?: boolean } = {}) {
    const { queueDraft = graphReady.value, skipValidation = false } = options
    graphVersionLight.value += 1
    if (!skipValidation) {
      graphVersion.value += 1
      if (_validationIssuesRef) _validationIssuesRef.value = _validateGraph()
    }
    if (queueDraft && graphReady.value) _queueDraftSave()
  }

  /** 拖动过程中合并校验 / DSL / 草稿队列，避免每帧 validateGraph */
  let positionDerivedSyncTimer: number | null = null
  function cancelPositionDerivedSyncTimer() {
    if (positionDerivedSyncTimer != null) {
      window.clearTimeout(positionDerivedSyncTimer)
      positionDerivedSyncTimer = null
    }
  }
  function schedulePositionDerivedSync() {
    cancelPositionDerivedSyncTimer()
    // 拖拽过程中只更新 graphVersion（stats 等），跳过昂贵的 validateGraph
    syncGraphDerivedState({ skipValidation: true, queueDraft: false })
    positionDerivedSyncTimer = window.setTimeout(() => {
      positionDerivedSyncTimer = null
      // 拖拽结束后再做完整校验 + 草稿
      syncGraphDerivedState()
    }, 300)
  }

  onScopeDispose(cancelPositionDerivedSyncTimer)

  // ─── Shape registration ────────────────────────────────────────────────────

  let shapesRegistered = false
  function registerShapes() {
    if (shapesRegistered) return

    const outPort = {
      r: 7,
      magnet: true,
      stroke: '#16a34a',
      strokeWidth: 2,
      fill: '#dcfce7',
      visibility: 'hidden',
      cursor: 'crosshair',
    }
    const inPort = {
      r: 7,
      magnet: true,
      stroke: '#2563eb',
      strokeWidth: 2,
      fill: '#dbeafe',
      visibility: 'hidden',
      cursor: 'crosshair',
    }

    Shape.HTML.register({
      shape: 'workflow-node',
      width: WORKFLOW_NODE_VIEW_W,
      height: WORKFLOW_NODE_VIEW_H,
      effect: ['data'],
      ports: {
        groups: {
          top: { position: 'top', attrs: { circle: { ...inPort } } },
          right: { position: 'right', attrs: { circle: { ...outPort } } },
          bottom: { position: 'bottom', attrs: { circle: { ...outPort } } },
          left: { position: 'left', attrs: { circle: { ...inPort } } },
        },
        items: [
          { id: 'top', group: 'top' },
          { id: 'right', group: 'right' },
          { id: 'bottom', group: 'bottom' },
          { id: 'left', group: 'left' },
        ],
      },
      html(cell) {
        const data = cell.getData() as WorkflowNodeDraft
        const theme = getTheme(data.nodeType)
        const jobOrPipe =
          data.relatedJobCode?.trim() || data.relatedPipelineCode?.trim() || '未关联作业 / 管道'
        const worker = data.workerGroup?.trim() || '默认 Worker 分组'
        const retry = (data.retryPolicy ?? 'NONE').trim() || 'NONE'
        const tip = `${jobOrPipe} · ${worker} · 重试 ${retry} · ${data.enabled ? '启用' : '停用'}`
        const root = document.createElement('div')
        root.className = `workflow-node workflow-node--${data.nodeType.toLowerCase()}`
        root.style.setProperty('--workflow-accent', theme.accent)
        root.style.setProperty('--workflow-soft', theme.softText)
        root.title = tip
        // 双保险：字段已 escapeHtml，再经 DOMPurify 兜底（前端独立 XSS 过滤策略）
        root.innerHTML = purifyHtml(`
            <div class="workflow-node__top">
              <span class="workflow-node__kind">${escapeHtml(data.nodeType)}</span>
              <span class="workflow-node__order">#${Number(data.nodeOrder || 0)}</span>
            </div>
            <div class="workflow-node__title">${escapeHtml(data.nodeName || data.nodeCode)}</div>
            <div class="workflow-node__footer workflow-node__footer--micro">
              <span class="workflow-node__code">${escapeHtml(data.nodeCode)}</span>
            </div>
          `)
        root.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!cell.isNode()) return
          const g = cell.model?.graph
          if (g) g.trigger('node:contextmenu', { e, node: cell })
        })
        return root
      },
    })

    Graph.registerEdge('workflow-edge', {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: '#64748b',
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
          targetMarker: {
            name: 'block',
            width: 10,
            height: 7,
            fill: '#64748b',
            stroke: '#64748b',
          },
        },
      },
    })
    shapesRegistered = true
  }

  // ─── Edge helpers ──────────────────────────────────────────────────────────

  function edgeDraftFromGraphCell(cell: X6Edge): WorkflowEdgeDraft {
    const data = cell.getData() as WorkflowEdgeDraft
    const fromNodeCode = cell.getSourceCellId() || data.fromNodeCode
    const toNodeCode = cell.getTargetCellId() || data.toNodeCode
    return {
      ...data,
      fromNodeCode,
      toNodeCode,
      sourcePort: cell.getSourcePortId() || data.sourcePort,
      targetPort: cell.getTargetPortId() || data.targetPort,
    }
  }

  function allocateEdgeId(fromId: string, toId: string, edgeType: WorkflowEdgeKind): string {
    const base = `${fromId}-${toId}-${edgeType}`
    const usedIds = new Set(
      graph.value?.getEdges().map((e) => (e.getData() as Partial<WorkflowEdgeDraft>)?.id ?? e.id) ??
        [],
    )
    if (!usedIds.has(base)) return base
    let i = 2
    while (usedIds.has(`${base}-${i}`)) i++
    return `${base}-${i}`
  }

  function allocateNodeCodeForGraph(kind: WorkflowNodeKind, g: Graph): string {
    const existingNodes = g.getNodes().map((cell) => cell.getData() as WorkflowNodeDraft)
    const baseCode = kind.toLowerCase()
    let index = 1
    let nodeCode = kind === 'START' ? 'start' : kind === 'END' ? 'end' : `${baseCode}_${index}`
    const usedCodes = new Set(existingNodes.map((item) => item.nodeCode))
    while (usedCodes.has(nodeCode)) {
      index += 1
      nodeCode =
        kind === 'START'
          ? `start_${index}`
          : kind === 'END'
            ? `end_${index}`
            : `${baseCode}_${index}`
    }
    return nodeCode
  }

  // ─── Snapshot helpers ──────────────────────────────────────────────────────

  function graphNodesSnapshot() {
    return graph.value?.getNodes().map((cell) => cell.getData() as WorkflowNodeDraft) ?? []
  }

  function graphEdgesSnapshot() {
    return graph.value?.getEdges().map((cell) => edgeDraftFromGraphCell(cell as X6Edge)) ?? []
  }

  function readNodePosition(node: X6Node, fallback: WorkflowNodeDraft) {
    const pos = node.position()
    return { ...fallback, x: pos.x, y: pos.y }
  }

  function currentWorkflowExportNodes() {
    if (!graph.value) return [] as WorkflowNodeDraft[]
    return graph.value
      .getNodes()
      .map((cell) => readNodePosition(cell, cell.getData() as WorkflowNodeDraft))
  }

  function currentWorkflowExportEdges() {
    if (!graph.value) return [] as WorkflowEdgeDraft[]
    return graph.value.getEdges().map((cell) => edgeDraftFromGraphCell(cell as X6Edge))
  }

  // ─── Build cells & resetGraph ──────────────────────────────────────────────

  function buildCellsFromDraft(nodes: WorkflowNodeDraft[], edges: WorkflowEdgeDraft[]) {
    if (!graph.value) return []
    const nodeCells = nodes.map((node) =>
      graph.value!.createNode({
        id: node.nodeCode,
        shape: 'workflow-node',
        x: node.x,
        y: node.y,
        width: WORKFLOW_NODE_VIEW_W,
        height: WORKFLOW_NODE_VIEW_H,
        data: { ...node, width: WORKFLOW_NODE_VIEW_W, height: WORKFLOW_NODE_VIEW_H },
      }),
    )
    const edgeCells = edges.map((edge) => {
      const fromN = nodes.find((n) => n.nodeCode === edge.fromNodeCode)
      const toN = nodes.find((n) => n.nodeCode === edge.toNodeCode)
      const { sourcePort, targetPort } = resolveEdgePortsForDraft(edge, fromN, toN)
      const data: WorkflowEdgeDraft = { ...edge, sourcePort, targetPort }
      const cell = graph.value!.createEdge({
        id: edge.id || `${edge.fromNodeCode}-${edge.toNodeCode}-${edge.edgeType}`,
        shape: 'workflow-edge',
        source: { cell: edge.fromNodeCode, port: sourcePort },
        target: { cell: edge.toNodeCode, port: targetPort },
        labels: buildEdgeLabels(edge),
        data,
      })
      return cell
    })
    return [...nodeCells, ...edgeCells]
  }

  function resetGraph(
    nodes: WorkflowNodeDraft[],
    edges: WorkflowEdgeDraft[],
    layoutFn: (n: WorkflowNodeDraft[], e: WorkflowEdgeDraft[]) => WorkflowNodeDraft[],
  ) {
    if (!graph.value) return
    const needLayout = nodes.every((node) => node.x === 0 && node.y === 0)
    const preparedNodes = needLayout ? layoutFn(nodes, edges) : nodes
    const cells = buildCellsFromDraft(preparedNodes, edges)

    // 隐藏画布，避免 resetCells 清空 → zoomToFit 调整缩放 之间的中间帧闪烁
    canvasResetting.value = true
    graph.value.resetCells(cells)

    // 对批量加载的边立即应用颜色样式（shape 默认色是灰色，需覆盖）
    for (const cell of cells) {
      if (cell.isEdge()) _setEdgeStyle(cell as X6Edge, false)
    }

    nextTick(() => {
      if (preparedNodes.length > 0 && canvasHasPaintableSize()) {
        graph.value?.zoomToFit({ padding: 40, maxScale: 1.1, minScale: 0.5 })
      }
      normalizeEdgeZOrder()
      // 等缩放完成后再显示，消除闪烁
      canvasResetting.value = false
    })
    _setSelectedCell(null)
    syncGraphDerivedState({ queueDraft: false })
  }

  // ─── Stencil palette (Dnd) ─────────────────────────────────────────────────

  function disposeStencilPalette() {
    stencilDnd?.dispose()
    stencilDnd = null
    paletteGraph?.dispose()
    paletteGraph = null
  }

  function initStencilPalette() {
    disposeStencilPalette()
    const host = dndPaletteRef.value
    const g = graph.value
    if (!host || !g) return

    paletteGraph = new Graph({
      container: host,
      width: 360,
      height: 800,
      interacting: false,
      async: false,
      background: { color: 'transparent' },
      grid: { visible: false, size: 1, type: 'dot' },
      panning: { enabled: false },
      mousewheel: { enabled: false },
    })

    let y = 16
    const gapY = WORKFLOW_NODE_VIEW_H + 28
    for (const nk of nodeKinds) {
      const kind = nk.kind
      const code = `__palette__${kind}`
      const form = defaultNodeForm(kind, code)
      paletteGraph.addNode({
        id: code,
        shape: 'workflow-node',
        x: 20,
        y,
        width: WORKFLOW_NODE_VIEW_W,
        height: WORKFLOW_NODE_VIEW_H,
        data: {
          ...form,
          x: 20,
          y,
          width: WORKFLOW_NODE_VIEW_W,
          height: WORKFLOW_NODE_VIEW_H,
        },
      })
      y += gapY
    }

    stencilDnd = new Dnd({
      target: g,
      scaled: true,
      getDragNode: (node) => node.clone({ deep: true }),
      getDropNode: (draggingNode, { targetGraph }) => {
        const draft = draggingNode.getData() as WorkflowNodeDraft
        const k = draft.nodeType
        const nodeCode = allocateNodeCodeForGraph(k, targetGraph)
        const form = defaultNodeForm(k, nodeCode)
        return targetGraph.createNode({
          id: nodeCode,
          shape: 'workflow-node',
          width: WORKFLOW_NODE_VIEW_W,
          height: WORKFLOW_NODE_VIEW_H,
          data: {
            ...form,
            x: 0,
            y: 0,
            width: WORKFLOW_NODE_VIEW_W,
            height: WORKFLOW_NODE_VIEW_H,
          },
        })
      },
      validateNode: (droppingNode, { targetGraph }) => {
        const data = droppingNode.getData() as WorkflowNodeDraft
        const k = data.nodeType
        if (k === 'START' || k === 'END') {
          const existing =
            targetGraph.getNodes().find((n) => (n.getData() as WorkflowNodeDraft).nodeType === k) ??
            null
          if (existing) {
            ElMessage.warning(`已经存在 ${k} 节点`)
            _setSelectedCell(existing)
            return false
          }
        }
        return true
      },
    })
  }

  function onLibraryNodePointerDown(kind: WorkflowNodeKind, e: PointerEvent) {
    if (e.button !== 0) return
    if (!stencilDnd || !paletteGraph) return
    const template = paletteGraph.getCellById(`__palette__${kind}`)
    if (!template?.isNode()) return
    e.preventDefault()
    stencilDnd.start(template as X6Node, e as MouseEvent)
  }

  // ─── MiniMap ───────────────────────────────────────────────────────────────

  /**
   * O4:缩略图容器(.workflow-canvas-hud)在"未选中 workflow / 正在初始化"
   * 时 display:none,尺寸为 0,此时 FixedMiniMap 构造内的首次 zoomToFit
   * 会算出 Infinity 触发 SVGMatrix DOMException(已由 FixedMiniMap 守卫
   * 兜住),但 plugin.use + 事件订阅仍是一次无用的启动成本。改成首次 host
   * 获得非零尺寸时再真正 use,等到用户真的能看到它。
   */
  let _minimapInitialized = false
  let _minimapInitRo: ResizeObserver | null = null
  function cancelMinimapLazyInit() {
    if (_minimapInitRo) {
      _minimapInitRo.disconnect()
      _minimapInitRo = null
    }
  }
  function initMinimapPlugin() {
    if (_minimapInitialized) return
    if (!graph.value) return
    const host = minimapHostRef.value
    if (!host) return
    if (host.clientWidth > 0 && host.clientHeight > 0) {
      attachMinimapPlugin(host)
      return
    }
    cancelMinimapLazyInit()
    _minimapInitRo = new ResizeObserver(() => {
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        cancelMinimapLazyInit()
        attachMinimapPlugin(host)
      }
    })
    _minimapInitRo.observe(host)
  }
  function attachMinimapPlugin(host: HTMLElement) {
    if (!graph.value) return
    graph.value.use(
      new FixedMiniMap({
        container: host,
        width: 164,
        height: 108,
        padding: 4,
        scalable: true,
      }),
    )
    _minimapInitialized = true
  }

  // ─── Create the graph ──────────────────────────────────────────────────────

  /**
   * x6 构造时会立刻用容器的 clientWidth/Height 计算 SVG viewBox / matrix。
   * 容器尺寸为 0 时,计算出 Infinity/NaN → 抛 "Failed to set the 'a'
   * property on 'SVGMatrix': non-finite value"。设计器在布局稳定前挂载
   * (tab 切换 / 弹窗打开 / 首帧 0 布局) 就容易命中。
   *
   * 策略:首帧尺寸非零就直接创建;否则挂 ResizeObserver 等到首个非零
   * 布局再真正构造。组件提前卸载时 cancelPendingCreateGraph 断连。
   */
  let _pendingCreateRo: ResizeObserver | null = null
  function cancelPendingCreateGraph() {
    if (_pendingCreateRo) {
      _pendingCreateRo.disconnect()
      _pendingCreateRo = null
    }
  }

  function createGraph() {
    const el = canvasRef.value
    if (!el) return
    if (graph.value) return // already created
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      createGraphImpl()
      return
    }
    cancelPendingCreateGraph()
    _pendingCreateRo = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        cancelPendingCreateGraph()
        createGraphImpl()
      }
    })
    _pendingCreateRo.observe(el)
  }

  function createGraphImpl() {
    if (!canvasRef.value) return
    registerShapes()
    graph.value = new Graph({
      container: canvasRef.value,
      autoResize: true,
      background: { color: 'transparent' },
      grid: {
        visible: true,
        size: 12,
        type: 'dot',
        args: { color: 'rgba(148, 163, 184, 0.34)' },
      },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'rightMouseDown', 'mouseWheel'],
      },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        minScale: 0.45,
        maxScale: 1.6,
      },
      connecting: {
        router: { name: 'orth', args: { padding: 20 } },
        connector: { name: 'rounded', args: { radius: 6 } },
        anchor: 'orth',
        connectionPoint: 'anchor',
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        allowEdge: false,
        allowPort: true,
        allowMulti: true,
        snap: { radius: 36, anchor: 'center' },
        highlight: true,
        validateConnection({ sourceCell, targetCell, sourcePort, targetPort }) {
          if (!sourceCell || !targetCell || sourceCell.id === targetCell.id) return false
          const source = sourceCell.isNode()
            ? (sourceCell.getData() as WorkflowNodeDraft).nodeType
            : null
          const target = targetCell.isNode()
            ? (targetCell.getData() as WorkflowNodeDraft).nodeType
            : null
          if (!source || !target) return false
          if (source === 'END') return false
          if (target === 'START') return false
          if (graph.value && sourcePort && targetPort) {
            const dup = graph.value
              .getEdges()
              .some(
                (e) =>
                  e.getSourceCellId() === sourceCell.id &&
                  e.getTargetCellId() === targetCell.id &&
                  e.getSourcePortId() === sourcePort &&
                  e.getTargetPortId() === targetPort,
              )
            if (dup) return false
          }
          return true
        },
      },
      highlighting: {
        magnetAvailable: {
          name: 'stroke',
          args: { padding: 6, attrs: { strokeWidth: 3, stroke: '#22c55e' } },
        },
        magnetAdsorbed: {
          name: 'stroke',
          args: { padding: 6, attrs: { strokeWidth: 3.5, stroke: '#2563eb' } },
        },
      },
      translating: { restrict: false, autoOffset: true },
      interacting: {
        nodeMovable: true,
        edgeMovable: true,
        edgeLabelMovable: false,
        vertexMovable: false,
      },
    })

    // ─── Plugins: History (undo/redo) + Selection (rubber-band 多选) ────────
    // 跳过 resetCells / 初次 load 等"加载态"变更，避免它们污染 undo 栈：
    // beforeAddCommand 返回 false 会让该 command 不入历史。
    graph.value.use(
      new History({
        enabled: true,
        beforeAddCommand(_event, args) {
          // canvasResetting=true 期间（重置画布 / 自动布局 / 切换 workflow）所有变更不入栈
          if (canvasResetting.value) return false
          // 仅记录用户交互产生的 ui 修改，忽略系统态（如 style 自动刷新）
          const opts = (args as { options?: { ui?: boolean; stencil?: unknown } } | undefined)
            ?.options
          if (opts?.stencil != null) return true
          if (opts?.ui === true) return true
          // node:added 等没有 ui 标记的也允许（拖入 / 删除）
          return true
        },
      }),
    )
    graph.value.use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true, // 空白处按住左键框选
        rubberEdge: true,
        modifiers: 'shift', // 与 panning 左键拖动并存：默认空白拖 = 平移，Shift+左键 = 框选
        movable: true,
        showNodeSelectionBox: true,
        showEdgeSelectionBox: false,
      }),
    )

    graph.value.on('history:change', () => {
      historyTick.value += 1
    })

    // ─── Event bindings ────────────────────────────────────────────────────
    graph.value.on('node:click', ({ node }) => _setSelectedCell(node))
    graph.value.on('edge:click', ({ edge }) => _setSelectedCell(edge))
    graph.value.on('blank:click', () => _setSelectedCell(null))
    graph.value.on('blank:contextmenu', ({ e }) => {
      preventCtxEvent(e)
      closeCanvasContextMenu()
    })
    graph.value.on('node:contextmenu', ({ e, node }) => {
      preventCtxEvent(e)
      openCanvasContextMenu(e.clientX, e.clientY, 'node', node.id)
    })
    graph.value.on('edge:contextmenu', ({ e, edge }) => {
      preventCtxEvent(e)
      openCanvasContextMenu(e.clientX, e.clientY, 'edge', edge.id)
    })
    graph.value.on('scale', () => {
      graphZoomUiTick.value += 1
    })
    graph.value.on('edge:connected', ({ edge }) => {
      const srcId = edge.getSourceCellId()
      const tgtId = edge.getTargetCellId()
      if (!srcId || !tgtId) {
        graph.value?.removeEdge(edge)
        return
      }
      const prev = edge.getData() as Partial<WorkflowEdgeDraft>
      const edgeType: WorkflowEdgeKind = (prev.edgeType as WorkflowEdgeKind) ?? 'SUCCESS'
      const nextId = allocateEdgeId(srcId, tgtId, edgeType)
      edge.setData({
        id: nextId,
        fromNodeCode: srcId,
        toNodeCode: tgtId,
        edgeType,
        conditionExpr: prev.conditionExpr ?? '',
        enabled: prev.enabled ?? true,
        sourcePort: edge.getSourcePortId() ?? 'right',
        targetPort: edge.getTargetPortId() ?? 'left',
      } satisfies WorkflowEdgeDraft)
      _setEdgeStyle(edge, false)
      scheduleEdgeZOrder()
      syncGraphDerivedState()
    })
    graph.value.on('node:moved', () => {
      cancelPositionDerivedSyncTimer()
      syncGraphDerivedState()
    })
    graph.value.on('node:change:position', ({ options }) => {
      if ((options as { ui?: boolean }).ui === true) {
        schedulePositionDerivedSync()
      } else {
        syncGraphDerivedState()
      }
    })
    graph.value.on('cell:removed', () => {
      syncGraphDerivedState()
      _setSelectedCell(null)
      scheduleEdgeZOrder()
    })
    graph.value.on('cell:change:data', ({ cell }) => {
      _renderCellAppearance(cell, cell.id === selectedCellId.value)
    })
    graph.value.on('node:added', ({ node, options }) => {
      if ((options as { stencil?: unknown } | undefined)?.stencil == null) return
      if (!node.isNode()) return
      _setNodeStyle(node, false)
      _setSelectedCell(node)
      syncGraphDerivedState()
      scheduleEdgeZOrder()
    })

    graphReady.value = true
    if (dndPaletteRef.value) {
      initStencilPalette()
    } else {
      void nextTick(() => initStencilPalette())
    }
    if (minimapHostRef.value) {
      initMinimapPlugin()
    } else {
      void nextTick(() => initMinimapPlugin())
    }
  }

  // ─── History / Selection helpers ────────────────────────────────────────

  function undo() {
    if (graph.value?.canUndo()) graph.value.undo()
  }
  function redo() {
    if (graph.value?.canRedo()) graph.value.redo()
  }
  function selectAll() {
    if (!graph.value) return
    graph.value.select(graph.value.getCells())
  }

  function disposeGraph() {
    cancelPositionDerivedSyncTimer()
    cancelEdgeZOrderRaf()
    cancelPendingCreateGraph()
    cancelMinimapLazyInit()
    disposeStencilPalette()
    graph.value?.dispose()
    graph.value = null
    graphReady.value = false
    _minimapInitialized = false
  }

  return {
    graph,
    graphReady,
    canvasResetting,
    graphZoomUiTick,
    graphVersion,
    graphVersionLight,
    canvasContextMenu,
    canvasContextMenuRef,
    graphZoomPercentLabel,
    canUndo,
    canRedo,
    undo,
    redo,
    selectAll,

    closeCanvasContextMenu,
    openCanvasContextMenu,
    onDocumentPointerCloseContextMenu,
    nudgeGraphZoom,
    fitGraphZoom,
    scheduleEdgeZOrder,
    normalizeEdgeZOrder,

    syncGraphDerivedState,
    bindDerivedStateCallbacks,
    bindInspectorCallbacks,
    cancelPositionDerivedSyncTimer,

    edgeDraftFromGraphCell,
    allocateEdgeId,
    allocateNodeCodeForGraph,
    graphNodesSnapshot,
    graphEdgesSnapshot,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    buildCellsFromDraft,
    resetGraph,

    onLibraryNodePointerDown,
    disposeStencilPalette,
    initMinimapPlugin,
    createGraph,
    disposeGraph,
  }
}

export type WorkflowGraphReturn = ReturnType<typeof useWorkflowGraph>
