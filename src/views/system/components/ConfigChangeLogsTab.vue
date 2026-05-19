<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingLogs"
      :disabled="loadingLogs"
      @refresh="() => runRefresh(loadLogs)"
      @search="() => runSearch(loadLogs)"
      @reset="() => runReset(loadLogs)"
    />
    <DataState
      :loading="loadingLogs"
      :error="loadLogsError"
      :has-data="pagedLogs.records.length > 0"
      :on-retry="loadLogs"
    >
      <el-table
        v-loading="loadingLogs"
        :data="pagedLogs.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" :label="t('configChangeLogsTab.colId')" width="80" />
        <el-table-column prop="configType" :label="t('configChangeLogsTab.colType')" width="100" />
        <el-table-column
          prop="configKey"
          :label="t('configChangeLogsTab.colConfigKey')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column prop="versionNo" :label="t('configChangeLogsTab.colVersion')" width="80" />
        <el-table-column
          prop="changeAction"
          :label="t('configChangeLogsTab.colAction')"
          width="110"
        />
        <el-table-column
          prop="changeResult"
          :label="t('configChangeLogsTab.colResult')"
          width="100"
        >
          <template #default="{ row }">
            <StatusTag :value="String(row.changeResult ?? '')" category="operationResult" />
          </template>
        </el-table-column>
        <el-table-column
          prop="operatorType"
          :label="t('configChangeLogsTab.colOperatorType')"
          width="110"
        />
        <el-table-column
          prop="operatorId"
          :label="t('configChangeLogsTab.colOperator')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="traceId"
          :label="t('configChangeLogsTab.colTrace')"
          width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText v-if="row.traceId" :text="String(row.traceId)" />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" :label="t('configChangeLogsTab.colTime')" width="160" />
        <el-table-column
          :label="t('configChangeLogsTab.colSummary')"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row.changeSummaryJson" class="mono">{{ row.changeSummaryJson }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="logPage"
      :page-size="logPageSize"
      :total="pagedLogs.total"
      @update:page="(p: number) => (logPage = p)"
      @update:page-size="
        (s: number) => {
          logPageSize = s
          logPage = 1
        }
      "
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listConfigChangeLogs } from '@/api/configReleases'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import DataState from '@/components/common/DataState.vue'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleConfigChangeLogResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const { loading: loadingLogs, error: loadLogsError, run: runLoadLogs } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingLogs)
  const logRows = ref<ConsoleConfigChangeLogResponse[]>([])
  const logPage = ref(1)
  const logPageSize = ref(15)
  const pagedLogs = computed(() => toPageResult(logRows.value, logPage.value, logPageSize.value))

  async function loadLogs() {
    await runLoadLogs(async () => {
      logRows.value = await listConfigChangeLogs(tenant.tenantId)
    }).catch(() => {
      logRows.value = []
    })
  }

  useTenantReload(() => {
    logPage.value = 1
    void loadLogs()
  })
</script>
