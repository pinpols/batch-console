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
    <el-table
      :data="pagedLogs.records"
      stripe
      border
      empty-text="暂无数据"
      size="small"
      class="console-table"
    >
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="releaseId" label="Release ID" width="100" />
      <el-table-column prop="changeType" label="变更类型" width="120" />
      <el-table-column prop="configKey" label="配置键" min-width="200" show-overflow-tooltip />
      <el-table-column prop="operatorId" label="操作者" width="120" />
      <DatetimeColumn prop="createdAt" label="时间" width="160" />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
    </el-table>
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
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleConfigChangeLogResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loadingLogs = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingLogs)
  const logRows = ref<ConsoleConfigChangeLogResponse[]>([])
  const logPage = ref(1)
  const logPageSize = ref(20)
  const pagedLogs = computed(() => toPageResult(logRows.value, logPage.value, logPageSize.value))

  async function loadLogs() {
    loadingLogs.value = true
    try {
      logRows.value = await listConfigChangeLogs(tenant.tenantId)
    } catch {
      logRows.value = []
    } finally {
      loadingLogs.value = false
    }
  }

  useTenantReload(() => {
    logPage.value = 1
    void loadLogs()
  })
</script>
