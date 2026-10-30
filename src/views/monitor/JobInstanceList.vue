<template>
  <PageContainer>
    <PageHeader />

    <OpsFilterToolbar
      :filter-busy="filterBusy"
      :refresh-busy="loading"
      :disabled="loading"
      @search="searchInstances"
      @reset="resetQuery"
      @refresh="() => runRefresh(loadData)"
    >
      <template #status>
        <StatusSegment
          v-model="statusSegmentValue"
          :items="statusSegmentItems"
          :aria-label="t('jobInstanceList.colStatus')"
        />
      </template>

      <DateRangePresetPicker
        class="jr-date"
        v-model="dateRange"
        type="daterange"
        default-preset="7d"
        @update:model-value="onDateChange"
      />
      <el-select
        class="jr-jobcode"
        v-model="query.jobCode"
        clearable
        filterable
        allow-create
        default-first-option
        :placeholder="t('jobInstanceList.jobCodePlaceholder')"
        @change="searchInstances"
      >
        <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
      </el-select>
      <TraceIdInput
        class="jr-trace"
        v-model="query.traceId"
        :placeholder="t('jobInstanceList.traceIdPlaceholder')"
        @keyup.enter="searchInstances"
      />
      <label class="jr-sla">
        <span>{{ t('jobInstanceList.slaBreachedLabel') }}</span>
        <el-switch size="small" v-model="query.slaBreached" @change="onSlaBreachedChange" />
      </label>

      <template #actions>
        <SavedFiltersMenu
          class="jr-presets__menu"
          :sets="savedFilters.sets.value"
          :on-save="savedFilters.save"
          :on-apply="savedFilters.applySet"
          :on-remove="savedFilters.remove"
          :on-rename="savedFilters.rename"
          :on-export="savedFilters.exportSets"
          :on-import="savedFilters.importSets"
        />
      </template>

      <template #monitor>
        <LiveMonitorBar
          :live="live.status.value === 'live'"
          :title="t('jobInstanceList.liveTitle')"
          :subtitle="t('jobInstanceList.liveEvery')"
          :last-label="t('jobInstanceList.liveLast')"
          :last-value="lastRefreshText"
        >
          <span v-if="statusCounts.RUNNING" class="jr-live__running">
            <span class="jr-live__minidot" />
            {{ t('jobInstanceList.liveRunning', { n: statusCounts.RUNNING }) }}
          </span>
          <template #actions>
            <el-button link @click="livePaused = !livePaused">
              {{ livePaused ? t('jobInstanceList.liveResume') : t('jobInstanceList.livePause') }}
            </el-button>
          </template>
        </LiveMonitorBar>
      </template>
    </OpsFilterToolbar>

    <!-- 多状态深链回显(OpsSummary 失败任务卡 FAILED,PARTIAL_FAILED) -->
    <div v-if="query.instanceStatuses" class="jr-multistatus">
      <el-tag type="danger" closable disable-transitions @close="clearMultiStatus">
        {{ multiStatusLabel }}
      </el-tag>
    </div>

    <div>
      <ProTable
        ref="proTableRef"
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="loadData"
        :total="total"
        column-config-id="job-instances"
        :column-defs="columnDefs"
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        @change="loadData"
        @selection-change="bulk.onSelectionChange"
      >
        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('jobInstanceList.emptyTitle')"
            :description="t('jobInstanceList.emptyDescription')"
            :image-size="80"
          >
            <template #action>
              <el-button type="primary" :icon="List" @click="$router.push('/jobs/definitions')">
                {{ t('jobInstanceList.emptyGoDefinitions') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <template #toolbar>
          <BulkActionBar
            v-if="canManageSystem"
            :count="bulk.count.value"
            :running="bulk.running.value"
            @clear="bulk.clear"
          >
            <template #default="{ running }">
              <el-button
                size="small"
                type="warning"
                plain
                :loading="running"
                :disabled="!canWriteSystem"
                @click="onBulkRetry"
              >
                {{ t('jobInstanceList.bulkRetry') }}
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                :loading="running"
                :disabled="!canWriteSystem"
                @click="onBulkCancel"
              >
                {{ t('jobInstanceList.bulkCancel') }}
              </el-button>
            </template>
          </BulkActionBar>
        </template>

        <template #default="{ isColVisible }">
          <el-table-column
            v-if="canManageSystem"
            type="selection"
            width="44"
            :selectable="isBulkSelectable"
          />
          <!-- 列序照设计 #instances:JOB CODE 首列,状态第三,TRACE 短码,操作=文字链 -->
          <el-table-column
            v-if="isColVisible('jobCode')"
            prop="jobCode"
            :label="t('jobInstanceList.colJobCode')"
            min-width="160"
          >
            <template #default="{ row }">
              <router-link class="cell-link" :to="`/jobs/definitions?jobCode=${row.jobCode}`">
                {{ row.jobCode }}
              </router-link>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('bizDate')"
            prop="bizDate"
            :label="t('jobInstanceList.colBizDate')"
            width="110"
          />
          <el-table-column :label="t('jobInstanceList.colStatus')" width="120">
            <template #default="{ row }">
              <StatusTag :value="row.instanceStatus" category="instance" />
              <el-tag
                v-if="row.dryRun"
                size="small"
                type="info"
                effect="plain"
                class="dry-run-badge"
              >
                {{ t('jobInstanceList.dryRunBadge') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('triggerType')"
            prop="triggerType"
            :label="t('jobInstanceList.colTrigger')"
            width="100"
          >
            <template #default="{ row }">
              {{ resolveTriggerType(row.triggerType) }}
            </template>
          </el-table-column>
          <DatetimeColumn
            v-if="isColVisible('startedAt')"
            prop="startedAt"
            :label="t('jobInstanceList.colStartedAt')"
            width="170"
          />
          <el-table-column
            v-if="isColVisible('duration')"
            :label="t('jobInstanceList.colDuration')"
            width="100"
          >
            <template #default="{ row }">
              <span class="jr-mono">{{
                formatJobInstanceDuration(row.startedAt, row.finishedAt)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('traceId')"
            prop="traceId"
            :label="t('jobInstanceList.colTrace')"
            width="90"
          >
            <template #default="{ row }">
              <router-link
                v-if="row.traceId"
                class="jr-trace-link"
                :to="`/observability/trace?traceId=${row.traceId}`"
                :title="row.traceId"
              >
                {{ row.traceId.slice(0, 6) }}
              </router-link>
              <span v-else class="muted">&#8212;</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('rerunRetry')"
            :label="t('jobInstanceList.colRerunRetry')"
            width="100"
          >
            <template #default="{ row }">
              <el-tag v-if="row.rerunFlag" size="small" type="warning" effect="plain">
                {{ t('jobInstanceList.tagRerun') }}
              </el-tag>
              <el-tag v-if="row.retryFlag" size="small" type="info" effect="plain">
                {{ t('jobInstanceList.tagRetry') }}
              </el-tag>
              <span v-if="!row.rerunFlag && !row.retryFlag" class="muted">&#8212;</span>
            </template>
          </el-table-column>
          <DatetimeColumn
            v-if="isColVisible('finishedAt')"
            prop="finishedAt"
            :label="t('jobInstanceList.colFinishedAt')"
            width="160"
          />
          <DatetimeColumn
            v-if="isColVisible('slaAlertedAt')"
            prop="slaAlertedAt"
            :label="t('jobInstanceList.colSlaAlerted')"
            width="160"
          />
          <el-table-column
            v-if="isColVisible('instanceNo')"
            prop="instanceNo"
            :label="t('jobInstanceList.colInstanceNo')"
            width="180"
          >
            <template #default="{ row }">
              <router-link class="cell-link" :to="`/monitor/job-instances/${row.id}`">
                {{ row.instanceNo }}
              </router-link>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('queueGroup')"
            :label="t('jobInstanceList.colQueueGroup')"
            width="160"
          >
            <template #default="{ row }">
              <div class="cell-stack">
                <span v-if="row.queueCode" class="cell-main">{{ row.queueCode }}</span>
                <span v-if="row.workerGroup" class="cell-sub">{{ row.workerGroup }}</span>
                <span v-if="!row.queueCode && !row.workerGroup" class="muted">&#8212;</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('jobInstanceList.colActions')" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                size="small"
                link
                type="primary"
                :icon="Eye"
                @click.stop="router.push(`/monitor/job-instances/${row.id}`)"
              >
                {{ t('jobInstanceList.actionDetail') }}
              </el-button>
              <el-button
                size="small"
                link
                type="primary"
                :icon="List"
                @click.stop="router.push(`/monitor/job-steps?instanceId=${row.id}`)"
              >
                {{ t('jobInstanceList.actionSteps') }}
              </el-button>
            </template>
          </el-table-column>
        </template>
      </ProTable>
    </div>

    <el-dialog
      v-model="bulkResultVisible"
      :title="t('jobInstanceList.bulkResultTitle')"
      width="760px"
    >
      <el-alert
        :title="
          t('jobInstanceList.bulkResultSummary', {
            ok: bulkResultOk,
            fail: bulkResultFailureCount,
          })
        "
        :type="bulkResultFailureCount > 0 ? 'warning' : 'success'"
        :closable="false"
        show-icon
      />
      <el-table :data="bulkResultRows" size="small" class="bulk-result-table">
        <el-table-column
          prop="instanceNo"
          :label="t('jobInstanceList.colInstanceNo')"
          min-width="150"
        />
        <el-table-column prop="jobCode" :label="t('jobInstanceList.colJobCode')" min-width="150" />
        <el-table-column prop="bizDate" :label="t('jobInstanceList.colBizDate')" width="120" />
        <el-table-column :label="t('jobInstanceList.bulkResultStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.succeeded ? 'success' : 'danger'">
              {{
                row.succeeded
                  ? t('jobInstanceList.bulkResultSucceeded')
                  : t('jobInstanceList.bulkResultFailed')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="message"
          :label="t('jobInstanceList.bulkResultReason')"
          min-width="220"
          show-overflow-tooltip
        />
      </el-table>
      <template #footer>
        <el-button @click="bulkResultVisible = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { usePermission } from '@/composables/usePermission'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t, te } = useI18n({ useScope: 'global' })
  const { ensureWriteAvailable } = useWriteAvailability()
  const { canManageSystem, canWriteSystem } = usePermission()

  function resolveTriggerType(value?: string | null): string {
    if (!value) return '—'
    const key = `enum.triggerType.${value}`
    return te(key) ? t(key) : value
  }

  // 列设置:状态/操作列不在表里(始终显示);工程字段(实例号/队列/Trace/SLA 时间)默认隐藏
  // 列口径照设计 #instances:JOB CODE 首/业务日期/状态/触发/开始时间/耗时/TRACE/操作;
  // 重跑重试/完成时间/SLA/实例号/队列 收进列设置(默认隐藏,功能不丢)。
  const columnDefs = computed(() => [
    { key: 'jobCode', label: t('jobInstanceList.colJobCode') },
    { key: 'bizDate', label: t('jobInstanceList.colBizDate') },
    { key: 'triggerType', label: t('jobInstanceList.colTrigger') },
    { key: 'startedAt', label: t('jobInstanceList.colStartedAt') },
    { key: 'duration', label: t('jobInstanceList.colDuration') },
    { key: 'traceId', label: t('jobInstanceList.colTrace') },
    { key: 'rerunRetry', label: t('jobInstanceList.colRerunRetry'), defaultHidden: true },
    { key: 'finishedAt', label: t('jobInstanceList.colFinishedAt'), defaultHidden: true },
    { key: 'slaAlertedAt', label: t('jobInstanceList.colSlaAlerted'), defaultHidden: true },
    { key: 'instanceNo', label: t('jobInstanceList.colInstanceNo'), defaultHidden: true },
    { key: 'queueGroup', label: t('jobInstanceList.colQueueGroup'), defaultHidden: true },
  ])
  import { instanceApi } from '@/api/instance'
  import { jobApi } from '@/api/job'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { Eye, List } from '@lucide/vue'
  import SavedFiltersMenu from '@/components/table/SavedFiltersMenu.vue'
  import { useSavedFilters } from '@/composables/useSavedFilters'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { useAuthStore } from '@/stores/auth'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import OpsFilterToolbar from '@/components/table/OpsFilterToolbar.vue'
  import StatusSegment, { type StatusSegmentItem } from '@/components/table/StatusSegment.vue'
  import LiveMonitorBar from '@/components/table/LiveMonitorBar.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { fmtClockTime, recentBusinessDateRange } from '@/utils/datetime'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import { useBulkSelection } from '@/composables/useBulkSelection'
  import { canSelectJobInstanceForBulk, TERMINAL_INSTANCE_STATUSES } from './jobInstanceBulk'

  const router = useRouter()
  const route = useRoute()
  const tenant = useTenantStore()
  const listScope = useTenantRequestScope()
  const countScope = useTenantRequestScope()
  const codeScope = useTenantRequestScope()
  const bulkScope = useTenantRequestScope()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const jobCodeOptions = ref<string[]>([])

  // ── 批量操作:多选 + 批量重试(FAILED)/ 批量取消(非终态)──────────────
  const proTableRef = ref<{ clearSelection?: () => void } | null>(null)
  const bulk = useBulkSelection<ConsoleJobInstanceResponse>()
  const bulkResultVisible = ref(false)
  const bulkResultOk = ref(0)
  const bulkResultRows = ref<
    Array<{
      instanceNo: string
      jobCode: string
      bizDate: string
      succeeded: boolean
      message: string
    }>
  >([])
  const bulkResultFailureCount = computed(() => {
    const failedRows = bulkResultRows.value.filter((row) => !row.succeeded)
    return failedRows.length
  })
  onMounted(() => bulk.bindTable(proTableRef.value))
  const isBulkSelectable = canSelectJobInstanceForBulk

  async function runInstanceBulk(
    items: ConsoleJobInstanceResponse[],
    action: (item: ConsoleJobInstanceResponse) => Promise<unknown>,
    actionLabel: string,
    isCurrent: () => boolean,
  ) {
    const result = await bulk.runBulk(items, action, { actionLabel, clearOnDone: false, isCurrent })
    if (!isCurrent()) return result
    const failedEntries: Array<[ConsoleJobInstanceResponse, unknown]> = result.failed.map(
      ({ item, error }) => [item, error],
    )
    const failedItems = new Map(failedEntries)
    bulkResultOk.value = result.ok
    bulkResultRows.value = items.map((item) => {
      const error = failedItems.get(item)
      return {
        instanceNo: item.instanceNo,
        jobCode: item.jobCode,
        bizDate: item.bizDate,
        succeeded: error === undefined,
        message: error === undefined ? t('jobInstanceList.bulkResultNoError') : errorMessage(error),
      }
    })
    bulkResultVisible.value = items.length > 0
    if (result.fail === 0) bulk.clear()
    return result
  }

  function errorMessage(error: unknown): string {
    const message = userErrorMessage(error)
    return message.slice(0, 400)
  }

  async function onBulkRetry() {
    if (!canWriteSystem.value || !ensureWriteAvailable()) return
    if (bulk.running.value) return
    const scope = bulkScope.begin()
    const sourceTenantId = scope.tenantId
    const operator = auth.userInfo?.username
    const isCurrent = () =>
      bulkScope.isCurrent(scope) && canWriteSystem.value && auth.userInfo?.username === operator
    if (!isCurrent()) return
    const eligible = bulk.selected.value.filter((r) => r.instanceStatus === 'FAILED')
    if (!eligible.length) {
      ElMessage.warning(t('jobInstanceList.bulkRetryNone'))
      return
    }
    const label = t('jobInstanceList.bulkRetry')
    const confirmed = await ElMessageBox.confirm(
      t('bulk.confirmBody', { label, n: eligible.length }),
      label,
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
    ).catch(() => false)
    if (confirmed === false) return
    if (!isCurrent()) return
    await runInstanceBulk(
      eligible,
      (r) => {
        if (!isCurrent()) return Promise.reject(new Error(t('common.cancel')))
        return instanceApi.retry(r.instanceNo, sourceTenantId, r.jobCode, r.bizDate)
      },
      label,
      isCurrent,
    )
    if (isCurrent()) void loadData()
  }

  async function onBulkCancel() {
    if (!canWriteSystem.value || !ensureWriteAvailable()) return
    if (bulk.running.value) return
    const scope = bulkScope.begin()
    const sourceTenantId = scope.tenantId
    const operator = auth.userInfo?.username
    const isCurrent = () =>
      bulkScope.isCurrent(scope) && canWriteSystem.value && auth.userInfo?.username === operator
    if (!isCurrent()) return
    const eligible = bulk.selected.value.filter(
      (r) => !TERMINAL_INSTANCE_STATUSES.includes(r.instanceStatus),
    )
    if (!eligible.length) {
      ElMessage.warning(t('jobInstanceList.bulkCancelNone'))
      return
    }
    const label = t('jobInstanceList.bulkCancel')
    try {
      await confirmDanger({
        verb: label,
        target: t('bulk.selectedCount', { n: eligible.length }),
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return
    }
    if (!isCurrent()) return
    await runInstanceBulk(
      eligible,
      (r) => {
        if (!isCurrent()) return Promise.reject(new Error(t('common.cancel')))
        return instanceApi.cancel(r.id, sourceTenantId)
      },
      label,
      isCurrent,
    )
    if (isCurrent()) void loadData()
  }

  // 按作业开始时间默认查看近7天；业务日期在行中独立展示，URL可覆盖日期范围。
  function recentRange(days = 7): [string, string] {
    return recentBusinessDateRange(days)
  }
  const initialRange = recentRange()
  const dateRange = ref<[string, string] | null>(initialRange)

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: '',
    /** CSV 多状态(优先于 instanceStatus 单值);OpsSummary 失败任务卡片用 */
    instanceStatuses: '',
    startDate: initialRange[0],
    endDate: initialRange[1],
    traceId: '',
    /** SLA 违约过滤(服务端 deadline_at<now AND active);OpsSummary「SLA 违规」卡片用 */
    slaBreached: false,
    page: 1,
    pageSize: 15,
  })

  const auth = useAuthStore()
  const savedFilters = useSavedFilters({
    pageKey: 'job-instances',
    userId: () => auth.userInfo?.userId,
    getCurrent: () => ({
      jobCode: query.jobCode,
      instanceStatus: query.instanceStatus,
      instanceStatuses: query.instanceStatuses,
      startDate: query.startDate,
      endDate: query.endDate,
      traceId: query.traceId,
      slaBreached: query.slaBreached,
    }),
    apply: (f) => {
      query.jobCode = String(f.jobCode ?? '')
      query.instanceStatus = String(f.instanceStatus ?? '')
      query.instanceStatuses = String(f.instanceStatuses ?? '')
      query.startDate = String(f.startDate ?? '')
      query.endDate = String(f.endDate ?? '')
      query.traceId = String(f.traceId ?? '')
      query.slaBreached = !!f.slaBreached
      query.page = 1
      void loadData()
    },
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const statusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'instanceStatus'))

  // ── 设计 #instances 母版:状态 tab + 真实计数 ────────────────────────────
  // 计数 = 同筛选(除状态外)下各状态 total(pageSize=1 轻查询);仅筛选签名变化时刷,
  // 不随 10s 实时轮询放大 QPS。
  const TAB_DEFS = [
    { key: '', tone: 'neutral', labelKey: 'jobInstanceList.tabAll' },
    { key: 'RUNNING', tone: 'info', labelKey: 'jobInstanceList.tabRunning' },
    { key: 'SUCCESS', tone: 'success', labelKey: 'jobInstanceList.tabSuccess' },
    { key: 'FAILED', tone: 'danger', labelKey: 'jobInstanceList.tabFailed' },
    {
      key: 'CANCELLED',
      tone: 'muted',
      labelKey: 'jobInstanceList.tabCancelled',
    },
  ] as const

  const statusCounts = reactive<Record<string, number | null>>({
    '': null,
    RUNNING: null,
    SUCCESS: null,
    FAILED: null,
    CANCELLED: null,
  })

  let lastCountSig = ''
  async function loadStatusCounts() {
    const sig = JSON.stringify([
      tenant.tenantId,
      query.jobCode,
      query.startDate,
      query.endDate,
      query.traceId,
      query.slaBreached,
    ])
    if (sig === lastCountSig) return
    lastCountSig = sig
    const scope = countScope.begin()
    const filters = { ...query, tenantId: scope.tenantId }
    let failed = false
    await Promise.all(
      TAB_DEFS.map(async (tab) => {
        try {
          const pr = await instanceApi.list({
            tenantId: filters.tenantId,
            jobCode: filters.jobCode,
            instanceStatus: tab.key,
            startDate: filters.startDate,
            endDate: filters.endDate,
            traceId: filters.traceId,
            slaBreached: filters.slaBreached,
            page: 1,
            pageSize: 1,
          })
          if (countScope.isCurrent(scope)) statusCounts[tab.key] = pr.total ?? 0
        } catch {
          if (countScope.isCurrent(scope)) {
            statusCounts[tab.key] = null
            failed = true
          }
        }
      }),
    )
    if (failed && countScope.isCurrent(scope)) lastCountSig = ''
  }

  const statusTabs = computed(() =>
    TAB_DEFS.map((tab) => ({
      key: tab.key,
      tone: tab.tone,
      label: t(tab.labelKey),
      count: statusCounts[tab.key],
      active: tab.key
        ? query.instanceStatus === tab.key ||
          (tab.key === 'FAILED' && query.instanceStatuses.includes('FAILED'))
        : !query.instanceStatus && !query.instanceStatuses,
    })),
  )

  const statusSegmentValue = computed({
    get: () => (query.instanceStatuses.includes('FAILED') ? 'FAILED' : query.instanceStatus || ''),
    set: (value: string) => pickStatusTab(value),
  })

  const statusSegmentItems = computed<StatusSegmentItem[]>(() =>
    statusTabs.value.map((tab) => ({
      value: tab.key,
      label: tab.label,
      count: tab.count,
      tone: tab.tone,
    })),
  )

  function pickStatusTab(key: string) {
    query.instanceStatuses = ''
    query.instanceStatus = query.instanceStatus === key ? '' : key
    if (!key) query.instanceStatus = ''
    query.page = 1
    syncFiltersToUrl()
    void loadData()
  }

  const lastRefreshText = computed(() => {
    const v = live.lastRefreshedAt.value
    return fmtClockTime(v)
  })

  async function loadJobCodes() {
    const scope = codeScope.begin()
    // 仅用于下拉"常用 jobCode"提示，取前 500 条即可；超过 500 的租户让用户手输或搜索
    // （旧实现走 fetchAllPageItems，大租户会拉回万级数据，浪费带宽）
    try {
      const paged = await jobApi.listDefinitionsPaged({
        tenantId: scope.tenantId,
        pageNo: 1,
        pageSize: 500,
      })
      if (!codeScope.isCurrent(scope)) return
      const jobCodes = paged.records.map((definition) => definition.jobCode)
      const nonEmptyJobCodes = jobCodes.filter(Boolean)
      const uniqueJobCodes = new Set(nonEmptyJobCodes)
      jobCodeOptions.value = [...uniqueJobCodes].sort((left, right) => left.localeCompare(right))
    } catch {
      if (codeScope.isCurrent(scope)) jobCodeOptions.value = []
    }
  }

  function onDateChange(val: [string, string] | null) {
    query.startDate = val?.[0] ?? ''
    query.endDate = val?.[1] ?? ''
    query.page = 1
    syncFiltersToUrl()
    void loadData()
  }

  function resetQuery() {
    return runReset(async () => {
      const t = recentRange()
      query.tenantId = tenant.tenantId
      query.jobCode = ''
      query.instanceStatus = ''
      query.instanceStatuses = ''
      query.startDate = t[0]
      query.endDate = t[1]
      query.traceId = ''
      query.slaBreached = false
      dateRange.value = t
      query.page = 1
      syncFiltersToUrl()
      await loadData()
    })
  }

  function searchInstances() {
    return runSearch(async () => {
      // traceId 是全局唯一键,搜它时清掉默认的今日日期锚定——否则别的业务日的 trace 会被
      // 日期范围挡掉(从详情页拷 traceId 来搜却"搜不到")。
      if (query.traceId) {
        query.startDate = ''
        query.endDate = ''
        dateRange.value = null
      }
      query.page = 1
      syncFiltersToUrl()
      await loadData()
    })
  }

  const loadError = ref<unknown>(null)
  async function loadData() {
    const scope = listScope.begin()
    if (!scope.tenantId) return
    const filters = { ...query, tenantId: scope.tenantId }
    loading.value = true
    loadError.value = null
    try {
      const result = await instanceApi.list(filters)
      if (!listScope.isCurrent(scope)) return
      rows.value = result.records
      total.value = result.total
      void loadStatusCounts()
      live.markRefreshed()
    } catch (err) {
      if (listScope.isCurrent(scope)) loadError.value = err
      throw err
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
    }
  }

  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (query.jobCode) params.jobCode = query.jobCode
    if (query.instanceStatus) params.status = query.instanceStatus
    // deeplink 的多状态过滤也写回 URL(刷新/分享不丢失),与单值 status 互斥
    if (query.instanceStatuses) {
      params.statuses = query.instanceStatuses
      params.range = 'all'
    }
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    if (query.traceId) params.traceId = query.traceId
    if (query.slaBreached) params.slaBreached = '1'
    void router.replace({ query: params })
  }

  function onSlaBreachedChange() {
    query.page = 1
    syncFiltersToUrl()
    void loadData()
  }

  function onStatusChange() {
    // 用户手动选单值状态时,清掉 deeplink(失败任务卡片)带来的 instanceStatuses CSV——
    // CSV 优先级高于单值,不清会出现"选成功却仍列失败"(搜索条件不生效)。
    query.instanceStatuses = ''
    query.page = 1
    syncFiltersToUrl()
    void loadData()
  }

  // 多状态深链回显:把 CSV 各码映射到枚举 label(映射不到则原样显示码)
  const multiStatusLabel = computed(() => {
    const statusCodes = query.instanceStatuses.split(',')
    const statusLabels = statusCodes.map(
      (code) => statusOptions.value.find((option) => option.value === code)?.label ?? code,
    )
    return statusLabels.join(' / ')
  })

  // 关闭多状态 tag = 清掉 CSV 过滤,回到普通单值筛选
  function clearMultiStatus() {
    query.instanceStatuses = ''
    query.page = 1
    syncFiltersToUrl()
    void loadData()
  }

  function viewDetail(row: ConsoleJobInstanceResponse) {
    router.push(`/monitor/job-instances/${row.id}`)
  }

  function viewPartitions(row: ConsoleJobInstanceResponse) {
    router.push(`/monitor/job-instances/${row.id}/partitions`)
  }

  function toEpochMs(v: unknown): number | null {
    if (v == null) return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (!s) return null
    const t = Date.parse(s)
    return Number.isFinite(t) ? t : null
  }

  function calcDurationMs(startedAt: unknown, finishedAt: unknown): number | null {
    const start = toEpochMs(startedAt)
    if (start == null) return null
    const parsedFinishedAt = toEpochMs(finishedAt)
    const end = parsedFinishedAt ?? Date.now()
    const d = end - start
    return d >= 0 ? d : null
  }

  function formatJobInstanceDuration(startedAt: unknown, finishedAt: unknown): string {
    const durationMs = calcDurationMs(startedAt, finishedAt)
    return formatDurationMs(durationMs)
  }

  function formatDurationMs(ms: number | null): string {
    if (ms == null) return '-'
    const sec = Math.floor(ms / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) {
      const minuteText = String(m)
      const paddedMinutes = minuteText.padStart(2, '0')
      return `${h}h ${paddedMinutes}m`
    }
    if (m > 0) {
      const secondText = String(s)
      const paddedSeconds = secondText.padStart(2, '0')
      return `${m}m ${paddedSeconds}s`
    }
    return `${s}s`
  }

  // 设计实时条右侧「暂停」:暂停期间自动刷新直接跳过(手动搜索/刷新不受影响)
  const livePaused = ref(false)
  const live = useSseAutoReload({
    domain: 'job-instances',
    reload: async () => {
      if (livePaused.value) return
      await loadData()
    },
    scope: () => tenant.tenantId,
  })

  {
    const q = route.query
    if (q.status) query.instanceStatus = String(q.status)
    // statuses CSV(优先于 status 单值,例如 OpsSummary "失败任务"卡片传 "FAILED,PARTIAL_FAILED")
    if (q.statuses) query.instanceStatuses = String(q.statuses)
    if (q.jobCode) query.jobCode = String(q.jobCode)
    if (q.startDate) query.startDate = String(q.startDate)
    if (q.endDate) query.endDate = String(q.endDate)
    if (q.traceId) query.traceId = String(q.traceId)
    // SLA 违约深链(OpsSummary「SLA 违规」卡片传 slaBreached=1)
    if (q.slaBreached === '1') query.slaBreached = true
    // range=all:跨页跳转(如 Ops 卡片"失败任务"全量计数)主动清空默认的今日锚定
    if (q.range === 'all') {
      query.startDate = ''
      query.endDate = ''
      dateRange.value = null
    } else if (query.startDate && query.endDate) {
      dateRange.value = [query.startDate, query.endDate]
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      query.tenantId = tenant.tenantId
      query.page = 1
      rows.value = []
      total.value = 0
      jobCodeOptions.value = []
      loading.value = false
      loadError.value = null
      lastCountSig = ''
      for (const key of Object.keys(statusCounts)) statusCounts[key] = null
      bulk.clear()
      bulkResultVisible.value = false
      bulkResultRows.value = []
      bulkResultOk.value = 0
    },
    { flush: 'sync' },
  )

  useTenantReload(async () => {
    query.tenantId = tenant.tenantId
    query.page = 1
    await Promise.all([loadJobCodes(), loadData()])
  })
</script>

<style scoped>
  .jr-presets {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
    flex: 1 1 auto;
  }

  .jr-presets__label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .jr-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 12px;
    border-radius: 13px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .jr-chip.is-active {
    padding: 0 11px;
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
    font-weight: 500;
  }

  .jr-chip__star,
  .jr-chip__plus {
    line-height: 1;
  }

  .jr-chip--save {
    gap: 4px;
    padding: 0 11px;
    border-style: dashed;
    border-color: var(--color-border-strong, rgba(255, 255, 255, 0.16));
    background: transparent;
    color: var(--color-text-tertiary);
  }

  .jr-date {
    width: min(440px, 38vw);
  }

  .jr-jobcode {
    width: min(168px, 15vw);
  }

  .jr-trace {
    width: min(180px, 16vw);
  }

  .jr-sla {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  .jr-multistatus {
    margin-bottom: 10px;
  }

  .jr-live__running {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-text-tertiary);
  }

  .jr-live__minidot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-primary);
  }

  .jr-presets__menu :deep(.el-button) {
    min-width: auto;
  }

  :deep(.pro-table__toolbar) {
    min-height: 0;
    margin: 0 0 6px;
  }

  @media (max-width: 720px) {
    .jr-date,
    .jr-jobcode,
    .jr-trace {
      width: 100%;
      max-width: none;
    }

    .jr-sla {
      justify-content: space-between;
      width: 100%;
    }
  }
</style>

<style scoped>
  /* 设计操作列:蓝色文字链(详情/步骤),非描边按钮 */
  .jr-acts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-width: 0;
    max-width: 100%;
  }

  .jr-act {
    color: var(--color-primary);
    font-size: 12.5px;
    text-decoration: none;
  }

  .jr-act:hover {
    text-decoration: underline;
  }

  /* TRACE 短码(灰 mono,hover 转主色) */
  .jr-trace-link {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-tertiary);
    text-decoration: none;
  }

  .jr-trace-link:hover {
    color: var(--color-primary);
  }

  .jr-mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
