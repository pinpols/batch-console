<template>
  <PageContainer>
    <PageHeader
      :title="pageTitle"
      :description="job ? `${job.jobType} / ${job.scheduleType}` : ''"
      back-to="/jobs/definitions"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="job" type="primary" :loading="triggering" @click="triggerJob">
          手工触发
        </el-button>
      </template>
    </PageHeader>

    <CalendarMiniCreateDrawer
      v-if="job?.tenantId"
      v-model:visible="calendarMiniVisible"
      :tenant-id="job.tenantId"
      @created="onCalendarCreated"
    />
    <WindowMiniCreateDrawer
      v-if="job?.tenantId"
      v-model:visible="windowMiniVisible"
      :tenant-id="job.tenantId"
      @created="onWindowCreated"
    />

    <SectionCard>
      <div v-if="loading && !job" class="detail-loading">
        <el-skeleton :rows="8" animated />
      </div>
      <el-empty v-else-if="!job" description="作业定义不存在或当前租户无权访问" />
      <template v-else>
        <div class="detail-summary">
          <div>
            <div class="summary-code">{{ job.jobCode }}</div>
            <div class="summary-name">{{ job.jobName || '—' }}</div>
          </div>
          <div class="summary-tags">
            <StatusTag :value="job.jobType" category="jobType" />
            <StatusTag :value="String(job.enabled)" category="yn" />
            <StatusTag :value="job.executionMode || 'FULL'" category="executionMode" />
          </div>
        </div>

        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <JobConfigBasicSection
              :job="job"
              :execution-mode-label="resolveEnumLabel('executionMode', job.executionMode)"
            />
          </el-tab-pane>

          <el-tab-pane label="调度" name="schedule">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="scheduleType">
                  {{ job.scheduleType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="scheduleExpr">
                  <span class="mono">{{ job.scheduleExpr || '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="timezone">
                  {{ job.timezone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="calendarCode">
                  {{ job.calendarCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="windowCode">
                  {{ job.windowCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="dagEnabled">
                  {{ job.dagEnabled ? '是' : '否' }}
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button @click="calendarMiniVisible = true">+ 新建日历</el-button>
                <el-button @click="windowMiniVisible = true">+ 新建窗口</el-button>
                <el-button @click="router.push('/governance/calendars')">维护日历</el-button>
                <el-button @click="router.push('/governance/windows')">维护窗口</el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="资源" name="resource">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="queueCode">
                  {{ job.queueCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="workerGroup">
                  {{ job.workerGroup || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="priority">
                  {{ job.priority ?? '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="shardStrategy">
                  {{ job.shardStrategy || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="timeoutSeconds">
                  {{ job.timeoutSeconds ?? '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="retryPolicy">
                  {{ job.retryPolicy || '—' }}
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button @click="router.push('/governance/queues')">维护队列</el-button>
                <el-button @click="router.push('/governance/quota')">维护配额</el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="触发" name="trigger">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="triggerMode">
                  {{ job.triggerMode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="scheduleType">
                  {{ job.scheduleType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="defaultParams" :span="2">
                  <pre class="json-block">{{ formatJson(job.defaultParams) }}</pre>
                </el-descriptions-item>
                <el-descriptions-item label="paramSchema" :span="2">
                  <pre class="json-block">{{ formatJson(job.paramSchema) }}</pre>
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button type="primary" :loading="triggering" @click="triggerJob">
                  手工触发
                </el-button>
                <el-button @click="router.push('/self-service')">补跑/自助入口</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- el-tab-pane 不能用 v-if(EP unmount 时 panes.indexOf 报错),改在内部条件渲染 -->
          <el-tab-pane label="关联文件" name="files" lazy>
            <JobRelatedFilesTab
              v-if="job.jobType === 'IMPORT' || job.jobType === 'EXPORT'"
              :tenant-id="job.tenantId"
              :job-code="job.jobCode"
            />
            <el-empty
              v-else
              description="此作业类型不涉及文件管道(仅 IMPORT / EXPORT 作业关联 fileChannels / fileTemplates)"
            />
          </el-tab-pane>

          <el-tab-pane label="关联编排" name="workflow" lazy>
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="jobType">{{ job.jobType }}</el-descriptions-item>
                <el-descriptions-item label="dagEnabled">
                  {{ job.dagEnabled ? '是' : '否' }}
                </el-descriptions-item>
                <el-descriptions-item label="executionHandler" :span="2">
                  <span class="mono">{{ job.executionHandler || '—' }}</span>
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-toolbar">
                <span>租户内 Workflow 定义(WORKFLOW 类型作业可关联)</span>
                <el-button :loading="workflowsLoading" @click="loadWorkflows">刷新</el-button>
              </div>
              <el-table
                v-loading="workflowsLoading"
                :data="workflowRows"
                size="small"
                stripe
                empty-text="当前租户暂无 workflow 定义"
                @row-click="goWorkflowDesigner"
              >
                <el-table-column prop="workflowCode" label="workflowCode" min-width="200">
                  <template #default="{ row }">
                    <span class="cell-link">{{ row.workflowCode }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="workflowName" label="名称" min-width="180" />
                <el-table-column prop="workflowType" label="类型" width="120" />
                <el-table-column prop="version" label="版本" width="80" />
                <el-table-column label="启用" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
                      {{ row.enabled ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div class="panel-actions">
                <el-button @click="router.push('/workflow/definitions')">维护工作流定义</el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="告警" name="alerts" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>当前租户告警路由(用于匹配 alertGroup / receiver,FE 仅列出可绑定路由)</span>
                <el-button :loading="alertsLoading" @click="loadAlerts">刷新</el-button>
              </div>
              <el-table
                v-loading="alertsLoading"
                :data="alertRows"
                size="small"
                stripe
                empty-text="当前租户无告警路由,先去治理页新建"
              >
                <el-table-column prop="routeCode" label="routeCode" min-width="160" />
                <el-table-column prop="team" label="team" width="140" />
                <el-table-column prop="severity" label="severity" width="100" />
                <el-table-column
                  prop="receiver"
                  label="receiver"
                  min-width="200"
                  show-overflow-tooltip
                />
                <el-table-column label="启用" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
                      {{ row.enabled ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div class="panel-actions">
                <el-button @click="router.push('/observability/alert-routings')">
                  维护告警路由
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="运行历史" name="runs" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>最近 20 次运行</span>
                <el-button text type="primary" @click="goAllRuns">查看全部</el-button>
              </div>
              <el-table
                v-loading="runsLoading"
                :data="runs"
                size="small"
                stripe
                empty-text="暂无运行记录"
                @row-click="goRunDetail"
              >
                <el-table-column prop="instanceNo" label="实例号" min-width="220">
                  <template #default="{ row }">
                    <span class="cell-link">{{ row.instanceNo }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="130">
                  <template #default="{ row }">
                    <StatusTag :value="row.instanceStatus" category="instance" />
                  </template>
                </el-table-column>
                <el-table-column prop="bizDate" label="业务日期" width="120" />
                <el-table-column label="开始时间" width="180">
                  <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
                </el-table-column>
                <el-table-column label="结束时间" width="180">
                  <template #default="{ row }">{{ fmtDatetime(row.finishedAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="审计" name="audit" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>按作业编码匹配最近审计记录</span>
                <el-button :loading="auditLoading" @click="loadAudits">刷新</el-button>
              </div>
              <el-table
                v-loading="auditLoading"
                :data="auditRows"
                size="small"
                stripe
                empty-text="暂无审计记录"
              >
                <el-table-column prop="operationType" label="操作" width="180" />
                <el-table-column prop="operationResult" label="结果" width="110" />
                <el-table-column prop="operatorId" label="操作人" width="160" />
                <el-table-column
                  prop="detailSummary"
                  label="摘要"
                  min-width="260"
                  show-overflow-tooltip
                />
                <el-table-column prop="createdAt" label="时间" width="180" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'
  import { jobApi } from '@/api/job'
  import { instanceApi } from '@/api/instance'
  import { governanceApi, type GovernanceAlertRoutingRow } from '@/api/governance'
  import { workflowApi } from '@/api/workflow'
  import { queryAudits } from '@/api/observabilityQueries'
  import type { ConsoleWorkflowDefinitionResponse } from '@/types/console-api'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { fmtDatetime } from '@/utils/datetime'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JobConfigBasicSection from './components/JobConfigBasicSection.vue'
  import JobRelatedFilesTab from './components/JobRelatedFilesTab.vue'
  import CalendarMiniCreateDrawer from './components/CalendarMiniCreateDrawer.vue'
  import WindowMiniCreateDrawer from './components/WindowMiniCreateDrawer.vue'
  import type {
    ConsoleAuditLogResponse,
    ConsoleJobDefinitionResponse,
    ConsoleJobInstanceResponse,
  } from '@/types/console-api'

  type DetailTab =
    | 'basic'
    | 'schedule'
    | 'resource'
    | 'trigger'
    | 'files'
    | 'workflow'
    | 'alerts'
    | 'runs'
    | 'audit'

  const DETAIL_TABS = new Set<DetailTab>([
    'basic',
    'schedule',
    'resource',
    'trigger',
    'files',
    'workflow',
    'alerts',
    'runs',
    'audit',
  ])

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { data: metaEnumsData } = useConsoleMetaEnumsQuery()

  type JobDefinitionDetailModel = ConsoleJobDefinitionResponse &
    Partial<{
      dagEnabled: boolean
      defaultParams: string
      expectedDurationSeconds: number
      priority: number
      timezone: string
      triggerMode: string
    }>

  function tabFromQuery(): DetailTab {
    const raw = String(route.query.tab || 'basic')
    return DETAIL_TABS.has(raw as DetailTab) ? (raw as DetailTab) : 'basic'
  }

  const activeTab = ref<DetailTab>(tabFromQuery())
  const loading = ref(false)
  const triggering = ref(false)
  const job = ref<JobDefinitionDetailModel | null>(null)
  const runs = ref<ConsoleJobInstanceResponse[]>([])
  const runsLoading = ref(false)
  const runsLoaded = ref(false)
  const auditRows = ref<ConsoleAuditLogResponse[]>([])
  const auditLoading = ref(false)
  const auditsLoaded = ref(false)
  const alertRows = ref<GovernanceAlertRoutingRow[]>([])
  const alertsLoading = ref(false)
  const alertsLoaded = ref(false)
  const workflowRows = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const workflowsLoading = ref(false)
  const workflowsLoaded = ref(false)
  const calendarMiniVisible = ref(false)
  const windowMiniVisible = ref(false)

  const jobId = computed(() => Number(route.params.id))
  const tenantId = computed(() => String(route.query.tenantId || tenant.tenantId))
  const pageTitle = computed(() => (job.value ? `作业详情 · ${job.value.jobCode}` : '作业详情'))

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    return metaEnumsData.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  function formatJson(raw: string | undefined | null): string {
    if (!raw) return '—'
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  async function load() {
    if (!Number.isFinite(jobId.value) || jobId.value <= 0) {
      job.value = null
      return
    }
    loading.value = true
    try {
      job.value = await jobApi.getDefinition(jobId.value, tenantId.value)
      if (
        activeTab.value === 'files' &&
        job.value.jobType !== 'IMPORT' &&
        job.value.jobType !== 'EXPORT'
      ) {
        activeTab.value = 'basic'
      }
      runsLoaded.value = false
      auditsLoaded.value = false
      alertsLoaded.value = false
      workflowsLoaded.value = false
      runs.value = []
      auditRows.value = []
      alertRows.value = []
      workflowRows.value = []
      void loadLazyTab(activeTab.value)
    } finally {
      loading.value = false
    }
  }

  async function loadRuns() {
    if (!job.value || runsLoaded.value) return
    runsLoading.value = true
    try {
      const result = await instanceApi.list({
        tenantId: job.value.tenantId,
        jobCode: job.value.jobCode,
        page: 1,
        pageSize: 20,
      })
      runs.value = result.records ?? []
      runsLoaded.value = true
    } finally {
      runsLoading.value = false
    }
  }

  async function loadAudits() {
    if (!job.value) return
    auditLoading.value = true
    try {
      const rows = await queryAudits(job.value.tenantId)
      auditRows.value = rows
        .filter((row) => {
          const text = `${row.operationType ?? ''} ${row.detailSummary ?? ''} ${row.evidenceRef ?? ''}`
          return text.includes(job.value?.jobCode ?? '')
        })
        .slice(0, 50)
      auditsLoaded.value = true
    } finally {
      auditLoading.value = false
    }
  }

  async function loadAlerts() {
    if (!job.value) return
    alertsLoading.value = true
    try {
      alertRows.value = await governanceApi.listAlertRoutings(job.value.tenantId)
      alertsLoaded.value = true
    } finally {
      alertsLoading.value = false
    }
  }

  async function loadWorkflows() {
    if (!job.value) return
    workflowsLoading.value = true
    try {
      const result = await workflowApi.listDefinitions({
        tenantId: job.value.tenantId,
        page: 1,
        pageSize: 50,
      })
      workflowRows.value = result.records ?? []
      workflowsLoaded.value = true
    } finally {
      workflowsLoading.value = false
    }
  }

  function goWorkflowDesigner(row: ConsoleWorkflowDefinitionResponse) {
    void router.push(`/workflow/viewer/${row.id}`)
  }

  function onCalendarCreated(code: string) {
    ElMessage.success(`已新建日历 ${code},可在治理页绑定到本作业`)
    calendarMiniVisible.value = false
  }

  function onWindowCreated(code: string) {
    ElMessage.success(`已新建窗口 ${code},可在治理页绑定到本作业`)
    windowMiniVisible.value = false
  }

  function loadLazyTab(tab: DetailTab) {
    if (tab === 'runs') return loadRuns()
    if (tab === 'audit' && !auditsLoaded.value) return loadAudits()
    if (tab === 'alerts' && !alertsLoaded.value) return loadAlerts()
    if (tab === 'workflow' && !workflowsLoaded.value) return loadWorkflows()
  }

  async function triggerJob() {
    if (!job.value) return
    let payloadText = job.value.defaultParams?.trim() || '{}'
    try {
      const { value } = await ElMessageBox.prompt(
        '确认本次手工触发参数',
        `触发 ${job.value.jobCode}`,
        {
          inputType: 'textarea',
          inputValue: payloadText,
          confirmButtonText: '触发',
          cancelButtonText: '取消',
          inputValidator: (v: string) => {
            const text = v?.trim() || '{}'
            try {
              JSON.parse(text)
              return true
            } catch {
              return '请输入合法 JSON'
            }
          },
        },
      )
      payloadText = value?.trim() || '{}'
    } catch {
      return
    }
    triggering.value = true
    try {
      await jobApi.trigger(job.value.jobCode, job.value.tenantId, JSON.parse(payloadText))
      ElMessage.success('已提交触发请求')
      runsLoaded.value = false
      if (activeTab.value === 'runs') await loadRuns()
    } finally {
      triggering.value = false
    }
  }

  function goAllRuns() {
    if (!job.value) return
    void router.push({
      path: '/monitor/job-instances',
      query: { jobCode: job.value.jobCode, range: 'all' },
    })
  }

  function goRunDetail(row: ConsoleJobInstanceResponse) {
    void router.push(`/monitor/job-instances/${row.id}`)
  }

  watch(activeTab, (tab) => {
    void loadLazyTab(tab)
    if (route.query.tab !== tab) {
      void router.replace({ query: { ...route.query, tab } })
    }
  })

  watch(
    () => route.query.tab,
    () => {
      const next = tabFromQuery()
      if (next !== activeTab.value) activeTab.value = next
    },
  )

  watch(
    () => job.value?.jobType,
    (jobType) => {
      if (activeTab.value === 'files' && jobType !== 'IMPORT' && jobType !== 'EXPORT') {
        activeTab.value = 'basic'
      }
    },
    { immediate: true },
  )

  watch(
    () => route.query.tenantId,
    () => {
      void load()
    },
  )

  watch(
    () => [route.params.id, tenant.tenantId],
    () => {
      void load()
    },
  )

  onMounted(load)
</script>

<style scoped>
  .detail-loading {
    padding: 8px 0;
  }

  .detail-summary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .summary-code {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .summary-name {
    margin-top: 4px;
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .summary-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .detail-tabs {
    margin-top: 16px;
  }

  .tab-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .panel-actions,
  .panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .panel-actions {
    justify-content: flex-start;
  }

  .mono,
  .json-block {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
    font-size: 12px;
  }

  .json-block {
    max-height: 240px;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .cell-link {
    color: var(--color-primary);
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .detail-summary {
      flex-direction: column;
    }

    .summary-tags {
      justify-content: flex-start;
    }
  }
</style>
