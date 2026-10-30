<template>
  <PageContainer>
    <PageHeader />
    <el-alert
      v-if="progressUnavailable"
      class="pipeline-stage-error"
      type="warning"
      show-icon
      :closable="false"
      :title="t('filePipelineObservability.progressUnavailable')"
    />

    <el-alert
      v-if="fileSummaryUnavailable"
      type="warning"
      show-icon
      :closable="false"
      :title="t('filePipelineObservability.fileSummaryUnavailable')"
    />

    <div v-if="currentFile" class="current-file-bar">
      <span class="current-file-bar__label">{{ t('filePipelineObservability.currentFile') }}</span>
      <span v-if="currentFile.fileName" class="current-file-bar__name">
        {{ currentFile.fileName }}
      </span>
      <router-link
        v-if="currentFile.fileId"
        class="cell-link"
        :to="`/files/list?fileId=${currentFile.fileId}`"
      >
        #{{ currentFile.fileId }}
      </router-link>
      <span v-if="!currentFile.fileName && !currentFile.fileId" class="muted">—</span>
    </div>

    <el-tabs v-model="activeTab" class="pill-tabs" @tab-change="onTabChange">
      <el-tab-pane :label="t('filePipelineObservability.tabPipelines')" name="pipelines">
        <div class="pipeline-workspace" :class="{ 'pipeline-workspace--empty': !selectedPipeline }">
          <ProTable
            class="pipeline-workspace__master"
            :data="pipelineRows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
            @change="onPageChange"
            :error="loadError"
            :on-retry="loadPipelines"
            @row-click="selectPipeline"
          >
            <template #toolbar>
              <OpsListToolbar
                :status="live.status.value"
                :last-refreshed-at="live.lastRefreshedAt.value"
              />
            </template>
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="onReset"
                @refresh="() => runRefresh(reloadTab)"
              >
                <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    :placeholder="t('filePipelineObservability.pipelinesKw')"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
            <el-table-column
              prop="jobCode"
              :label="t('filePipelineObservability.colJob')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              prop="pipelineType"
              :label="t('filePipelineObservability.colType')"
              width="110"
            />
            <el-table-column
              prop="runStatus"
              :label="t('filePipelineObservability.colStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
              </template>
            </el-table-column>
            <el-table-column
              prop="currentStage"
              :label="t('filePipelineObservability.colCurrentStage')"
              width="120"
              show-overflow-tooltip
            />
            <DatetimeColumn
              prop="startedAt"
              :label="t('filePipelineObservability.colStart')"
              width="160"
            />
            <el-table-column :label="t('common.detail')" width="76" fixed="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="primary"
                  :icon="Eye"
                  :aria-label="t('common.detail')"
                  :aria-pressed="selectedPipeline?.id === row.id"
                  @click="selectPipeline(row as ConsoleFilePipelineResponse)"
                />
              </template>
            </el-table-column>
          </ProTable>
          <el-alert
            v-if="selectedPipelineProgress && !selectedPipelineProgress.stageGraphAvailable"
            :title="t('filePipelineObservability.stageVersionUnavailable')"
            type="warning"
            :closable="false"
          />
          <SelectedPipelinePanel
            v-if="selectedPipeline"
            :pipeline="selectedPipelineDisplay!"
            :stages="selectedStages"
            :selected-code="selectedStageCode"
            :loading="selectedStepsLoading"
            :load-error="Boolean(selectedStepLoadError)"
            @stage-click="focusStage"
            @retry="reloadSelectedSteps"
          />
          <div v-else-if="pipelineRows.length" class="pipeline-workspace__hint">
            <EmptyState
              :description="t('filePipelineObservability.selectRunHint')"
              :image-size="64"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('filePipelineObservability.tabSteps')" name="steps">
        <ProTable
          :data="stepRows"
          :loading="tableBlocking"
          :error="stepLoadError"
          :on-retry="loadSteps"
          :total="total"
          v-model:page="page"
          v-model:page-size="pageSize"
          @change="onPageChange"
        >
          <template #toolbar>
            <OpsListToolbar
              :status="live.status.value"
              :last-refreshed-at="progressLastSucceededAt"
            />
          </template>
          <template #query>
            <ListPageQueryBar
              :filter-busy="queryActionBusy"
              :refresh-busy="loading"
              :disabled="loading"
              @search="onSearch"
              @reset="onReset"
              @refresh="() => runRefresh(reloadTab)"
            >
              <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                <el-input
                  class="query-w-280"
                  v-model="kwDraft"
                  clearable
                  :placeholder="t('filePipelineObservability.stepsKw')"
                  @keyup.enter="onSearch"
                />
              </el-form-item>
              <el-form-item :label="t('filePipelineObservability.colToggleHint')">
                <el-checkbox v-model="showProgressColumns">
                  {{ t('filePipelineObservability.colRowsProcessed') }} /
                  {{ t('filePipelineObservability.colTotalRowsEta') }}
                </el-checkbox>
              </el-form-item>
            </ListPageQueryBar>
          </template>
          <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
          <el-table-column
            prop="pipelineInstanceId"
            :label="t('filePipelineObservability.colPipelineInstance')"
            width="120"
          />
          <el-table-column
            prop="stepCode"
            :label="t('filePipelineObservability.colStep')"
            width="120"
          />
          <el-table-column
            prop="stageCode"
            :label="t('filePipelineObservability.colStage')"
            width="120"
          />
          <el-table-column
            prop="runSeq"
            :label="t('filePipelineObservability.colSeq')"
            width="70"
            align="right"
          />
          <el-table-column
            prop="stepStatus"
            :label="t('filePipelineObservability.colStatus')"
            width="120"
          >
            <template #default="{ row }">
              <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
            </template>
          </el-table-column>
          <el-table-column
            prop="retryCount"
            :label="t('filePipelineObservability.colRetry')"
            width="72"
            align="right"
          />
          <el-table-column
            v-if="showProgressColumns"
            :label="t('filePipelineObservability.colRowsProcessed')"
            width="110"
            align="right"
          >
            <template #default="{ row }">
              {{ formatProcessed(row as ConsoleFilePipelineStepResponse) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showProgressColumns"
            :label="t('filePipelineObservability.colTotalRowsEta')"
            width="170"
          >
            <template #default="{ row }">
              {{ formatTotalEta(row as ConsoleFilePipelineStepResponse) }}
            </template>
          </el-table-column>
          <DatetimeColumn
            prop="startedAt"
            :label="t('filePipelineObservability.colStart')"
            width="160"
          />
          <DatetimeColumn
            prop="finishedAt"
            :label="t('filePipelineObservability.colDone')"
            width="160"
          />
          <el-table-column
            :label="t('filePipelineObservability.colError')"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
              <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
              <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="durationMs"
            :label="t('filePipelineObservability.colDurationMs')"
            width="100"
            align="right"
          />
        </ProTable>
      </el-tab-pane>

      <el-tab-pane :label="t('filePipelineObservability.tabDispatches')" name="dispatches">
        <ProTable
          :data="dispatchRows"
          :loading="tableBlocking"
          :total="total"
          v-model:page="page"
          v-model:page-size="pageSize"
          @change="onPageChange"
        >
          <template #query>
            <ListPageQueryBar
              :filter-busy="queryActionBusy"
              :refresh-busy="loading"
              :disabled="loading"
              @search="onSearch"
              @reset="onReset"
              @refresh="() => runRefresh(reloadTab)"
            >
              <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                <el-input
                  class="query-w-280"
                  v-model="kwDraft"
                  clearable
                  :placeholder="t('filePipelineObservability.dispatchesKw')"
                  @keyup.enter="onSearch"
                />
              </el-form-item>
            </ListPageQueryBar>
          </template>
          <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
          <el-table-column
            prop="fileId"
            :label="t('filePipelineObservability.colFileId')"
            width="88"
          />
          <el-table-column
            prop="pipelineInstanceId"
            :label="t('filePipelineObservability.colPipeline')"
            width="100"
          />
          <el-table-column
            prop="dispatchStatus"
            :label="t('filePipelineObservability.colStatus')"
            width="120"
          >
            <template #default="{ row }">
              <StatusTag :value="String(row.dispatchStatus ?? '')" category="outboxPublishStatus" />
            </template>
          </el-table-column>
          <el-table-column
            prop="channelCode"
            :label="t('filePipelineObservability.colChannel')"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="dispatchTarget"
            :label="t('filePipelineObservability.colTarget')"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="dispatchAttempt"
            :label="t('filePipelineObservability.colAttempt')"
            width="70"
            align="right"
          />
          <el-table-column
            prop="receiptStatus"
            :label="t('filePipelineObservability.colReceipt')"
            width="100"
          />
          <el-table-column
            prop="receiptCode"
            :label="t('filePipelineObservability.colReceiptCode')"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="externalRequestId"
            :label="t('filePipelineObservability.colExternalReqId')"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column
            :label="t('filePipelineObservability.colError')"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
              <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
              <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
            </template>
          </el-table-column>
          <DatetimeColumn
            prop="dispatchedAt"
            :label="t('filePipelineObservability.colDispatchedAt')"
            width="160"
          />
          <DatetimeColumn
            prop="ackAt"
            :label="t('filePipelineObservability.colAckAt')"
            width="160"
          />
        </ProTable>
      </el-tab-pane>

      <el-tab-pane :label="t('filePipelineObservability.tabErrors')" name="errors">
        <ProTable
          :data="errorRows"
          :loading="tableBlocking"
          :total="total"
          v-model:page="page"
          v-model:page-size="pageSize"
          @change="onPageChange"
        >
          <template #query>
            <ListPageQueryBar
              :filter-busy="queryActionBusy"
              :refresh-busy="loading"
              :disabled="loading"
              @search="onSearch"
              @reset="onReset"
              @refresh="() => runRefresh(reloadTab)"
            >
              <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                <el-input
                  class="query-w-280"
                  v-model="kwDraft"
                  clearable
                  :placeholder="t('filePipelineObservability.errorsKw')"
                  @keyup.enter="onSearch"
                />
              </el-form-item>
            </ListPageQueryBar>
          </template>
          <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
          <el-table-column
            prop="fileId"
            :label="t('filePipelineObservability.colFileId')"
            width="88"
          />
          <el-table-column
            prop="recordNo"
            :label="t('filePipelineObservability.colRecordNo')"
            width="80"
            align="right"
          />
          <el-table-column
            prop="errorCode"
            :label="t('filePipelineObservability.colErrorCode')"
            width="120"
          />
          <el-table-column
            prop="errorStage"
            :label="t('filePipelineObservability.colStage')"
            width="100"
          />
          <el-table-column
            prop="errorMessage"
            :label="t('filePipelineObservability.colErrorMessage')"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column :label="t('filePipelineObservability.colSkipped')" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.skipped" size="small" type="warning" effect="plain">
                {{ t('filePipelineObservability.tagSkipped')
                }}{{ row.skipAction ? `(${row.skipAction})` : '' }}
              </el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <DatetimeColumn
            prop="createdAt"
            :label="t('filePipelineObservability.colTime')"
            width="160"
          />
        </ProTable>
      </el-tab-pane>
    </el-tabs>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
  import { Eye } from '@lucide/vue'
  import { fetchAllPageItems } from '@/api/adapters'
  import {
    queryFileDispatchPage,
    queryFileErrorPage,
    queryFilePipelinePage,
    queryFilePipelineStepPage,
  } from '@/api/filePipelineQuery'

  const { t, te } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import SelectedPipelinePanel from './components/SelectedPipelinePanel.vue'
  import type {
    ConsoleFileDispatchRecordResponse,
    ConsoleFileErrorRecordResponse,
    ConsoleFilePipelineResponse,
    ConsoleFilePipelineStepResponse,
  } from '@/types/console-api'
  import { getPipelineProgressSnapshot } from '@/api/pipelineProgress'
  import { useLivePipelineProgress } from '@/composables/useLivePipelineProgress'
  import { processedCountFromSummary } from '@/utils/pipelineStepSummary'
  import { fmtNumber } from '@/utils/number'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { pipelineStageCodes } from './pipelineStageModel'

  const tenant = useTenantStore()
  const route = useRoute()
  const activeTab = ref<'pipelines' | 'steps' | 'dispatches' | 'errors'>('pipelines')
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const page = ref(1)
  const pageSize = ref(15)
  const initialPipelineInstanceValue = route.query.pipelineInstanceId ?? ''
  const initialPipelineInstanceText = String(initialPipelineInstanceValue)
  const initialPipelineInstanceId = initialPipelineInstanceText.trim()
  const kwDraft = ref(initialPipelineInstanceId)
  const kwApplied = ref(initialPipelineInstanceId)

  // 深链打开时从正式进度响应读取文件摘要，错误与真实空摘要分开展示。
  const currentFile = ref<{
    pipelineId: number
    fileId: number | null
    fileName: string | null
  } | null>(null)
  const fileSummaryUnavailable = ref(false)
  let fileSummaryRequestId = 0
  let fileSummaryPushRevision = 0

  async function loadCurrentFile(pipelineInstanceId: string) {
    const requestId = ++fileSummaryRequestId
    const requestedTenant = tenant.tenantId
    const revision = fileSummaryPushRevision
    currentFile.value = null
    fileSummaryUnavailable.value = false
    const pid = Number(pipelineInstanceId)
    if (!Number.isFinite(pid) || pid <= 0) {
      currentFile.value = null
      return
    }
    try {
      const response = await getPipelineProgressSnapshot(String(pid), requestedTenant)
      const snapshot = response.pipelines.find((p) => p.pipelineInstanceId === pid)
      if (!snapshot || response.tenantId !== requestedTenant)
        throw new Error('Pipeline snapshot scope mismatch')
      if (
        requestId === fileSummaryRequestId &&
        requestedTenant === tenant.tenantId &&
        revision === fileSummaryPushRevision &&
        (!selectedPipeline.value || selectedPipeline.value.id === pid)
      )
        currentFile.value = {
          pipelineId: pid,
          fileId: snapshot.fileId ?? null,
          fileName: snapshot.fileName ?? null,
        }
    } catch {
      if (
        requestId === fileSummaryRequestId &&
        requestedTenant === tenant.tenantId &&
        revision === fileSummaryPushRevision &&
        (!selectedPipeline.value || selectedPipeline.value.id === pid)
      )
        fileSummaryUnavailable.value = true
    }
  }

  const allPipelines = ref<ConsoleFilePipelineResponse[]>([])
  const allSteps = ref<ConsoleFilePipelineStepResponse[]>([])
  const stepLoadError = ref<unknown>(null)
  const selectedPipelineSteps = ref<ConsoleFilePipelineStepResponse[]>([])
  const selectedStepsLoading = ref(false)
  const selectedStepLoadError = ref<unknown>(null)
  let selectedStepsRequestId = 0
  const allDispatches = ref<ConsoleFileDispatchRecordResponse[]>([])
  const allErrors = ref<ConsoleFileErrorRecordResponse[]>([])
  const serverTotal = ref(0)
  const selectedPipeline = ref<ConsoleFilePipelineResponse | null>(null)
  const selectedStageCode = ref<string | null>(null)
  const selectedSteps = computed(() => selectedPipelineSteps.value)
  const selectedPipelineProgress = computed(() =>
    progress.progress.value?.pipelines.find(
      (p) => p.pipelineInstanceId === selectedPipeline.value?.id,
    ),
  )
  const selectedPipelineDisplay = computed(() =>
    selectedPipeline.value
      ? {
          ...selectedPipeline.value,
          runStatus: selectedPipelineProgress.value?.runStatus ?? selectedPipeline.value.runStatus,
          currentStage:
            selectedPipelineProgress.value?.currentStage ?? selectedPipeline.value.currentStage,
        }
      : null,
  )
  const selectedStages = computed(() => {
    const snapshot = selectedPipelineProgress.value
    const steps = snapshot?.steps ?? selectedSteps.value
    const code = snapshot?.systemPipelineCode ?? ''
    const catalog = snapshot?.stageGraphAvailable ? { [code]: snapshot.stageCodes } : {}
    return pipelineStageCodes(code, steps, catalog).map((code, index) => {
      const step = steps.find((item) => item.stageCode?.toUpperCase() === code)
      const terminal =
        snapshot && ['SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED'].includes(snapshot.runStatus)
      const status = String(step?.stepStatus ?? (terminal ? 'NOT_EXECUTED' : ''))
      const normalized = status.toUpperCase()
      const tone: 'success' | 'danger' | 'active' | 'pending' = [
        'SUCCESS',
        'COMPLETED',
        'SUCCEEDED',
      ].includes(normalized)
        ? 'success'
        : ['FAILED', 'ERROR'].includes(normalized)
          ? 'danger'
          : ['RUNNING', 'PROCESSING'].includes(normalized)
            ? 'active'
            : 'pending'
      return {
        code,
        index: index + 1,
        label: te(`filePipelineObservability.stage${code}`)
          ? t(`filePipelineObservability.stage${code}`)
          : code,
        status: status
          ? te(`workflowProgress.states.${status}`)
            ? t(`workflowProgress.states.${status}`)
            : status
          : t('filePipelineObservability.stageNoRecord'),
        error: step?.errorCode || '',
        tone,
      }
    })
  })

  async function loadSelectedSteps(pipelineInstanceId: number) {
    const requestId = ++selectedStepsRequestId
    const requestedTenant = tenant.tenantId
    selectedStepsLoading.value = true
    selectedStepLoadError.value = null
    try {
      const steps = await fetchAllPageItems<ConsoleFilePipelineStepResponse>(
        '/api/console/queries/file-pipeline-steps',
        { tenantId: tenant.tenantId, pipelineInstanceId },
      )
      if (
        requestId === selectedStepsRequestId &&
        requestedTenant === tenant.tenantId &&
        selectedPipeline.value?.id === pipelineInstanceId
      )
        selectedPipelineSteps.value = steps
    } catch (error) {
      if (requestId === selectedStepsRequestId && requestedTenant === tenant.tenantId)
        selectedStepLoadError.value = error
    } finally {
      if (requestId === selectedStepsRequestId && requestedTenant === tenant.tenantId)
        selectedStepsLoading.value = false
    }
  }

  function reloadSelectedSteps() {
    const pipelineInstanceId = selectedPipeline.value?.id
    if (pipelineInstanceId) void loadSelectedSteps(pipelineInstanceId)
  }

  function selectPipeline(row: ConsoleFilePipelineResponse) {
    selectedPipeline.value = row
    selectedStageCode.value = null
    selectedPipelineSteps.value = []
    void loadSelectedSteps(row.id)
  }

  function focusStage(code: string) {
    const nextStage = selectedStageCode.value === code ? null : code
    selectedStageCode.value = nextStage
    activeTab.value = 'steps'
    page.value = 1
    void loadSteps()
  }

  // 默认展示行级进度；未知总量不推断预计完成时间。
  const showProgressColumns = ref(true)
  // stepId → 最新进度采样(BE pipeline-progress 端点上报)
  const progressIds = computed(() =>
    activeTab.value === 'pipelines'
      ? allPipelines.value.map((p) => p.id)
      : activeTab.value === 'steps' && showProgressColumns.value
        ? allSteps.value.map((s) => s.pipelineInstanceId).filter((id): id is number => id != null)
        : [],
  )
  const progress = useLivePipelineProgress(() => tenant.tenantId, progressIds)
  const {
    byStepId: progressByStepId,
    unavailable: progressUnavailable,
    lastSucceededAt: progressLastSucceededAt,
  } = progress
  watch([progress.progress, () => selectedPipeline.value?.id], ([data, selected]) => {
    if (!route.query.pipelineInstanceId) return
    if (selected && currentFile.value?.pipelineId !== selected) currentFile.value = null
    const id = selected ?? Number(route.query.pipelineInstanceId)
    const current = data?.pipelines.find((p) => p.pipelineInstanceId === id)
    if (current) {
      fileSummaryPushRevision++
      currentFile.value = {
        pipelineId: id,
        fileId: current.fileId ?? null,
        fileName: current.fileName ?? null,
      }
      fileSummaryUnavailable.value = false
    }
  })
  const HEARTBEAT_STALL_MS = 90_000

  function formatRowsCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  function formatProcessed(row: ConsoleFilePipelineStepResponse): string {
    // 运行中步骤:优先实时 cache(若 BE 实时端点可用);完成步骤:回落 outputSummary 计数
    // (见 utils/pipelineStepSummary —— 完成步骤的计数本就在响应里,无需 BE 端点)。
    const prog = progressByStepId.value.get(row.id)
    if (prog && prog.rowsProcessed != null) return fmtNumber(prog.rowsProcessed)
    const fromSummary = processedCountFromSummary(row.stageCode, row.outputSummary)
    if (fromSummary != null) return fmtNumber(fromSummary)
    return '—'
  }

  function formatTotalEta(row: ConsoleFilePipelineStepResponse): string {
    if (
      row.pipelineInstanceId != null &&
      progress.failedPipelineIds.value.has(row.pipelineInstanceId)
    )
      return '—'
    const prog = progressByStepId.value.get(row.id)
    if (!prog || prog.totalRowsHint == null) return '—'
    const totalStr = formatRowsCompact(prog.totalRowsHint)

    // 心跳停滞:文本切「无响应」
    const heartbeatIsStalled =
      prog.lastHeartbeatAt != null && Date.now() - prog.lastHeartbeatAt > HEARTBEAT_STALL_MS
    if (heartbeatIsStalled) {
      return `${totalStr} · ${t('common.etaStalled')}`
    }
    const minutes = progress.estimateMinutes(prog)
    return minutes == null ? totalStr : `${totalStr} · ${t('common.etaPattern', { minutes })}`
  }

  const live = { status: progress.status, lastRefreshedAt: progress.lastSucceededAt }
  function currentStep(row: ConsoleFilePipelineStepResponse) {
    const sample = progressByStepId.value.get(row.id)
    return sample?.pipelineInstanceId === row.pipelineInstanceId
      ? {
          ...row,
          stepStatus: sample.stepStatus ?? row.stepStatus,
          runSeq: sample.runSeq ?? row.runSeq,
          errorCode: sample.errorCode ?? '',
          errorMessage: sample.errorCode === row.errorCode ? row.errorMessage : '',
        }
      : row
  }
  const total = computed(() => serverTotal.value)
  const pipelineRows = computed(() =>
    allPipelines.value.map((row) => {
      const current = progress.progress.value?.pipelines.find(
        (p) => p.pipelineInstanceId === row.id,
      )
      return {
        ...row,
        runStatus: current?.runStatus ?? row.runStatus,
        currentStage: current?.currentStage ?? row.currentStage,
      }
    }),
  )
  const stepRows = computed(() => allSteps.value.map(currentStep))
  const dispatchRows = computed(() => allDispatches.value)
  const errorRows = computed(() => allErrors.value)

  function onSearch() {
    return runSearch(async () => {
      kwApplied.value = kwDraft.value.trim()
      page.value = 1
      await runActive()
    })
  }

  function onReset() {
    return runReset(async () => {
      kwDraft.value = ''
      kwApplied.value = ''
      page.value = 1
      await runActive()
    })
  }

  function onPageChange() {
    void runActive()
  }

  function exactDeepPipelineId() {
    const text = String(route.query.pipelineInstanceId ?? '').trim()
    const id = Number(text)
    return kwApplied.value === text && Number.isSafeInteger(id) && id > 0 ? id : undefined
  }
  let pipelinesRequestId = 0
  async function loadPipelines() {
    const requestId = ++pipelinesRequestId
    const requestedTenant = tenant.tenantId
    const valid = () => requestId === pipelinesRequestId && requestedTenant === tenant.tenantId
    loading.value = true
    loadError.value = null
    try {
      const result = await queryFilePipelinePage({
        tenantId: tenant.tenantId,
        pageNo: page.value,
        pageSize: pageSize.value,
        keyword: kwApplied.value || undefined,
        pipelineInstanceId: exactDeepPipelineId(),
      })
      if (!valid()) return
      allPipelines.value = result.items ?? []
      serverTotal.value = result.total ?? 0
      const requestedId = Number(route.query.pipelineInstanceId)
      const previousId = selectedPipeline.value?.id
      selectedPipeline.value =
        allPipelines.value.find((item) => item.id === requestedId) ??
        allPipelines.value.find((item) => item.id === previousId) ??
        allPipelines.value[0] ??
        null
    } catch (error) {
      if (valid()) loadError.value = error
    } finally {
      if (valid()) loading.value = false
    }
    if (valid() && selectedPipeline.value) {
      selectedPipelineSteps.value = []
      void loadSelectedSteps(selectedPipeline.value.id)
    }
  }

  let stepsRequestId = 0

  async function loadSteps() {
    const requestId = ++stepsRequestId
    const requestedTenant = tenant.tenantId
    loading.value = true
    stepLoadError.value = null
    try {
      const result = await queryFilePipelineStepPage({
        tenantId: tenant.tenantId,
        pageNo: page.value,
        pageSize: pageSize.value,
        keyword: kwApplied.value || undefined,
        pipelineInstanceId: selectedStageCode.value
          ? selectedPipeline.value?.id
          : exactDeepPipelineId(),
        stageCode: selectedStageCode.value || undefined,
      })
      if (requestId !== stepsRequestId || requestedTenant !== tenant.tenantId) return
      allSteps.value = result.items ?? []
      serverTotal.value = result.total ?? 0
    } catch (error) {
      if (requestId === stepsRequestId && requestedTenant === tenant.tenantId)
        stepLoadError.value = error
    } finally {
      if (requestId === stepsRequestId && requestedTenant === tenant.tenantId) loading.value = false
    }
  }

  async function loadDispatches() {
    loading.value = true
    try {
      const result = await queryFileDispatchPage({
        tenantId: tenant.tenantId,
        pageNo: page.value,
        pageSize: pageSize.value,
        keyword: kwApplied.value || undefined,
      })
      allDispatches.value = result.items ?? []
      serverTotal.value = result.total ?? 0
    } finally {
      loading.value = false
    }
  }

  async function loadErrors() {
    loading.value = true
    try {
      const result = await queryFileErrorPage({
        tenantId: tenant.tenantId,
        pageNo: page.value,
        pageSize: pageSize.value,
        keyword: kwApplied.value || undefined,
      })
      allErrors.value = result.items ?? []
      serverTotal.value = result.total ?? 0
    } finally {
      loading.value = false
    }
  }

  async function reloadTab() {
    page.value = 1
    const pipelineInstanceValue = route.query.pipelineInstanceId ?? ''
    const pipelineInstanceText = String(pipelineInstanceValue)
    const pipelineInstanceId = pipelineInstanceText.trim()
    await Promise.all([
      runActive(),
      fileSummaryUnavailable.value ? loadCurrentFile(pipelineInstanceId) : Promise.resolve(),
    ])
  }

  function onTabChange() {
    if (activeTab.value !== 'steps') selectedStageCode.value = null
    page.value = 1
    const deepFilter = exactDeepPipelineId() ? String(route.query.pipelineInstanceId).trim() : ''
    kwDraft.value = deepFilter
    kwApplied.value = deepFilter
    void runActive()
  }

  watch(
    () => route.query.pipelineInstanceId,
    (value) => {
      const pipelineInstanceValue = value ?? ''
      const pipelineInstanceText = String(pipelineInstanceValue)
      const next = pipelineInstanceText.trim()
      if (!next) return
      activeTab.value = 'pipelines'
      kwDraft.value = next
      kwApplied.value = next
      page.value = 1
      const pipelineInstanceId = Number(next)
      selectedPipeline.value =
        allPipelines.value.find((item) => item.id === pipelineInstanceId) ?? selectedPipeline.value
      selectedStageCode.value = null
      if (selectedPipeline.value) {
        selectedPipelineSteps.value = []
        void loadSelectedSteps(selectedPipeline.value.id)
      }
      void loadCurrentFile(next)
    },
  )

  async function runActive() {
    if (activeTab.value === 'pipelines') await loadPipelines()
    else if (activeTab.value === 'steps') await loadSteps()
    else if (activeTab.value === 'dispatches') await loadDispatches()
    else await loadErrors()
  }

  useTenantReload(() => {
    stepsRequestId++
    pipelinesRequestId++
    selectedStepsRequestId++
    fileSummaryRequestId++
    fileSummaryUnavailable.value = false
    progress.reset()
    page.value = 1
    selectedPipeline.value = null
    selectedStageCode.value = null
    allPipelines.value = []
    allSteps.value = []
    selectedPipelineSteps.value = []
    selectedStepLoadError.value = null
    stepLoadError.value = null
    allDispatches.value = []
    allErrors.value = []
    currentFile.value = null
    const pipelineInstanceValue = route.query.pipelineInstanceId ?? ''
    const pipelineInstanceText = String(pipelineInstanceValue)
    const pipelineInstanceId = pipelineInstanceText.trim()
    if (pipelineInstanceId) void loadCurrentFile(pipelineInstanceId)
    return runActive()
  })
</script>

<style scoped>
  .current-file-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-info);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    font-size: var(--font-size-md);
  }

  .current-file-bar__label {
    color: var(--color-text-secondary);
  }

  .current-file-bar__name {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .pipeline-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(19rem, 1fr);
    align-items: start;
    gap: var(--page-block-gap);
    min-width: 0;
  }

  .pipeline-workspace__master,
  .pipeline-workspace__hint {
    min-width: 0;
  }

  .pipeline-workspace__hint {
    display: grid;
    min-height: 18rem;
    place-items: center;
    border: 1px dashed var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-page);
  }

  .pipeline-workspace--empty {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 1320px) {
    .pipeline-workspace {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
