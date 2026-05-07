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
    <el-table
      :data="syncLogs"
      stripe
      border
      empty-text="暂无数据"
      size="small"
      class="console-table"
    >
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="syncType" label="类型" width="100" />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="operatorId" label="操作者" width="120" />
      <el-table-column prop="summary" label="摘要" min-width="250" show-overflow-tooltip />
      <DatetimeColumn prop="createdAt" label="时间" width="160" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { listConfigSyncLogs } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loadingSyncLogs = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingSyncLogs)
  const syncLogs = ref<Record<string, unknown>[]>([])

  async function loadSyncLogs() {
    loadingSyncLogs.value = true
    try {
      const data = await listConfigSyncLogs(tenant.tenantId)
      syncLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      syncLogs.value = []
    } finally {
      loadingSyncLogs.value = false
    }
  }

  useTenantReload(() => {
    syncLogs.value = []
    void loadSyncLogs()
  })
</script>
