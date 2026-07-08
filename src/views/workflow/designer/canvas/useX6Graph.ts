/**
 * X6 实例的初始化、节点注册、事件桥接,以及自动布局(dagre)。
 *
 * Spike 阶段:
 * - 注册 3 类 Vue 节点(START / END / JOB);GATEWAY / FILE_STEP / APPROVAL 用通用矩形占位
 * - 启用 mini-map + 历史插件不开(undo/redo 走 store)
 * - 拖入节点 / 连线 / 删除 / 选中事件全部回写 store
 */

import { Graph } from '@antv/x6'
// 必须走 es/ 构建:lib/(CJS)是另一份 x6 实例,其 NodeView.registry 里没有
// x6-vue-shape 注册的 'vue-shape-view',minimap 渲染缩略图时会抛
// 「View with name 'vue-shape-view' does not exist」(且随节点变化在 watcher 里间歇复现)。
import { MiniMap } from '@antv/x6/es/plugin/minimap'
// 拖拽对齐辅助线(与其它节点边/中线对齐时显示参考线);纯视觉辅助,不改 store
import { Snapline } from '@antv/x6/es/plugin/snapline'
import { register as registerVueShape } from '@antv/x6-vue-shape'
// X6 v3 仍保留对老式 dagre 字符串布局算法的支持,但需要用户层手算 -> 走 npm dagre 自行布局
import dagre from 'dagre'
import { ElMessage } from 'element-plus'
import type { Component, Ref } from 'vue'
import { onBeforeUnmount, onMounted } from 'vue'
import { i18n } from '@/locales'
import StartNode from './nodes/StartNode.vue'
import EndNode from './nodes/EndNode.vue'
import JobNode from './nodes/JobNode.vue'
import GatewayNode from './nodes/GatewayNode.vue'
import FileStepNode from './nodes/FileStepNode.vue'
import ApprovalNode from './nodes/ApprovalNode.vue'
import type { DesignerNode, DesignerNodeType } from '../types'
import { useDesignerStore } from '../store/useDesignerStore'

const NODE_WIDTH = 140
const NODE_HEIGHT = 60
const START_END_SIZE = 60

let registered = false
function ensureRegistered() {
  if (registered) return
  registered = true
  const shapes: Array<{ name: string; component: Component }> = [
    { name: 'designer-start', component: StartNode as unknown as Component },
    { name: 'designer-end', component: EndNode as unknown as Component },
    { name: 'designer-job', component: JobNode as unknown as Component },
    { name: 'designer-gateway', component: GatewayNode as unknown as Component },
    { name: 'designer-file-step', component: FileStepNode as unknown as Component },
    { name: 'designer-approval', component: ApprovalNode as unknown as Component },
  ]
  for (const s of shapes) {
    registerVueShape({ shape: s.name, component: s.component })
  }
}

function shapeOf(type: DesignerNodeType): string {
  switch (type) {
    case 'START':
      return 'designer-start'
    case 'END':
      return 'designer-end'
    case 'JOB':
      return 'designer-job'
    case 'GATEWAY':
      return 'designer-gateway'
    case 'FILE_STEP':
      return 'designer-file-step'
    case 'APPROVAL':
      return 'designer-approval'
    default:
      return 'rect'
  }
}

function sizeOf(type: DesignerNodeType): { width: number; height: number } {
  if (type === 'START' || type === 'END') {
    return { width: START_END_SIZE, height: START_END_SIZE }
  }
  if (type === 'GATEWAY') {
    return { width: 80, height: 80 }
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT }
}

// 连接桩(x6 port):in 在顶、out 在底(TB 布局);默认隐藏,hover 节点时显现。
// 从 out 拖到另一节点 in 即连线(见 connecting.validateMagnet/validateConnection)。
// 常态半透明可见(让用户一眼看出"从这里连线"),hover 全亮;用 opacity 而非
// visibility:hidden —— 后者藏着时不接收指针事件,会导致桩抓不住、连不了线。
const PORT_ATTRS = {
  circle: {
    r: 5,
    magnet: true,
    stroke: 'var(--color-primary, #1668e3)',
    strokeWidth: 1.5,
    fill: 'var(--color-bg-card, #fff)',
    opacity: 0.45,
  },
} as const
const PORT_GROUPS = {
  in: { position: 'top', attrs: PORT_ATTRS },
  out: { position: 'bottom', attrs: PORT_ATTRS },
} as const

function portsOf(type: DesignerNodeType) {
  const items =
    type === 'START'
      ? [{ id: 'out', group: 'out' }]
      : type === 'END'
        ? [{ id: 'in', group: 'in' }]
        : [
            { id: 'in', group: 'in' },
            { id: 'out', group: 'out' },
          ]
  return { groups: PORT_GROUPS, items }
}

