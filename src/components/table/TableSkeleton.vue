<template>
  <el-card
    class="table-skeleton"
    shadow="never"
    role="status"
    aria-busy="true"
    :aria-label="t('common.loading')"
  >
    <el-skeleton v-if="layout === 'content'" :rows="rows" animated />
    <el-skeleton v-else animated>
      <template #template>
        <div class="table-skeleton__header" aria-hidden="true">
          <el-skeleton-item v-for="column in 4" :key="column" variant="text" />
        </div>
        <div v-for="row in rows" :key="row" class="table-skeleton__row" aria-hidden="true">
          <el-skeleton-item v-for="column in 4" :key="column" variant="text" />
        </div>
      </template>
    </el-skeleton>
  </el-card>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
  withDefaults(
    defineProps<{
      rows?: number
      layout?: 'table' | 'content'
    }>(),
    {
      rows: 6,
      layout: 'table',
    },
  )
</script>

<style scoped>
  .table-skeleton {
    border: 1px solid var(--color-border-light);
  }

  .table-skeleton__header,
  .table-skeleton__row {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.6fr);
    gap: var(--space-lg);
    align-items: center;
    min-height: 44px;
    border-bottom: 1px solid var(--color-border-light);
  }
  .table-skeleton__header {
    padding: 0 var(--space-sm);
    background: var(--color-bg-subtle);
  }
  .table-skeleton__row {
    padding: 0 var(--space-sm);
  }
  .table-skeleton__row:last-child {
    border-bottom: 0;
  }
  .table-skeleton__row :deep(.el-skeleton__item) {
    width: 75%;
    height: 12px;
  }
  .table-skeleton__row:nth-child(even) :deep(.el-skeleton__item) {
    width: 60%;
  }
  @media (prefers-reduced-motion: reduce) {
    .table-skeleton :deep(.el-skeleton__item) {
      animation: none;
      background: var(--el-skeleton-color);
    }
  }
</style>
