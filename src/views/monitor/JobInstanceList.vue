<template>
  <PageContainer>
    <!-- 照设计 #instances 母版:页头右侧=业务日期+刷新;下方 预设条/状态tab行/实时条 -->
    <PageHeader>
      <template #actions>
        <DateRangePresetPicker
          v-model="dateRange"
          type="daterange"
          default-preset="7d"
          @update:model-value="onDateChange"
        />
        <el-button :loading="loading" @click="() => runRefresh(loadData)">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 已保存筛选 chip 条(26h/r13;active=★+accent 软底;虚线=保存当前) -->
    <div class="jr-presets">
      <span class="jr-presets__label">{{ t('jobInstanceList.savedFilters') }}</span>
      <button
        v-for="s in savedFilters.sets.value"
        :key="s.id"
        type="button"
        class="jr-chip"
        :class="{ 'is-active': activePresetId === s.id }"
        @click="applyPreset(s.id)"
      >
        <span v-if="activePresetId === s.id" class="jr-chip__star">★</span>{{ s.name }}
      </button>
      <button type="button" class="jr-chip jr-chip--save" @click="promptSaveFilter">
        <span class="jr-chip__plus">＋</span>{{ t('jobInstanceList.saveCurrentFilter') }}
      </button>
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
    </div>

    <!-- 状态 tab 行(28h/r14 彩点+mono计数)+ 右侧 JobCode/Trace/SLA -->
    <div class="jr-tabs">
      <button
        v-for="tab in statusTabs"
        :key="tab.key"
        type="button"
        class="jr-tab"
        :class="{ 'is-active': tab.active }"
        @click="pickStatusTab(tab.key)"
      >
        <span v-if="tab.dot" class="jr-tab__dot" :style="{ background: tab.dot }" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== null" class="jr-tab__count">{{ tab.count }}</span>
      </button>
      <span class="jr-tabs__spacer" />
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
      <el-button text class="jr-reset" @click="resetQuery">{{ t('common.reset') }}</el-button>
    </div>

    <!-- 多状态深链回显(OpsSummary 失败任务卡 FAILED,PARTIAL_FAILED) -->
    <div v-if="query.instanceStatuses" class="jr-multistatus">
      <el-tag type="danger" closable disable-transitions @close="clearMultiStatus">
        {{ multiStatusLabel }}
      </el-tag>
    </div>

    <!-- 实时监控条(7 14/r9/bg-card) -->
    <div class="jr-live">
      <span class="jr-live__dot" :class="{ 'is-off': live.status.value !== 'live' }" />
      <span class="jr-live__title">{{ t('jobInstanceList.liveTitle') }}</span>
      <span class="jr-live__sub">{{ t('jobInstanceList.liveEvery') }}</span>
      <span class="jr-live__sep" />
      <span class="jr-live__time">{{ t('jobInstanceList.liveLast') }} {{ lastRefreshText }}</span>
      <span class="jr-live__spacer" />
      <span v-if="statusCounts.RUNNING" class="jr-live__running">
        <span class="jr-live__minidot" />{{
          t('jobInstanceList.liveRunning', { n: statusCounts.RUNNING })
        }}
      </span>
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
            :count="bulk.count.value"
            :running="bulk.running.value"
            @clear="bulk.clear"
          >
            <template #default="{ running }">
              <el-button size="small" type="warning" plain :loading="running" @click="onBulkRetry">
                {{ t('jobInstanceList.bulkRetry') }}
              </el-button>
              <el-button size="small" type="danger" plain :loading="running" @click="onBulkCancel">
                {{ t('jobInstanceList.bulkCancel') }}
              </el-button>
            </template>
          </BulkActionBar>
        </template>

        <template #default="{ isColVisible }">
          <el-table-column type="selection" width="44" :selectable="() => true" />
          <!-- P2.4 列顺序优化:用户决策字段(状态/jobCode/bizDate/耗时/重跑)优先,
             工程字段(instanceNo/queue/traceId)后置 -->
          <el-table-column :label="t('jobInstanceList.colStatus')" width="140">
            <template #default="{ row }">
              <StatusTag :value="row.instanceStatus" category="instance" />
              <!-- ADR-026 dry-run 实例:badge 标识不写状态/不投递,避免误读为真实运行 -->
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
            v-if="isColVisible('jobCode')"
            prop="jobCode"
            :label="t('jobInstanceList.colJobCode')"
            width="140"
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
          <el-table-column
            v-if="isColVisible('duration')"
            :label="t('jobInstanceList.colDuration')"
            width="120"
          >
            <template #default="{ row }">
              <span>{{ formatDurationMs(calcDurationMs(row.startedAt, row.finishedAt)) }}</span>
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
              <span v-if="!row.rerunFlag && !row.retryFlag" class="muted">—</span>
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
            width="160"
          />
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
          <!-- 以下工程字段:实例号 / 队列+Worker / Trace(默认隐藏) -->
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
                <span v-if="!row.queueCode && !row.workerGroup" class="muted">—</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('traceId')"
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
        </template>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveTriggerType(value?: string | null): string {
    if (!value) return '—'
    const key = `enum.triggerType.${value}`
    return te(key) ? t(key) : value
  }

  // 列设置:状态/操作列不在表里(始终显示);工程字段(实例号/队列/Trace/SLA 时间)默认隐藏
  const columnDefs = computed(() => [
    { key: 'jobCode', label: t('jobInstanceList.colJobCode') },
    { key: 'bizDate', label: t('jobInstanceList.colBizDate') },
    { key: 'duration', label: t('jobInstanceList.colDuration') },
    { key: 'rerunRetry', label: t('jobInstanceList.colRerunRetry') },
    { key: 'triggerType', label: t('jobInstanceList.colTrigger') },
    { key: 'startedAt', label: t('jobInstanceList.colStartedAt') },
    { key: 'finishedAt', label: t('jobInstanceList.colFinishedAt') },
    { key: 'slaAlertedAt', label: t('jobInstanceList.colSlaAlerted'), defaultHidden: true },
    { key: 'instanceNo', label: t('jobInstanceList.colInstanceNo'), defaultHidden: true },
    { key: 'queueGroup', label: t('jobInstanceList.colQueueGroup'), defaultHidden: true },
    { key: 'traceId', label: t('jobInstanceList.colTrace'), defaultHidden: true },
  ])
  import { instanceApi } from '@/api/instance'
  import { jobApi } from '@/api/job'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { List } from 'lucide-vue-next'
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
    await bulk.runBulk(eligible, (r) => instanceApi.cancel(r.id, tenant.tenantId), {
      actionLabel: label,
    })
    void loadData()
  }

  // 列表筛选默认锚到「近 7 天」:批量作业的 biz_date 多为 T-1 及更早,默认只看"今天单日"
  // 常常空屏(尤其当天尚无业务日数据),近 7 天更贴合运维"看最近一批运行"的真实诉求;
  // URL query 会在下面覆盖。需要精确单日时用户自行收窄即可。
  function recentRange(days = 7): [string, string] {
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    }
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    return [fmt(start), fmt(end)]
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
    { key: '', dot: '', labelKey: 'jobInstanceList.tabAll' },
    { key: 'RUNNING', dot: 'var(--color-primary)', labelKey: 'jobInstanceList.tabRunning' },
    { key: 'SUCCESS', dot: 'var(--color-success)', labelKey: 'jobInstanceList.tabSuccess' },
    { key: 'FAILED', dot: 'var(--color-danger)', labelKey: 'jobInstanceList.tabFailed' },
    {
      key: 'CANCELLED',
      dot: 'var(--color-text-tertiary)',
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
    await Promise.all(
      TAB_DEFS.map(async (tab) => {
        try {
          const pr = await instanceApi.list({
            tenantId: query.tenantId || tenant.tenantId,
            jobCode: query.jobCode,
            instanceStatus: tab.key,
            startDate: query.startDate,
            endDate: query.endDate,
            traceId: query.traceId,
            slaBreached: query.slaBreached,
            page: 1,
            pageSize: 1,
          })
          statusCounts[tab.key] = pr.total ?? 0
        } catch {
          statusCounts[tab.key] = null
        }
      }),
    )
  }

  const statusTabs = computed(() =>
    TAB_DEFS.map((tab) => ({
      key: tab.key,
      dot: tab.dot,
      label: t(tab.labelKey),
      count: statusCounts[tab.key],
      active: tab.key
        ? query.instanceStatus === tab.key ||
          (tab.key === 'FAILED' && query.instanceStatuses.includes('FAILED'))
        : !query.instanceStatus && !query.instanceStatuses,
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

  // 预设 chip:当前 query 与某套保存值完全一致时该 chip 高亮
  const activePresetId = computed(() => {
    const cur = JSON.stringify({
      jobCode: query.jobCode,
      instanceStatus: query.instanceStatus,
      instanceStatuses: query.instanceStatuses,
      startDate: query.startDate,
      endDate: query.endDate,
      traceId: query.traceId,
      slaBreached: query.slaBreached,
    })
    return savedFilters.sets.value.find((s) => JSON.stringify(s.filters) === cur)?.id ?? ''
  })

  function applyPreset(id: string) {
    savedFilters.applySet(id)
    dateRange.value = query.startDate && query.endDate ? [query.startDate, query.endDate] : null
  }

  async function promptSaveFilter() {
    try {
      const { value } = await ElMessageBox.prompt(
        t('jobInstanceList.saveFilterPrompt'),
        t('jobInstanceList.saveCurrentFilter'),
        { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel') },
      )
      if (value?.trim()) savedFilters.save(value.trim())
    } catch {
      /* cancel */
    }
  }

  const lastRefreshText = computed(() => {
    const v = live.lastRefreshedAt.value
    if (!v) return '—'
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  })

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
    loading.value = true
    loadError.value = null
    try {
      const result = await instanceApi.list(query)
      rows.value = result.records
      total.value = result.total
      void loadStatusCounts()
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

<style scoped>
  /* ── 照设计 #instances 母版 dump(docs/redesign/proto-instances.html)1:1 ── */

  /* 已保存筛选 chip 条 */
  .jr-presets {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 12px;
    flex-wrap: wrap;
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

  .jr-presets__menu {
    margin-left: 2px;
  }

  /* 状态 tab 行 */
  .jr-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .jr-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12.5px;
    font-weight: 400;
    white-space: nowrap;
    flex-shrink: 0;
    cursor: pointer;
  }

  .jr-tab.is-active {
    border-color: var(--color-text-secondary);
    background: var(--color-bg-elevated);
    font-weight: 600;
  }

  .jr-tab__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .jr-tab__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .jr-tabs__spacer {
    flex: 1;
  }

  .jr-jobcode {
    width: 200px;
  }

  .jr-trace {
    width: 200px;
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

  /* 实时监控条 */
  .jr-live {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    background: var(--color-bg-card);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .jr-live__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-success);
    flex-shrink: 0;
  }

  .jr-live__dot.is-off {
    background: var(--color-text-tertiary);
  }

  .jr-live__title {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .jr-live__sub {
    color: var(--color-text-tertiary);
  }

  .jr-live__sep {
    width: 1px;
    height: 12px;
    background: var(--color-border);
  }

  .jr-live__time {
    font-family: var(--font-mono);
    color: var(--color-text-tertiary);
  }

  .jr-live__spacer {
    flex: 1;
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
</style>
