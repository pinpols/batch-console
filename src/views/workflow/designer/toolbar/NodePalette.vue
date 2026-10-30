<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { Component } from 'vue'
  import {
    GitFork,
    PanelLeftClose,
    PanelLeftOpen,
    Play,
    Square,
    Workflow,
  } from '@lucide/vue'
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
  ]

  function onClickAdd(type: DesignerNodeType) {
    if (!store.editable) return
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
      :disabled="!store.editable"
      :aria-label="t(item.labelKey)"
      :title="t('workflowDesignerSpike.paletteAddHint')"
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
    gap: 8px;
    width: 100%;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-card);
    box-shadow: 0 1px 2px color-mix(in srgb, #1f2328 6%, transparent);
  }
  .node-palette--collapsed {
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
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
    font-weight: 700;
    color: var(--color-text-primary);
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
    min-height: 44px;
    padding: 8px 10px 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    user-select: none;
    width: 100%;
    font: inherit;
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
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
    width: 34px;
    height: 34px;
    min-height: 34px;
    padding: 0;
  }

  .palette-item::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 50%;
    width: 3px;
    height: 22px;
    border-radius: var(--radius-pill);
    background: var(--palette-accent);
    transform: translateY(-50%);
  }

  .node-palette--collapsed .palette-item::before {
    display: none;
  }

  .palette-item__icon {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
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
    background: color-mix(in srgb, var(--palette-accent) 10%, var(--color-bg-card) 90%);
  }

  .palette-item:disabled {
    cursor: not-allowed;
    opacity: 0.5;
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
</style>
