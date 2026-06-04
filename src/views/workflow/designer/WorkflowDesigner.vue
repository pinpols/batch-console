<script setup lang="ts">
/**
 * Workflow DAG 设计器顶层容器(Spike 阶段)。
 *
 * 布局:
 *   ┌──────────────────────────────────────────┐
 *   │ Toolbar(undo / redo / 自动布局 / 保存 / Mermaid)│
 *   ├────────┬─────────────────────────────────┤
 *   │ Palette│ Canvas(X6)+ mini-map           │
 *   └────────┴─────────────────────────────────┘
 *
 * 数据流(Spike):
 * - 加载已有 workflow(:id):懒占位,Spike 阶段不联 BE,从空白开始(MVP 接 GET /full)
 * - 保存:console.log(snapshot)(MVP 接 PUT /full)
 * - Mermaid:从 store snapshot 走 `exportMermaid`,弹 dialog 展示文本
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useDesignerStore } from './store/useDesignerStore'
import { exportMermaid } from './codec/mermaidExporter'
import { graphToDefinition } from './codec/graphToDefinition'
import { logRoute } from '@/utils/logger'
import DagCanvas from './canvas/DagCanvas.vue'
import DesignerToolbar from './toolbar/DesignerToolbar.vue'
import NodePalette from './toolbar/NodePalette.vue'

const route = useRoute()
const { t } = useI18n()

const store = useDesignerStore()
const canvasRef = ref<InstanceType<typeof DagCanvas> | null>(null)
const mermaidDialogVisible = ref(false)
const mermaidText = ref('')

const workflowId = (route.params.id as string | undefined) ?? null

onMounted(() => {
  // Spike 阶段:不联 BE,始终从空快照开始;:id 仅用于 logger 标识
  store.reset({ nodes: [], edges: [] })
  logRoute('[designer] mounted', { workflowId })
})

onBeforeUnmount(() => {
  store.reset({ nodes: [], edges: [] })
})

function onAutoLayout() {
  canvasRef.value?.autoLayout()
}

function onSave() {
  // Spike 阶段:不真接 BE,只 console.log;MVP 接 PUT /workflow/definitions/{id}/full
  const def = graphToDefinition(store.snapshot)
  // Spike 阶段不联 BE,仅借 logger 留痕(MVP 删除此 log,改为真实保存)
  logRoute('[designer] save (spike: log only)', { workflowId, nodeCount: def.nodes.length })
  store.markClean()
  ElMessage.success(t('workflowDesignerSpike.saveSpikeToast'))
}

function onExportMermaid() {
  mermaidText.value = exportMermaid(store.snapshot)
  mermaidDialogVisible.value = true
}
</script>

<template>
  <div class="workflow-designer">
    <DesignerToolbar
      @auto-layout="onAutoLayout"
      @save="onSave"
      @export-mermaid="onExportMermaid"
    />
    <div class="workflow-designer__body">
      <NodePalette />
      <DagCanvas ref="canvasRef" />
    </div>

    <el-dialog
      v-model="mermaidDialogVisible"
      :title="t('workflowDesignerSpike.mermaidDialogTitle')"
      width="600px"
    >
      <el-input
        v-model="mermaidText"
        type="textarea"
        :rows="12"
        readonly
        :aria-label="t('workflowDesignerSpike.mermaidDialogTitle')"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.workflow-designer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 60px);
}
.workflow-designer__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
