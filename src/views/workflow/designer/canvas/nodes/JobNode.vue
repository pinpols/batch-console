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
  <div class="designer-node designer-node--job" role="img" :aria-label="t('workflowDesignerSpike.nodeJob')">
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
  color: var(--color-text-primary, #303133);
  user-select: none;
}
.designer-node--job {
  background: var(--color-info-light, #ecf5ff);
  border: 2px solid var(--color-primary, #409eff);
}
.designer-node__badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-primary, #409eff);
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
