<script setup lang="ts">
  /**
   * FILE_STEP 节点(长方形 + 文件 icon)。显示 pipelineCode。
   */
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { FileText as Document } from '@lucide/vue'
  import { useDesignerStore } from '../../store/useDesignerStore'
  import type { DesignerNode } from '../../types'

  const { t } = useI18n()
  const store = useDesignerStore()
  const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
    'getNode',
    null,
  )
  const data = getNode?.()?.getData?.()
  const pipelineCode = computed(
    () => String((data?.attrs as Record<string, unknown> | undefined)?.pipelineCode ?? '') || '',
  )
  const hasError = computed(() => (data?.id ? store.errorNodeIds.has(data.id) : false))
  const isSelected = computed(() => (data?.id ? store.selectedIds.has(data.id) : false))
</script>

<template>
  <div
    class="designer-node designer-node--file"
    :class="{ 'designer-node--error': hasError, 'designer-node--selected': isSelected }"
    role="img"
    :aria-label="t('workflowDesignerMvp.nodeFileStep')"
  >
    <div class="designer-node__row">
      <el-icon class="designer-node__icon" aria-hidden="true"><Document /></el-icon>
      <span class="designer-node__badge">{{ t('workflowDesignerMvp.nodeFileStep') }}</span>
    </div>
    <span class="designer-node__label">
      {{ pipelineCode || t('workflowDesignerMvp.pipelineCodeUnset') }}
    </span>
    <span v-if="data?.nodeName" class="designer-node__name">{{ data.nodeName }}</span>
  </div>
</template>

<style scoped>
  .designer-node {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    color: var(--color-text-primary);
    user-select: none;
  }
  .designer-node--file {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    box-shadow:
      inset 4px 0 0 var(--wf-node-file-step),
      0 1px 2px color-mix(in srgb, #1f2328 8%, transparent);
    transition:
      box-shadow 0.12s ease,
      border-color 0.12s ease;
  }
  .designer-node--file:hover {
    border-color: var(--wf-node-file-step);
    box-shadow:
      inset 4px 0 0 var(--wf-node-file-step),
      0 3px 10px color-mix(in srgb, #1f2328 12%, transparent);
  }
  .designer-node--selected {
    border-color: var(--color-primary) !important;
    box-shadow:
      inset 4px 0 0 var(--wf-node-file-step),
      0 0 0 3px var(--color-primary-light-8) !important;
  }
  .designer-node--error {
    border-color: var(--wf-node-error) !important;
    background: var(--wf-node-error-light) !important;
  }
  .designer-node__row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .designer-node__icon {
    font-size: 13px;
    color: var(--wf-node-file-step);
  }
  .designer-node__badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--wf-node-file-step);
    text-transform: uppercase;
  }
  .designer-node__label {
    font-size: 11px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .designer-node__name {
    font-size: 10px;
    color: #52677f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
