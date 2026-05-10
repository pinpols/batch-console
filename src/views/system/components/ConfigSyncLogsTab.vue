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
        <el-table-column prop="id" :label="t('configSyncLogsTab.colId')" width="80" />
        <el-table-column prop="syncType" :label="t('configSyncLogsTab.colType')" width="100" />
        <el-table-column prop="status" :label="t('configSyncLogsTab.colStatus')" width="100" />
        <el-table-column
          prop="operatorId"
          :label="t('configSyncLogsTab.colOperator')"
          width="120"
        />
        <el-table-column
          prop="summary"
          :label="t('configSyncLogsTab.colSummary')"
          min-width="250"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="createdAt" :label="t('configSyncLogsTab.colTime')" width="160" />
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