/** hover 全亮 / 离开半透明 连接桩(常态即可见可抓,hover 强调) */
function togglePorts(graph: Graph, nodeId: string, hovered: boolean) {
  const node = graph.getCellById(nodeId)
  if (!node || !node.isNode()) return
  for (const port of node.getPorts()) {
    node.setPortProp(port.id as string, 'attrs/circle/opacity', hovered ? 1 : 0.45)
  }
}

export interface X6GraphHandle {
  graph: Graph | null
  /** Polish 阶段:可选 dagre 布局方向(TB 默认 / LR 左右),不传保持原行为 */
  autoLayout: (direction?: 'TB' | 'LR') => void
  /** 把指定节点居中到视口并选中(校验错误列表点击定位用);节点不存在则 no-op */
  focusNode: (nodeId: string) => void
  /** 返回当前视口中心对应的画布逻辑坐标(点击节点库 / QuickPalette 落点用) */
  getViewportCenter: () => { x: number; y: number }
}

export function useX6Graph(
  containerRef: Ref<HTMLDivElement | null>,
  minimapRef: Ref<HTMLDivElement | null>,
): X6GraphHandle {
  const store = useDesignerStore()
  const handle: X6GraphHandle = {
    graph: null,
    autoLayout: () => {},
    focusNode: () => {},
    getViewportCenter: () => ({ x: 320, y: 200 }),
  }

  /**
   * 视口中心 → 画布逻辑坐标。
   * 用容器中点的 client 坐标经 graph.clientToLocal 反算,随平移 / 缩放正确跟随;
   * graph 未挂载时回退到设计书默认落点。
   */
  function getViewportCenter(): { x: number; y: number } {
    const graph = handle.graph
    const el = containerRef.value
    if (!graph || !el) return { x: 320, y: 200 }
    const rect = el.getBoundingClientRect()
    const point = graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2)
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      return { x: point.x, y: point.y }
    }
    return { x: 320, y: 200 }
  }
  handle.getViewportCenter = getViewportCenter

  function focusNode(nodeId: string) {
    const graph = handle.graph
    if (!graph) return
    const cell = graph.getCellById(nodeId)
    if (!cell || !cell.isNode()) return
    graph.centerCell(cell, { padding: 24 })
    store.setSelection([nodeId])
  }
  handle.focusNode = focusNode

  /**
   * 把 store 状态 → X6 cells(全量替换)。
   * 设计折衷:Spike 阶段每次 store 变化都全量重画,数十节点性能可接受;
   * MVP 接 BE 后再做增量 diff。
   */
  function syncFromStore(graph: Graph) {
    graph.startBatch('sync-from-store')
    try {
      // 增量 reconcile(不 clearCells 全量重建):x6-vue-shape 节点销毁是异步的(Teleport),
      // 「clear + 立刻重加同 id」会残留幽灵 DOM 节点(连带其端口成为游离圆圈)。
      // 改为:删掉 store 里已无的、复用已有的(只更新位置/数据)、只新增新的。
      const nodeIds = new Set(store.nodes.map((n) => n.id))
      const edgeIds = new Set(store.edges.map((e) => e.id))
      for (const cell of graph.getCells()) {
        if (cell.isNode() && !nodeIds.has(cell.id)) graph.removeCell(cell)
        else if (cell.isEdge() && !edgeIds.has(cell.id)) graph.removeCell(cell)
      }
      for (const n of store.nodes) {
        const existing = graph.getCellById(n.id)
        if (existing?.isNode()) {
          existing.position(n.x, n.y)
          existing.setData(
            {
              nodeCode: n.nodeCode,
              nodeName: n.nodeName,
              nodeType: n.nodeType,
              getData: () => n satisfies DesignerNode,
            },
            { overwrite: true },
          )
          existing.attr('text/text', n.nodeName || n.nodeCode, { silent: true })
          continue
        }
        const { width, height } = sizeOf(n.nodeType)
        graph.addNode({
          id: n.id,
          shape: shapeOf(n.nodeType),
          x: n.x,
          y: n.y,
          width,
          height,
          ports: portsOf(n.nodeType),
          // GATEWAY 等占位矩形需要显式 label,vue-shape 自渲染则忽略 label
          label: n.nodeName || n.nodeCode,
          data: {
            nodeCode: n.nodeCode,
            nodeName: n.nodeName,
            nodeType: n.nodeType,
            getData: () => n satisfies DesignerNode,
          },
        })
      }
      for (const e of store.edges) {
        if (graph.getCellById(e.id)) continue
        graph.addEdge({
          id: e.id,
          source: e.source,
          target: e.target,
          attrs: {
            line: {
              stroke: 'var(--color-text-secondary, #909399)',
              strokeWidth: 1.5,
              targetMarker: { name: 'block', size: 8 },
            },
          },
          labels: e.label ? [{ attrs: { text: { text: e.label } } }] : undefined,
        })
      }
    } finally {
      graph.stopBatch('sync-from-store')
    }
  }

  function autoLayout(direction: 'TB' | 'LR' = 'TB') {
    if (!handle.graph) return
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of store.nodes) {
      const { width, height } = sizeOf(n.nodeType)
      g.setNode(n.id, { width, height })
    }
    for (const e of store.edges) {
      g.setEdge(e.source, e.target)
    }
    dagre.layout(g)
    // 将 dagre 算出来的中心点转回左上角坐标写回 store(走 moveNode,不污染 undoStack)
    for (const n of store.nodes) {
      const v = g.node(n.id)
      if (!v) continue
      store.moveNode(n.id, v.x - v.width / 2, v.y - v.height / 2)
    }
    syncFromStore(handle.graph)
  }
  handle.autoLayout = autoLayout

  onMounted(() => {
    if (!containerRef.value) return
    ensureRegistered()
    const graph = new Graph({
      container: containerRef.value,
      // --color-bg-canvas 是已定义且暗色感知的画布底色(light #e9eef5 / dark #0b0f14);
      // 原 --color-bg-base 未定义 → 暗色下回退 #fafafa 变浅色画布。
      background: { color: 'var(--color-bg-canvas, #e9eef5)' },
      grid: { visible: true, type: 'dot', size: 10 },
      panning: { enabled: true },
      mousewheel: { enabled: true, modifiers: 'ctrl', zoomAtMousePosition: true },
      connecting: {
        router: 'manhattan',
        connector: 'rounded',
        snap: { radius: 24 },
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        allowMulti: false,
        allowPort: true,
        // 只能从 out 桩起线
        validateMagnet({ magnet }) {
          return magnet?.getAttribute('port-group') === 'out'
        },
        // out → in 才成立(禁 out→out / in→in / 反向)
        validateConnection({ sourceMagnet, targetMagnet }) {
          if (sourceMagnet?.getAttribute('port-group') !== 'out') return false
          if (targetMagnet?.getAttribute('port-group') !== 'in') return false
          return true
        },
        createEdge() {
          return this.createEdge({
            attrs: {
              line: {
                stroke: 'var(--color-primary, #1668e3)',
                strokeWidth: 1.5,
                targetMarker: { name: 'block', size: 8 },
              },
            },
          })
        },
      },
      interacting: { nodeMovable: true, edgeMovable: true },
    })
    handle.graph = graph
    graph.use(
      new MiniMap({
        container: minimapRef.value!,
        width: 180,
        height: 120,
      }),
    )
    graph.use(new Snapline({ enabled: true, sharp: true }))

    // 事件桥接 store
    graph.on('node:moved', ({ node }) => {
      // P1 只读守卫:未持锁 / 他人持锁时禁止移动。X6 此刻已把节点拖到新位置,
      // 需把它还原回 store 里的旧坐标,避免画布与 store 不一致。
      if (!store.editable) {
        const orig = store.nodes.find((n) => n.id === node.id)
        if (orig) node.setPosition(orig.x, orig.y, { silent: true })
        store.setSelection([])
        ElMessage.warning(i18n.global.t('workflowDesignerMvp.lock.readonlyGuard'))
        return
      }
      // P4 拖拽入 undo 栈:此刻 store 仍是拖前坐标(moveNode 尚未调),
      // pushUndo() 正好快照「拖前」状态 → 一次拖拽 = 一个可撤销单元。
      store.pushUndo()
      const pos = node.getPosition()
      store.moveNode(node.id, pos.x, pos.y)
    })
    graph.on('edge:connected', ({ edge, isNew }) => {
      // P1 只读守卫:未持锁 / 他人持锁时禁止连线。移除刚连出来的临时边并提示。
      if (!store.editable) {
        graph.removeEdge(edge.id, { silent: true })
        ElMessage.warning(i18n.global.t('workflowDesignerMvp.lock.readonlyGuard'))
        return
      }
      if (!isNew) return
      const src = edge.getSourceCellId()
      const tgt = edge.getTargetCellId()
      if (src && tgt) {
        // 移除 X6 临时边,store 添加正式边后 syncFromStore 重画
        graph.removeEdge(edge.id, { silent: true })
        store.addEdge({ source: src, target: tgt })
      }
    })
    graph.on('cell:click', ({ cell }) => {
      store.setSelection([cell.id])
    })
    graph.on('blank:click', () => store.setSelection([]))
    // hover 显 / 离开隐 连接桩,提升"从哪连线"的可发现性
    graph.on('node:mouseenter', ({ node }) => togglePorts(graph, node.id, true))
    graph.on('node:mouseleave', ({ node }) => togglePorts(graph, node.id, false))

    syncFromStore(graph)
    // store 变更 → 重画
    graph.on('__rerender__', () => syncFromStore(graph))
  })

  onBeforeUnmount(() => {
    handle.graph?.dispose()
    handle.graph = null
  })

  return handle
}
