<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        ref="proTableRef"
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="loadData"
        :total="total"
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        @change="loadData"
        @selection-change="bulk.onSelectionChange"
      >
        <template #query>
          <ListPageQueryBar
            :model="query"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="searchInstances"
            @reset="resetQuery"
            @refresh="() => runRefresh(loadData)"
          >
            <template #prepend>
              <SavedFiltersMenu
                :sets="savedFilters.sets.value"
                :on-save="savedFilters.save"
                :on-apply="savedFilters.applySet"
                :on-remove="savedFilters.remove"
                :on-rename="savedFilters.rename"
                :on-export="savedFilters.exportSets"
                :on-import="savedFilters.importSets"
              />
            </template>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobInstanceList.jobCodeTip')">
                  {{ t('jobInstanceList.jobCodeLabel') }}
                </HelpLabel>
              </template>
              <el-select
                class="query-w-200"
                v-model="query.jobCode"
                clearable
                filterable
                allow-create
                default-first-option
                :placeholder="t('jobInstanceList.jobCodePlaceholder')"
              >
                <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('jobInstanceList.statusLabel')">
              <!-- 多状态深链(如 OpsSummary「失败任务」卡片传 FAILED,PARTIAL_FAILED):
                   单值下拉无法表达,改用可关闭 tag 回显,让用户看到过滤条件确实生效 -->
              <el-tag
                v-if="query.instanceStatuses"
                class="query-w-180"
                type="danger"
                closable
                disable-transitions
                @close="clearMultiStatus"
              >
                {{ multiStatusLabel }}
              </el-tag>
              <MetaSelect
                v-else
                class="query-w-180"
                v-model="query.instanceStatus"
                clearable
                filterable
                enum-key="instanceStatus"
                :placeholder="t('jobInstanceList.statusPlaceholder')"
                :options="statusOptions"
                @change="onStatusChange"
              />
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobInstanceList.bizDateTip')">
                  {{ t('jobInstanceList.bizDateLabel') }}
                </HelpLabel>
              </template>
              <DateRangePresetPicker
                v-model="dateRange"
                type="daterange"
                default-preset="today"
                @update:model-value="onDateChange"
              />
            </el-form-item>
            <el-form-item :label="t('jobInstanceList.traceIdLabel')">
              <el-input
                class="query-w-240"
                v-model="query.traceId"
                clearable
                :placeholder="t('jobInstanceList.traceIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobInstanceList.slaBreachedTip')">
                  {{ t('jobInstanceList.slaBreachedLabel') }}
                </HelpLabel>
              </template>
              <el-switch v-model="query.slaBreached" @change="onSlaBreachedChange" />
            </el-form-item>
          </ListPageQueryBar>
        </template>

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
          <OpsListToolbar
            :status="live.status.value"
            :last-refreshed-at="live.lastRefreshedAt.value"
          >
            <BulkActionBar
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
                  @click="onBulkRetry"
                >
                  {{ t('jobInstanceList.bulkRetry') }}
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="running"
                  @click="onBulkCancel"
                >
                  {{ t('jobInstanceList.bulkCancel') }}
                </el-button>
              </template>
            </BulkActionBar>
          </OpsListToolbar>
        </template>

        <el-table-column type="selection" width="44" :selectable="() => true" />
        <!-- P2.4 列顺序优化:用户决策字段(状态/jobCode/bizDate/耗时/重跑)优先,
             工程字段(instanceNo/queue/traceId)后置 -->
        <el-table-column :label="t('jobInstanceList.colStatus')" width="140">
          <template #default="{ row }">
            <StatusTag :value="row.instanceStatus" category="instance" />
            <!-- ADR-026 dry-run 实例:badge 标识不写状态/不投递,避免误读为真实运行 -->
            <el-tag v-if="row.dryRun" size="small" type="info" effect="plain" class="dry-run-badge">
              {{ t('jobInstanceList.dryRunBadge') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="jobCode" :label="t('jobInstanceList.colJobCode')" width="140">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/jobs/definitions?jobCode=${row.jobCode}`">
              {{ row.jobCode }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="bizDate" :label="t('jobInstanceList.colBizDate')" width="110" />
        <el-table-column :label="t('jobInstanceList.colDuration')" width="120">
          <template #default="{ row }">
            <span>{{ formatDurationMs(calcDurationMs(row.startedAt, row.finishedAt)) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('jobInstanceList.colRerunRetry')" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.rerunFlag" size="small" type="warning" effect="plain">
              {{ t('jobInstanceList.tagRerun') }}
            </el-tag>
            <el-tag v-if="row.retryFlag" size="small" type="info" effect="plain">
              {{ t('jobInstanceList.tagRetry') }}
            </el-tag>
            <span v-if="!row.rerunFlag && !row.retryFlag" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="triggerType" :label="t('jobInstanceList.colTrigger')" width="100">
          <template #default="{ row }">
            {{ resolveTriggerType(row.triggerType) }}
          </template>
        </el-table-column>
        <DatetimeColumn prop="startedAt" :label="t('jobInstanceList.colStartedAt')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('jobInstanceList.colFinishedAt')" width="160" />
        <DatetimeColumn
          prop="slaAlertedAt"
          :label="t('jobInstanceList.colSlaAlerted')"
          width="160"
        />
        <!-- 以下工程字段:实例号 / 队列+Worker / Trace -->
        <el-table-column prop="instanceNo" :label="t('jobInstanceList.colInstanceNo')" width="180">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/job-instances/${row.id}`">
              {{ row.instanceNo }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column :label="t('jobInstanceList.colQueueGroup')" width="160">
          <template #default="{ row }">
            <div class="cell-stack">
              <span v-if="row.queueCode" class="cell-main">{{ row.queueCode }}</span>
              <span v-if="row.workerGroup" class="cell-sub">{{ row.workerGroup }}</span>
              <span v-if="!row.queueCode && !row.workerGroup" class="muted">—</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="traceId"
          :label="t('jobInstanceList.colTrace')"
          width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
              :title="t('jobInstanceList.colTraceJumpTip')"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('jobInstanceList.colActions')" fixed="right" width="200">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="viewDetail(row)">
                {{ t('jobInstanceList.actionDetail') }}
              </el-button>
              <el-button size="small" plain @click="viewPartitions(row)">
                {{ t('jobInstanceList.actionPartitions') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveTriggerType(value?: string | null): string {
    if (!value) return '—'
    const key = `enum.triggerType.${value}`
    return te(key) ? t(key) : value
  }
  import { instanceApi } from '@/api/instance'
  import { jobApi } from '@/api/job'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { List } from '@element-plus/icons-vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import SavedFiltersMenu from '@/components/table/SavedFiltersMenu.vue'
  import { useSavedFilters } from '@/composables/useSavedFilters'
  import { useAuthStore } from '@/stores/auth'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import { useBulkSelection } from '@/composables/useBulkSelection'

  const router = useRouter()
  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const jobCodeOptions = ref<string[]>([])

  // ── 批量操作:多选 + 批量重试(FAILED)/ 批量取消(非终态)──────────────
  const proTableRef = ref<{ clearSelection?: () => void } | null>(null)
  const bulk = useBulkSelection<ConsoleJobInstanceResponse>()
  onMounted(() => bulk.bindTable(proTableRef.value))
  const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED', 'CANCELED', 'TERMINATED']

  async function onBulkRetry() {
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
    await bulk.runBulk(
      eligible,
      (r) => instanceApi.retry(r.instanceNo, tenant.tenantId, r.jobCode, r.bizDate),
      { actionLabel: label },
    )
    void loadData()
  }

  async function onBulkCancel() {
    const eligible = bulk.selected.value.filter(
      (r) => !TERMINAL_STATUSES.includes(r.instanceStatus),
    )
    if (!eligible.length) {
      ElMessage.warning(t('jobInstanceList.bulkCancelNone'))
      return
    }
    const label = t('jobInstanceList.bulkCancel')
    const confirmed = await ElMessageBox.confirm(
      t('bulk.confirmBody', { label, n: eligible.length }),
      label,
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
    ).catch(() => false)
    if (confirmed === false) return
    await bulk.runBulk(eligible, (r) => instanceApi.cancel(r.id, tenant.tenantId), {
      actionLabel: label,
    })
    void loadData()
  }

  // 列表筛选默认锚到"今日",运维 80% 场景关心当天数据;URL query 会在下面覆盖
  function todayRange(): [string, string] {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    return [s, s]
  }
  const initialRange = todayRange()
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

  async function loadJobCodes() {
    // 仅用于下拉"常用 jobCode"提示，取前 500 条即可；超过 500 的租户让用户手输或搜索
    // （旧实现走 fetchAllPageItems，大租户会拉回万级数据，浪费带宽）
    try {
      const paged = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 500,
      })
      jobCodeOptions.value = [...new Set(paged.records.map((d) => d.jobCode).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      )
    } catch {
      jobCodeOptions.value = []
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
      const t = todayRange()
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
    loading.value = true
    loadError.value = null
    try {
      const result = await instanceApi.list(query)
      rows.value = result.records
      total.value = result.total
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
      live.markRefreshed()
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
  const multiStatusLabel = computed(() =>
    query.instanceStatuses
      .split(',')
      .map((c) => statusOptions.value.find((o) => o.value === c)?.label ?? c)
      .join(' / '),
  )

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
    const end = toEpochMs(finishedAt) ?? Date.now()
    const d = end - start
    return d >= 0 ? d : null
  }

  function formatDurationMs(ms: number | null): string {
    if (ms == null) return '-'
    const sec = Math.floor(ms / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
    return `${s}s`
  }

  const live = useSseAutoReload({
    domain: 'job-instances',
    reload: loadData,
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

  useTenantReload(() => {
    query.tenantId = tenant.tenantId
    query.page = 1
    void loadJobCodes()
    void loadData()
  })
</script>
