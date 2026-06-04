<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'
import { useX6Graph } from './useX6Graph'

const { t } = useI18n()
const containerRef = ref<HTMLDivElement | null>(null)
const minimapRef = ref<HTMLDivElement | null>(null)

const store = useDesignerStore()
const handle = useX6Graph(containerRef, minimapRef)

defineExpose({
  /** 暴露给 toolbar 的自动布局入口 */
  autoLayout: () => handle.autoLayout(),
})

// store 变更 → 通过自定义 event 触发 X6 重画(useX6Graph 内部监听 `__rerender__`)
watch(
  () => [store.nodes.length, store.edges.length, store.undoStack.length, store.redoStack.length],
  () => {
    handle.graph?.trigger('__rerender__')
  },
)

// 拖入节点(从 palette HTML5 DnD 落点),由 DagCanvas 监听 drop
function onDrop(ev: DragEvent) {
  ev.preventDefault()
  const nodeType = ev.dataTransfer?.getData('application/x-designer-node-type')
  if (!nodeType || !containerRef.value || !handle.graph) return
  const rect = containerRef.value.getBoundingClientRect()
  // X6 提供 clientToLocalPoint 把屏幕坐标 → 画布逻辑坐标
  const point = handle.graph.clientToLocalPoint({ x: ev.clientX, y: ev.clientY })
  // fallback 当 graph 还未挂载时:用相对容器坐标
  const x = Number.isFinite(point.x) ? point.x : ev.clientX - rect.left
  const y = Number.isFinite(point.y) ? point.y : ev.clientY - rect.top
  // 生成 nodeCode:类型前缀 + 时间戳后 4 位,Spike 阶段够用
  const suffix = String(Date.now()).slice(-4)
  const code = `${nodeType.toLowerCase()}_${suffix}`
  store.addNode({
    nodeCode: code,
    nodeName: code,
    nodeType: nodeType as never,
    x,
    y,
  })
}

function onKeyDown(ev: KeyboardEvent) {
  // Delete 删除选中
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    const ids = Array.from(store.selectedIds)
    for (const id of ids) {
      // 先尝试当节点删,失败则当边删
      const wasNode = store.nodes.some((n) => n.id === id)
      if (wasNode) store.deleteNode(id)
      else store.deleteEdge(id)
    }
    return
  }
  // Ctrl+Z / Ctrl+Y
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
    ev.preventDefault()
    store.undo()
    return
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
    ev.preventDefault()
    store.redo()
  }
}
</script>

<template>
  <div
    class="dag-canvas"
    tabindex="0"
    :aria-label="t('workflowDesignerSpike.canvasAriaLabel')"
    @dragover.prevent
    @drop="onDrop"
    @keydown="onKeyDown"
  >
    <div ref="containerRef" class="dag-canvas__graph" />
    <div ref="minimapRef" class="dag-canvas__minimap" :aria-label="t('workflowDesignerSpike.minimapAriaLabel')" />
  </div>
</template>

<style scoped>
.dag-canvas {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  outline: none;
}
.dag-canvas__graph {
  width: 100%;
  height: 100%;
}
.dag-canvas__minimap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 180px;
  height: 120px;
  background: var(--color-bg-overlay, #fff);
  border: 1px solid var(--color-border-base, #dcdfe6);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 2;
}
</style>
