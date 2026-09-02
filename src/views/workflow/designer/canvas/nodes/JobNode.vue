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
</script>

<template>
  <div
    class="designer-node designer-node--job"
    :class="{ 'designer-node--error': hasError }"
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
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #243247;
    user-select: none;
  }
  .designer-node--job {
    background: var(--wf-node-job-light);
    border: 2px solid var(--wf-node-job);
    transition:
      box-shadow 0.12s ease,
      border-color 0.12s ease;
  }
  .designer-node--job:hover {
    box-shadow: 0 0 0 3px var(--wf-node-job-light);
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
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
