<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingSyncLogs"
      :disabled="loadingSyncLogs"
      @refresh="() => runRefresh(loadSyncLogs)"
      @search="() => runSearch(loadSyncLogs)"
      @reset="() => runReset(loadSyncLogs)"
    />
    <DataState
      :loading="loadingSyncLogs"
      :error="loadSyncLogsError"
      :has-data="syncLogs.length > 0"
      :on-retry="loadSyncLogs"
    >
      <el-table
        v-loading="loadingSyncLogs"
        :data="syncLogs"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" :label="t('configSyncLogsTab.colId')" width="72" align="center">
          <template #default="{ row }">
            <span class="mono-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colType')" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.syncDirection"
              :type="typeTag(row.syncDirection)"
              size="small"
              effect="light"
              round
            >
              {{ row.syncDirection }}
            </el-tag>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.syncStatus"
              :type="statusTag(row.syncStatus)"
              size="small"
              effect="light"
              round
            >
              {{ row.syncStatus }}
            </el-tag>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colOperator')" width="130">
          <template #default="{ row }">
            <span v-if="row.operatorId" class="op-id">{{ row.operatorId }}</span>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colSummary')" min-width="260">
          <template #default="{ row }">
            <template v-if="hasMetrics(row)">
              <span class="sync-metrics">
                <template v-for="(seg, idx) in summarySegments(row)" :key="seg.label">
                  <span v-if="idx > 0" class="m-sep">·</span>
                  {{ seg.label }}
                  <strong :class="seg.cls">{{ seg.value }}</strong>
                </template>
              </span>
            </template>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" :label="t('configSyncLogsTab.colTime')" width="170" />
      </el-table>
    </DataState>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listConfigSyncLogs } from '@/api/configReleases'

  const { t } = useI18n({ useScope: 'global' })
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'

  const tenant = useTenantStore()
  const {
    loading: loadingSyncLogs,
    error: loadSyncLogsError,
    run: runLoadSyncLogs,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingSyncLogs)
  const syncLogs = ref<Record<string, unknown>[]>([])

  function hasMetrics(row: Record<string, unknown>): boolean {
    return (
      Number(row.totalItems ?? 0) +
        Number(row.successItems ?? 0) +
        Number(row.failedItems ?? 0) +
        Number(row.skippedItems ?? 0) >
      0
    )
  }

  function summarySegments(row: Record<string, unknown>) {
    const failed = Number(row.failedItems ?? 0)
    return [
      { label: t('configSyncLogsTab.metricTotal'), value: Number(row.totalItems ?? 0), cls: '' },
      {
        label: t('configSyncLogsTab.metricSuccess'),
        value: Number(row.successItems ?? 0),
        cls: 'm-ok',
      },
      {
        label: t('configSyncLogsTab.metricFailed'),
        value: failed,
        cls: failed > 0 ? 'm-bad' : 'm-ok',
      },
      {
        label: t('configSyncLogsTab.metricSkipped'),
        value: Number(row.skippedItems ?? 0),
        cls: 'm-dim',
      },
    ]
  }

  /** EXPORT/IMPORT 双向同步,颜色区分 */
  function typeTag(v: unknown): 'primary' | 'success' | 'info' {
    const s = String(v ?? '').toUpperCase()
    if (s.includes('EXPORT')) return 'info'
    if (s.includes('IMPORT')) return 'primary'
    return 'success'
  }

  /** SUCCESS/FAILED/PARTIAL/RUNNING 状态颜色 */
  function statusTag(v: unknown): 'success' | 'danger' | 'warning' | 'info' {
    const s = String(v ?? '').toUpperCase()
    if (s === 'SUCCESS' || s === 'OK' || s === 'COMPLETED') return 'success'
    if (s === 'FAILED' || s === 'ERROR') return 'danger'
    if (s === 'PARTIAL' || s === 'WARNING') return 'warning'
    return 'info'
  }

  async function loadSyncLogs() {
    await runLoadSyncLogs(async () => {
      const data = await listConfigSyncLogs(tenant.tenantId)
      syncLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      syncLogs.value = []
    })
  }

  useTenantReload(() => {
    syncLogs.value = []
    void loadSyncLogs()
  })
</script>

<style scoped>
  .mono-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .op-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    color: var(--color-text-primary);
  }

  .cell-empty {
    color: var(--color-text-tertiary);
  }

  .sync-metrics :deep(.m-ok) {
    color: var(--color-success);
  }

  .sync-metrics :deep(.m-bad) {
    color: var(--color-danger);
  }

  .sync-metrics :deep(.m-dim) {
    color: var(--color-text-tertiary);
  }
</style>
