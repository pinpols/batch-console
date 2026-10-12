<template>
  <el-popover
    :width="popoverWidth"
    :placement="placement"
    trigger="click"
    :teleported="true"
    popper-class="json-preview-popover"
  >
    <template #reference>
      <button class="json-preview-popover__trigger" type="button" :title="t('common.viewJson')">
        <el-icon :size="14"><Braces /></el-icon>
        <span>{{ t('common.viewJson') }}</span>
      </button>
    </template>
    <JsonPreview :data="data" />
  </el-popover>
</template>

<script setup lang="ts">
  import { ElIcon, ElPopover } from 'element-plus'
  import { Braces } from '@lucide/vue'
  import { useI18n } from 'vue-i18n'
  import JsonPreview from './JsonPreview.vue'

  withDefaults(
    defineProps<{
      data: unknown
      popoverWidth?: number
      placement?:
        | 'top'
        | 'top-start'
        | 'top-end'
        | 'bottom'
        | 'bottom-start'
        | 'bottom-end'
        | 'left'
        | 'right'
    }>(),
    { popoverWidth: 560, placement: 'left' },
  )

  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .json-preview-popover__trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .json-preview-popover__trigger:hover,
  .json-preview-popover__trigger:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
    outline: none;
  }
</style>
