<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'
import type { DesignerNode } from '../../types'

const { t } = useI18n()
const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
  'getNode',
  null,
)
const data = getNode?.()?.getData?.()
</script>

<template>
  <div class="designer-node designer-node--end" role="img" :aria-label="t('workflowDesignerSpike.nodeEnd')">
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
  background: var(--color-danger, #f56c6c);
  border: 2px solid var(--color-danger-dark, #b25b5b);
}
.designer-node__badge {
  font-weight: 600;
}
.designer-node__label {
  font-size: 11px;
  opacity: 0.9;
}
</style>
