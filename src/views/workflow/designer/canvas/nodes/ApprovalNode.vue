<script setup lang="ts">
  /**
   * APPROVAL 节点(长方形 + 审批 icon)。显示 approvalTemplateCode。
   */
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Check } from 'lucide-vue-next'
  import { useDesignerStore } from '../../store/useDesignerStore'
  import type { DesignerNode } from '../../types'

  const { t } = useI18n()
  const store = useDesignerStore()
  const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
    'getNode',
    null,
  )
  const data = getNode?.()?.getData?.()
  const tplCode = computed(
    () =>
      String((data?.attrs as Record<string, unknown> | undefined)?.approvalTemplateCode ?? '') ||
      '',
  )
  const hasError = computed(() => (data?.id ? store.errorNodeIds.has(data.id) : false))
</script>

<template>
  <div
    class="designer-node designer-node--approval"
    :class="{ 'designer-node--error': hasError }"
    role="img"
    :aria-label="t('workflowDesignerMvp.nodeApproval')"
  >
    <div class="designer-node__row">
      <el-icon class="designer-node__icon" aria-hidden="true"><Check /></el-icon>
      <span class="designer-node__badge">{{ t('workflowDesignerMvp.nodeApproval') }}</span>
    </div>
    <span class="designer-node__label">
      {{ tplCode || t('workflowDesignerMvp.approvalTemplateUnset') }}
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
    color: #243247;
    user-select: none;
  }
  .designer-node--approval {
    background: var(--wf-node-approval-light);
    border: 2px solid var(--wf-node-approval);
    transition:
      box-shadow 0.12s ease,
      border-color 0.12s ease;
  }
  .designer-node--approval:hover {
    box-shadow: 0 0 0 3px var(--wf-node-approval-light);
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
    color: var(--wf-node-approval);
  }
  .designer-node__badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--wf-node-approval);
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
