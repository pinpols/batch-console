<template>
  <div class="file-summary">
    <div class="file-summary__cell">
      <MetricCard
        :label="t('fileList.summaryArrivedToday')"
        :value="summary?.arrivedToday ?? 0"
        tone="info"
        clickable
        :active="activeSummaryKey === 'today'"
        @click="emit('today')"
      />
      <span class="file-summary__arrow" aria-hidden="true">›</span>
    </div>
    <div class="file-summary__cell">
      <MetricCard
        :label="t('fileList.summaryPending')"
        :value="summary?.pending ?? 0"
        tone="warning"
        clickable
        :active="activeSummaryKey === 'RECEIVED'"
        @click="emit('status', 'RECEIVED')"
      />
      <span class="file-summary__arrow" aria-hidden="true">›</span>
    </div>
    <div class="file-summary__cell">
      <MetricCard
        :label="t('fileList.summaryProcessed')"
        :value="summary?.processed ?? 0"
        tone="success"
        clickable
        :active="activeSummaryKey === 'LOADED'"
        @click="emit('status', 'LOADED')"
      />
      <span class="file-summary__arrow" aria-hidden="true">›</span>
    </div>
    <div class="file-summary__cell">
      <MetricCard
        :label="t('fileList.summaryFailed')"
        :value="summary?.failed ?? 0"
        tone="danger"
        clickable
        :active="activeSummaryKey === 'FAILED'"
        @click="emit('status', 'FAILED')"
      />
      <span class="file-summary__arrow" aria-hidden="true">›</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import MetricCard from '@/components/common/MetricCard.vue'
  import type { ConsoleFileSummaryResponse } from '@/types/console-api'

  defineProps<{
    summary: ConsoleFileSummaryResponse | null
    activeSummaryKey: string
  }>()
  const emit = defineEmits<{
    today: []
    status: [status: 'RECEIVED' | 'LOADED' | 'FAILED']
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .file-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .file-summary__cell {
    position: relative;
    min-width: 0;
  }

  /* 照设计 dump:卡片标签行右端「›」(11px / text-3),提示卡片可点联动筛选 */
  .file-summary__arrow {
    position: absolute;
    top: 16px;
    right: 18px;
    font-size: 11px;
    line-height: 1;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .file-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
