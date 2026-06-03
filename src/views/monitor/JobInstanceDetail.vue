<template>
  <PageContainer>
    <PageHeader
      :title="t('monitor.detailTitle')"
      :description="headerDesc"
      back-to="/monitor/job-instances"
    >
      <template #actions>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('monitor.detailRefresh') }}
        </el-button>
        <el-button v-if="row" type="danger" :loading="cancelLoading" @click="confirmCancel">
          {{ t('monitor.detailCancel') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- ADR-026 dry-run 实例:醒目 banner 提醒"未真正写状态/未投递",并展示 failureClass(若有) -->
    <el-alert
      v-if="row?.dryRun"
      :title="t('jobInstanceDetail.dryRunBannerTitle')"
      type="info"
      show-icon
      :closable="false"
      class="dry-run-banner"
    >
      <template #default>
        <div>{{ t('jobInstanceDetail.dryRunBannerHint') }}</div>
        <div v-if="row.failureClass" class="failure-class">
          {{ t('jobInstanceDetail.failureClass') }}: <code>{{ row.failureClass }}</code>
        </div>
      </template>
    </el-alert>

    <div v-if="row" class="detail-grid">
      <MetricCard
        :label="t('monitor.detailMetricInstanceNo')"
        :value="row.instanceNo"
        description="instanceNo"
      />
      <MetricCard
        :label="t('monitor.detailMetricStatus')"
        :value="row.instanceStatus"
        description="instanceStatus"
      />
      <MetricCard
        :label="t('monitor.detailMetricJobCode')"
        :value="row.jobCode"
        description="jobCode"
      />
      <MetricCard
        :label="t('monitor.detailMetricBizDate')"
        :value="row.bizDate"
        description="bizDate"
      />
      <MetricCard
        :label="t('monitor.detailMetricTrace')"
        :value="row.traceId || '—'"
        description="traceId"
      />
      <MetricCard
        :label="t('monitor.detailMetricQueue')"
        :value="row.queueCode || '—'"
        description="queueCode"
      />
    </div>

    <el-tabs v-if="row" v-model="activeTab" class="detail-tabs">
      <!-- Tab 1: 概览 -->
      <el-tab-pane name="overview" :label="t('monitor.detailTabOverview')">
        <SectionCard v-if="row.parentInstanceId || row.relatedFileId || row.failureClass">
          <template #header>{{ t('monitor.detailRelatedSection') }}</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item
              v-if="row.parentInstanceId"
              :label="t('monitor.detailParentInstance')"
            >
              <router-link class="cell-link" :to="`/monitor/job-instances/${row.parentInstanceId}`">
                #{{ row.parentInstanceId }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item v-if="row.relatedFileId" :label="t('monitor.detailRelatedFile')">
              <router-link class="cell-link" :to="`/files/list?fileId=${row.relatedFileId}`">
                #{{ row.relatedFileId }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item v-if="row.failureClass" :label="t('monitor.detailFailureClass')">
              <el-tag size="small" type="danger" effect="plain">{{ row.failureClass }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </SectionCard>

        <SectionCard>
          <template #header>{{ t('monitor.detailTimeSection') }}</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('monitor.detailStarted')">{{
              fmtDatetime(row.startedAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailFinished')">{{
              fmtDatetime(row.finishedAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailDeadline')">{{
              fmtDatetime(row.deadlineAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailSlaAlerted')">{{
              row.slaAlertedAt || '—'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailRerun')">
              {{ row.rerunFlag ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailRetry')">
              {{ row.retryFlag ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="actions">
            <el-button @click="goLogs">{{ t('monitor.detailGoLogs') }}</el-button>
            <el-button type="warning" :loading="rerunLoading" @click="confirmRerun">
              {{ t('monitor.detailRerunBtn') }}
            </el-button>
            <el-button type="danger" :loading="cancelLoading" @click="confirmCancel">
              {{ t('monitor.detailCancelBtn') }}
            </el-button>
            <el-button type="danger" :loading="terminateLoading" @click="confirmTerminate">
              {{ t('monitor.detailTerminateBtn') }}
            </el-button>
          </div>
        </SectionCard>

        <SectionCard>
          <template #header>{{ t('monitor.detailParamsSection') }}</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="paramsSnapshot">
              <JsonPreview :data="row.paramsSnapshot" />
            </el-descriptions-item>
            <el-descriptions-item label="resultSummary">
              <JsonPreview :data="row.resultSummary" />
            </el-descriptions-item>
          </el-descriptions>
        </SectionCard>
      </el-tab-pane>

      <!-- Tab 2: 步骤(inline) -->
      <el-tab-pane name="steps" :lazy="true">
        <template #label>
          <span>
            {{ t('monitor.detailTabSteps') }}
            <el-tag v-if="stepsRows.length" size="small" round>{{ stepsRows.length }}</el-tag>
          </span>
        </template>
        <SectionCard>
          <template #header>
            <span>{{ t('monitor.detailTabSteps') }}</span>
            <el-button text type="primary" @click="goSteps">
              {{ t('monitor.detailOpenStandalone') }}
            </el-button>
          </template>
          <div class="step-toggle-bar">
            <el-checkbox v-model="showStepProgressCols" size="small">
              {{ t('filePipelineObservability.colRowsProcessed') }} /
              {{ t('filePipelineObservability.colTotalRowsEta') }}
            </el-checkbox>
          </div>
          <el-table v-loading="stepsLoading" :data="stepsRows" size="small" empty-text="—" stripe>
            <el-table-column prop="stepCode" :label="t('monitor.stepColStep')" min-width="180" />
            <el-table-column :label="t('monitor.stepColStatus')" width="120">
              <template #default="{ row: s }">
                <el-tag size="small" :type="stepTagType(s.stepStatus)">{{ s.stepStatus }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="retryCount"
              :label="t('monitor.stepColRetry')"
              width="80"
              align="right"
            />
            <el-table-column
              v-if="showStepProgressCols"
              :label="t('filePipelineObservability.colRowsProcessed')"
              width="110"
              align="right"
            >
              <template #default="{ row: s }">
                {{ formatStepProcessed(s) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="showStepProgressCols"
              :label="t('filePipelineObservability.colTotalRowsEta')"
              width="170"
            >
              <template #default="{ row: s }">
                {{ formatStepTotalEta(s) }}
              </template>
            </el-table-column>
            <el-table-column :label="t('monitor.stepColStarted')" width="170">
              <template #default="{ row: s }">{{ fmtDatetime(s.startedAt) }}</template>
            </el-table-column>
            <el-table-column :label="t('monitor.stepColFinished')" width="170">
              <template #default="{ row: s }">{{ fmtDatetime(s.finishedAt) }}</template>
            </el-table-column>
            <el-table-column
              prop="errorMessage"
              :label="t('monitor.stepColError')"
              show-overflow-tooltip
            />
          </el-table>
        </SectionCard>
      </el-tab-pane>

      <!-- Tab: 心跳进度(SDK Phase 4 / FE 2-C) -->
      <el-tab-pane name="heartbeat" :lazy="true">
        <template #label>
          <span>{{ t('jobInstanceDetail.heartbeatTab') }}</span>
        </template>
        <SectionCard>
          <template #header>{{ t('jobInstanceDetail.heartbeatSection') }}</template>
          <div v-if="taskOptions.length === 0" class="hb-empty">
            <EmptyState
              :description="t('jobInstanceDetail.heartbeatNoTasks')"
              :image-size="60"
            />
          </div>
          <div v-else class="hb-wrap">
            <div class="hb-picker">
              <span class="hb-picker__label">{{ t('jobInstanceDetail.heartbeatPickStep') }}</span>
              <el-select v-model="selectedTaskId" size="small" class="hb-picker__select">
                <el-option
                  v-for="opt in taskOptions"
                  :key="opt.taskId"
                  :label="opt.label"
                  :value="opt.taskId"
                />
              </el-select>
            </div>
            <HeartbeatProgressPanel v-if="selectedTaskId" :task-id="selectedTaskId" />
          </div>
        </SectionCard>
      </el-tab-pane>

      <!-- Tab 3: 最近运行(同 jobCode) -->
      <el-tab-pane name="recent" :lazy="true">
        <template #label>
          <span>
            {{ t('monitor.detailTabRecent') }}
            <el-tag v-if="recentRows.length" size="small" round>{{ recentRows.length }}</el-tag>
          </span>
        </template>
        <SectionCard>
          <template #header>{{ t('monitor.detailRecentHeader', { code: row.jobCode }) }}</template>
          <el-table v-loading="recentLoading" :data="recentRows" size="small" empty-text="—" stripe>
            <el-table-column :label="t('monitor.detailMetricInstanceNo')" min-width="220">
              <template #default="{ row: r }">
                <router-link class="cell-link" :to="`/monitor/job-instances/${r.id}`">
                  {{ r.instanceNo }}
                </router-link>
                <el-tag
                  v-if="r.id === row?.id"
                  size="small"
                  effect="plain"
                  style="margin-left: 6px"
                >
                  {{ t('monitor.detailRecentSelf') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="bizDate" :label="t('monitor.detailMetricBizDate')" width="120" />
            <el-table-column :label="t('monitor.detailMetricStatus')" width="120">
              <template #default="{ row: r }">
                <el-tag size="small" :type="stepTagType(r.instanceStatus)">{{
                  r.instanceStatus
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('monitor.detailStarted')" width="170">
              <template #default="{ row: r }">{{ fmtDatetime(r.startedAt) }}</template>
            </el-table-column>
            <el-table-column :label="t('monitor.detailFinished')" width="170">
              <template #default="{ row: r }">{{ fmtDatetime(r.finishedAt) }}</template>
            </el-table-column>
          </el-table>
        </SectionCard>
      </el-tab-pane>
    </el-tabs>

    <SectionCard v-else-if="!loading">
      <EmptyState :description="t('monitor.detailEmpty')" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDatetime } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import { instanceApi } from '@/api/instance'
  import { createLogStream } from '@/api/stream'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import HeartbeatProgressPanel from '@/components/heartbeat/HeartbeatProgressPanel.vue'
  import type {
    ConsoleJobInstanceResponse,
    ConsoleJobStepInstanceResponse,
  } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rerunLoading = ref(false)
  const cancelLoading = ref(false)
  const terminateLoading = ref(false)
  const row = ref<ConsoleJobInstanceResponse | null>(null)

  const activeTab = ref<'overview' | 'steps' | 'heartbeat' | 'recent'>('overview')
  const stepsLoading = ref(false)
  const stepsRows = ref<ConsoleJobStepInstanceResponse[]>([])
  const stepsLoaded = ref(false)
  const recentLoading = ref(false)
  const recentRows = ref<ConsoleJobInstanceResponse[]>([])
  const recentLoaded = ref(false)

  // 行级进度列(默认隐藏);本视图无 pipelineInstanceId,暂走「—」降级,
  // 等 BE 把 pipeline-progress 端点按 jobStepId 索引后补真实数据。详见
  // `docs/design/pipeline-stage-progress-display.md`
  const showStepProgressCols = ref(false)

  const FILE_STAGE_STEP_TYPES = new Set(['LOAD', 'GENERATE', 'IMPORT', 'EXPORT', 'PROCESS'])

  function isFileStageStep(s: ConsoleJobStepInstanceResponse): boolean {
    const tp = String(s.stepType ?? '').toUpperCase()
    return FILE_STAGE_STEP_TYPES.has(tp)
  }

  function formatStepProcessed(s: ConsoleJobStepInstanceResponse): string {
    if (!isFileStageStep(s)) return '—'
    // 当前视图未接入 pipeline-progress 端点(无 pipelineInstanceId 直查路径)
    return '—'
  }

  function formatStepTotalEta(s: ConsoleJobStepInstanceResponse): string {
    if (!isFileStageStep(s)) return '—'
    return '—'
  }

  const taskOptions = computed(() =>
    stepsRows.value
      .filter((s) => typeof s.jobTaskId === 'number' && s.jobTaskId > 0)
      .map((s) => ({
        taskId: s.jobTaskId as number,
        label: `${s.stepCode} · #${s.jobTaskId} · ${s.stepStatus}`,
        status: s.stepStatus,
      })),
  )
  const selectedTaskId = ref<number | undefined>(undefined)
  // 默认挑当前 RUNNING 步骤;否则取最后一个(序号最大)
  watch(
    taskOptions,
    (opts) => {
      if (selectedTaskId.value && opts.some((o) => o.taskId === selectedTaskId.value)) return
      if (opts.length === 0) {
        selectedTaskId.value = undefined
        return
      }
      const running = opts.find((o) => o.status === 'RUNNING')
      selectedTaskId.value = running?.taskId ?? opts[opts.length - 1].taskId
    },
    { immediate: true },
  )

  // 切到 heartbeat tab 时,确保 steps 已加载(taskOptions 依赖它)
  watch(activeTab, async (tab) => {
    if (tab === 'heartbeat' && !stepsLoaded.value && !stepsLoading.value) {
      await loadSteps()
    }
  })

  function stepTagType(
    status: string,
  ): 'success' | 'danger' | 'warning' | 'info' | 'primary' | undefined {
    const s = (status || '').toUpperCase()
    if (s === 'SUCCESS' || s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED') return 'danger'
    if (s === 'RUNNING' || s === 'RETRYING') return 'warning'
    return 'info'
  }

  async function loadSteps() {
    if (!row.value || !Number.isFinite(instanceId.value)) return
    stepsLoading.value = true
    try {
      stepsRows.value = await instanceApi.partitions(instanceId.value, tenant.tenantId)
      stepsLoaded.value = true
    } catch {
      stepsRows.value = []
    } finally {
      stepsLoading.value = false
    }
  }

  async function loadRecent() {
    if (!row.value?.jobCode) return
    recentLoading.value = true
    try {
      const page = await instanceApi.list({
        tenantId: tenant.tenantId,
        jobCode: row.value.jobCode,
        page: 1,
        pageSize: 10,
      })
      recentRows.value = page.records ?? []
      recentLoaded.value = true
    } catch {
      recentRows.value = []
    } finally {
      recentLoading.value = false
    }
  }

  watch(activeTab, (tab) => {
    if (tab === 'steps' && !stepsLoaded.value) void loadSteps()
    if (tab === 'recent' && !recentLoaded.value) void loadRecent()
  })

  const instanceId = computed(() => Number(route.params.id))

  const headerDesc = computed(() => {
    if (!row.value) return t('monitor.detailLoading')
    return `${row.value.jobCode} · ${row.value.bizDate || ''} · ${t('monitor.detailKeyHint')}`
  })

  async function load() {
    if (!Number.isFinite(instanceId.value)) return
    loading.value = true
    try {
      row.value = await instanceApi.detail(instanceId.value, tenant.tenantId)
    } catch {
      row.value = null
    } finally {
      loading.value = false
    }
  }

  function goSteps() {
    router.push(`/monitor/job-instances/${instanceId.value}/partitions`)
  }

  function goLogs() {
    const t = row.value?.traceId
    router.push({ path: '/observability/trace', query: t ? { traceId: t } : {} })
  }

  async function confirmRerun() {
    const r = row.value
    if (!r) return
    try {
      await confirmDanger({
        verb: '重跑',
        target: `实例「${r.instanceNo}」`,
        consequence:
          '将基于相同 jobCode + bizDate 派发一条新实例,原实例数据保留。下游若已消费旧实例输出,可能产生重复处理。',
        confirmButtonText: '确认重跑',
      })
    } catch {
      return
    }
    rerunLoading.value = true
    try {
      await instanceApi.retry(r.instanceNo, tenant.tenantId, r.jobCode, r.bizDate)
      // rerun 产生的是新实例;给用户两个明确动作:看新实例 / 留在当前
      showCreateSuccess({
        title: t('monitor.rerunSuccessTitle'),
        message: t('monitor.rerunSuccessMessage', { no: r.instanceNo, code: r.jobCode }),
        primary: {
          label: t('monitor.rerunGoList'),
          onClick: () => {
            void router.push({
              path: '/monitor/job-instances',
              query: { jobCode: r.jobCode, startDate: r.bizDate, endDate: r.bizDate },
            })
          },
        },
        secondary: { label: t('monitor.rerunStay'), onClick: () => load() },
      })
    } finally {
      rerunLoading.value = false
    }
  }

  async function confirmCancel() {
    const r = row.value
    if (!r) return
    try {
      await confirmDanger({
        verb: '终止',
        target: `实例「${r.instanceNo}」`,
        consequence: 'Worker 会尽快终止运行中的进程。已写入的中间结果可能保留,需手动清理。',
        irreversible: true,
        confirmButtonText: '确认终止',
      })
    } catch {
      return
    }
    cancelLoading.value = true
    try {
      await instanceApi.cancel(r.id, tenant.tenantId)
      ElMessage.success(t('monitor.instanceCanceled', { no: r.instanceNo }))
      await load()
    } finally {
      cancelLoading.value = false
    }
  }

  async function confirmTerminate() {
    const r = row.value
    if (!r) return
    try {
      await confirmDanger({
        verb: t('monitor.terminateVerb'),
        target: t('monitor.terminateTarget', { no: r.instanceNo }),
        consequence: t('monitor.terminateConsequence'),
        irreversible: true,
      })
    } catch {
      return
    }
    terminateLoading.value = true
    try {
      await instanceApi.terminate(r.id, tenant.tenantId)
      ElMessage.success(t('monitor.terminateSuccess', { no: r.instanceNo }))
      await load()
    } finally {
      terminateLoading.value = false
    }
  }

  let sse: EventSource | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let reopenTimer: ReturnType<typeof setTimeout> | null = null
  let streamGen = 0
  let streamRetries = 0
  const MAX_SSE_RETRIES = 5

  function clearReopenTimer() {
    if (reopenTimer) {
      clearTimeout(reopenTimer)
      reopenTimer = null
    }
  }

  function closeStream() {
    streamGen++
    clearReopenTimer()
    if (sse) {
      sse.close()
      sse = null
    }
    if (reloadTimer) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }
  }

  function scheduleReload() {
    if (reloadTimer) return
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      load()
    }, 400)
  }

  function scheduleReopen(capturedGen: number) {
    if (capturedGen !== streamGen) return
    if (streamRetries >= MAX_SSE_RETRIES) return
    clearReopenTimer()
    const delay = Math.min(30_000, 1_000 * 2 ** streamRetries)
    streamRetries += 1
    reopenTimer = setTimeout(() => {
      reopenTimer = null
      void openStream()
    }, delay)
  }

  async function openStream() {
    closeStream()
    if (!Number.isFinite(instanceId.value) || !tenant.tenantId) return
    const my = streamGen
    try {
      const es = await createLogStream(
        instanceId.value,
        () => scheduleReload(),
        () => scheduleReopen(my),
      )
      if (my !== streamGen) {
        es.close()
        return
      }
      sse = es
      streamRetries = 0
    } catch {
      scheduleReopen(my)
    }
  }

  useTenantReload(() => {
    void load()
    void openStream()
  })

  watch(instanceId, () => {
    // 切到不同实例时,steps/recent 数据要重新拉,但只在当前 tab 触发,避免无谓请求
    stepsLoaded.value = false
    recentLoaded.value = false
    stepsRows.value = []
    recentRows.value = []
    // load() reject 不应升级为 unhandled rejection;失败时也尝试拉 tab 数据(其中
    // load 内部已 toast 提示,这里只静默 catch)。
    load()
      .then(() => {
        if (activeTab.value === 'steps') void loadSteps()
        else if (activeTab.value === 'recent') void loadRecent()
      })
      .catch(() => {
        /* 已在 load() 内 toast 提示,无需重复 */
      })
    void openStream()
  })

  onBeforeUnmount(closeStream)

  /**
   * 详情页快捷键(oncall 高频):
   *   r → rerun(仅 FAILED 时)
   *   l → 跳 logs
   *   s → 看 steps/分区
   *   esc → 智能返回
   * 在 input/textarea/contenteditable 内不触发,避免吞输入。
   */
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const tgt = e.target as HTMLElement | null
    if (tgt) {
      const tag = tgt.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable) return
    }
    if (e.key === 'r' || e.key === 'R') {
      if (row.value?.instanceStatus === 'FAILED') {
        e.preventDefault()
        void confirmRerun()
      }
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault()
      goLogs()
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault()
      goSteps()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      router.back()
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .detail-tabs :deep(.el-tabs__header) {
    margin-bottom: var(--space-md);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--page-block-gap);
    margin-top: var(--space-md);
  }

  .mono {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
  }

  .hb-empty {
    padding: 24px 0;
  }

  .hb-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hb-picker {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hb-picker__label {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .hb-picker__select {
    width: 320px;
  }
</style>
