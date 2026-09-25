<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { Component } from 'vue'
  import {
    CheckSquare,
    FileInput,
    GitFork,
    PanelLeftClose,
    PanelLeftOpen,
    Play,
    Square,
    Workflow,
  } from 'lucide-vue-next'
  import type { DesignerNodeType } from '../types'
  import { useDesignerStore } from '../store/useDesignerStore'

  const { t } = useI18n()
  const store = useDesignerStore()

  defineProps<{ collapsed: boolean }>()

  const emit = defineEmits<{
    /** 点击节点库添加节点;父组件负责落点(视口中心 + 偏移)与只读兜底 */
    (e: 'add', type: DesignerNodeType): void
    (e: 'toggle'): void
  }>()

  interface PaletteItem {
    type: DesignerNodeType
    labelKey: string
    styleClass: string
    icon: Component
  }

  const items: PaletteItem[] = [
    {
      type: 'START',
      labelKey: 'workflowDesignerSpike.nodeStart',
      styleClass: 'palette-item--start',
      icon: Play,
    },
    {
      type: 'END',
      labelKey: 'workflowDesignerSpike.nodeEnd',
      styleClass: 'palette-item--end',
      icon: Square,
    },
    {
      type: 'JOB',
      labelKey: 'workflowDesignerSpike.nodeJob',
      styleClass: 'palette-item--job',
      icon: Workflow,
    },
    {
      type: 'GATEWAY',
      labelKey: 'workflowDesignerMvp.nodeGateway',
      styleClass: 'palette-item--gateway',
      icon: GitFork,
    },
    {
      type: 'FILE_STEP',
      labelKey: 'workflowDesignerMvp.nodeFileStep',
      styleClass: 'palette-item--file',
      icon: FileInput,
    },
    {
      type: 'APPROVAL',
      labelKey: 'workflowDesignerMvp.nodeApproval',
      styleClass: 'palette-item--approval',
      icon: CheckSquare,
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
  <div
    class="node-palette"
    :class="{ 'node-palette--collapsed': collapsed }"
    :aria-label="t('workflowDesignerSpike.paletteAriaLabel')"
  >
    <div class="node-palette__header">
      <div v-if="!collapsed" class="node-palette__title">
        {{ t('workflowDesignerSpike.paletteTitle') }}
      </div>
      <el-button
        text
        circle
        size="small"
        :icon="collapsed ? PanelLeftOpen : PanelLeftClose"
        :title="
          collapsed
            ? t('workflowDesignerMvp.layout.expandPalette')
            : t('workflowDesignerMvp.layout.collapsePalette')
        "
        :aria-label="
          collapsed
            ? t('workflowDesignerMvp.layout.expandPalette')
            : t('workflowDesignerMvp.layout.collapsePalette')
        "
        @click="emit('toggle')"
      />
    </div>
    <div v-if="!collapsed" class="node-palette__hint">
      {{ t('workflowDesignerSpike.paletteAddHint') }}
    </div>
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
      <component :is="item.icon" class="palette-item__icon" aria-hidden="true" />
      <span v-if="!collapsed" class="palette-item__label">{{ t(item.labelKey) }}</span>
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
    padding: 10px;
    border: 1px solid var(--color-border-light);
    border-right: none;
    border-radius: var(--radius-content) 0 0 var(--radius-content);
    background: var(--color-bg-card);
  }
  .node-palette--collapsed {
    align-items: center;
    gap: 8px;
    padding: 8px 6px;
  }
  .node-palette__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 28px;
  }
  .node-palette--collapsed .node-palette__header {
    justify-content: center;
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
    padding: 8px 10px;
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
    display: flex;
    align-items: center;
    gap: 8px;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      color 120ms ease;
  }

  .node-palette--collapsed .palette-item {
    justify-content: center;
    width: 40px;
    height: 40px;
    min-height: 40px;
    padding: 0;
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

  .node-palette--collapsed .palette-item::before {
    display: none;
  }

  .palette-item__icon {
    flex: 0 0 auto;
    width: 17px;
    height: 17px;
    color: var(--palette-accent);
  }
  .palette-item__label {
    min-width: 0;
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
