<template>
  <PageContainer>
    <PageHeader />

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

    <SectionCard v-if="selectedPipeline" class="pipeline-focus">
      <template #header>
        <div class="pipeline-focus__header">
          <span>{{ t('filePipelineObservability.selectedRun', { id: selectedPipeline.id }) }}</span>
          <StatusTag :value="String(selectedPipeline.runStatus ?? '')" category="workflow" />
        </div>
      </template>
      <div class="pipeline-focus__links">
        <span>{{ selectedPipeline.jobCode }}</span>
        <router-link
          v-if="selectedPipeline.fileId"
          class="cell-link"
          :to="`/files/list?fileId=${selectedPipeline.fileId}`"
        >
          {{ t('filePipelineObservability.relatedFile', { id: selectedPipeline.fileId }) }}
        </router-link>
        <router-link
          v-if="selectedPipeline.relatedJobInstanceId"
          class="cell-link"
          :to="`/monitor/job-instances/${selectedPipeline.relatedJobInstanceId}`"
        >
          {{
            t('filePipelineObservability.relatedInstance', {
              id: selectedPipeline.relatedJobInstanceId,
            })
          }}
        </router-link>
        <router-link
          v-if="selectedPipeline.traceId"
          class="cell-link"
          :to="`/observability/trace?traceId=${selectedPipeline.traceId}`"
        >
          {{ t('filePipelineObservability.relatedTrace') }}
        </router-link>
      </div>
      <el-alert
        v-if="selectedStepLoadError"
        class="pipeline-stage-error"
        type="error"
        show-icon
        :closable="false"
        :title="t('filePipelineObservability.stageLoadError')"
      >
        <template #default>
          <el-button link type="primary" @click="reloadSelectedSteps">
            {{ t('common.retry') }}
          </el-button>
        </template>
      </el-alert>
      <div
        v-else
        v-loading="selectedStepsLoading"
        class="pipeline-stages"
        :aria-label="t('filePipelineObservability.stageOverview')"
      >
        <button
          v-for="stage in selectedStages"
          :key="stage.code"
          type="button"
          class="pipeline-stage"
          :class="[
            `pipeline-stage--${stage.tone}`,
            { 'pipeline-stage--selected': selectedStageCode === stage.code },
          ]"
          :aria-pressed="selectedStageCode === stage.code"
          @click="focusStage(stage.code)"
        >
          <span class="pipeline-stage__index">{{ stage.index }}</span>
          <span class="pipeline-stage__body">
            <strong>{{ stage.label }}</strong>
            <span>{{ stage.status }}</span>
            <span v-if="stage.error" class="pipeline-stage__error" :title="stage.error">
              {{ stage.error }}
            </span>
          </span>
        </button>
      </div>
    </SectionCard>

    <el-tabs v-model="activeTab" class="pill-tabs" @tab-change="onTabChange">
      <el-tab-pane :label="t('filePipelineObservability.tabPipelines')" name="pipelines">
        <ProTable
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
          <el-table-column
            prop="lastSuccessStage"
            :label="t('filePipelineObservability.colLastSuccess')"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="fileId"
            :label="t('filePipelineObservability.colFileId')"
            width="88"
          >
            <template #default="{ row }">
              <router-link
                v-if="row.fileId"
                class="cell-link"
                :to="`/files/list?fileId=${row.fileId}`"
              >
                {{ row.fileId }}
              </router-link>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="relatedJobInstanceId"
            :label="t('filePipelineObservability.colRelatedInstance')"
            width="100"
          >
            <template #default="{ row }">
              <router-link
                v-if="row.relatedJobInstanceId"
                class="cell-link"
                :to="`/monitor/job-instances/${row.relatedJobInstanceId}`"
              >
                {{ row.relatedJobInstanceId }}
              </router-link>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="traceId"
            :label="t('filePipelineObservability.colTrace')"
            min-width="220"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <router-link
                v-if="row.traceId"
                class="cell-link"
                :to="`/observability/trace?traceId=${row.traceId}`"
              >
                {{ row.traceId }}
              </router-link>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <DatetimeColumn
            prop="startedAt"
            :label="t('filePipelineObservability.colStart')"
            width="180"
          />
          <DatetimeColumn
            prop="finishedAt"
            :label="t('filePipelineObservability.colFinish')"
            width="180"
          />
        </ProTable>
      </el-tab-pane>

      <el-tab-pane :label="t('filePipelineObservability.tabSteps')" name="steps">
        <el-alert
          v-if="showProgressColumns && progressUnavailable"
          class="pipeline-stage-error"
          type="warning"
          show-icon
          :closable="false"
          :title="t('filePipelineObservability.progressUnavailable')"
        />
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
              {{ formatProcessed(row) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showProgressColumns"
            :label="t('filePipelineObservability.colTotalRowsEta')"
            width="170"
          >
            <template #default="{ row }">
              {{ formatTotalEta(row) }}
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
  import { ref, computed, onMounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
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
  import type {
    ConsoleFileDispatchRecordResponse,
    ConsoleFileErrorRecordResponse,
    ConsoleFilePipelineResponse,
    ConsoleFilePipelineStepResponse,
  } from '@/types/console-api'
  import { queryPipelineProgress } from '@/api/filePipelineQuery'
  import { usePipelineProgress } from '@/composables/usePipelineProgress'
  import { processedCountFromSummary } from '@/utils/pipelineStepSummary'
  import { fmtNumber } from '@/utils/number'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { pipelineStageCodes } from './pipelineStageModel'
  import { fetchPipelineStages, type PipelineStagesMap } from '@/api/pipelineMeta'

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
  const initialPipelineInstanceId = String(route.query.pipelineInstanceId ?? '').trim()
  const kwDraft = ref(initialPipelineInstanceId)
  const kwApplied = ref(initialPipelineInstanceId)

  // 深链打开时从正式进度响应读取文件摘要，错误与真实空摘要分开展示。
  const currentFile = ref<{ fileId: number | null; fileName: string | null } | null>(null)
  const fileSummaryUnavailable = ref(false)
  let fileSummaryRequestId = 0

  async function loadCurrentFile(pipelineInstanceId: string) {
    const requestId = ++fileSummaryRequestId
    currentFile.value = null
    fileSummaryUnavailable.value = false
    const pid = Number(pipelineInstanceId)
    if (!Number.isFinite(pid) || pid <= 0) {
      currentFile.value = null
      return
    }
    try {
      const resp = await queryPipelineProgress(pid)
      if (requestId === fileSummaryRequestId)
        currentFile.value = { fileId: resp.fileId ?? null, fileName: resp.fileName ?? null }
    } catch {
      if (requestId === fileSummaryRequestId) fileSummaryUnavailable.value = true
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
  const stagesMap = ref<PipelineStagesMap>({})
  const selectedSteps = computed(() => selectedPipelineSteps.value)
  const selectedStages = computed(() =>
    pipelineStageCodes(
      selectedPipeline.value?.pipelineType,
      selectedSteps.value,
      stagesMap.value,
    ).map((code, index) => {
      const step = selectedSteps.value.find((item) => item.stageCode?.toUpperCase() === code)
      const status = String(step?.stepStatus ?? '')
      const normalized = status.toUpperCase()
      const tone = ['SUCCESS', 'COMPLETED', 'SUCCEEDED'].includes(normalized)
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
          ? te(`enum.partitionStatus.${status}`)
            ? t(`enum.partitionStatus.${status}`)
            : status
          : t('filePipelineObservability.stageNoRecord'),
        error: step?.errorMessage?.trim() || '',
        tone,
      }
    }),
  )

  async function loadSelectedSteps(pipelineInstanceId: number) {
    const requestId = ++selectedStepsRequestId
    selectedStepsLoading.value = true
    selectedStepLoadError.value = null
    try {
      const steps = await fetchAllPageItems<ConsoleFilePipelineStepResponse>(
        '/api/console/queries/file-pipeline-steps',
        { tenantId: tenant.tenantId, pipelineInstanceId },
      )
      if (requestId === selectedStepsRequestId && selectedPipeline.value?.id === pipelineInstanceId)
        selectedPipelineSteps.value = steps
    } catch (error) {
      if (requestId === selectedStepsRequestId) selectedStepLoadError.value = error
    } finally {
      if (requestId === selectedStepsRequestId) selectedStepsLoading.value = false
    }
  }

  onMounted(() => {
    fetchPipelineStages()
      .then((stages) => (stagesMap.value = stages || {}))
      .catch(() => {
        stagesMap.value = {}
      })
  })

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
  const progress = usePipelineProgress(() => tenant.tenantId)
  const {
    byStepId: progressByStepId,
    unavailable: progressUnavailable,
    lastSucceededAt: progressLastSucceededAt,
  } = progress
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
    if (prog.lastHeartbeatAt != null && Date.now() - prog.lastHeartbeatAt > HEARTBEAT_STALL_MS) {
      return `${totalStr} · ${t('common.etaStalled')}`
    }
    const minutes = progress.estimateMinutes(prog)
    return minutes == null ? totalStr : `${totalStr} · ${t('common.etaPattern', { minutes })}`
  }

  async function loadProgress() {
    // 只在 steps tab 且需要时拉
    if (activeTab.value !== 'steps' || !showProgressColumns.value) return false
    return progress.refresh(
      allSteps.value.map((s) => s.pipelineInstanceId).filter((id) => id != null),
    )
  }

  // 30s 轮询(与心跳一致);页面隐藏自动暂停
  useAutoRefresh(() => {
    void loadProgress()
  }, 30_000)

  const progressSseEnabled = computed(
    () => activeTab.value === 'steps' && showProgressColumns.value,
  )
  const live = useSseAutoReload({
    domain: 'pipeline-progress',
    reload: loadProgress,
    scope: () => tenant.tenantId,
    debounceMs: 1_200,
    enabled: progressSseEnabled,
    onFallback: null,
  })

  const total = computed(() => serverTotal.value)
  const pipelineRows = computed(() => allPipelines.value)
  const stepRows = computed(() => allSteps.value)
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

  async function loadPipelines() {
    loading.value = true
    loadError.value = null
    try {
      const result = await queryFilePipelinePage({
        tenantId: tenant.tenantId,
        pageNo: page.value,
        pageSize: pageSize.value,
        keyword: kwApplied.value || undefined,
      })
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
      loadError.value = error
    } finally {
      loading.value = false
    }
    if (selectedPipeline.value) {
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
        pipelineInstanceId: selectedStageCode.value ? selectedPipeline.value?.id : undefined,
        stageCode: selectedStageCode.value || undefined,
      })
      if (requestId !== stepsRequestId || requestedTenant !== tenant.tenantId) return
      allSteps.value = result.items ?? []
      serverTotal.value = result.total ?? 0
      if (showProgressColumns.value) {
        await loadProgress()
      }
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
    const pipelineInstanceId = String(route.query.pipelineInstanceId ?? '').trim()
    await Promise.all([
      runActive(),
      fileSummaryUnavailable.value ? loadCurrentFile(pipelineInstanceId) : Promise.resolve(),
    ])
  }

  function onTabChange() {
    if (activeTab.value !== 'steps') selectedStageCode.value = null
    page.value = 1
    kwDraft.value = ''
    kwApplied.value = ''
    void runActive()
  }

  watch(
    () => route.query.pipelineInstanceId,
    (value) => {
      const next = String(value ?? '').trim()
      if (!next) return
      activeTab.value = 'pipelines'
      kwDraft.value = next
      kwApplied.value = next
      page.value = 1
      selectedPipeline.value =
        allPipelines.value.find((item) => item.id === Number(next)) ?? selectedPipeline.value
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
    const pipelineInstanceId = String(route.query.pipelineInstanceId ?? '').trim()
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

  .pipeline-focus {
    margin-bottom: var(--page-block-gap);
  }

  .pipeline-focus__header,
  .pipeline-focus__links {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .pipeline-focus__links {
    margin-bottom: var(--space-md);
    color: var(--color-text-secondary);
  }

  .pipeline-stages {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-sm);
  }

  .pipeline-stage {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-page);
    color: inherit;
    font: inherit;
    width: 100%;
    cursor: pointer;
    text-align: left;
  }

  .pipeline-stage--selected,
  .pipeline-stage:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .pipeline-stage__index {
    display: inline-grid;
    place-items: center;
    width: var(--space-xl);
    height: var(--space-xl);
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
  }

  .pipeline-stage__body {
    display: grid;
    min-width: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .pipeline-stage__body strong {
    color: var(--color-text-primary);
  }

  .pipeline-stage__error {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-danger);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .pipeline-stage--success {
    border-color: var(--color-success);
  }

  .pipeline-stage--active {
    border-color: var(--color-primary);
    background: var(--color-bg-info);
  }

  .pipeline-stage--danger {
    border-color: var(--color-danger);
    background: var(--wf-node-error-light);
  }

  @media (max-width: 900px) {
    .pipeline-stages {
      grid-template-columns: 1fr;
    }
  }
</style>
