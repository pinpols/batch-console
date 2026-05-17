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
        <el-button v-if="run?.workflowDefinitionId" :icon="View" @click="openDag">
          看 DAG
        </el-button>
        <el-button v-if="run" type="warning" :loading="actionLoading" @click="confirmCancel">
          {{ t('monitor.runDetailCancel') }}
        </el-button>
        <el-button v-if="run" type="danger" :loading="actionLoading" @click="confirmTerminate">
          {{ t('monitor.runDetailTerminate') }}
        </el-button>
      </template>
    </PageHeader>

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
          {{ run.currentNodeCode }}
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
          {{ run.startedAt }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.runDetailFinished')">
          {{ run.finishedAt }}
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard>
      <template #header>{{ t('monitor.nodeRunsHeader') }}</template>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="applyNodeFilter"
        @reset="resetNodeFilter"
        @refresh="() => runRefresh(loadNodeRuns)"
      >
        <el-form-item label="nodeCode">
          <el-input
            class="query-w-200"
            v-model="nodeFilterDraft.nodeCode"
            clearable
            :placeholder="t('monitor.nodeFilterCodePlaceholder')"
            @keyup.enter="applyNodeFilter"
          />
        </el-form-item>
        <el-form-item label="nodeStatus">
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
      >
        <el-table-column prop="nodeCode" :label="t('monitor.nodeColCode')" width="140" />
        <el-table-column prop="nodeType" :label="t('monitor.nodeColType')" width="100" />
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
            <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="durationMs"
          :label="t('monitor.nodeColDuration')"
          width="100"
          align="right"
        />
        <el-table-column :label="t('monitor.nodeColActions')" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="warning" @click="confirmSkipNode(row)">
                {{ t('monitor.nodeActionSkip') }}
              </el-button>
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
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { View, Refresh } from '@element-plus/icons-vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { instanceApi } from '@/api/instance'
  import { cancelWorkflowRun, terminateWorkflowRun, skipWorkflowRunNode } from '@/api/workflowRuns'
  import { queryWorkflowNodeRunsPaged } from '@/api/workflowQueries'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type {
    ConsoleWorkflowNodeRunResponse,
    ConsoleWorkflowRunResponse,
  } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()

  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const actionLoading = ref(false)
  const run = ref<ConsoleWorkflowRunResponse | null>(null)
  const nodeRuns = ref<ConsoleWorkflowNodeRunResponse[]>([])
  const nodePage = ref(1)
  const nodePageSize = ref(20)
  const nodeTotal = ref(0)

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const nodeStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'workflowNodeRunStatus'),
  )

  const nodeFilterDraft = reactive({ nodeCode: '', nodeStatus: '' })
  const nodeFilterApplied = reactive({ nodeCode: '', nodeStatus: '' })

  async function loadNodeRuns() {
    if (!Number.isFinite(runId.value)) return
    loading.value = true
    try {
      const pr = await queryWorkflowNodeRunsPaged({
        tenantId: tenant.tenantId,
        page: nodePage.value,
        pageSize: nodePageSize.value,
        workflowRunId: runId.value,
        nodeCode: nodeFilterApplied.nodeCode,
        nodeStatus: nodeFilterApplied.nodeStatus,
      })
      nodeRuns.value = pr.records
      nodeTotal.value = pr.total
    } catch {
      nodeRuns.value = []
      nodeTotal.value = 0
    } finally {
      loading.value = false
    }
  }

  const runId = computed(() => Number(route.params.id))

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
    if (!Number.isFinite(runId.value)) return
    loading.value = true
    try {
      run.value = await instanceApi.workflowRunDetail(runId.value, tenant.tenantId)
      nodePage.value = 1
      await loadNodeRuns()
    } catch {
      run.value = null
      nodeRuns.value = []
      nodeTotal.value = 0
      nodePage.value = 1
    } finally {
      loading.value = false
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

  async function confirmCancel() {
    try {
      await confirmDanger({
        verb: '取消',
        target: `工作流运行「#${runId.value}」`,
        consequence:
          '未开始的节点不再派发,正在运行的节点会按各自策略尽快收尾。已完成节点的产物保留。',
        confirmButtonText: '确认取消',
      })
      actionLoading.value = true
      await cancelWorkflowRun(runId.value, tenant.tenantId)
      ElMessage.success(t('monitor.runCanceled'))
      await load()
    } catch {
      /* cancel */
    } finally {
      actionLoading.value = false
    }
  }

  async function confirmTerminate() {
    try {
      await confirmDanger({
        verb: t('monitor.runTerminateVerb'),
        target: t('monitor.runTerminateTarget', { id: runId.value }),
        consequence: t('monitor.runTerminateConsequence'),
        irreversible: true,
      })
      actionLoading.value = true
      await terminateWorkflowRun(runId.value, tenant.tenantId)
      ElMessage.success(t('monitor.runTerminated'))
      await load()
    } catch {
      /* cancel */
    } finally {
      actionLoading.value = false
    }
  }

  async function confirmSkipNode(row: ConsoleWorkflowNodeRunResponse) {
    try {
      await confirmDanger({
        verb: '跳过',
        target: `节点「${row.nodeCode}」`,
        consequence: '该节点状态置为 SKIPPED,下游节点按依赖正常推进,但本节点的输出不会产生。',
        irreversible: true,
        confirmButtonText: '确认跳过',
      })
      await skipWorkflowRunNode(runId.value, tenant.tenantId, row.nodeCode)
      ElMessage.success(t('monitor.skipNodeSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)

  watch(runId, () => {
    void load()
  })
</script>
