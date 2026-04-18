<template>
  <PageContainer>
    <PageHeader
      title="Workflow Run 详情"
      :description="headerDesc"
      back-to="/monitor/workflow-runs"
    >
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
        <el-table-column prop="errorMessage" label="错误" min-width="160" show-overflow-tooltip />
        <el-table-column prop="durationMs" label="耗时 ms" width="100" />
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
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { instanceApi } from '@/api/instance'
  import { cancelWorkflowRun, terminateWorkflowRun, skipWorkflowRunNode } from '@/api/workflowRuns'
  import { queryWorkflowNodeRuns } from '@/api/workflowQueries'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type {
    ConsoleWorkflowNodeRunResponse,
    ConsoleWorkflowRunResponse,
  } from '@/types/console-api'

  const route = useRoute()

  const tenant = useTenantStore()
  const loading = ref(false)
  const actionLoading = ref(false)
  const run = ref<ConsoleWorkflowRunResponse | null>(null)
  const nodeRuns = ref<ConsoleWorkflowNodeRunResponse[]>([])

  const runId = computed(() => Number(route.params.id))

  const headerDesc = computed(() =>
    Number.isFinite(runId.value) ? `Run #${runId.value}` : '无效路由参数',
  )

  async function load() {
    if (!Number.isFinite(runId.value)) return
    loading.value = true
    try {
      run.value = await instanceApi.workflowRunDetail(runId.value, tenant.tenantId)
      // 传入 workflowRunId 让后端过滤，避免拉取全量 nodeRuns
      const items = await queryWorkflowNodeRuns(tenant.tenantId, runId.value)
      nodeRuns.value = items.filter((n) => n.workflowRunId === runId.value)
    } catch {
      run.value = null
      nodeRuns.value = []
    } finally {
      loading.value = false
    }
  }

  async function confirmCancel() {
    try {
      await ElMessageBox.confirm(`取消 Workflow Run #${runId.value}？`, '取消确认', {
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
      await ElMessageBox.confirm(`强制终止 Workflow Run #${runId.value}？不可逆。`, '终止确认', {
        type: 'error',
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

  watch(
    () => [runId.value, tenant.tenantId] as const,
    () => load(),
    { immediate: true },
  )
</script>
