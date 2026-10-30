<template>
  <PageContainer>
    <PageHeader
      :title="t('monitor.runDetailTitle')"
      :description="headerDesc"
      back-to="/monitor/workflow-runs"
    >
      <template #actions>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('monitor.runDetailRefresh') }}
        </el-button>
        <el-button v-if="lifecycleAction" :loading="actionLoading" @click="changeLifecycle">
          {{ t(`runControl.${lifecycleAction}`) }}
        </el-button>
        <el-button v-if="run?.workflowDefinitionId" :icon="View" @click="openDag">
          {{ t('monitor.runDetailOpenFullDag') }}
        </el-button>
        <el-button
          v-if="canWriteSystem && canReplayWholeWorkflowRun(run?.runStatus)"
          type="danger"
          plain
          :icon="RotateCcw"
          :loading="wholeReplayLoading"
          @click="confirmReplayWholeWorkflow"
        >
          {{ t('monitor.replayWholeWorkflowButton') }}
        </el-button>
        <el-button
          v-if="canCancelWorkflowExecution(run?.runStatus, canWriteSystem)"
          type="warning"
          :loading="actionLoading"
          @click="confirmCancel"
        >
          {{ t('monitor.runDetailCancel') }}
        </el-button>
        <el-button
          v-if="canTerminateWorkflowExecution(run?.runStatus, canWriteSystem)"
          type="danger"
          :loading="actionLoading"
          @click="confirmTerminate"
        >
          {{ t('monitor.runDetailTerminate') }}
        </el-button>
        <PrintButton />
      </template>
    </PageHeader>

    <WorkflowExecutionPanel :run-id="runId" @snapshot="onExecutionSnapshot" />

    <SectionCard v-if="run">
      <template #header>{{ t('monitor.runDetailMaster') }}</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('monitor.runDetailRunId')">
          {{ run.id }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailDefId')">
          {{ run.workflowDefinitionId }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailStatus')">
          {{ run.runStatus }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailCurrentNode')">
          <span data-testid="workflow-progress-focus">{{
            currentExecutionNodes.join(', ') || '—'
          }}</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailBizDate')">
          {{ run.bizDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailTrace')">
          <router-link
            v-if="run.traceId"
            class="cell-link"
            :to="`/observability/trace?traceId=${run.traceId}`"
          >
            {{ run.traceId }}
          </router-link>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailStarted')">
          <DatetimeText :value="run.startedAt" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailFinished')">
          <DatetimeText data-testid="workflow-finished-at" :value="run.finishedAt" />
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard>
      <template #header>
        <div class="node-runs-header">
          <span>{{ t('monitor.nodeRunsHeader') }}</span>
          <el-button
            text
            :icon="List"
            :aria-expanded="nodeTableVisible"
            @click="nodeTableVisible = !nodeTableVisible"
          >
            {{ nodeTableVisible ? t('common.close') : t('common.detail') }}
          </el-button>
        </div>
      </template>
      <div v-show="nodeTableVisible">
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loading"
          @search="applyNodeFilter"
          @reset="resetNodeFilter"
          @refresh="() => runRefresh(loadNodeRuns)"
        >
          <el-form-item :label="t('monitor.nodeFilterCodeLabel')">
            <el-input
              class="query-w-200"
              v-model="nodeFilterDraft.nodeCode"
              clearable
              :placeholder="t('monitor.nodeFilterCodePlaceholder')"
              @keyup.enter="applyNodeFilter"
            />
          </el-form-item>
          <el-form-item :label="t('monitor.nodeFilterStatusLabel')">
            <MetaSelect
              class="query-w-200"
              v-model="nodeFilterDraft.nodeStatus"
              clearable
              filterable
              :placeholder="t('monitor.nodeFilterStatusPlaceholder')"
              :options="nodeStatusOptions"
            />
          </el-form-item>
        </ListPageQueryBar>
        <el-table
          v-loading="loading"
          :data="nodeRuns"
          stripe
          border
          :empty-text="t('common.noData')"
          class="console-table"
          @expand-change="onNodeExpand"
        >
          <el-table-column type="expand" width="44">
            <template #default="{ row }">
              <div v-if="row.jobInstanceId" class="node-execution-detail">
                <el-skeleton
                  v-if="executionDetails[row.jobInstanceId]?.loading"
                  animated
                  :rows="3"
                />
                <el-alert
                  v-else-if="executionDetails[row.jobInstanceId]?.error"
                  type="error"
                  show-icon
                  :closable="false"
                  :title="t('monitor.nodeExecutionLoadFailed')"
                >
                  <template #default>
                    <el-button link type="primary" @click="loadNodeExecution(row.jobInstanceId)">
                      {{ t('common.retry') }}
                    </el-button>
                  </template>
                </el-alert>
                <template v-else-if="executionDetails[row.jobInstanceId]?.instance">
                  <div class="node-execution-detail__heading">
                    <el-descriptions :column="3" border size="small">
                      <el-descriptions-item :label="t('monitor.nodeExecutionJob')">
                        {{ executionDetails[row.jobInstanceId].instance?.jobCode }}
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('monitor.nodeExecutionStatus')">
                        <StatusTag
                          :value="
                            String(
                              executionDetails[row.jobInstanceId].instance?.instanceStatus ?? '',
                            )
                          "
                          category="partition"
                        />
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('monitor.nodeExecutionInstanceNo')">
                        {{ executionDetails[row.jobInstanceId].instance?.instanceNo || '—' }}
                      </el-descriptions-item>
                    </el-descriptions>
                    <router-link
                      class="cell-link"
                      :to="`/monitor/job-instances/${row.jobInstanceId}`"
                    >
                      {{ t('monitor.nodeExecutionOpenInstance') }} →
                    </router-link>
                  </div>
                  <div class="node-execution-detail__section">
                    <strong>
                      {{ t('monitor.nodeExecutionPartitions') }}
                      <span v-if="executionDetails[row.jobInstanceId].partitionTotal">
                        ({{ executionDetails[row.jobInstanceId].partitions.length }}/{{
                          executionDetails[row.jobInstanceId].partitionTotal
                        }})
                      </span>
                    </strong>
                    <el-table
                      :data="executionDetails[row.jobInstanceId].partitions"
                      size="small"
                      stripe
                      :empty-text="t('common.noData')"
                    >
                      <el-table-column
                        prop="partitionNo"
                        :label="t('monitor.nodeExecutionPartitionNo')"
                        width="100"
                      />
                      <el-table-column
                        prop="partitionKey"
                        :label="t('monitor.nodeExecutionPartitionKey')"
                        min-width="160"
                      />
                      <el-table-column :label="t('monitor.nodeExecutionStatus')" width="120">
                        <template #default="{ row: partition }">
                          <StatusTag
                            :value="String(partition.partitionStatus ?? '')"
                            category="partition"
                          />
                        </template>
                      </el-table-column>
                      <el-table-column
                        prop="retryCount"
                        :label="t('monitor.nodeColRetry')"
                        width="80"
                      />
                      <el-table-column
                        prop="errorMessage"
                        :label="t('monitor.nodeColError')"
                        min-width="180"
                        show-overflow-tooltip
                      />
                    </el-table>
                  </div>
                  <div class="node-execution-detail__section">
                    <strong>
                      {{ t('monitor.nodeExecutionStages') }}
                      <span v-if="executionDetails[row.jobInstanceId].stepTotal">
                        ({{ executionDetails[row.jobInstanceId].steps.length }}/{{
                          executionDetails[row.jobInstanceId].stepTotal
                        }})
                      </span>
                    </strong>
                    <el-table
                      :data="executionDetails[row.jobInstanceId].steps"
                      size="small"
                      stripe
                      :empty-text="t('common.noData')"
                    >
                      <el-table-column
                        prop="stepCode"
                        :label="t('monitor.nodeExecutionStage')"
                        min-width="140"
                      />
                      <el-table-column
                        prop="stepType"
                        :label="t('monitor.nodeColType')"
                        width="120"
                      />
                      <el-table-column :label="t('monitor.nodeExecutionStatus')" width="120">
                        <template #default="{ row: step }">
                          <StatusTag :value="String(step.stepStatus ?? '')" category="partition" />
                        </template>
                      </el-table-column>
                      <el-table-column :label="t('monitor.nodeExecutionPipeline')" min-width="150">
                        <template #default="{ row: step }">
                          <router-link
                            v-if="step.relatedPipelineInstanceId"
                            class="cell-link"
                            :to="`/files/pipeline-obs?pipelineInstanceId=${step.relatedPipelineInstanceId}`"
                          >
                            {{ t('monitor.nodeExecutionOpenPipeline') }} →
                          </router-link>
                          <span v-else class="muted">—</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </template>
              </div>
              <el-empty
                v-else
                :description="t('monitor.nodeExecutionNoInstance')"
                :image-size="48"
              />
            </template>
          </el-table-column>
          <el-table-column prop="nodeCode" :label="t('monitor.nodeColCode')" width="140" />
          <el-table-column prop="nodeType" :label="t('monitor.nodeColType')" width="100" />
          <el-table-column :label="t('monitor.nodeColJobInstance')" width="150">
            <template #default="{ row }">
              <router-link
                v-if="row.jobInstanceId"
                class="cell-link"
                :to="`/monitor/job-instances/${row.jobInstanceId}`"
              >
                {{ row.jobInstanceId }}
              </router-link>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="nodeStatus" :label="t('monitor.nodeColStatus')" width="120">
            <template #default="{ row }">
              <StatusTag :value="String(row.nodeStatus ?? '')" category="partition" />
            </template>
          </el-table-column>
          <el-table-column prop="runSeq" :label="t('monitor.nodeColSeq')" width="70" />
          <el-table-column prop="retryCount" :label="t('monitor.nodeColRetry')" width="70" />
          <DatetimeColumn prop="startedAt" :label="t('monitor.nodeColStarted')" width="160" />
          <DatetimeColumn prop="finishedAt" :label="t('monitor.nodeColFinished')" width="160" />
          <el-table-column :label="t('monitor.nodeColError')" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
              <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
              <span v-if="workflowNodeSkipReasonText(row as ConsoleWorkflowNodeRunResponse, t)">
                {{ workflowNodeSkipReasonText(row as ConsoleWorkflowNodeRunResponse, t) }}
              </span>
              <span
                v-if="
                  !row.errorCode &&
                  !row.errorMessage &&
                  !workflowNodeSkipReasonText(row as ConsoleWorkflowNodeRunResponse, t)
                "
                class="muted"
                >—</span
              >
            </template>
          </el-table-column>
          <el-table-column
            prop="durationMs"
            :label="t('monitor.nodeColDuration')"
            width="100"
            align="right"
          />
          <el-table-column :label="t('monitor.nodeColActions')" width="190" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button
                  v-if="
                    canWriteSystem &&
                    canReplayFailedWorkflowJobNode(
                      run?.runStatus,
                      row.nodeType,
                      row.nodeStatus,
                      row.jobInstanceId,
                    )
                  "
                  size="small"
                  plain
                  type="danger"
                  :loading="replayNodeLoadingId === row.id"
                  @click="confirmReplayFailedNode(row as ConsoleWorkflowNodeRunResponse)"
                >
                  {{ t('monitor.nodeActionReplayJob') }}
                </el-button>
                <el-button
                  v-if="
                    canWriteSystem &&
                    ['RUNNING', 'FAILED'].includes(run?.runStatus ?? '') &&
                    canSkipWorkflowNode(row.nodeStatus)
                  "
                  size="small"
                  plain
                  type="warning"
                  :icon="SkipForward"
                  @click="confirmSkipNode(row as ConsoleWorkflowNodeRunResponse)"
                >
                  {{ t('monitor.nodeActionSkip') }}
                </el-button>
                <span
                  v-else-if="
                    !canReplayFailedWorkflowJobNode(
                      run?.runStatus,
                      row.nodeType,
                      row.nodeStatus,
                      row.jobInstanceId,
                    )
                  "
                  class="muted"
                  >—</span
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
        <TablePagerBar
          :page="nodePage"
          :page-size="nodePageSize"
          :total="nodeTotal"
          @update:page="onNodePageChange"
          @update:page-size="
            (s: number) => {
              nodePageSize = s
              nodePage = 1
              void loadNodeRuns()
            }
          "
        />
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import type { DeepReadonly } from 'vue'
  import type { WorkflowExecutionProgress } from '@/api/workflowRuns'
  import { computed, ref, shallowRef, watch, reactive } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { List, SkipForward, Eye as View, RefreshCw as Refresh, RotateCcw } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { instanceApi } from '@/api/instance'
  import { jobApi } from '@/api/job'
  import type { ConsoleJobPartitionResponse } from '@/api/queries/partitions'
  import {
    cancelWorkflowRun,
    pauseWorkflowRun,
    resumeWorkflowRun,
    terminateWorkflowRun,
    skipWorkflowRunNode,
    previewWholeWorkflowReplay,
    submitWholeWorkflowReplay,
    type WorkflowRunReplayRequest,
  } from '@/api/workflowRuns'
  import WorkflowExecutionPanel from '@/components/workflow/WorkflowExecutionPanel.vue'
  import { executionFocusNodeCodes } from '@/utils/workflowExecutionGraph'
  import { queryWorkflowNodeRunsPaged } from '@/api/workflowQueries'
  import { useTenantStore } from '@/stores/tenant'
  import { usePermission } from '@/composables/usePermission'
  import {
    runLifecycleAction,
    canCancelWorkflowExecution,
    canTerminateWorkflowExecution,
  } from '@/utils/runControls'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useAuthStore } from '@/stores/auth'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import PrintButton from '@/components/common/PrintButton.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type {
    ConsoleWorkflowNodeRunResponse,
    ConsoleWorkflowRunResponse,
    ConsoleJobInstanceResponse,
    ConsoleJobStepInstanceResponse,
  } from '@/types/console-api'
  import { loadWorkflowNodeExecutionDetails } from './workflowNodeExecution'
  import { workflowNodeSkipReasonText } from './workflowNodeSkipReason'
  import { canSkipWorkflowNode } from './canSkipWorkflowNode'
  import { canReplayFailedWorkflowJobNode } from './canReplayFailedWorkflowJobNode'
  import { canReplayWholeWorkflowRun } from './canReplayWholeWorkflowRun'

  const route = useRoute()
  const router = useRouter()

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const mainScope = useTenantRequestScope()
  const nodeScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const { canWriteSystem } = usePermission()
  const lifecycleAction = computed(() =>
    runLifecycleAction(run.value?.runStatus, canWriteSystem.value),
  )
  const mainLoading = ref(false)
  const nodeLoading = ref(false)
  const loading = computed(() => mainLoading.value || nodeLoading.value)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const actionLoading = ref(false)
  const wholeReplayLoading = ref(false)
  const replayNodeLoadingId = ref<number | null>(null)
  const actionPending = computed(
    () => actionLoading.value || wholeReplayLoading.value || replayNodeLoadingId.value !== null,
  )
  const run = ref<ConsoleWorkflowRunResponse | null>(null)
  let progressRevision = 0
  let loadSequence = 0
  const latestProgress = shallowRef<DeepReadonly<WorkflowExecutionProgress> | null>(null)
  const currentExecutionNodes = computed(() => {
    const snapshot = latestProgress.value
    return snapshot?.tenantId === tenant.tenantId && snapshot.workflowRunId === runId.value
      ? executionFocusNodeCodes(snapshot.nodes)
      : []
  })
  function onExecutionSnapshot(snapshot: DeepReadonly<WorkflowExecutionProgress>) {
    if (snapshot.tenantId !== tenant.tenantId || snapshot.workflowRunId !== runId.value) return
    latestProgress.value = snapshot
    progressRevision++
    if (run.value?.id === snapshot.workflowRunId)
      run.value = {
        ...run.value,
        runStatus: snapshot.runStatus,
        startedAt: snapshot.startedAt ?? '',
        finishedAt: snapshot.finishedAt ?? '',
      }
  }
  const nodeRuns = ref<ConsoleWorkflowNodeRunResponse[]>([])
  const executionDetails = reactive<
    Record<
      number,
      {
        loading: boolean
        error: boolean
        instance: ConsoleJobInstanceResponse | null
        partitions: ConsoleJobPartitionResponse[]
        partitionTotal: number
        steps: ConsoleJobStepInstanceResponse[]
        stepTotal: number
      }
    >
  >({})
  const nodeTableVisible = ref(false)
  const nodePage = ref(1)
  const nodePageSize = ref(15)
  const nodeTotal = ref(0)

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const nodeStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'workflowNodeRunStatus'),
  )

  const nodeFilterDraft = reactive({ nodeCode: '', nodeStatus: '' })
  const nodeFilterApplied = reactive({ nodeCode: '', nodeStatus: '' })

  async function loadNodeExecution(jobInstanceId: number) {
    const state = (executionDetails[jobInstanceId] ??= {
      loading: false,
      error: false,
      instance: null,
      partitions: [],
      partitionTotal: 0,
      steps: [],
      stepTotal: 0,
    })
    if (state.loading) return
    state.loading = true
    state.error = false
    try {
      const tenantId = tenant.tenantId
      const details = await loadWorkflowNodeExecutionDetails(jobInstanceId, tenantId)
      if (tenant.tenantId !== tenantId) return
      state.instance = details.instance
      state.partitions = details.partitions
      state.partitionTotal = details.partitionTotal
      state.steps = details.steps
      state.stepTotal = details.stepTotal
    } catch {
      state.error = true
    } finally {
      state.loading = false
    }
  }

  function onNodeExpand(
    row: ConsoleWorkflowNodeRunResponse,
    expanded: ConsoleWorkflowNodeRunResponse[] | boolean,
  ) {
    const isExpanded = Array.isArray(expanded)
      ? expanded.some((item) => item.id === row.id)
      : expanded
    if (row.jobInstanceId && isExpanded) {
      void loadNodeExecution(row.jobInstanceId)
    }
  }

  async function loadNodeRuns() {
    const scope = nodeScope.begin()
    const requestedRun = runId.value
    if (!scope.tenantId || !Number.isSafeInteger(requestedRun) || requestedRun <= 0) return
    const isCurrent = () => nodeScope.isCurrent(scope) && requestedRun === runId.value
    nodeLoading.value = true
    try {
      const pr = await queryWorkflowNodeRunsPaged({
        tenantId: scope.tenantId,
        page: nodePage.value,
        pageSize: nodePageSize.value,
        workflowRunId: requestedRun,
        nodeCode: nodeFilterApplied.nodeCode,
        nodeStatus: nodeFilterApplied.nodeStatus,
      })
      if (!isCurrent()) return
      nodeRuns.value = pr.records
      nodeTotal.value = pr.total
      for (const key of Object.keys(executionDetails)) delete executionDetails[Number(key)]
    } catch {
      if (!isCurrent()) return
      nodeRuns.value = []
      nodeTotal.value = 0
    } finally {
      if (isCurrent()) nodeLoading.value = false
    }
  }

  const runId = computed(() => Number(route.params.id))

  /** 每个确认绑定运行上下文；租户或路由往返不能恢复旧确认的有效性。 */
  function captureRunAction() {
    const scope = actionScope.begin()
    const requestedRun = runId.value
    const requestedRoute = route.name
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrentTarget = () =>
      actionScope.isCurrent(scope) && requestedRun === runId.value && requestedRoute === route.name
    const isCurrent = () =>
      isCurrentTarget() &&
      canWriteSystem.value &&
      operator === (auth.userInfo?.username ?? auth.userInfo?.userId)
    return { isCurrentTarget, isCurrent }
  }

  watch(
    [runId, () => route.name, () => tenant.tenantId],
    () => {
      mainScope.begin()
      nodeScope.begin()
      actionScope.begin()
      ++loadSequence
      run.value = null
      latestProgress.value = null
      nodeRuns.value = []
      nodeTotal.value = 0
      nodePage.value = 1
      for (const key of Object.keys(executionDetails)) delete executionDetails[Number(key)]
      mainLoading.value = false
      nodeLoading.value = false
      actionLoading.value = false
      wholeReplayLoading.value = false
      replayNodeLoadingId.value = null
    },
    { flush: 'sync' },
  )

  function openDag() {
    if (!run.value?.workflowDefinitionId || !Number.isFinite(runId.value)) return
    void router.push({
      path: `/workflow/viewer/${run.value.workflowDefinitionId}`,
      query: { runId: String(runId.value) },
    })
  }

  const headerDesc = computed(() =>
    Number.isFinite(runId.value) ? `Run #${runId.value}` : t('monitor.runDetailInvalidParam'),
  )

  async function load() {
    const scope = mainScope.begin()
    if (!scope.tenantId || !Number.isSafeInteger(runId.value) || runId.value <= 0) return
    const sequence = ++loadSequence
    const observedProgress = progressRevision
    const requestedTenant = tenant.tenantId
    const requestedRun = runId.value
    const isCurrent = () =>
      mainScope.isCurrent(scope) &&
      sequence === loadSequence &&
      requestedTenant === tenant.tenantId &&
      requestedRun === runId.value
    mainLoading.value = true
    try {
      const detail = await instanceApi.workflowRunDetail(requestedRun, requestedTenant)
      if (!isCurrent()) return
      run.value = detail
      if (latestProgress.value && observedProgress !== progressRevision)
        onExecutionSnapshot(latestProgress.value)
      nodePage.value = 1
      await loadNodeRuns()
    } catch {
      if (!isCurrent()) return
      run.value = null
      nodeRuns.value = []
      nodeTotal.value = 0
      nodePage.value = 1
    } finally {
      if (isCurrent()) mainLoading.value = false
    }
  }

  function applyNodeFilter() {
    return runSearch(async () => {
      nodeFilterApplied.nodeCode = nodeFilterDraft.nodeCode
      nodeFilterApplied.nodeStatus = nodeFilterDraft.nodeStatus
      nodePage.value = 1
      await loadNodeRuns()
    })
  }

  function resetNodeFilter() {
    return runReset(async () => {
      nodeFilterDraft.nodeCode = ''
      nodeFilterDraft.nodeStatus = ''
      nodeFilterApplied.nodeCode = ''
      nodeFilterApplied.nodeStatus = ''
      nodePage.value = 1
      await loadNodeRuns()
    })
  }

  function onNodePageChange(p: number) {
    nodePage.value = p
    void loadNodeRuns()
  }

  async function changeLifecycle() {
    const action = lifecycleAction.value
    if (!action) return
    const tenantId = tenant.tenantId
    const targetId = runId.value
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t(`runControl.${action}`),
        target: t('monitor.runCancelTarget', { id: targetId }),
        consequence: t(`runControl.${action}Hint`),
      })
      if (!context.isCurrent()) return
      if (
        tenantId !== tenant.tenantId ||
        targetId !== runId.value ||
        action !== lifecycleAction.value
      )
        return
      actionLoading.value = true
      const request = action === 'pause' ? pauseWorkflowRun : resumeWorkflowRun
      await request(targetId, tenantId)
      if (!context.isCurrent()) return
      if (tenantId === tenant.tenantId && targetId === runId.value) await load()
    } catch {
      /* 取消或接口错误由确认框/统一拦截器处理。 */
    } finally {
      if (context.isCurrentTarget()) actionLoading.value = false
    }
  }

  async function confirmCancel() {
    if (!canCancelWorkflowExecution(run.value?.runStatus, canWriteSystem.value)) return
    const requestedTenantId = tenant.tenantId
    const requestedRunId = runId.value
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('monitor.runCancelVerb'),
        target: t('monitor.runCancelTarget', { id: requestedRunId }),
        consequence: t('monitor.runCancelConsequence'),
        confirmButtonText: t('monitor.runCancelButton'),
      })
      if (!context.isCurrent()) return
      if (
        requestedTenantId !== tenant.tenantId ||
        requestedRunId !== runId.value ||
        !canCancelWorkflowExecution(run.value?.runStatus, canWriteSystem.value)
      )
        return
      actionLoading.value = true
      await cancelWorkflowRun(requestedRunId, requestedTenantId)
      if (!context.isCurrent()) return
      if (requestedTenantId !== tenant.tenantId || requestedRunId !== runId.value) return
      ElMessage.success(t('monitor.runCanceled'))
      await load()
    } catch {
      /* cancel */
    } finally {
      if (context.isCurrentTarget()) actionLoading.value = false
    }
  }

  async function confirmTerminate() {
    if (!canTerminateWorkflowExecution(run.value?.runStatus, canWriteSystem.value)) return
    const requestedTenantId = tenant.tenantId
    const requestedRunId = runId.value
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('monitor.runTerminateVerb'),
        target: t('monitor.runTerminateTarget', { id: requestedRunId }),
        consequence: t('monitor.runTerminateConsequence'),
        irreversible: true,
      })
      if (!context.isCurrent()) return
      if (
        requestedTenantId !== tenant.tenantId ||
        requestedRunId !== runId.value ||
        !canTerminateWorkflowExecution(run.value?.runStatus, canWriteSystem.value)
      )
        return
      actionLoading.value = true
      await terminateWorkflowRun(requestedRunId, requestedTenantId)
      if (!context.isCurrent()) return
      if (requestedTenantId !== tenant.tenantId || requestedRunId !== runId.value) return
      ElMessage.success(t('monitor.runTerminated'))
      await load()
    } catch {
      /* cancel */
    } finally {
      if (context.isCurrentTarget()) actionLoading.value = false
    }
  }

  async function confirmSkipNode(row: ConsoleWorkflowNodeRunResponse) {
    if (!canWriteSystem.value || !['RUNNING', 'FAILED'].includes(run.value?.runStatus ?? '')) return
    const requestedTenantId = tenant.tenantId
    const requestedRunId = runId.value
    const requestedNodeId = row.id
    const requestedNodeCode = row.nodeCode
    const requestedNodeStatus = row.nodeStatus
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      const skipTarget = t('monitor.skipNodeTarget', { code: requestedNodeCode })
      const promptTitle = `${t('monitor.skipNodeVerb')} ${skipTarget}`
      const promptOptions = {
        inputType: 'textarea' as const,
        inputPlaceholder: t('monitor.skipNodeReasonPlaceholder'),
        inputValidator: (value: string) => {
          const normalizedReason = value.trim()
          if (!normalizedReason) return t('monitor.skipNodeReasonRequired')
          if (normalizedReason.length > 1024) return t('monitor.skipNodeReasonTooLong')
          return true
        },
        confirmButtonText: t('monitor.skipNodeButton'),
        cancelButtonText: t('common.cancel'),
      }
      const { value: enteredReason } = await ElMessageBox.prompt(
        t('monitor.skipNodeConsequence'),
        promptTitle,
        promptOptions,
      )
      if (!context.isCurrent()) return
      const reason = enteredReason.trim()
      const currentNode = nodeRuns.value.find((node) => node.id === requestedNodeId)
      if (
        requestedTenantId !== tenant.tenantId ||
        requestedRunId !== runId.value ||
        !canWriteSystem.value ||
        !['RUNNING', 'FAILED'].includes(run.value?.runStatus ?? '') ||
        currentNode?.nodeCode !== requestedNodeCode ||
        currentNode.nodeStatus !== requestedNodeStatus ||
        !canSkipWorkflowNode(currentNode.nodeStatus)
      )
        return
      await skipWorkflowRunNode(requestedRunId, requestedTenantId, requestedNodeCode, reason)
      if (!context.isCurrent()) return
      if (requestedTenantId !== tenant.tenantId || requestedRunId !== runId.value) return
      ElMessage.success(t('monitor.skipNodeSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function confirmReplayFailedNode(row: ConsoleWorkflowNodeRunResponse) {
    if (!canWriteSystem.value) return
    const sourceRun = run.value
    const requestedTenantId = tenant.tenantId
    if (!sourceRun || !row.jobInstanceId) return
    const sourceNodeIsEligibleForReplay = canReplayFailedWorkflowJobNode(
      sourceRun.runStatus,
      row.nodeType,
      row.nodeStatus,
      row.jobInstanceId,
    )
    if (!sourceNodeIsEligibleForReplay) return
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      replayNodeLoadingId.value = row.id
      const reason = t('monitor.replayNodeAuditReason', { runId: sourceRun.id, code: row.nodeCode })
      const preview = await jobApi.previewFailedWorkflowJobNode({
        tenantId: requestedTenantId,
        workflowRunId: sourceRun.id,
        workflowNodeRunId: row.id,
        reason,
      })
      if (!context.isCurrent()) return
      const previewDetails = t('monitor.replayNodePreviewDetails', {
        jobCode: preview.jobCode,
        bizDate: preview.bizDate,
        sourceRunId: preview.sourceWorkflowRunId,
        sourceNodeRunId: preview.sourceWorkflowNodeRunId,
        sourceJobInstanceId: preview.sourceJobInstanceId,
        sourceNodeRunSeq: preview.sourceNodeRunSeq ?? t('monitor.replayNodeUnknownValue'),
        configVersion: preview.sourceConfigVersion ?? t('monitor.replayNodeUnknownValue'),
        configVersionPolicy: preview.configVersionPolicy,
        resultPolicy: preview.resultPolicy,
        warnings: preview.warnings.join(' '),
      })
      await confirmDanger({
        verb: t('monitor.replayNodeVerb'),
        target: t('monitor.replayNodeTarget', { code: preview.sourceNodeCode }),
        consequence: `${t('monitor.replayNodeConsequence')} ${previewDetails}`,
        irreversible: true,
        confirmButtonText: t('monitor.nodeActionReplayJob'),
      })
      if (!context.isCurrent()) return
      const currentNode = nodeRuns.value.find((node) => node.id === row.id)
      if (
        tenant.tenantId !== requestedTenantId ||
        run.value?.id !== sourceRun.id ||
        !canWriteSystem.value ||
        !currentNode ||
        currentNode.jobInstanceId !== row.jobInstanceId ||
        !canReplayFailedWorkflowJobNode(
          run.value.runStatus,
          currentNode.nodeType,
          currentNode.nodeStatus,
          currentNode.jobInstanceId,
        )
      )
        return
      await jobApi.replayFailedWorkflowJobNode({
        tenantId: requestedTenantId,
        jobCode: preview.jobCode,
        bizDate: preview.bizDate,
        compensationType: 'WORKFLOW_NODE',
        targetId: row.id,
        sourceWorkflowRunId: sourceRun.id,
        sourceWorkflowNodeRunId: row.id,
        reason,
        operationKey: preview.operationKey,
        previewToken: preview.previewToken,
        resultPolicy: preview.resultPolicy,
        configVersionPolicy: preview.configVersionPolicy,
        ...(preview.configVersion == null ? {} : { configVersion: preview.configVersion }),
      })
      if (!context.isCurrent()) return
      ElMessage.success(t('monitor.replayNodeSuccess'))
      await load()
    } catch {
      /* replay */
    } finally {
      if (context.isCurrentTarget()) replayNodeLoadingId.value = null
    }
  }

  async function confirmReplayWholeWorkflow() {
    const sourceRun = run.value
    const requestedTenantId = tenant.tenantId
    if (!canWriteSystem.value || !sourceRun || !canReplayWholeWorkflowRun(sourceRun.runStatus))
      return
    if (actionPending.value) return
    const context = captureRunAction()
    if (!context.isCurrent()) return
    try {
      wholeReplayLoading.value = true
      const reason = t('monitor.replayWholeWorkflowAuditReason', { runId: sourceRun.id })
      const preview = await previewWholeWorkflowReplay({
        tenantId: requestedTenantId,
        workflowRunId: sourceRun.id,
        reason,
      })
      if (!context.isCurrent()) return
      const nodeLines = preview.nodes.map((node) => {
        const capabilityStatus =
          node.capability?.status ?? t('monitor.replayWholeWorkflowCapabilityUnknown')
        const effects =
          node.capability?.declaration?.externalEffectCategories.join(', ') ||
          t('monitor.replayWholeWorkflowCapabilityUnknown')
        const blockers = node.blockers.length
          ? node.blockers.join(', ')
          : t('monitor.replayWholeWorkflowNoBlockers')
        return `${node.nodeCode} (${node.nodeType}; ${node.pluginId ?? '—'}): ${capabilityStatus}; ${effects}; ${blockers}`
      })
      const edgeLines = preview.edges.map(
        (edge) => `${edge.fromNodeCode} → ${edge.toNodeCode} (${edge.edgeType})`,
      )
      const previewDetails = [
        t('monitor.replayWholeWorkflowPreviewHeader', {
          sourceRunId: preview.sourceWorkflowRunId,
          bizDate: preview.bizDate,
          workflowVersion: preview.workflowVersion,
          resultPolicy: preview.resultPolicy,
          configVersionPolicy: preview.configVersionPolicy,
        }),
        t('monitor.replayWholeWorkflowNodesHeader'),
        ...nodeLines,
        t('monitor.replayWholeWorkflowEdgesHeader'),
        ...(edgeLines.length ? edgeLines : [t('monitor.replayWholeWorkflowNoEdges')]),
      ].join('\n')
      const blockers = preview.nodes.flatMap((node) => node.blockers)
      if (blockers.length > 0) {
        await ElMessageBox.alert(previewDetails, t('monitor.replayWholeWorkflowBlockedTitle'), {
          type: 'warning',
          confirmButtonText: t('common.close'),
        })
        return
      }
      await confirmDanger({
        verb: t('monitor.replayWholeWorkflowVerb'),
        target: t('monitor.replayWholeWorkflowTarget', { runId: sourceRun.id }),
        consequence: `${t('monitor.replayWholeWorkflowConsequence')}\n${previewDetails}`,
        irreversible: true,
        confirmButtonText: t('monitor.replayWholeWorkflowButton'),
      })
      if (!context.isCurrent()) return
      if (
        tenant.tenantId !== requestedTenantId ||
        run.value?.id !== sourceRun.id ||
        !canWriteSystem.value ||
        !canReplayWholeWorkflowRun(run.value.runStatus)
      )
        return
      const request: WorkflowRunReplayRequest = {
        tenantId: requestedTenantId,
        workflowRunId: sourceRun.id,
        reason,
        resultPolicy: preview.resultPolicy as WorkflowRunReplayRequest['resultPolicy'],
        configVersionPolicy:
          preview.configVersionPolicy as WorkflowRunReplayRequest['configVersionPolicy'],
        ...(preview.configVersion == null ? {} : { configVersion: preview.configVersion }),
        operationKey: preview.operationKey,
        previewToken: preview.previewToken,
      }
      const submission = await submitWholeWorkflowReplay(request, preview.operationKey)
      if (!context.isCurrent()) return
      ElMessage.success(
        t('monitor.replayWholeWorkflowSuccess', { approvalNo: submission.approvalNo }),
      )
      await load()
    } catch {
      /* user cancelled or request failed */
    } finally {
      if (context.isCurrentTarget()) wholeReplayLoading.value = false
    }
  }

  useTenantReload(load)

  // route.params.id 是全局共享的:点「看 DAG」跳 /workflow/viewer/:id 时,本组件在路由
  // 过渡期间仍挂载,params.id 会先变成 workflowDefinitionId(如 5),触发 watch 用 defId 当
  // runId 重新 load(),命中 /workflow-runs/5 → 404「workflow run not found」。仅当当前路由
  // 仍是本运行详情页时才重载,避免把 defId 误当 runId。
  watch(runId, () => {
    if (route.name !== 'workflow-run-detail') return
    void load()
  })
</script>

<style scoped>
  .run-detail-mini-dag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .node-runs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .run-detail-mini-dag-header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .run-detail__dag :deep(.mini-dag__graph) {
    min-height: 20rem;
  }

  .node-execution-detail {
    display: grid;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
  }

  .node-execution-detail__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .node-execution-detail__section {
    display: grid;
    gap: var(--space-sm);
  }
</style>
