<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getTeleport } from '@antv/x6-vue-shape'
import { useDesignerStore } from '../store/useDesignerStore'
import { useX6Graph } from './useX6Graph'

const { t } = useI18n()

// x6-vue-shape 的节点通过 Teleport 渲染进这个容器,从而复用主 app 上下文
// (vue-i18n / pinia / element-plus 等插件);不挂它则 x6-vue-shape 退化为每节点
// 独立 createApp,节点组件里的 useI18n() 会抛「Need to install with `app.use`」。
const TeleportContainer = getTeleport()
const containerRef = ref<HTMLDivElement | null>(null)
const minimapRef = ref<HTMLDivElement | null>(null)

const store = useDesignerStore()
const handle = useX6Graph(containerRef, minimapRef)

defineExpose({
  /** 暴露给 toolbar 的自动布局入口(Polish 阶段支持方向参数) */
  autoLayout: (direction: 'TB' | 'LR' = 'TB') => handle.autoLayout(direction),
  /** 校验错误列表点击 → 居中并选中该节点 */
  focusNode: (nodeId: string) => handle.focusNode(nodeId),
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
  // P1 只读守卫:未持锁 / 他人持锁时禁止拖入新节点
  if (!store.editable) {
    ev.preventDefault()
    ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
    return
  }
  ev.preventDefault()
  const nodeType = ev.dataTransfer?.getData('application/x-designer-node-type')
  if (!nodeType || !containerRef.value || !handle.graph) return
  const rect = containerRef.value.getBoundingClientRect()
  // X6 v3 公开方法是 graph.clientToLocal(x, y)(clientToLocalPoint 仅在 graph.coord 子对象上,
  // 直接 graph.clientToLocalPoint(...) 会 is-not-a-function);返回画布逻辑坐标点
  const point = handle.graph.clientToLocal(ev.clientX, ev.clientY)
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
  // P1 只读守卫:未持锁 / 他人持锁时禁止删除 / 撤销 / 重做(均会改 store)
  if (!store.editable) {
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
    }
    return
  }
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
    <TeleportContainer />
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
  overflow: hidden;
  background: color-mix(in srgb, var(--color-bg-elevated) 88%, var(--color-bg-canvas) 12%);
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, var(--color-primary) 18%);
  border-radius: var(--radius-content);
  box-shadow:
    0 10px 24px rgb(0 0 0 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 8%);
  z-index: 2;
}

.dag-canvas__minimap :deep(.x6-widget-minimap),
.dag-canvas__minimap :deep(.x6-graph),
.dag-canvas__minimap :deep(.x6-graph-scroller) {
  background: transparent !important;
}

.dag-canvas__minimap :deep(.x6-widget-minimap-viewport) {
  border: 1px solid color-mix(in srgb, var(--color-primary) 46%, var(--color-border) 54%);
  border-radius: calc(var(--radius-content) - 4px);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
}
</style>
