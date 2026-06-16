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
    class="designer-node designer-node--end"
    :class="{ 'designer-node--error': hasError }"
    role="img"
    :aria-label="t('workflowDesignerSpike.nodeEnd')"
  >
    <span class="designer-node__badge">{{ t('workflowDesignerSpike.nodeEnd') }}</span>
    <span v-if="data?.nodeName" class="designer-node__label">{{ data.nodeName }}</span>
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
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  user-select: none;
}
.designer-node--end {
  background: var(--wf-node-end);
  border: 2px solid var(--wf-node-end);
  transition:
    box-shadow 0.12s ease,
    border-color 0.12s ease;
}
.designer-node--end:hover {
  box-shadow: 0 0 0 3px var(--wf-node-end-light);
}
.designer-node--error {
  border-color: var(--color-text-primary, #303133) !important;
  box-shadow: 0 0 0 3px var(--wf-node-error-light);
}
.designer-node__badge {
  font-weight: 600;
}
.designer-node__label {
  font-size: 11px;
  opacity: 0.9;
}
</style>
