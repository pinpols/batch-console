<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DesignerNodeType } from '../types'

const { t } = useI18n()

interface PaletteItem {
  type: DesignerNodeType
  labelKey: string
  styleClass: string
}

const items: PaletteItem[] = [
  { type: 'START', labelKey: 'workflowDesignerSpike.nodeStart', styleClass: 'palette-item--start' },
  { type: 'END', labelKey: 'workflowDesignerSpike.nodeEnd', styleClass: 'palette-item--end' },
  { type: 'JOB', labelKey: 'workflowDesignerSpike.nodeJob', styleClass: 'palette-item--job' },
  {
    type: 'GATEWAY',
    labelKey: 'workflowDesignerMvp.nodeGateway',
    styleClass: 'palette-item--gateway',
  },
  {
    type: 'FILE_STEP',
    labelKey: 'workflowDesignerMvp.nodeFileStep',
    styleClass: 'palette-item--file',
  },
  {
    type: 'APPROVAL',
    labelKey: 'workflowDesignerMvp.nodeApproval',
    styleClass: 'palette-item--approval',
  },
]

function onDragStart(ev: DragEvent, type: DesignerNodeType) {
  if (!ev.dataTransfer) return
  ev.dataTransfer.effectAllowed = 'copy'
  ev.dataTransfer.setData('application/x-designer-node-type', type)
}
</script>

<template>
  <div class="node-palette" :aria-label="t('workflowDesignerSpike.paletteAriaLabel')">
    <div class="node-palette__title">{{ t('workflowDesignerSpike.paletteTitle') }}</div>
    <div
      v-for="item in items"
      :key="item.type"
      class="palette-item"
      :class="item.styleClass"
      draggable="true"
      :aria-label="t(item.labelKey)"
      @dragstart="onDragStart($event, item.type)"
    >
      {{ t(item.labelKey) }}
    </div>
  </div>
</template>

<style scoped>
.node-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  width: 180px;
  background: var(--color-bg-overlay, #fff);
  border-right: 1px solid var(--color-border-base, #dcdfe6);
}
.node-palette__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #606266);
  margin-bottom: 4px;
}
.palette-item {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  cursor: grab;
  user-select: none;
  border: 1px dashed var(--color-border-base, #dcdfe6);
}
.palette-item:active {
  cursor: grabbing;
}
.palette-item--start {
  background: var(--color-success-light, #f0f9eb);
  color: var(--color-success, #67c23a);
}
.palette-item--end {
  background: var(--color-danger-light, #fef0f0);
  color: var(--color-danger, #f56c6c);
}
.palette-item--job {
  background: var(--color-info-light, #ecf5ff);
  color: var(--color-primary, #409eff);
}
.palette-item--gateway {
  background: var(--color-warning-light, #fdf6ec);
  color: var(--color-warning-dark, #b88230);
}
.palette-item--file {
  background: var(--color-success-light, #f0f9eb);
  color: var(--color-success-dark, #529b2e);
}
.palette-item--approval {
  background: #f5f0ff;
  color: #6b3fcb;
}
</style>
