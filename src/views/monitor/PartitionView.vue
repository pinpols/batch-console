<template>
  <PageContainer>
    <PageHeader
      :title="t('monitor.partitionTitle')"
      :description="t('monitor.partitionDescription', { id: instanceId })"
      :back-to="`/monitor/job-instances/${instanceId}`"
    >
      <template #actions>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('monitor.partitionRefresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="applyFilter"
        @reset="resetFilter"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('monitor.partitionStatusLabel')">
          <MetaSelect
            class="query-w-200"
            v-model="filterDraft.partitionStatus"
            clearable
            filterable
            enum-key="partitionStatus"
            :placeholder="t('monitor.partitionStatusPlaceholder')"
            :options="partitionStatusOptions"
          />
        </el-form-item>
      </ListPageQueryBar>
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        border
        :empty-text="t('common.noData')"
        class="console-table"
      >
        <el-table-column
          prop="partitionNo"
          :label="t('monitor.partColNo')"
          width="80"
          align="right"
        />
        <el-table-column
          prop="partitionKey"
          :label="t('monitor.partColKey')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="businessKey"
          :label="t('monitor.partColBusinessKey')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="jobInstanceId"
          :label="t('monitor.partColInstanceId')"
          width="100"
          align="right"
        />
        <el-table-column prop="partitionStatus" :label="t('monitor.partColStatus')" width="140">
          <template #default="{ row }">
            <StatusTag :value="String(row.partitionStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column
          prop="workerGroup"
          :label="t('monitor.partColWorkerGroup')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="workerCode"
          :label="t('monitor.partColWorker')"
          width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.workerCode"
              class="cell-link"
              :to="`/workers/management?workerCode=${row.workerCode}`"
            >
              {{ row.workerCode }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" :label="t('monitor.partColRetry')" width="70" />
        <DatetimeColumn prop="leaseExpireAt" :label="t('monitor.partColLeaseExpire')" width="160" />
        <DatetimeColumn prop="startedAt" :label="t('monitor.partColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.partColFinished')" width="160" />
        <el-table-column :label="t('monitor.partColActions')" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="warning" @click="retryPartition(row)">
                {{ t('monitor.partActionRetry') }}
              </el-button>
              <el-button size="small" plain type="danger" @click="cancelPartition(row)">
                {{ t('monitor.partActionCancel') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <TablePagerBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @update:page="onPageChange"
        @update:page-size="
          (s: number) => {
            pageSize = s
            page = 1
            void load()
          }
        "
      />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()

  const { t } = useI18n({ useScope: 'global' })
  import { instanceApi } from '@/api/instance'
  import { queryPartitionsPaged, type ConsoleJobPartitionResponse } from '@/api/queries/partitions'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const rows = ref<ConsoleJobPartitionResponse[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  const instanceId = computed(() => Number(route.params.id))

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const partitionStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'partitionStatus'),
  )

  const filterDraft = reactive({ partitionStatus: '' })
  const filterApplied = reactive({ partitionStatus: '' })

  async function load() {
    if (!Number.isFinite(instanceId.value)) return
    loading.value = true
    try {
      const pr = await queryPartitionsPaged({
        tenantId: tenant.tenantId,
        jobInstanceId: instanceId.value,
        partitionStatus: filterApplied.partitionStatus,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } finally {
      loading.value = false
    }
  }

  function applyFilter() {
    return runSearch(async () => {
      filterApplied.partitionStatus = filterDraft.partitionStatus
      page.value = 1
      await load()
    })
  }

  function resetFilter() {
    return runReset(async () => {
      filterDraft.partitionStatus = ''
      filterApplied.partitionStatus = ''
      page.value = 1
      await load()
    })
  }

  function onPageChange(p: number) {
    page.value = p
    void load()
  }

  async function cancelPartition(row: ConsoleJobPartitionResponse) {
    try {
      await ElMessageBox.confirm(
        t('monitor.partCancelConfirmText', { id: row.id }),
        t('monitor.partCancelConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.cancelPartition(row.id, row.tenantId ?? tenant.tenantId)
      ElMessage.success(t('monitor.partCanceled'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function retryPartition(row: ConsoleJobPartitionResponse) {
    try {
      await ElMessageBox.confirm(
        t('monitor.partRetryConfirmText', { id: row.id }),
        t('monitor.partRetryConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.retryPartition(row.id, row.tenantId ?? tenant.tenantId)
      ElMessage.success(t('monitor.partRetrySuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)

  watch(instanceId, () => {
    void load()
  })
</script>
