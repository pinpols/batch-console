<script setup lang="ts">
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../../store/useDesignerStore'
  import type { DesignerNode } from '../../types'

  const { t } = useI18n()
  const store = useDesignerStore()
  const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
    'getNode',
    null,
  )
  const data = getNode?.()?.getData?.()
  const hasError = computed(() => (data?.id ? store.errorNodeIds.has(data.id) : false))
  const isSelected = computed(() => (data?.id ? store.selectedIds.has(data.id) : false))
</script>

<template>
  <div
    class="designer-node designer-node--job"
    :class="{ 'designer-node--error': hasError, 'designer-node--selected': isSelected }"
    role="img"
    :aria-label="t('workflowDesignerSpike.nodeJob')"
  >
    <span class="designer-node__badge">{{ t('workflowDesignerSpike.nodeJob') }}</span>
    <span class="designer-node__label">{{ data?.nodeName || data?.nodeCode || '' }}</span>
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
    padding: 8px 12px 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    color: var(--color-text-primary);
    user-select: none;
  }
  .designer-node--job {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    box-shadow:
      inset 4px 0 0 var(--wf-node-job),
      0 1px 2px color-mix(in srgb, #1f2328 8%, transparent);
    transition:
      box-shadow 0.12s ease,
      border-color 0.12s ease;
  }
  .designer-node--job:hover {
    border-color: var(--wf-node-job);
    box-shadow:
      inset 4px 0 0 var(--wf-node-job),
      0 3px 10px color-mix(in srgb, #1f2328 12%, transparent);
  }
  .designer-node--selected {
    border-color: var(--color-primary) !important;
    box-shadow:
      inset 4px 0 0 var(--wf-node-job),
      0 0 0 3px var(--color-primary-light-8) !important;
  }
  .designer-node--error {
    border-color: var(--wf-node-error) !important;
    background: var(--wf-node-error-light) !important;
  }
  .designer-node__badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--wf-node-job);
    text-transform: uppercase;
  }
  .designer-node__label {
    font-size: 12px;
    margin-top: 3px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
