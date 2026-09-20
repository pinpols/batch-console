<template>
  <section class="ops-filter-toolbar">
    <div v-if="$slots.saved" class="ops-filter-toolbar__saved">
      <slot name="saved" />
    </div>

    <div class="ops-filter-toolbar__main">
      <div v-if="$slots.status" class="ops-filter-toolbar__status">
        <slot name="status" />
      </div>
      <div class="ops-filter-toolbar__filters">
        <slot />
      </div>
      <div class="ops-filter-toolbar__actions">
        <slot name="before-actions" />
        <el-button
          v-if="showSearch"
          type="primary"
          :icon="Search"
          :loading="filterBusy"
          :disabled="disabled"
          @click="emit('search')"
        >
          {{ t('common.search') }}
        </el-button>
        <el-button
          v-if="showReset"
          plain
          :icon="RotateCcw"
          :disabled="disabled || filterBusy"
          @click="emit('reset')"
        >
          {{ t('common.reset') }}
        </el-button>
        <el-button
          v-if="showRefresh"
          plain
          :icon="Refresh"
          :loading="refreshBusy"
          :disabled="disabled"
          @click="emit('refresh')"
        >
          {{ t('common.refresh') }}
        </el-button>
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.context" class="ops-filter-toolbar__context">
      <slot name="context" />
    </div>
    <slot name="monitor" />
  </section>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, RotateCcw, Search } from 'lucide-vue-next'

  withDefaults(
    defineProps<{
      filterBusy?: boolean
      refreshBusy?: boolean
      disabled?: boolean
      showSearch?: boolean
      showReset?: boolean
      showRefresh?: boolean
    }>(),
    {
      filterBusy: false,
      refreshBusy: false,
      disabled: false,
      showSearch: true,
      showReset: true,
      showRefresh: true,
    },
  )

  const emit = defineEmits<{
    (event: 'search'): void
    (event: 'reset'): void
    (event: 'refresh'): void
  }>()

  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .ops-filter-toolbar {
    display: grid;
    min-width: 0;
    margin: 6px 0 10px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }

  .ops-filter-toolbar__saved {
    display: flex;
    align-items: center;
    min-height: 42px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .ops-filter-toolbar__main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 10px 12px;
  }

  .ops-filter-toolbar__status {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 0 0 auto;
  }

  .ops-filter-toolbar__filters {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
  }

  .ops-filter-toolbar__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
  }

  .ops-filter-toolbar__actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .ops-filter-toolbar__actions :deep(.el-button) {
    min-width: 74px;
  }

  .ops-filter-toolbar__context {
    padding: 0 12px 10px;
  }

  @media (max-width: 1800px) {
    .ops-filter-toolbar__main {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .ops-filter-toolbar__filters {
      order: 3;
      width: 100%;
      flex-basis: 100%;
    }

    .ops-filter-toolbar__actions {
      margin-left: auto;
    }
  }

  @media (max-width: 720px) {
    .ops-filter-toolbar__main,
    .ops-filter-toolbar__filters,
    .ops-filter-toolbar__actions {
      align-items: stretch;
      flex-direction: column;
    }

    .ops-filter-toolbar__status,
    .ops-filter-toolbar__filters,
    .ops-filter-toolbar__actions {
      width: 100%;
    }

    .ops-filter-toolbar__actions :deep(.el-button) {
      width: 100%;
      margin-left: 0;
    }
  }
</style>
