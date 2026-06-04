<script setup lang="ts">
/**
 * FILE_STEP 节点(长方形 + 文件 icon)。显示 pipelineCode。
 */
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { Document } from '@element-plus/icons-vue'
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
</script>

<template>
  <div
    class="designer-node designer-node--file"
    :class="{ 'designer-node--error': hasError }"
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
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-primary, #303133);
  user-select: none;
}
.designer-node--file {
  background: var(--color-success-light, #f0f9eb);
  border: 2px solid var(--color-success, #67c23a);
}
.designer-node--error {
  border-color: var(--color-danger, #f56c6c) !important;
  background: var(--color-danger-light, #fef0f0) !important;
}
.designer-node__row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.designer-node__icon {
  font-size: 13px;
}
.designer-node__badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-success-dark, #529b2e);
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
  color: var(--color-text-secondary, #909399);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
