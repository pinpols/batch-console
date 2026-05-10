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
        empty-text="暂无数据"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="configType" label="类型" width="100" />
        <el-table-column prop="configKey" label="配置键" min-width="200" show-overflow-tooltip />
        <el-table-column prop="versionNo" label="版本" width="80" />
        <el-table-column prop="changeAction" label="操作" width="110" />
        <el-table-column prop="changeResult" label="结果" width="100">
          <template #default="{ row }">
            <StatusTag :value="String(row.changeResult ?? '')" category="operationResult" />
          </template>
        </el-table-column>
        <el-table-column prop="operatorType" label="操作者类型" width="110" />
        <el-table-column prop="operatorId" label="操作者" width="140" show-overflow-tooltip />
        <el-table-column prop="traceId" label="Trace" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <CopyableText v-if="row.traceId" :text="String(row.traceId)" />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
        <el-table-column label="变更摘要" min-width="180" show-overflow-tooltip>
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
  import { listConfigChangeLogs } from '@/api/configReleases'
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
  const logPageSize = ref(20)
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
