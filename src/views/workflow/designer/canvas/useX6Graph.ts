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
import { register as registerVueShape } from '@antv/x6-vue-shape'
// X6 v3 仍保留对老式 dagre 字符串布局算法的支持,但需要用户层手算 -> 走 npm dagre 自行布局
import dagre from 'dagre'
import type { Component, Ref } from 'vue'
import { onBeforeUnmount, onMounted } from 'vue'
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

export interface X6GraphHandle {
  graph: Graph | null
  /** Polish 阶段:可选 dagre 布局方向(TB 默认 / LR 左右),不传保持原行为 */
  autoLayout: (direction?: 'TB' | 'LR') => void
}

export function useX6Graph(containerRef: Ref<HTMLDivElement | null>, minimapRef: Ref<HTMLDivElement | null>): X6GraphHandle {
  const store = useDesignerStore()
  const handle: X6GraphHandle = { graph: null, autoLayout: () => {} }

  /**
   * 把 store 状态 → X6 cells(全量替换)。
   * 设计折衷:Spike 阶段每次 store 变化都全量重画,数十节点性能可接受;
   * MVP 接 BE 后再做增量 diff。
   */
  function syncFromStore(graph: Graph) {
    graph.startBatch('sync-from-store')
    try {
      graph.clearCells()
      for (const n of store.nodes) {
        const { width, height } = sizeOf(n.nodeType)
        graph.addNode({
          id: n.id,
          shape: shapeOf(n.nodeType),
          x: n.x,
          y: n.y,
          width,
          height,
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
      background: { color: 'var(--color-bg-base, #fafafa)' },
      grid: { visible: true, type: 'dot', size: 10 },
      panning: { enabled: true },
      mousewheel: { enabled: true, modifiers: 'ctrl', zoomAtMousePosition: true },
      connecting: {
        router: 'manhattan',
        connector: 'rounded',
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        allowMulti: false,
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

    // 事件桥接 store
    graph.on('node:moved', ({ node }) => {
      const pos = node.getPosition()
      store.moveNode(node.id, pos.x, pos.y)
    })
    graph.on('edge:connected', ({ edge, isNew }) => {
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
      // Spike 阶段:用 console.log 验证选中事件路径(inspector 留 MVP)
      // eslint-disable-next-line no-console
      console.log('[designer] cell selected', cell.id, cell.isNode() ? 'node' : 'edge')
    })
    graph.on('blank:click', () => store.setSelection([]))

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
