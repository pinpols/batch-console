<template>
  <PageContainer>
    <PageHeader
      :title="pageTitle"
      :description="job ? `${job.jobType} / ${job.scheduleType}` : ''"
      back-to="/jobs/definitions"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
        <el-button v-if="job" :icon="MagicStick" @click="dryRunVisible = true">
          {{ t('jobDefinitionDetail.dryRun') }}
        </el-button>
        <el-button v-if="job" type="primary" :loading="triggering" @click="triggerJob">
          {{ t('jobDefinitionDetail.manualTrigger') }}
        </el-button>
      </template>
    </PageHeader>

    <DryRunPlanDialog
      v-if="job"
      v-model="dryRunVisible"
      :tenant-id="job.tenantId"
      :job-code="job.jobCode"
      :default-params="job.defaultParams"
    />

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
      <el-empty v-else-if="!job" :description="t('jobDefinitionDetail.emptyJob')" />
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
          <el-tab-pane :label="t('jobDefinitionDetail.tabBasic')" name="basic">
            <JobConfigBasicSection
              :job="job"
              :execution-mode-label="resolveEnumLabel('executionMode', job.executionMode)"
            />
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabSchedule')" name="schedule">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleType')">
                  {{ job.scheduleType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleExpr')">
                  <span class="mono">{{ job.scheduleExpr || '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="dependsOnJobCode">
                  <span class="mono">{{ job.dependsOnJobCode || '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldTimezone')">
                  {{ job.timezone || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldCalendarCode')">
                  {{ job.calendarCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldWindowCode')">
                  {{ job.windowCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldDagEnabled')">
                  {{ job.dagEnabled ? t('common.yes') : t('common.no') }}
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button @click="calendarMiniVisible = true">
                  {{ t('jobDefinitionDetail.btnNewCalendar') }}
                </el-button>
                <el-button @click="windowMiniVisible = true">
                  {{ t('jobDefinitionDetail.btnNewWindow') }}
                </el-button>
                <el-button @click="router.push('/governance/calendars')">
                  {{ t('jobDefinitionDetail.maintainCalendar') }}
                </el-button>
                <el-button @click="router.push('/governance/windows')">
                  {{ t('jobDefinitionDetail.maintainWindow') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabResource')" name="resource">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldQueueCode')">
                  {{ job.queueCode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldWorkerGroup')">
                  {{ job.workerGroup || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldPriority')">
                  {{ job.priority ?? '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldShardStrategy')">
                  {{ job.shardStrategy || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldTimeoutSeconds')">
                  {{ job.timeoutSeconds ?? '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldRetryPolicy')">
                  {{ job.retryPolicy || '—' }}
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button @click="router.push('/governance/queues')">
                  {{ t('jobDefinitionDetail.maintainQueue') }}
                </el-button>
                <el-button @click="router.push('/governance/quota')">
                  {{ t('jobDefinitionDetail.maintainQuota') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabTrigger')" name="trigger">
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldTriggerMode')">
                  {{ job.triggerMode || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleType')">
                  {{ job.scheduleType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldDefaultParams')" :span="2">
                  <pre class="json-block">{{ formatJson(job.defaultParams) }}</pre>
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldParamSchema')" :span="2">
                  <pre class="json-block">{{ formatJson(job.paramSchema) }}</pre>
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-actions">
                <el-button type="primary" :loading="triggering" @click="triggerJob">
                  {{ t('jobDefinitionDetail.manualTrigger') }}
                </el-button>
                <el-button @click="router.push('/self-service')">
                  {{ t('jobDefinitionDetail.btnSelfService') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- el-tab-pane 不能用 v-if(EP unmount 时 panes.indexOf 报错),改在内部条件渲染 -->
          <el-tab-pane :label="t('jobDefinitionDetail.tabFiles')" name="files" lazy>
            <JobRelatedFilesTab
              v-if="job.jobType === 'IMPORT' || job.jobType === 'EXPORT'"
              :tenant-id="job.tenantId"
              :job-code="job.jobCode"
            />
            <el-empty v-else :description="t('jobDefinitionDetail.filesNotApplicable')" />
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabWorkflow')" name="workflow" lazy>
            <div class="tab-panel">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldJobType')">{{
                  job.jobType
                }}</el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldDagEnabled')">
                  {{ job.dagEnabled ? t('common.yes') : t('common.no') }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldExecutionHandler')" :span="2">
                  <span class="mono">{{ job.executionHandler || '—' }}</span>
                </el-descriptions-item>
              </el-descriptions>
              <div class="panel-toolbar">
                <span>{{ t('jobDefinitionDetail.workflowToolbarHint') }}</span>
                <el-button :loading="workflowsLoading" @click="loadWorkflows">
                  {{ t('common.refresh') }}
                </el-button>
              </div>
              <el-table
                v-loading="workflowsLoading"
                :data="workflowRows"
                size="small"
                stripe
                :empty-text="t('jobDefinitionDetail.emptyWorkflows')"
                @row-click="goWorkflowDesigner"
              >
                <el-table-column
                  prop="workflowCode"
                  :label="t('jobDefinitionDetail.colWorkflowCode')"
                  min-width="200"
                >
                  <template #default="{ row }">
                    <span class="cell-link">{{ row.workflowCode }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="workflowName"
                  :label="t('jobDefinitionDetail.colName')"
                  min-width="180"
                />
                <el-table-column
                  prop="workflowType"
                  :label="t('jobDefinitionDetail.colType')"
                  width="120"
                />
                <el-table-column
                  prop="version"
                  :label="t('jobDefinitionDetail.colVersion')"
                  width="80"
                />
                <el-table-column :label="t('jobDefinitionDetail.colEnabled')" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
                      {{ row.enabled ? t('common.yes') : t('common.no') }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div class="panel-actions">
                <el-button @click="router.push('/workflow/definitions')">
                  {{ t('jobDefinitionDetail.maintainWorkflowDefinition') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabAlerts')" name="alerts" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>{{ t('jobDefinitionDetail.alertsToolbarHint') }}</span>
                <el-button :loading="alertsLoading" @click="loadAlerts">
                  {{ t('common.refresh') }}
                </el-button>
              </div>
              <el-table
                v-loading="alertsLoading"
                :data="alertRows"
                size="small"
                stripe
                :empty-text="t('jobDefinitionDetail.emptyAlerts')"
              >
                <el-table-column
                  prop="routeCode"
                  :label="t('jobDefinitionDetail.colRouteCode')"
                  min-width="160"
                />
                <el-table-column
                  prop="team"
                  :label="t('jobDefinitionDetail.colTeam')"
                  width="140"
                />
                <el-table-column
                  prop="severity"
                  :label="t('jobDefinitionDetail.colSeverity')"
                  width="100"
                />
                <el-table-column
                  prop="receiver"
                  :label="t('jobDefinitionDetail.colReceiver')"
                  min-width="200"
                  show-overflow-tooltip
                />
                <el-table-column :label="t('jobDefinitionDetail.colEnabled')" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
                      {{ row.enabled ? t('common.yes') : t('common.no') }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div class="panel-actions">
                <el-button @click="router.push('/observability/alert-routings')">
                  {{ t('jobDefinitionDetail.maintainAlertRouting') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabRuns')" name="runs" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>{{ t('jobDefinitionDetail.runsToolbarHint') }}</span>
                <el-button text type="primary" @click="goAllRuns">
                  {{ t('jobDefinitionDetail.viewAll') }}
                </el-button>
              </div>
              <el-table
                v-loading="runsLoading"
                :data="runs"
                size="small"
                stripe
                :empty-text="t('jobDefinitionDetail.emptyRuns')"
                @row-click="goRunDetail"
              >
                <el-table-column
                  prop="instanceNo"
                  :label="t('jobDefinitionDetail.colInstanceNo')"
                  min-width="220"
                >
                  <template #default="{ row }">
                    <span class="cell-link">{{ row.instanceNo }}</span>
                  </template>
                </el-table-column>
                <el-table-column :label="t('jobDefinitionDetail.colStatus')" width="130">
                  <template #default="{ row }">
                    <StatusTag :value="row.instanceStatus" category="instance" />
                  </template>
                </el-table-column>
                <el-table-column
                  prop="bizDate"
                  :label="t('jobDefinitionDetail.colBizDate')"
                  width="120"
                />
                <el-table-column :label="t('jobDefinitionDetail.colStartedAt')" width="180">
                  <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
                </el-table-column>
                <el-table-column :label="t('jobDefinitionDetail.colFinishedAt')" width="180">
                  <template #default="{ row }">{{ fmtDatetime(row.finishedAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabAudit')" name="audit" lazy>
            <div class="tab-panel">
              <div class="panel-toolbar">
                <span>{{ t('jobDefinitionDetail.auditToolbarHint') }}</span>
                <el-button :loading="auditLoading" @click="loadAudits">
                  {{ t('common.refresh') }}
                </el-button>
              </div>
              <el-table
                v-loading="auditLoading"
                :data="auditRows"
                size="small"
                stripe
                :empty-text="t('jobDefinitionDetail.emptyAudit')"
              >
                <el-table-column
                  prop="operationType"
                  :label="t('jobDefinitionDetail.colOperation')"
                  width="180"
                />
                <el-table-column
                  prop="operationResult"
                  :label="t('jobDefinitionDetail.colResult')"
                  width="110"
                />
                <el-table-column
                  prop="operatorId"
                  :label="t('jobDefinitionDetail.colOperator')"
                  width="160"
                />
                <el-table-column
                  prop="detailSummary"
                  :label="t('jobDefinitionDetail.colSummary')"
                  min-width="260"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="createdAt"
                  :label="t('jobDefinitionDetail.colCreatedAt')"
                  width="180"
                />
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
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Refresh, MagicStick } from '@element-plus/icons-vue'
  import DryRunPlanDialog from '@/components/dialogs/DryRunPlanDialog.vue'
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
  const { t } = useI18n({ useScope: 'global' })
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
  const dryRunVisible = ref(false)
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
  const pageTitle = computed(() =>
    job.value
      ? t('jobDefinitionDetail.pageTitleWithCode', { code: job.value.jobCode })
      : t('jobDefinitionDetail.pageTitle'),
  )

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
        pageSize: 15,
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
        t('jobDefinitionDetail.triggerPromptMessage'),
        t('jobDefinitionDetail.triggerPromptTitle', { code: job.value.jobCode }),
        {
          inputType: 'textarea',
          inputValue: payloadText,
          confirmButtonText: t('jobDefinitionDetail.triggerConfirm'),
          cancelButtonText: t('common.cancel'),
          inputValidator: (v: string) => {
            const text = v?.trim() || '{}'
            try {
              JSON.parse(text)
              return true
            } catch {
              return t('jobDefinitionDetail.invalidJson')
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
      ElMessage.success(t('jobDefinitionDetail.triggerSubmitted'))
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
