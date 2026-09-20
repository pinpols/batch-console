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
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--color-border-light);
    border-right: none;
    border-radius: var(--radius-content) 0 0 var(--radius-content);
    background: var(--color-bg-card);
  }
  .node-palette__title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-secondary, #606266);
    margin-bottom: 0;
  }
  .node-palette__hint {
    font-size: 12px;
    color: var(--color-text-secondary, #909399);
    line-height: 1.5;
  }
  .palette-item {
    --palette-accent: var(--color-text-tertiary);

    position: relative;
    min-height: 42px;
    padding: 8px 12px 8px 22px;
    border-radius: var(--radius-content);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: grab;
    user-select: none;
    width: 100%;
    font: inherit;
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-canvas) 68%, var(--color-bg-card) 32%);
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      color 120ms ease;
  }

  .palette-item::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 50%;
    width: 3px;
    height: 16px;
    border-radius: var(--radius-pill);
    background: var(--palette-accent);
    transform: translateY(-50%);
  }

  .palette-item:hover {
    border-color: color-mix(in srgb, var(--palette-accent) 50%, var(--color-border) 50%);
    background: color-mix(in srgb, var(--palette-accent) 6%, var(--color-bg-card) 94%);
    color: var(--color-text-primary);
  }

  .palette-item:active {
    cursor: grabbing;
    background: color-mix(in srgb, var(--palette-accent) 10%, var(--color-bg-card) 90%);
  }

  .palette-item:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--palette-accent) 42%, transparent);
    outline-offset: 2px;
  }

  .palette-item--start {
    --palette-accent: var(--wf-node-start);
  }
  .palette-item--end {
    --palette-accent: var(--wf-node-end);
  }
  .palette-item--job {
    --palette-accent: var(--wf-node-job);
  }
  .palette-item--gateway {
    --palette-accent: var(--wf-node-gateway);
  }
  .palette-item--file {
    --palette-accent: var(--wf-node-file-step);
  }
  .palette-item--approval {
    --palette-accent: var(--wf-node-approval);
  }
</style>
