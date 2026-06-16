<template>
  <transition name="bulk-bar-fade">
    <div
      v-if="count > 0"
      class="bulk-action-bar"
      role="region"
      :aria-label="t('bulk.selectedAria')"
    >
      <div class="bulk-action-bar__count">
        <el-icon class="bulk-action-bar__icon"><Select /></el-icon>
        <span>{{ t('bulk.selectedCount', { n: count }) }}</span>
        <el-button link type="primary" :disabled="running" @click="$emit('clear')">
          {{ t('bulk.clear') }}
        </el-button>
      </div>
      <div class="bulk-action-bar__actions">
        <slot :running="running" />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Select } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })

  defineProps<{
    /** 当前选中数 */
    count: number
    /** 是否有批量动作正在执行(禁用清除/动作) */
    running?: boolean
  }>()

  defineEmits<{ (e: 'clear'): void }>()
</script>

<style scoped>
  .bulk-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md, 12px);
    flex-wrap: wrap;
    padding: var(--space-sm, 8px) var(--space-md, 12px);
    margin-bottom: var(--page-block-gap);
    border-radius: var(--radius-md, 8px);
    background: var(--color-bg-info, #ecf5ff);
    border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
  }

  .bulk-action-bar__count {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-primary);
  }

  .bulk-action-bar__icon {
    color: var(--color-primary);
  }

  .bulk-action-bar__actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    flex-wrap: wrap;
  }

  .bulk-bar-fade-enter-active,
  .bulk-bar-fade-leave-active {
    transition:
      opacity var(--motion-duration-sm, 0.15s) ease,
      transform var(--motion-duration-sm, 0.15s) ease;
  }

  .bulk-bar-fade-enter-from,
  .bulk-bar-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
