<template>
  <PageContainer>
    <PageHeader :title="t('runs.title')" :description="t('runs.description')">
      <template #actions>
        <el-radio-group v-model="statusFilter" size="small" @change="loadAll">
          <el-radio-button value="all">{{ t('runs.filterAll') }}</el-radio-button>
          <el-radio-button value="running">{{ t('runs.filterRunning') }}</el-radio-button>
          <el-radio-button value="failed">{{ t('runs.filterFailed') }}</el-radio-button>
        </el-radio-group>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(loadAll)"
        >
          {{ t('runs.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 跨实体的近期运行概览:左作业,右工作流。-->
    <div class="runs-grid">
      <SectionCard>
        <template #header>
          <div class="runs-header">
            <span>{{ t('runs.jobSection') }}</span>
            <router-link class="runs-header__more" to="/monitor/job-instances">
              {{ t('runs.viewAll') }} →
            </router-link>
          </div>
        </template>
        <el-table
          v-loading="jobLoading"
          :data="jobRows"
          size="small"
          empty-text="—"
          stripe
          @row-click="goJob"
        >
          <el-table-column :label="t('runs.colInstance')" min-width="180">
            <template #default="{ row }">
              <span class="cell-link">{{ row.instanceNo }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="jobCode" :label="t('runs.colJobCode')" min-width="160" />
          <el-table-column :label="t('runs.colStatus')" width="110">
            <template #default="{ row }">
              <StatusTag :value="row.instanceStatus" category="instance" />
            </template>
          </el-table-column>
          <el-table-column prop="bizDate" :label="t('runs.colBizDate')" width="110" />
          <el-table-column :label="t('runs.colStarted')" width="160">
            <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
          </el-table-column>
        </el-table>
      </SectionCard>

      <SectionCard>
        <template #header>
          <div class="runs-header">
            <span>{{ t('runs.workflowSection') }}</span>
            <router-link class="runs-header__more" to="/monitor/workflow-runs">
              {{ t('runs.viewAll') }} →
            </router-link>
          </div>
        </template>
        <el-table
          v-loading="wfLoading"
          :data="wfRows"
          size="small"
          empty-text="—"
          stripe
          @row-click="goWorkflow"
        >
          <el-table-column :label="t('runs.colRun')" min-width="100">
            <template #default="{ row }">
              <span class="cell-link">#{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('runs.colStatus')" width="110">
            <template #default="{ row }">
              <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
            </template>
          </el-table-column>
          <el-table-column prop="bizDate" :label="t('runs.colBizDate')" width="110" />
          <el-table-column
            prop="currentNodeCode"
            :label="t('runs.colCurrentNode')"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column :label="t('runs.colStarted')" width="160">
            <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
          </el-table-column>
        </el-table>
      </SectionCard>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { fmtDatetime } from '@/utils/datetime'
  import { instanceApi } from '@/api/instance'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleJobInstanceResponse, ConsoleWorkflowRunResponse } from '@/types/console-api'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenant = useTenantStore()

  const jobRows = ref<ConsoleJobInstanceResponse[]>([])
  const wfRows = ref<ConsoleWorkflowRunResponse[]>([])
  const jobLoading = ref(false)
  const wfLoading = ref(false)
  const loading = computed(() => jobLoading.value || wfLoading.value)

  // 'all' | 'running' | 'failed' — 默认 all,oncall 切到 failed 一眼锁定挂的
  const statusFilter = ref<'all' | 'running' | 'failed'>('all')

  function statusCode(): string | undefined {
    if (statusFilter.value === 'running') return 'RUNNING'
    if (statusFilter.value === 'failed') return 'FAILED'
    return undefined
  }

  async function loadJobs() {
    jobLoading.value = true
    try {
      const page = await instanceApi.list({
        tenantId: tenant.tenantId,
        instanceStatus: statusCode(),
        page: 1,
        pageSize: 15,
      })
      jobRows.value = page.records ?? []
    } catch {
      jobRows.value = []
    } finally {
      jobLoading.value = false
    }
  }

  async function loadWorkflows() {
    wfLoading.value = true
    try {
      const page = await instanceApi.workflowRuns({
        tenantId: tenant.tenantId,
        runStatus: statusCode(),
        page: 1,
        pageSize: 15,
      })
      wfRows.value = page.records ?? []
    } catch {
      wfRows.value = []
    } finally {
      wfLoading.value = false
    }
  }

  function loadAll() {
    void loadJobs()
    void loadWorkflows()
  }

  function goJob(row: ConsoleJobInstanceResponse) {
    router.push(`/monitor/job-instances/${row.id}`)
  }

  function goWorkflow(row: ConsoleWorkflowRunResponse) {
    router.push(`/monitor/workflow-runs/${row.id}`)
  }

  // useTenantReload immediate:true 已经在 setup 时调一次 loadAll;
  // 之前还重复 onMounted(loadAll),首屏会触发 2 次 GET → 删 onMounted。
  useTenantReload(loadAll)
</script>

<style scoped>
  .runs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(520px, 1fr));
    gap: var(--space-md);
  }

  .runs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .runs-header__more {
    font-size: 13px;
    color: var(--el-color-primary);
    text-decoration: none;
  }

  .runs-header__more:hover {
    text-decoration: underline;
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }
</style>
