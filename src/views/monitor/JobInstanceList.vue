<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="loadData"
        :total="total"
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        @change="loadData"
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
              <MetaSelect
                class="query-w-180"
                v-model="query.instanceStatus"
                clearable
                filterable
                enum-key="instanceStatus"
                :placeholder="t('jobInstanceList.statusPlaceholder')"
                :options="statusOptions"
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
  import { ref, reactive, computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'

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
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { List } from '@element-plus/icons-vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const router = useRouter()
  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const jobCodeOptions = ref<string[]>([])

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
    page: 1,
    pageSize: 15,
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
      query.startDate = t[0]
      query.endDate = t[1]
      query.traceId = ''
      dateRange.value = t
      query.page = 1
      syncFiltersToUrl()
      await loadData()
    })
  }

  function searchInstances() {
    return runSearch(async () => {
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
    }
  }

  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (query.jobCode) params.jobCode = query.jobCode
    if (query.instanceStatus) params.status = query.instanceStatus
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    if (query.traceId) params.traceId = query.traceId
    void router.replace({ query: params })
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

  useSseAutoReload({
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
