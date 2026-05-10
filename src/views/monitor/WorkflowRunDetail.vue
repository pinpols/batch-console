<template>
  <PageContainer>
    <PageHeader title="工作流运行详情" :description="headerDesc" back-to="/monitor/workflow-runs">
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="run" type="warning" :loading="actionLoading" @click="confirmCancel"
          >取消</el-button
        >
        <el-button v-if="run" type="danger" :loading="actionLoading" @click="confirmTerminate"
          >终止</el-button
        >
      </template>
    </PageHeader>

    <SectionCard v-if="run">
      <template #header>运行主档</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Run Id">{{ run.id }}</el-descriptions-item>
        <el-descriptions-item label="Def Id">{{ run.workflowDefinitionId }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ run.runStatus }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ run.currentNodeCode }}</el-descriptions-item>
        <el-descriptions-item label="业务日">{{ run.bizDate }}</el-descriptions-item>
        <el-descriptions-item label="Trace">{{ run.traceId }}</el-descriptions-item>
        <el-descriptions-item label="开始">{{ run.startedAt }}</el-descriptions-item>
        <el-descriptions-item label="结束">{{ run.finishedAt }}</el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard>
      <template #header
        >节点运行（GET /api/console/queries/workflow-node-runs，端上按 workflowRunId
        过滤）</template
      >
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
            placeholder="exact"
            @keyup.enter="applyNodeFilter"
          />
        </el-form-item>
        <el-form-item label="nodeStatus">
          <MetaSelect
            class="query-w-200"
            v-model="nodeFilterDraft.nodeStatus"
            clearable
            filterable
            placeholder="全部"
            :options="nodeStatusOptions"
          />
        </el-form-item>
      </ListPageQueryBar>
      <el-table
        v-loading="loading"
        :data="nodeRuns"
        stripe
        border
        empty-text="暂无数据"
        class="console-table"
      >
        <el-table-column prop="nodeCode" label="节点" width="140" />
        <el-table-column prop="nodeType" label="类型" width="100" />
        <el-table-column prop="nodeStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.nodeStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column prop="runSeq" label="序号" width="70" />
        <el-table-column prop="retryCount" label="重试" width="70" />
        <DatetimeColumn prop="startedAt" label="开始" width="160" />
        <DatetimeColumn prop="finishedAt" label="完成" width="160" />
        <el-table-column label="错误" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
            <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
            <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="durationMs" label="耗时 ms" width="100" align="right" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="warning" @click="confirmSkipNode(row)"
                >跳过</el-button
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
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
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

  const headerDesc = computed(() =>
    Number.isFinite(runId.value) ? `Run #${runId.value}` : '无效路由参数',
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
      await ElMessageBox.confirm(`取消工作流运行 #${runId.value}？`, '取消确认', {
        type: 'warning',
      })
      actionLoading.value = true
      await cancelWorkflowRun(runId.value, tenant.tenantId)
      ElMessage.success('已取消')
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
        verb: '强制终止',
        target: `工作流运行 #${runId.value}`,
        consequence: '所有正在执行的节点会被打断;已写入的中间结果不会回滚,需手动清理或重跑。',
        irreversible: true,
      })
      actionLoading.value = true
      await terminateWorkflowRun(runId.value, tenant.tenantId)
      ElMessage.success('已终止')
      await load()
    } catch {
      /* cancel */
    } finally {
      actionLoading.value = false
    }
  }

  async function confirmSkipNode(row: ConsoleWorkflowNodeRunResponse) {
    try {
      await ElMessageBox.confirm(`跳过节点 ${row.nodeCode}？`, '跳过确认', { type: 'warning' })
      await skipWorkflowRunNode(runId.value, tenant.tenantId, row.nodeCode)
      ElMessage.success('已跳过')
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
