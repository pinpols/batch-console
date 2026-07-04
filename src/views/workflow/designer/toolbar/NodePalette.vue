<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { DesignerNodeType } from '../types'
  import { useDesignerStore } from '../store/useDesignerStore'

  const { t } = useI18n()
  const store = useDesignerStore()

  const emit = defineEmits<{
    /** 点击节点库添加节点;父组件负责落点(视口中心 + 偏移)与只读兜底 */
    (e: 'add', type: DesignerNodeType): void
  }>()

  interface PaletteItem {
    type: DesignerNodeType
    labelKey: string
    styleClass: string
  }

  const items: PaletteItem[] = [
    {
      type: 'START',
      labelKey: 'workflowDesignerSpike.nodeStart',
      styleClass: 'palette-item--start',
    },
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
    // P1 只读守卫:未持锁 / 他人持锁时禁止从节点库拖出
    if (!store.editable) {
      ev.preventDefault()
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    if (!ev.dataTransfer) return
    ev.dataTransfer.effectAllowed = 'copy'
    ev.dataTransfer.setData('application/x-designer-node-type', type)
  }

  function onClickAdd(type: DesignerNodeType) {
    // P1 只读守卫:未持锁 / 他人持锁时禁止点击添加
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    emit('add', type)
  }
</script>

<template>
  <div class="node-palette" :aria-label="t('workflowDesignerSpike.paletteAriaLabel')">
    <div class="node-palette__title">{{ t('workflowDesignerSpike.paletteTitle') }}</div>
    <div class="node-palette__hint">{{ t('workflowDesignerSpike.paletteAddHint') }}</div>
    <button
      v-for="item in items"
      :key="item.type"
      type="button"
      class="palette-item"
      :class="item.styleClass"
      draggable="true"
      :aria-label="t(item.labelKey)"
      :title="t('workflowDesignerSpike.paletteAddHint')"
      @dragstart="onDragStart($event, item.type)"
      @click="onClickAdd(item.type)"
    >
      {{ t(item.labelKey) }}
    </button>
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
    border-right: 1px solid var(--color-border);
  }
  .node-palette__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #606266);
    margin-bottom: 4px;
  }
  .node-palette__hint {
    font-size: 11px;
    color: var(--color-text-secondary, #909399);
    margin-bottom: 2px;
  }
  .palette-item {
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    text-align: center;
    cursor: grab;
    user-select: none;
    width: 100%;
    font: inherit;
    border: 1px dashed var(--color-border);
    transition:
      box-shadow 0.12s ease,
      transform 0.06s ease;
  }
  .palette-item:active {
    cursor: grabbing;
  }
  .palette-item:hover {
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
  }
  .palette-item:active {
    transform: translateY(1px);
  }
  .palette-item--start {
    background: var(--wf-node-start-light);
    color: var(--wf-node-start);
    border-color: var(--wf-node-start);
  }
  .palette-item--end {
    background: var(--wf-node-end-light);
    color: var(--wf-node-end);
    border-color: var(--wf-node-end);
  }
  .palette-item--job {
    background: var(--wf-node-job-light);
    color: var(--wf-node-job);
    border-color: var(--wf-node-job);
  }
  .palette-item--gateway {
    background: var(--wf-node-gateway-light);
    color: var(--wf-node-gateway);
    border-color: var(--wf-node-gateway);
  }
  .palette-item--file {
    background: var(--wf-node-file-step-light);
    color: var(--wf-node-file-step);
    border-color: var(--wf-node-file-step);
  }
  .palette-item--approval {
    background: var(--wf-node-approval-light);
    color: var(--wf-node-approval);
    border-color: var(--wf-node-approval);
  }
</style>
