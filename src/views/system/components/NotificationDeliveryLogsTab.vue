<template>
  <ProTable
    :data="pagedDeliveryLogs"
    :loading="loadingLogs"
    :error="loadLogsError"
    :on-retry="loadDeliveryLogs"
    :total="filteredDeliveryLogs.length"
    v-model:page="logPage"
    v-model:page-size="logPageSize"
    @change="() => {}"
  >
    <template #query>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loadingLogs"
        @search="applyLogFilter"
        @reset="resetLogFilter"
        @refresh="() => runRefresh(loadDeliveryLogs)"
      >
        <el-form-item :label="t('notificationDeliveryLogsTab.kwLabel')">
          <el-input
            class="query-w-260"
            v-model="logFilterDraft.keyword"
            clearable
            :placeholder="t('notificationDeliveryLogsTab.kwPlaceholder')"
            @keyup.enter="applyLogFilter"
          />
        </el-form-item>
        <el-form-item :label="t('notificationDeliveryLogsTab.statusLabel')">
          <MetaSelect
            class="query-w-180"
            v-model="logFilterDraft.status"
            clearable
            :placeholder="t('notificationDeliveryLogsTab.statusPlaceholder')"
            :options="deliveryStatusOptions"
          />
        </el-form-item>
      </ListPageQueryBar>
    </template>
    <el-table-column prop="id" :label="t('notificationDeliveryLogsTab.colId')" width="80">
      <template #default="{ row }">{{ row.id ?? '—' }}</template>
    </el-table-column>
    <el-table-column
      prop="channelId"
      :label="t('notificationDeliveryLogsTab.colChannelId')"
      width="100"
    >
      <template #default="{ row }">{{ row.channelId ?? '—' }}</template>
    </el-table-column>
    <el-table-column
      prop="eventType"
      :label="t('notificationDeliveryLogsTab.colEventType')"
      width="160"
    >
      <template #default="{ row }">{{ row.eventType || '—' }}</template>
    </el-table-column>
    <el-table-column
      prop="deliveryStatus"
      :label="t('notificationDeliveryLogsTab.colStatus')"
      width="100"
    >
      <template #default="{ row }">
        <StatusTag
          v-if="row.deliveryStatus"
          :value="String(row.deliveryStatus)"
          category="deliveryStatus"
        />
        <span v-else class="cell-empty">—</span>
      </template>
    </el-table-column>
    <el-table-column prop="httpStatus" :label="t('notificationDeliveryLogsTab.colHttp')" width="80">
      <template #default="{ row }">{{ row.httpStatus ?? '—' }}</template>
    </el-table-column>
    <el-table-column
      prop="responseBody"
      :label="t('notificationDeliveryLogsTab.colResponse')"
      min-width="200"
      show-overflow-tooltip
    >
      <template #default="{ row }">{{ row.responseBody || '—' }}</template>
    </el-table-column>
    <DatetimeColumn
      prop="createdAt"
      :label="t('notificationDeliveryLogsTab.colTime')"
      width="160"
    />
  </ProTable>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listNotificationDeliveryLogs } from '@/api/notifications'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const deliveryStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'deliveryStatus'))

  const { loading: loadingLogs, error: loadLogsError, run: runLoadLogs } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingLogs)
  const deliveryLogs = ref<Record<string, unknown>[]>([])
  const logPage = ref(1)
  const logPageSize = ref(20)
  const logFilterDraft = reactive({ keyword: '', status: '' })
  const logFilterApplied = reactive({ keyword: '', status: '' })

  async function loadDeliveryLogs() {
    await runLoadLogs(async () => {
      const data = await listNotificationDeliveryLogs(tenant.tenantId)
      deliveryLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      deliveryLogs.value = []
    })
  }

  function normalize(s: unknown) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
  }

  const filteredDeliveryLogs = computed(() => {
    const k = normalize(logFilterApplied.keyword)
    const s = normalize(logFilterApplied.status)
    return deliveryLogs.value.filter((row) => {
      const okStatus = !s ? true : normalize(row.deliveryStatus) === s
      if (!okStatus) return false
      if (!k) return true
      const hay = `${row.eventType ?? ''} ${row.channelId ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const pagedDeliveryLogs = computed(
    () => toPageResult(filteredDeliveryLogs.value, logPage.value, logPageSize.value).records,
  )

  function applyLogFilter() {
    return runSearch(() => {
      logFilterApplied.keyword = logFilterDraft.keyword.trim()
      logFilterApplied.status = logFilterDraft.status.trim()
      logPage.value = 1
    })
  }

  function resetLogFilter() {
    return runReset(() => {
      logFilterDraft.keyword = ''
      logFilterDraft.status = ''
      logFilterApplied.keyword = ''
      logFilterApplied.status = ''
      logPage.value = 1
    })
  }
</script>
