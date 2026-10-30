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
        <el-button v-if="lifecycleAction" :loading="lifecycleLoading" @click="changeLifecycle">
          {{ t(`runControl.${lifecycleAction}`) }}
        </el-button>
        <el-button
          v-if="canWriteSystem && row && canCancelInstance(row.instanceStatus)"
          type="danger"
          :disabled="writesFrozen"
          :loading="cancelLoading"
          @click="confirmCancel"
        >
          {{
            row.instanceStatus === 'RUNNING'
              ? t('monitor.detailCancelRequestBtn')
              : t('monitor.detailCancel')
          }}
        </el-button>
        <el-button v-if="row && canManageSystem" :loading="diagnosisLoading" @click="runDiagnosis">
          {{ t('monitor.detailDiagnose') }}
        </el-button>
        <el-button v-if="canManageSystem" @click="router.push('/ops/diagnostic')">
          {{ t('jobInstanceDetail.opsDiagnosticAction') }}
        </el-button>
        <el-button v-if="row" @click="goLogs">{{ t('monitor.detailGoLogs') }}</el-button>
        <el-button
          v-if="canWriteSystem && row && isTerminal"
          type="warning"
          :disabled="writesFrozen"
          :loading="rerunLoading"
          @click="confirmRerun"
        >
          {{ t('monitor.detailRerunBtn') }}
        </el-button>
        <el-tooltip
          v-if="canWriteSystem && row && isTerminal"
          :disabled="canRetryFailedPartitions"
          :content="t('monitor.detailRetryFailedPartitionsDisabled')"
          placement="bottom"
        >
          <span class="action-button-wrap">
            <el-button
              :loading="retryFailedPartitionsLoading"
              :disabled="!canRetryFailedPartitions || writesFrozen"
              @click="confirmRetryFailedPartitions"
            >
              {{ t('monitor.detailRetryFailedPartitions') }}
            </el-button>
          </span>
        </el-tooltip>
        <el-button
          v-if="canWriteSystem && row && canTerminateInstance(row.instanceStatus)"
          type="danger"
          plain
          :disabled="writesFrozen"
          :loading="terminateLoading"
          @click="confirmTerminate"
        >
          {{ t('monitor.detailTerminateBtn') }}
        </el-button>
        <PrintButton />
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
        :value="compactIdentifier(row.instanceNo)"
        :copy-value="row.instanceNo"
        :description="row.instanceNo"
      />
      <MetricCard
        :label="t('monitor.detailMetricStatus')"
        :value="row.instanceStatus"
        :tone="statusTone(row.instanceStatus)"
        :description="t('jobInstanceDetail.metricStatusDescription')"
      />
      <MetricCard
        :label="t('monitor.detailMetricJobCode')"
        :value="compactIdentifier(row.jobCode, 18, 8)"
        :copy-value="row.jobCode"
        :description="row.jobCode"
      />
      <MetricCard
        :label="t('monitor.detailMetricBizDate')"
        :value="row.bizDate"
        :description="t('jobInstanceDetail.metricBizDateDescription')"
      />
      <MetricCard
        :label="t('monitor.detailMetricTrace')"
        :value="compactIdentifier(row.traceId)"
        :copy-value="row.traceId || ''"
        :description="row.traceId || t('jobInstanceDetail.metricTraceEmpty')"
      />
      <MetricCard
        :label="t('monitor.detailMetricQueue')"
        :value="row.queueCode || '—'"
        :description="t('jobInstanceDetail.metricQueueDescription')"
      />
    </div>

    <JobExecutionPanel v-if="row" :job-id="instanceId" @snapshot="acceptExecutionProgress" />

    <el-tabs v-if="row" v-model="activeTab" class="detail-tabs">
      <!-- Tab 1: 概览 -->
      <el-tab-pane name="overview" :label="t('monitor.detailTabOverview')">
        <SectionCard v-if="row.parentInstanceId || row.relatedFileId || row.failureClass">
          <template #header>{{ t('monitor.detailRelatedSection') }}</template>
          <el-descriptions class="detail-descriptions" :column="2" border size="small">
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
          <el-descriptions class="detail-descriptions" :column="2" border size="small">
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
              fmtDatetime(row.slaAlertedAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailRerun')">
              {{ row.rerunFlag ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('monitor.detailRetry')">
              {{ row.retryFlag ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
          </el-descriptions>
        </SectionCard>

        <SectionCard v-if="diagnosisResult">
          <template #header>{{ t('monitor.detailDiagnosisSection') }}</template>
          <JsonPreview :data="diagnosisResult" />
        </SectionCard>

        <SectionCard>
          <template #header>{{ t('monitor.detailParamsSection') }}</template>
          <el-descriptions class="detail-descriptions" :column="1" border size="small">
            <el-descriptions-item :label="t('jobInstanceDetail.paramsSnapshot')">
              <JsonPreview :data="row.paramsSnapshot" />
            </el-descriptions-item>
            <el-descriptions-item :label="t('jobInstanceDetail.resultSummary')">
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
            <div class="steps-section-header">
              <span>{{ t('monitor.detailTabSteps') }}</span>
              <div class="steps-section-header__actions">
                <el-button
                  text
                  :icon="stepsTableView ? GitBranch : List"
                  :aria-pressed="stepsTableView"
                  @click="stepsTableView = !stepsTableView"
                >
                  {{
                    stepsTableView
                      ? t('jobInstanceDetail.stepsTimelineView')
                      : t('jobInstanceDetail.stepsTableView')
                  }}
                </el-button>
                <el-button text type="primary" @click="goSteps">
                  {{ t('monitor.detailOpenStandalone') }}
                </el-button>
              </div>
            </div>
          </template>
          <el-alert
            v-if="stepsLoadError"
            type="error"
            show-icon
            :closable="false"
            :title="t('jobInstanceDetail.stepsLoadFailed')"
          >
            <template #default>
              <el-button link type="primary" @click="loadSteps">{{ t('common.retry') }}</el-button>
            </template>
          </el-alert>
          <div v-else-if="showInitialStepsLoading" v-loading="true" class="steps-loading" />
          <el-timeline v-else-if="!stepsTableView && orderedSteps.length" class="steps-timeline">
            <el-timeline-item
              v-for="step in orderedSteps"
              :key="step.id"
              :type="stepTimelineTone(step.stepStatus)"
              :timestamp="fmtDatetime(step.startedAt)"
              :hollow="!step.finishedAt"
            >
              <div class="step-event">
                <div class="step-event__heading">
                  <strong>{{ step.stepCode }}</strong>
                  <StatusTag :value="String(step.stepStatus ?? '')" category="partition" />
                </div>
                <div class="step-event__meta">
                  <span>{{ step.stepType }}</span>
                  <span>{{ t('monitor.stepColRetry') }}: {{ step.retryCount ?? 0 }}</span>
                  <span v-if="stepDuration(step)">{{ stepDuration(step) }}</span>
                  <span v-if="step.finishedAt">{{ fmtDatetime(step.finishedAt) }}</span>
                </div>
                <div v-if="step.errorCode || step.errorMessage" class="step-event__error">
                  <code v-if="step.errorCode">{{ step.errorCode }}</code>
                  <span v-if="step.errorMessage">{{ step.errorMessage }}</span>
                </div>
                <router-link
                  v-if="step.relatedPipelineInstanceId"
                  class="cell-link"
                  :to="`/files/pipeline-obs?pipelineInstanceId=${step.relatedPipelineInstanceId}`"
                >
                  {{ t('monitor.stepViewPipelineProgress') }}
                </router-link>
              </div>
            </el-timeline-item>
          </el-timeline>
          <EmptyState
            v-else-if="!stepsTableView && !stepsLoading"
            :description="t('common.noData')"
            :image-size="56"
          />
          <div v-else-if="stepsTableView" class="detail-table-wrap">
            <el-table
              v-loading="stepsLoading"
              :data="stepsRows"
              size="small"
              empty-text="—"
              stripe
              table-layout="fixed"
              class="console-table detail-table detail-table--steps"
            >
              <el-table-column prop="stepCode" :label="t('monitor.stepColStep')" min-width="180" />
              <el-table-column :label="t('monitor.stepColStatus')" width="120">
                <template #default="{ row: s }">
                  <StatusTag :value="String(s.stepStatus ?? '')" category="partition" />
                </template>
              </el-table-column>
              <el-table-column
                prop="retryCount"
                :label="t('monitor.stepColRetry')"
                width="80"
                align="right"
              />
              <el-table-column :label="t('monitor.stepColPipelineProgress')" width="180">
                <template #default="{ row: s }">
                  <router-link
                    v-if="s.relatedPipelineInstanceId"
                    class="cell-link"
                    :to="`/files/pipeline-obs?pipelineInstanceId=${s.relatedPipelineInstanceId}`"
                  >
                    {{ t('monitor.stepViewPipelineProgress') }}
                  </router-link>
                  <span v-else class="cell-empty">—</span>
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
          </div>
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
            <EmptyState :description="t('jobInstanceDetail.heartbeatNoTasks')" :image-size="60" />
          </div>
          <div v-else class="hb-wrap">
            <div class="hb-picker">
              <label class="hb-picker__label" for="heartbeat-task-picker">
                {{ t('jobInstanceDetail.heartbeatPickStep') }}
              </label>
              <el-select
                id="heartbeat-task-picker"
                v-model="selectedTaskId"
                size="small"
                class="hb-picker__select"
              >
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
          <div class="detail-table-wrap">
            <el-table
              v-loading="recentLoading"
              :data="recentRows"
              size="small"
              empty-text="—"
              stripe
              table-layout="fixed"
              class="console-table detail-table detail-table--recent"
            >
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
              <el-table-column
                prop="bizDate"
                :label="t('monitor.detailMetricBizDate')"
                width="120"
              />
              <el-table-column :label="t('monitor.detailMetricStatus')" width="120">
                <template #default="{ row: r }">
                  <StatusTag :value="String(r.instanceStatus ?? '')" category="instance" />
                </template>
              </el-table-column>
              <el-table-column :label="t('monitor.detailStarted')" width="170">
                <template #default="{ row: r }">{{ fmtDatetime(r.startedAt) }}</template>
              </el-table-column>
              <el-table-column :label="t('monitor.detailFinished')" width="170">
                <template #default="{ row: r }">{{ fmtDatetime(r.finishedAt) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </SectionCard>
      </el-tab-pane>
    </el-tabs>

    <SectionCard v-else-if="!loading">
      <EmptyState :description="t('monitor.detailEmpty')" />
    </SectionCard>

    <el-drawer
      v-model="diagnosisDrawerOpen"
      :title="t('monitor.detailDiagnosisSection')"
      size="720px"
      direction="rtl"
    >
      <JsonPreview v-if="diagnosisResult" :data="diagnosisResult" />
      <EmptyState v-else :description="t('monitor.detailDiagnosisEmpty')" />
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDatetime, fmtDuration } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { GitBranch, List, RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import { usePermission } from '@/composables/usePermission'
  import { runLifecycleAction } from '@/utils/runControls'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { diagnoseJobInstance } from '@/api/clusterDiagnostic'
  import { instanceApi } from '@/api/instance'
  import {
    canCancelInstance,
    canTerminateInstance,
    resolveInstanceCancelOutcome,
  } from '@/utils/instanceAction'
  import JobExecutionPanel from '@/components/job/JobExecutionPanel.vue'
  import type { JobExecutionProgress } from '@/api/jobProgress'
  import type { DeepReadonly } from 'vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useAuthStore } from '@/stores/auth'
  import { TERMINAL_INSTANCE_STATUSES } from './jobInstanceBulk'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import PrintButton from '@/components/common/PrintButton.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import HeartbeatProgressPanel from '@/components/heartbeat/HeartbeatProgressPanel.vue'
  import type {
    ConsoleJobInstanceResponse,
    ConsoleJobStepInstanceResponse,
  } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const mainScope = useTenantRequestScope()
  const stepsScope = useTenantRequestScope()
  const recentScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const diagnosisScope = useTenantRequestScope()
  const { canManageSystem, canWriteSystem } = usePermission()
  const lifecycleAction = computed(() =>
    runLifecycleAction(row.value?.instanceStatus, canWriteSystem.value),
  )
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()
  const loading = ref(false)
  const rerunLoading = ref(false)
  const cancelLoading = ref(false)
  const lifecycleLoading = ref(false)
  const terminateLoading = ref(false)
  const diagnosisLoading = ref(false)
  const retryFailedPartitionsLoading = ref(false)
  const diagnosisDrawerOpen = ref(false)
  const diagnosisResult = ref<Record<string, unknown> | null>(null)
  const row = ref<ConsoleJobInstanceResponse | null>(null)

  // 终态实例不能取消/终止(BE 会 409 STATE_CONFLICT「cannot transition from FAILED/SUCCESS...」)——
  // 按钮禁用,避免用户点了"没反应"(重跑不受此限,失败实例可重跑)。
  const TERMINAL_STATUSES = TERMINAL_INSTANCE_STATUSES
  const isTerminal = computed(() => TERMINAL_STATUSES.includes(row.value?.instanceStatus ?? ''))
  const RETRY_FAILED_PARTITION_STATUSES = ['FAILED', 'PARTIAL_FAILED', 'ERROR']
  const canRetryFailedPartitions = computed(() =>
    RETRY_FAILED_PARTITION_STATUSES.includes(row.value?.instanceStatus ?? ''),
  )

  const activeTab = ref<'overview' | 'steps' | 'heartbeat' | 'recent'>('overview')
  const stepsLoading = ref(false)
  const stepsLoadError = ref(false)
  const stepsRows = ref<ConsoleJobStepInstanceResponse[]>([])
  const stepsTableView = ref(false)
  const orderedSteps = computed(() =>
    [...stepsRows.value].sort((a, b) => {
      const aStart = Date.parse(a.startedAt)
      const bStart = Date.parse(b.startedAt)
      const bothStartTimesAreValid = Number.isFinite(aStart) && Number.isFinite(bStart)
      const startTimesCanDetermineOrder = bothStartTimesAreValid && aStart !== bStart
      if (startTimesCanDetermineOrder) return aStart - bStart
      return a.id - b.id
    }),
  )
  const showInitialStepsLoading = computed(
    () => !stepsTableView.value && stepsLoading.value && !orderedSteps.value.length,
  )
  const stepsLoaded = ref(false)
  const recentLoading = ref(false)
  const recentRows = ref<ConsoleJobInstanceResponse[]>([])
  const recentLoaded = ref(false)

  function compactIdentifier(value: string | null | undefined, head = 14, tail = 8): string {
    const text = value?.trim()
    if (!text) return '—'
    if (text.length <= head + tail + 3) return text
    return `${text.slice(0, head)}...${text.slice(-tail)}`
  }

  function statusTone(
    status: string | null | undefined,
  ): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
    const s = (status ?? '').toUpperCase()
    if (['SUCCESS', 'COMPLETED', 'SUCCEEDED'].includes(s)) return 'success'
    if (['FAILED', 'ERROR', 'CANCELLED', 'CANCELED'].includes(s)) return 'danger'
    if (['RUNNING', 'EXECUTING', 'CLAIMED', 'DISPATCHED'].includes(s)) return 'info'
    if (['WAITING', 'PENDING', 'QUEUED', 'PAUSED', 'COMPENSATING'].includes(s)) return 'warning'
    return 'neutral'
  }

  function stepTimelineTone(status: string | null | undefined) {
    const tone = statusTone(status)
    return tone === 'neutral' ? 'info' : tone
  }

  function stepDuration(step: ConsoleJobStepInstanceResponse): string {
    const start = Date.parse(step.startedAt)
    const finish = Date.parse(step.finishedAt)
    const hasValidDurationRange =
      Number.isFinite(start) && Number.isFinite(finish) && finish >= start
    return hasValidDurationRange ? fmtDuration(finish - start) : ''
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
    const heartbeatStepsNeedLoading =
      tab === 'heartbeat' && !stepsLoaded.value && !stepsLoading.value
    if (heartbeatStepsNeedLoading) {
      await loadSteps()
    }
  })

  async function loadSteps() {
    if (!row.value || !Number.isFinite(instanceId.value)) return
    const scope = stepsScope.begin()
    const targetId = instanceId.value
    const isCurrent = () => stepsScope.isCurrent(scope) && instanceId.value === targetId
    stepsLoading.value = true
    stepsLoadError.value = false
    try {
      const result = await instanceApi.partitions(targetId, scope.tenantId)
      if (!isCurrent()) return
      stepsRows.value = result
      stepsLoaded.value = true
    } catch {
      if (!isCurrent()) return
      stepsRows.value = []
      stepsLoadError.value = true
    } finally {
      if (isCurrent()) stepsLoading.value = false
    }
  }

  async function loadRecent() {
    if (!row.value?.jobCode) return
    const scope = recentScope.begin()
    const targetId = instanceId.value
    const jobCode = row.value.jobCode
    const isCurrent = () => recentScope.isCurrent(scope) && instanceId.value === targetId
    recentLoading.value = true
    try {
      const page = await instanceApi.list({
        tenantId: scope.tenantId,
        jobCode,
        page: 1,
        pageSize: 10,
      })
      if (!isCurrent()) return
      recentRows.value = page.records ?? []
      recentLoaded.value = true
    } catch {
      if (isCurrent()) recentRows.value = []
    } finally {
      if (isCurrent()) recentLoading.value = false
    }
  }

  watch(activeTab, (tab) => {
    if (tab === 'steps' && !stepsLoaded.value) void loadSteps()
    if (tab === 'recent' && !recentLoaded.value) void loadRecent()
  })

  const instanceId = computed(() => Number(route.params.id))

  const headerDesc = computed(() => {
    if (!row.value) return t('monitor.detailLoading')
    return `${row.value.jobCode} · ${row.value.bizDate || '—'} · ${row.value.instanceNo}`
  })

  let loadSequence = 0
  let progressRevision = 0
  function acceptExecutionProgress(data: DeepReadonly<JobExecutionProgress>) {
    if (data.tenantId !== tenant.tenantId || data.jobInstanceId !== instanceId.value) return
    progressRevision++
    const current = row.value
    if (current && current.id === data.jobInstanceId)
      row.value = {
        ...current,
        instanceStatus: data.instanceStatus,
        startedAt: data.startedAt ?? '',
        finishedAt: data.finishedAt ?? '',
      }
  }
  let activeLoadKey: string | null = null
  let activeLoadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (!Number.isFinite(instanceId.value) || !tenant.tenantId) return
    const loadKey = `${tenant.tenantId}:${instanceId.value}`
    if (activeLoadKey === loadKey && activeLoadPromise) return activeLoadPromise

    const sequence = ++loadSequence
    const scope = mainScope.begin()
    const revision = progressRevision
    const current = () =>
      mainScope.isCurrent(scope) &&
      sequence === loadSequence &&
      loadKey === `${tenant.tenantId}:${instanceId.value}`
    const request = (async () => {
      loading.value = true
      try {
        const result = await instanceApi.detail(instanceId.value, tenant.tenantId)
        if (current())
          row.value =
            revision === progressRevision || !row.value
              ? result
              : {
                  ...result,
                  instanceStatus: row.value.instanceStatus,
                  startedAt: row.value.startedAt,
                  finishedAt: row.value.finishedAt,
                }
      } catch {
        if (current()) row.value = null
      } finally {
        if (current()) loading.value = false
        if (activeLoadKey === loadKey) {
          activeLoadKey = null
          activeLoadPromise = null
        }
      }
    })()
    activeLoadKey = loadKey
    activeLoadPromise = request
    return request
  }

  function goSteps() {
    router.push(`/monitor/job-instances/${instanceId.value}/partitions`)
  }

  function goLogs() {
    const t = row.value?.traceId
    router.push({ path: '/observability/trace', query: t ? { traceId: t } : {} })
  }

  /** 危险确认、原因输入和响应均绑定当时的租户、实例及操作者。 */
  function captureInstanceAction(target: ConsoleJobInstanceResponse) {
    const scope = actionScope.begin()
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrentTarget = () =>
      actionScope.isCurrent(scope) &&
      instanceId.value === target.id &&
      row.value?.id === target.id &&
      (auth.userInfo?.username ?? auth.userInfo?.userId) === operator
    return {
      tenantId: scope.tenantId,
      isCurrentTarget,
      isCurrent: () => isCurrentTarget() && canWriteSystem.value,
    }
  }

  async function confirmRerun() {
    if (!canWriteSystem.value) return
    if (!ensureWriteAvailable()) return
    const r = row.value
    if (!r) return
    const action = captureInstanceAction(r)
    try {
      await confirmDanger({
        verb: t('monitor.rerunConfirmVerb'),
        target: t('monitor.confirmInstanceTarget', { no: r.instanceNo }),
        consequence: t('monitor.rerunConfirmConsequence'),
        confirmButtonText: t('monitor.rerunConfirmButton'),
      })
    } catch {
      return
    }
    if (!action.isCurrent() || !isTerminal.value) return
    rerunLoading.value = true
    try {
      await instanceApi.retry(r.instanceNo, action.tenantId, r.jobCode, r.bizDate)
      if (!action.isCurrent()) return
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
      if (action.isCurrentTarget()) rerunLoading.value = false
    }
  }

  async function runDiagnosis() {
    if (!Number.isFinite(instanceId.value) || !tenant.tenantId) return
    const scope = diagnosisScope.begin()
    const targetId = instanceId.value
    const isCurrent = () => diagnosisScope.isCurrent(scope) && instanceId.value === targetId
    diagnosisLoading.value = true
    try {
      const result = await diagnoseJobInstance(targetId, scope.tenantId)
      if (!isCurrent()) return
      diagnosisResult.value = result
      diagnosisDrawerOpen.value = true
    } finally {
      if (isCurrent()) diagnosisLoading.value = false
    }
  }

  async function confirmRetryFailedPartitions() {
    if (!canWriteSystem.value) return
    if (!ensureWriteAvailable()) return
    const r = row.value
    if (!r) return
    const action = captureInstanceAction(r)
    try {
      await confirmDanger({
        verb: t('monitor.detailRetryFailedPartitions'),
        target: t('monitor.detailRetryFailedPartitionsTarget', { no: r.instanceNo }),
        consequence: t('monitor.detailRetryFailedPartitionsConsequence'),
        confirmButtonText: t('common.confirm'),
      })
    } catch {
      return
    }
    if (!action.isCurrent() || !canRetryFailedPartitions.value) return
    retryFailedPartitionsLoading.value = true
    try {
      const result = await instanceApi.retryFailedPartitions(r.id, action.tenantId)
      if (!action.isCurrent()) return
      diagnosisResult.value = result
      diagnosisDrawerOpen.value = true
      ElMessage.success(t('monitor.detailRetryFailedPartitionsOk'))
      await Promise.all([load(), loadSteps()])
    } finally {
      if (action.isCurrentTarget()) retryFailedPartitionsLoading.value = false
    }
  }

  async function changeLifecycle() {
    const action = lifecycleAction.value
    const target = row.value
    if (!action || !target || !canWriteSystem.value) return
    const context = captureInstanceAction(target)
    try {
      await confirmDanger({
        verb: t(`runControl.${action}`),
        target: target.instanceNo,
        consequence: t(`runControl.${action}Hint`),
      })
      if (!context.isCurrent() || action !== lifecycleAction.value) return
      lifecycleLoading.value = true
      await instanceApi[action](target.id, context.tenantId)
      if (context.isCurrent()) await load()
    } catch {
      /* 取消或接口错误由确认框/统一拦截器处理。 */
    } finally {
      if (context.isCurrentTarget()) lifecycleLoading.value = false
    }
  }

  async function confirmCancel() {
    if (!canWriteSystem.value) return
    if (!ensureWriteAvailable()) return
    const r = row.value
    if (!r) return
    const action = captureInstanceAction(r)
    const isRunning = r.instanceStatus === 'RUNNING'
    try {
      await confirmDanger({
        verb: t(isRunning ? 'monitor.cancelConfirmRequestVerb' : 'monitor.cancelConfirmVerb'),
        target: t('monitor.confirmInstanceTarget', { no: r.instanceNo }),
        consequence: t(
          isRunning ? 'monitor.cancelRunningConsequence' : 'monitor.cancelQueuedConsequence',
        ),
        irreversible: true,
        confirmButtonText: t(
          isRunning ? 'monitor.cancelConfirmButton' : 'monitor.cancelConfirmQueuedButton',
        ),
      })
    } catch {
      return
    }
    if (!action.isCurrent() || !canCancelInstance(row.value?.instanceStatus ?? '')) return
    cancelLoading.value = true
    try {
      const result = await instanceApi.cancel(r.id, action.tenantId)
      if (!action.isCurrent()) return
      const outcome = resolveInstanceCancelOutcome(result.status)
      if (outcome === 'requested') {
        ElMessage.success(
          t('monitor.instanceCancelRequested', {
            no: r.instanceNo,
            count: result.cancelRequestedTasks ?? 0,
          }),
        )
      } else if (outcome === 'completed') {
        ElMessage.success(t('monitor.instanceCanceled', { no: r.instanceNo }))
      } else {
        ElMessage.success(
          t('monitor.instanceCancelAccepted', { no: r.instanceNo, status: result.status }),
        )
      }
      await load()
    } finally {
      if (action.isCurrentTarget()) cancelLoading.value = false
    }
  }

  async function confirmTerminate() {
    if (!canWriteSystem.value) return
    if (!ensureWriteAvailable()) return
    const r = row.value
    if (!r) return
    const action = captureInstanceAction(r)
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
    if (!action.isCurrent() || !canTerminateInstance(row.value?.instanceStatus ?? '')) return
    terminateLoading.value = true
    try {
      await instanceApi.terminate(r.id, action.tenantId)
      if (!action.isCurrent()) return
      ElMessage.success(t('monitor.terminateSuccess', { no: r.instanceNo }))
      await load()
    } finally {
      if (action.isCurrentTarget()) terminateLoading.value = false
    }
  }

  function reloadInstanceScope() {
    const targetTenantId = tenant.tenantId
    const targetInstanceId = instanceId.value
    row.value = null
    progressRevision = 0
    // 切到不同实例时,steps/recent 数据要重新拉,但只在当前 tab 触发,避免无谓请求
    stepsLoaded.value = false
    recentLoaded.value = false
    stepsRows.value = []
    recentRows.value = []
    // load() reject 不应升级为 unhandled rejection;失败时也尝试拉 tab 数据(其中
    // load 内部已 toast 提示,这里只静默 catch)。
    load()
      .then(() => {
        if (tenant.tenantId !== targetTenantId || instanceId.value !== targetInstanceId) return
        if (activeTab.value === 'steps') void loadSteps()
        else if (activeTab.value === 'recent') void loadRecent()
      })
      .catch(() => {
        /* 已在 load() 内 toast 提示,无需重复 */
      })
  }
  watch(
    [instanceId, () => tenant.tenantId],
    () => {
      loadSequence += 1
      mainScope.begin()
      stepsScope.begin()
      recentScope.begin()
      actionScope.begin()
      diagnosisScope.begin()
      activeLoadKey = null
      activeLoadPromise = null
      row.value = null
      stepsRows.value = []
      recentRows.value = []
      stepsLoaded.value = false
      recentLoaded.value = false
      loading.value = false
      stepsLoading.value = false
      recentLoading.value = false
      rerunLoading.value = false
      cancelLoading.value = false
      lifecycleLoading.value = false
      terminateLoading.value = false
      retryFailedPartitionsLoading.value = false
      diagnosisLoading.value = false
      diagnosisDrawerOpen.value = false
      diagnosisResult.value = null
    },
    { flush: 'sync' },
  )
  watch(instanceId, reloadInstanceScope)
  useTenantReload(reloadInstanceScope)

  /**
   * 详情页快捷键(oncall 高频):
   *   r → rerun(仅 FAILED 时)
   *   l → 跳 logs
   *   s → 看 steps/分区
   *   esc → 智能返回
   * 在 input/textarea/contenteditable 内不触发,避免吞输入。
   */
  function onKey(e: KeyboardEvent) {
    const hasShortcutModifier = e.metaKey || e.ctrlKey || e.altKey
    if (hasShortcutModifier) return
    const tgt = e.target as HTMLElement | null
    if (tgt) {
      const tag = tgt.tagName
      const eventTargetsEditableContent =
        tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable
      if (eventTargetsEditableContent) return
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
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: var(--space-md);
  }

  .detail-grid :deep(.metric-card) {
    min-height: 82px;
    border-radius: var(--radius-content);
  }

  .detail-grid :deep(.metric-card .el-card__body) {
    padding: 11px 12px 10px;
  }

  .detail-grid :deep(.metric-card__label) {
    margin-bottom: 5px;
    font-size: 12px;
  }

  .detail-grid :deep(.metric-card__value) {
    font-size: 18px;
  }

  .detail-grid :deep(.metric-card__value--long) {
    font-size: 14px;
  }

  .detail-grid :deep(.metric-card__description) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-descriptions :deep(.el-descriptions__label) {
    width: 132px;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .detail-descriptions :deep(.el-descriptions__content) {
    min-width: 0;
    word-break: break-word;
  }

  .detail-table-wrap {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .steps-section-header,
  .steps-section-header__actions,
  .step-event__heading,
  .step-event__meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .steps-section-header {
    justify-content: space-between;
    width: 100%;
    min-width: 0;
  }

  .steps-section-header__actions {
    flex-wrap: wrap;
  }

  .steps-timeline {
    max-width: 58rem;
    padding-top: var(--space-sm);
  }

  .steps-loading {
    min-height: 8rem;
  }

  .step-event {
    display: grid;
    gap: var(--space-xs);
    min-width: 0;
    padding: 0 0 var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .steps-timeline :deep(.el-timeline-item:last-child .step-event) {
    border-bottom: 0;
  }

  .step-event__heading,
  .step-event__meta {
    flex-wrap: wrap;
  }

  .step-event__heading {
    justify-content: space-between;
  }

  .step-event__meta {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .step-event__meta > span + span::before {
    content: '·';
    margin-right: var(--space-xs);
    color: var(--color-text-tertiary);
  }

  .step-event__error {
    display: grid;
    gap: var(--space-xs);
    color: var(--color-danger);
    overflow-wrap: anywhere;
  }

  .step-event__error code {
    font-family: var(--font-family-mono);
  }

  .detail-table {
    width: 100%;
  }

  .detail-table--steps {
    min-width: 1080px;
  }

  .detail-table--recent {
    min-width: 820px;
  }

  .detail-tabs :deep(.el-tabs__header) {
    margin-bottom: var(--space-md);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    margin-top: var(--space-md);
  }

  .action-group {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .action-group :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .action-group--danger {
    margin-left: auto;
  }

  .action-button-wrap {
    display: inline-flex;
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
    gap: 16px;
  }

  .hb-picker {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .hb-picker__label {
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .hb-picker__select {
    width: min(440px, 100%);
    max-width: 100%;
  }

  @media (max-width: 1100px) {
    .detail-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .action-group--danger {
      margin-left: 0;
    }

    .hb-picker {
      align-items: stretch;
      flex-direction: column;
      gap: 6px;
    }
  }
</style>
