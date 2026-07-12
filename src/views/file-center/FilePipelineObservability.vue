<template>
  <PageContainer>
    <PageHeader />

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
        <ProTable
          :data="pipelineRows"
          :loading="tableBlocking"
          :total="total"
          v-model:page="page"
          v-model:page-size="pageSize"
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
            width="140"
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
            min-width="120"
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
            width="160"
          />
          <DatetimeColumn
            prop="finishedAt"
            :label="t('filePipelineObservability.colFinish')"
            width="160"
          />
        </ProTable>
      </el-tab-pane>

      <el-tab-pane :label="t('filePipelineObservability.tabSteps')" name="steps">
        <ProTable
          :data="stepRows"
          :loading="tableBlocking"
          :total="total"
          v-model:page="page"
          v-model:page-size="pageSize"
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
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'

  const { t } = useI18n({ useScope: 'global' })
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
  import { queryPipelineProgressSafe, type PipelineStepProgress } from '@/api/filePipelineQuery'
  import { processedCountFromSummary } from '@/utils/pipelineStepSummary'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'

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

  // 缺口2:当前文件摘要(深链 ?pipelineInstanceId=X 进入时,从 pipeline-progress 顶层拿 fileName/fileId)
  const currentFile = ref<{ fileId: number | null; fileName: string | null } | null>(null)

  async function loadCurrentFile(pipelineInstanceId: string) {
    const pid = Number(pipelineInstanceId)
    if (!Number.isFinite(pid) || pid <= 0) {
      currentFile.value = null
      return
    }
    const resp = await queryPipelineProgressSafe(pid)
    currentFile.value = { fileId: resp.fileId ?? null, fileName: resp.fileName ?? null }
  }

  const allPipelines = ref<ConsoleFilePipelineResponse[]>([])
  const allSteps = ref<ConsoleFilePipelineStepResponse[]>([])
  const allDispatches = ref<ConsoleFileDispatchRecordResponse[]>([])
  const allErrors = ref<ConsoleFileErrorRecordResponse[]>([])

  // 行级进度:默认开启(BE 已服务端桥接运行中实时行数,未开 checkpoint 也有值;
  // 用户反馈默认看不到实时行数是主痛点)。total 恒 null 时 ETA 列优雅降级为 '—'。
  const showProgressColumns = ref(true)
  // stepId → 最新进度采样(BE pipeline-progress 端点上报)
  const progressByStepId = ref<Map<number, PipelineStepProgress>>(new Map())
  // stepId → 最近 60s 内的 rowsProcessed 历史(ETA 线性外推用,长度上限 6)
  const historyByStepId = new Map<number, { ts: number; processed: number }[]>()

  const HISTORY_WINDOW_MS = 60_000
  const HEARTBEAT_STALL_MS = 90_000
  const MIN_ETA_WINDOW_MS = 60_000
  const MAX_HISTORY_SAMPLES = 12

  function recordHistory(stepId: number, processed: number | null) {
    if (processed == null) return
    const now = Date.now()
    const arr = historyByStepId.get(stepId) ?? []
    arr.push({ ts: now, processed })
    // 丢弃 > 2×WINDOW 的样本,保留尾部 MAX_HISTORY_SAMPLES 个
    const cutoff = now - HISTORY_WINDOW_MS * 2
    const trimmed = arr.filter((s) => s.ts >= cutoff).slice(-MAX_HISTORY_SAMPLES)
    historyByStepId.set(stepId, trimmed)
  }

  function formatNumberWithCommas(n: number): string {
    return n.toLocaleString('en-US')
  }

  function formatRowsCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  function formatProcessed(row: ConsoleFilePipelineStepResponse): string {
    // 运行中步骤:优先实时 cache(若 BE 实时端点可用);完成步骤:回落 outputSummary 计数
    // (见 utils/pipelineStepSummary —— 完成步骤的计数本就在响应里,无需 BE 端点)。
    const prog = progressByStepId.value.get(row.id)
    if (prog && prog.rowsProcessed != null) return formatNumberWithCommas(prog.rowsProcessed)
    const fromSummary = processedCountFromSummary(row.stageCode, row.outputSummary)
    if (fromSummary != null) return formatNumberWithCommas(fromSummary)
    return '—'
  }

  function computeEtaText(prog: PipelineStepProgress): string {
    const history = historyByStepId.get(prog.stepId) ?? []
    if (history.length < 2) return ''
    const first = history[0]
    const last = history[history.length - 1]
    const windowMs = last.ts - first.ts
    if (windowMs < MIN_ETA_WINDOW_MS) return ''
    if (prog.totalRowsHint == null) return ''
    if ((prog.rowsProcessed ?? 0) >= prog.totalRowsHint) return ''
    const delta = last.processed - first.processed
    if (delta <= 0) return ''
    const ratePerMs = delta / windowMs
    const remaining = prog.totalRowsHint - (prog.rowsProcessed ?? 0)
    const remainingMs = remaining / ratePerMs
    const minutes = Math.max(1, Math.round(remainingMs / 60_000))
    return t('common.etaPattern', { minutes })
  }

  function formatTotalEta(row: ConsoleFilePipelineStepResponse): string {
    const prog = progressByStepId.value.get(row.id)
    if (!prog || prog.totalRowsHint == null) return '—'
    const totalStr = formatRowsCompact(prog.totalRowsHint)

    // 心跳停滞:文本切「无响应」
    if (prog.lastHeartbeatAt != null && Date.now() - prog.lastHeartbeatAt > HEARTBEAT_STALL_MS) {
      return `${totalStr} · ${t('common.etaStalled')}`
    }
    const etaText = computeEtaText(prog)
    if (!etaText) return totalStr
    return `${totalStr} · ${etaText}`
  }

  async function loadProgress() {
    // 只在 steps tab 且需要时拉
    if (activeTab.value !== 'steps' || !showProgressColumns.value) return
    if (allSteps.value.length === 0) return
    // 按 pipelineInstanceId 去重拉取
    const pipelineIds = Array.from(
      new Set(allSteps.value.map((s) => s.pipelineInstanceId).filter((id) => id != null)),
    )
    const next = new Map(progressByStepId.value)
    for (const pid of pipelineIds) {
      try {
        const resp = await queryPipelineProgressSafe(pid)
        for (const s of resp.steps) {
          next.set(s.stepId, s)
          recordHistory(s.stepId, s.rowsProcessed)
        }
      } catch {
        // safe 版已吞错;此处 catch 兜底防 TS 警告
      }
    }
    progressByStepId.value = next
    live.markRefreshed()
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

  const filteredPipelines = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allPipelines.value
    return allPipelines.value.filter((row) =>
      `${row.jobCode} ${row.pipelineType} ${row.runStatus} ${row.traceId} ${row.fileId} ${row.currentStage ?? ''}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredSteps = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allSteps.value
    return allSteps.value.filter((row) =>
      `${row.stepCode} ${row.stageCode} ${row.stepStatus} ${row.errorMessage ?? ''} ${row.pipelineInstanceId}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredDispatches = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allDispatches.value
    return allDispatches.value.filter((row) =>
      `${row.fileId} ${row.dispatchStatus} ${row.channelCode} ${row.externalRequestId ?? ''} ${row.pipelineInstanceId}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredErrors = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allErrors.value
    return allErrors.value.filter((row) =>
      `${row.fileId} ${row.errorCode} ${row.errorStage} ${row.errorMessage ?? ''}`
        .toLowerCase()
        .includes(k),
    )
  })

  const total = computed(() => {
    if (activeTab.value === 'pipelines') return filteredPipelines.value.length
    if (activeTab.value === 'steps') return filteredSteps.value.length
    if (activeTab.value === 'dispatches') return filteredDispatches.value.length
    return filteredErrors.value.length
  })

  const pipelineRows = computed(() => {
    const pr = toPageResult(filteredPipelines.value, page.value, pageSize.value)
    return pr.records
  })

  const stepRows = computed(() => {
    const pr = toPageResult(filteredSteps.value, page.value, pageSize.value)
    return pr.records
  })

  const dispatchRows = computed(() => {
    const pr = toPageResult(filteredDispatches.value, page.value, pageSize.value)
    return pr.records
  })

  const errorRows = computed(() => {
    const pr = toPageResult(filteredErrors.value, page.value, pageSize.value)
    return pr.records
  })

  function onSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      page.value = 1
    })
  }

  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      kwApplied.value = ''
      page.value = 1
    })
  }

  async function loadPipelines() {
    loading.value = true
    try {
      allPipelines.value = await fetchAllPageItems<ConsoleFilePipelineResponse>(
        '/api/console/queries/file-pipelines',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  async function loadSteps() {
    loading.value = true
    try {
      allSteps.value = await fetchAllPageItems<ConsoleFilePipelineStepResponse>(
        '/api/console/queries/file-pipeline-steps',
        { tenantId: tenant.tenantId },
      )
      if (showProgressColumns.value) {
        void loadProgress()
      }
    } finally {
      loading.value = false
    }
  }

  async function loadDispatches() {
    loading.value = true
    try {
      allDispatches.value = await fetchAllPageItems<ConsoleFileDispatchRecordResponse>(
        '/api/console/queries/file-dispatches',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  async function loadErrors() {
    loading.value = true
    try {
      allErrors.value = await fetchAllPageItems<ConsoleFileErrorRecordResponse>(
        '/api/console/queries/file-errors',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  function reloadTab() {
    page.value = 1
    void runActive()
  }

  function onTabChange() {
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
      void loadCurrentFile(next)
    },
  )

  if (initialPipelineInstanceId) void loadCurrentFile(initialPipelineInstanceId)

  async function runActive() {
    if (activeTab.value === 'pipelines') await loadPipelines()
    else if (activeTab.value === 'steps') await loadSteps()
    else if (activeTab.value === 'dispatches') await loadDispatches()
    else await loadErrors()
  }

  useTenantReload(() => {
    page.value = 1
    void runActive()
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
</style>
