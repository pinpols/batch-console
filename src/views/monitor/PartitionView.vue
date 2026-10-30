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
      <el-alert
        v-if="loadError"
        :title="userErrorMessage(loadError)"
        type="error"
        :closable="false"
      />
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
        <el-table-column :label="t('monitor.partColError')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
            <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
            <span v-if="!row.errorCode && !row.errorMessage" class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="leaseExpireAt" :label="t('monitor.partColLeaseExpire')" width="160" />
        <DatetimeColumn prop="startedAt" :label="t('monitor.partColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.partColFinished')" width="160" />
        <el-table-column :label="t('monitor.partColActions')" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <RowActions
                :actions="partitionRowActions(row as ConsoleJobPartitionResponse)"
                :inline-limit="1"
              />
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
            void loadForNavigation()
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
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'
  import { userErrorMessage } from '@/utils/userErrorMessage'

  const refresh = useRefreshAction()

  const { t } = useI18n({ useScope: 'global' })
  import { instanceApi } from '@/api/instance'
  import { queryPartitionsPaged, type ConsoleJobPartitionResponse } from '@/api/queries/partitions'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { usePermission } from '@/composables/usePermission'
  import { useAuthStore } from '@/stores/auth'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const route = useRoute()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { canWriteSystem } = usePermission()
  const listScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const rows = ref<ConsoleJobPartitionResponse[]>([])
  const page = ref(1)
  const pageSize = ref(15)
  const total = ref(0)

  const instanceId = computed(() => Number(route.params.id))

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const partitionStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'partitionStatus'),
  )

  const filterDraft = reactive({ partitionStatus: '' })
  const filterApplied = reactive({ partitionStatus: '' })

  async function load() {
    const scope = listScope.begin()
    const requestedInstance = instanceId.value
    if (!scope.tenantId || !Number.isSafeInteger(requestedInstance) || requestedInstance <= 0)
      return
    loading.value = true
    loadError.value = null
    try {
      const pr = await queryPartitionsPaged({
        tenantId: scope.tenantId,
        jobInstanceId: requestedInstance,
        partitionStatus: filterApplied.partitionStatus,
        page: page.value,
        pageSize: pageSize.value,
      })
      if (!listScope.isCurrent(scope) || requestedInstance !== instanceId.value) return
      rows.value = pr.records
      total.value = pr.total
    } catch (error) {
      if (!listScope.isCurrent(scope) || requestedInstance !== instanceId.value) return
      loadError.value = error
      throw error
    } finally {
      if (listScope.isCurrent(scope) && requestedInstance === instanceId.value)
        loading.value = false
    }
  }

  async function loadForNavigation() {
    try {
      await load()
    } catch {
      // 被动加载失败已由页面错误态呈现，主动查询仍传播失败以避免成功提示。
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
    void loadForNavigation()
  }

  /** 不能把离开实例前的确认应用到新页面或新租户。 */
  function capturePartitionAction(row: ConsoleJobPartitionResponse) {
    const scope = actionScope.begin()
    const requestedInstance = instanceId.value
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrent = () =>
      actionScope.isCurrent(scope) &&
      requestedInstance === instanceId.value &&
      operator === (auth.userInfo?.username ?? auth.userInfo?.userId) &&
      canWriteSystem.value &&
      (!row.tenantId || row.tenantId === scope.tenantId) &&
      rows.value.some((current) => current.id === row.id)
    return { tenantId: scope.tenantId, isCurrent }
  }

  watch(
    [instanceId, () => tenant.tenantId],
    () => {
      listScope.begin()
      actionScope.begin()
      rows.value = []
      total.value = 0
      page.value = 1
      loading.value = false
      loadError.value = null
    },
    { flush: 'sync' },
  )

  async function cancelPartition(row: ConsoleJobPartitionResponse) {
    const context = capturePartitionAction(row)
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('monitor.partActionCancel'),
        target: `${t('monitor.partitionTitle')} #${row.id}`,
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
      if (!context.isCurrent()) return
      await instanceApi.cancelPartition(row.id, context.tenantId)
      if (!context.isCurrent()) return
      ElMessage.success(t('monitor.partCanceled'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function retryPartition(row: ConsoleJobPartitionResponse) {
    const context = capturePartitionAction(row)
    if (!context.isCurrent()) return
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
      if (!context.isCurrent()) return
      await instanceApi.retryPartition(row.id, context.tenantId)
      if (!context.isCurrent()) return
      ElMessage.success(t('monitor.partRetrySuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  function partitionRowActions(row: ConsoleJobPartitionResponse): RowAction[] {
    return [
      {
        key: 'retry',
        label: t('monitor.partActionRetry'),
        disabled: !canWriteSystem.value,
        primary: true,
        onClick: () => retryPartition(row),
      },
      {
        key: 'cancel',
        label: t('monitor.partActionCancel'),
        disabled: !canWriteSystem.value,
        danger: true,
        divided: true,
        onClick: () => cancelPartition(row),
      },
    ]
  }

  useTenantReload(load)

  watch(instanceId, () => {
    void loadForNavigation()
  })
</script>
