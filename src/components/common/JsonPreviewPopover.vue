<template>
  <el-popover
    :width="popoverWidth"
    :placement="placement"
    :trigger="['hover', 'focus', 'click']"
    :show-after="180"
    :hide-after="120"
    :focus-on-target="true"
    :teleported="true"
    popper-class="json-preview-popover"
  >
    <template #reference>
      <button
        class="json-preview-popover__trigger"
        type="button"
        :aria-label="t('common.viewJson')"
      >
        <el-icon :size="16"><Eye /></el-icon>
      </button>
    </template>
    <JsonPreview :data="data" />
  </el-popover>
</template>

<script setup lang="ts">
  import { ElIcon, ElPopover } from 'element-plus'
  import { Eye } from '@lucide/vue'
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
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
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
