<template>
  <PageContainer>
    <PageHeader
      :title="pageTitle"
      :description="job ? `${job.jobType} / ${job.executionMode || 'FULL'}` : ''"
      back-to="/jobs/definitions"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
        <el-button v-if="canActOnJob" :icon="Edit" @click="goEdit">
          {{ t('common.edit') }}
        </el-button>
        <el-button v-if="canActOnJob" :icon="MagicStick" @click="dryRunVisible = true">
          {{ t('jobDefinitionDetail.dryRun') }}
        </el-button>
        <el-button
          v-if="canActOnJob"
          type="primary"
          :icon="Play"
          :loading="triggering"
          @click="triggerJob"
        >
          {{ t('jobDefinitionDetail.manualTrigger') }}
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="job && !sameTenant"
      :title="t('jobDefinitionDetail.switchTenantForDetails', { tenant: job.tenantId })"
      type="warning"
      :closable="false"
      show-icon
    />

    <DryRunPlanDialog
      v-if="job && canActOnJob"
      v-model="dryRunVisible"
      :tenant-id="job.tenantId"
      :job-code="job.jobCode"
      :default-params="job.defaultParams"
    />

    <CalendarMiniCreateDrawer
      v-if="job && canActOnJob && canWriteSystem"
      v-model:visible="calendarMiniVisible"
      :tenant-id="job.tenantId"
      @created="onCalendarCreated"
    />
    <WindowMiniCreateDrawer
      v-if="job && canActOnJob && canWriteSystem"
      v-model:visible="windowMiniVisible"
      :tenant-id="job.tenantId"
      @created="onWindowCreated"
    />

    <el-alert v-if="loadError" type="error" :closable="false" show-icon>
      <template #title>{{ t('jobDefinitionDetail.loadFailed') }}</template>
      <el-button link type="primary" @click="load">{{ t('common.retry') }}</el-button>
    </el-alert>

    <SectionCard>
      <div v-if="loading && !job" class="detail-loading">
        <el-skeleton :rows="8" animated />
      </div>
      <EmptyState v-else-if="!job && !loadError" :description="t('jobDefinitionDetail.emptyJob')" />
      <template v-else-if="job">
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
              overview-only
            />
            <section class="detail-pipeline">
              <h3>{{ t('jobDefinitionList.systemPipelineTitle') }}</h3>
              <SystemPipelineStages :code="systemPipelineCode" :stages="systemPipelineStages" />
            </section>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabSchedule')" name="schedule">
            <div class="tab-panel">
              <el-alert
                :title="t('jobDefinitionDetail.workflowScheduleHint')"
                type="info"
                :closable="false"
                show-icon
              />
              <el-descriptions :column="isMobile ? 1 : 2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleType')">
                  {{ job.scheduleType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldScheduleExpr')">
                  <span class="mono">{{ job.scheduleExpr || '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldDependsOnJobCode')">
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
              <div v-if="canActOnJob" class="panel-actions">
                <el-button type="primary" @click="router.push('/workflow/definitions')">
                  {{ t('jobDefinitionDetail.maintainWorkflowDefinition') }}
                </el-button>
                <el-button v-if="canWriteSystem" :icon="Plus" @click="calendarMiniVisible = true">
                  {{ t('jobDefinitionDetail.btnNewCalendar') }}
                </el-button>
                <el-button v-if="canWriteSystem" :icon="Plus" @click="windowMiniVisible = true">
                  {{ t('jobDefinitionDetail.btnNewWindow') }}
                </el-button>
                <el-button
                  v-if="canOpenGovernance('/governance/calendars')"
                  @click="router.push('/governance/calendars')"
                >
                  {{ t('jobDefinitionDetail.maintainCalendar') }}
                </el-button>
                <el-button
                  v-if="canManageSystem && canOpenGovernance('/governance/windows')"
                  @click="router.push('/governance/windows')"
                >
                  {{ t('jobDefinitionDetail.maintainWindow') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabResource')" name="resource">
            <div class="tab-panel">
              <el-descriptions :column="isMobile ? 1 : 2" border size="small">
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
              <div v-if="canActOnJob" class="panel-actions">
                <el-button
                  v-if="canManageSystem && canOpenGovernance('/governance/queues')"
                  @click="router.push('/governance/queues')"
                >
                  {{ t('jobDefinitionDetail.maintainQueue') }}
                </el-button>
                <el-button
                  v-if="canOpenGovernance('/governance/quota')"
                  @click="router.push('/governance/quota')"
                >
                  {{ t('jobDefinitionDetail.maintainQuota') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabTrigger')" name="trigger">
            <div class="tab-panel">
              <el-descriptions :column="isMobile ? 1 : 2" border size="small">
                <el-descriptions-item
                  :label="t('jobConfigBasic.fieldDefaultParams')"
                  :span="isMobile ? 1 : 2"
                >
                  <JsonPreview :data="job.defaultParams" />
                </el-descriptions-item>
                <el-descriptions-item
                  :label="t('jobConfigBasic.fieldParamSchema')"
                  :span="isMobile ? 1 : 2"
                >
                  <JsonPreview :data="job.paramSchema" />
                </el-descriptions-item>
              </el-descriptions>
              <div v-if="canActOnJob" class="panel-actions">
                <el-button type="primary" :icon="Play" :loading="triggering" @click="triggerJob">
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
            <EmptyState v-else :description="t('jobDefinitionDetail.filesNotApplicable')" />
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabWorkflow')" name="workflow" lazy>
            <div class="tab-panel">
              <el-descriptions :column="isMobile ? 1 : 2" border size="small">
                <el-descriptions-item :label="t('jobConfigBasic.fieldJobType')">{{
                  job.jobType
                }}</el-descriptions-item>
                <el-descriptions-item :label="t('jobConfigBasic.fieldDagEnabled')">
                  {{ job.dagEnabled ? t('common.yes') : t('common.no') }}
                </el-descriptions-item>
                <el-descriptions-item
                  :label="t('jobConfigBasic.fieldExecutionHandler')"
                  :span="isMobile ? 1 : 2"
                >
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
                    <span class="long-link-cell">
                      <span class="cell-link">{{ row.workflowCode }}</span>
                      <CopyableText v-if="row.workflowCode" :text="row.workflowCode" icon-only />
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="workflowName"
                  :label="t('jobDefinitionDetail.colName')"
                  min-width="180"
                >
                  <template #default="{ row }">
                    <CopyableText v-if="row.workflowName" :text="row.workflowName" />
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="workflowType"
                  :label="t('jobDefinitionDetail.colType')"
                  width="120"
                />
                <el-table-column :label="t('jobDefinitionDetail.workflowRelation')" width="150">
                  <template #default="{ row }">
                    <el-tag
                      size="small"
                      :type="row.singleJobDefinitionId === job.id ? 'primary' : 'success'"
                    >
                      {{
                        row.singleJobDefinitionId === job.id
                          ? t('jobDefinitionDetail.defaultSingleJobWorkflow')
                          : t('jobDefinitionDetail.composedWorkflow')
                      }}
                    </el-tag>
                  </template>
                </el-table-column>
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
              <div v-if="canActOnJob" class="panel-actions">
                <el-button @click="router.push('/workflow/definitions')">
                  {{ t('jobDefinitionDetail.maintainWorkflowDefinition') }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('jobDefinitionDetail.tabAlerts')" name="alerts" lazy>
            <div class="tab-panel">
              <!-- 监控规则只在监控策略页编辑，这里只读展示并给出修改入口 -->
              <section class="monitoring-summary">
                <header>
                  <h3>{{ t('jobDefinitionDetail.monitoringTitle') }}</h3>
                  <router-link
                    class="cell-link"
                    :to="{
                      path: '/observability/job-monitoring-policies',
                      query: { jobCode: job.jobCode },
                    }"
                  >
                    {{ t('jobDefinitionDetail.monitoringEdit') }}
                  </router-link>
                </header>
                <dl>
                  <div v-for="item in monitoringSummary" :key="item.label">
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
              </section>
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
                >
                  <template #default="{ row }">
                    <CopyableText v-if="row.routeCode" :text="row.routeCode" />
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <el-table-column prop="team" :label="t('jobDefinitionDetail.colTeam')" width="140">
                  <template #default="{ row }"
                    ><CopyableText v-if="row.team" :text="row.team" /><span v-else
                      >—</span
                    ></template
                  >
                </el-table-column>
                <el-table-column
                  prop="severity"
                  :label="t('jobDefinitionDetail.colSeverity')"
                  width="100"
                />
                <el-table-column
                  prop="receiver"
                  :label="t('jobDefinitionDetail.colReceiver')"
                  min-width="200"
                >
                  <template #default="{ row }"
                    ><CopyableText v-if="row.receiver" :text="row.receiver" /><span v-else
                      >—</span
                    ></template
                  >
                </el-table-column>
                <el-table-column :label="t('jobDefinitionDetail.colEnabled')" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
                      {{ row.enabled ? t('common.yes') : t('common.no') }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
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
                    <span class="long-link-cell">
                      <span class="cell-link">{{ row.instanceNo }}</span>
                      <CopyableText v-if="row.instanceNo" :text="row.instanceNo" icon-only />
                    </span>
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
                >
                  <template #default="{ row }"
                    ><CopyableText v-if="row.operatorId" :text="String(row.operatorId)" /><span
                      v-else
                      >—</span
                    ></template
                  >
                </el-table-column>
                <el-table-column
                  prop="detailSummary"
                  :label="t('jobDefinitionDetail.colSummary')"
                  min-width="260"
                >
                  <template #default="{ row }">
                    <JsonPreviewPopover :data="row.detailSummary" />
                  </template>
                </el-table-column>
                <el-table-column :label="t('jobDefinitionDetail.colCreatedAt')" width="180">
                  <template #default="{ row }">{{ fmtDatetime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    Pencil as Edit,
    Play,
    Plus,
    RefreshCw as Refresh,
    Sparkles as MagicStick,
  } from '@lucide/vue'
  import DryRunPlanDialog from '@/components/dialogs/DryRunPlanDialog.vue'
  import { jobApi } from '@/api/job'
  import { instanceApi } from '@/api/instance'
  import { governanceApi, type GovernanceAlertRoutingRow } from '@/api/governance'
  import { workflowApi } from '@/api/workflow'
  import { queryAuditsPage } from '@/api/observabilityQueries'
  import type { ConsoleWorkflowDefinitionResponse } from '@/types/console-api'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { usePermission } from '@/composables/usePermission'
  import { usePermissionStore } from '@/stores/permission'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { currentAuthSession, isSharedAuthRevisionCurrent } from '@/api/authSession'
  import { useResponsive } from '@/composables/useResponsive'
  import { fmtDatetime } from '@/utils/datetime'
  import PageContainer from '@/components/common/PageContainer.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import JsonPreviewPopover from '@/components/common/JsonPreviewPopover.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JobConfigBasicSection from './components/JobConfigBasicSection.vue'
  import JobRelatedFilesTab from './components/JobRelatedFilesTab.vue'
  import SystemPipelineStages from './components/SystemPipelineStages.vue'
  import { fetchPipelineStages } from '@/api/pipelineMeta'
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
  const { canMutateConfig, canManageSystem, canWriteSystem } = usePermission()
  const permissionStore = usePermissionStore()
  function canOpenGovernance(path: string) {
    return (
      permissionStore.hasBackendMenuAccess(path) ||
      (path !== '/governance/queues' &&
        path !== '/governance/quota' &&
        permissionStore.hasBackendMenuAccess('/governance/queues'))
    )
  }
  const { isMobile } = useResponsive()

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
  const loadError = ref(false)
  const triggering = ref(false)
  const dryRunVisible = ref(false)
  const job = ref<JobDefinitionDetailModel | null>(null)

  /** 监控规则只读摘要：0 或未设置表示已关闭 */
  const monitoringSummary = computed(() => {
    const current = job.value
    if (!current) return []
    const off = t('jobMonitoringPolicy.disabled')
    const seconds = (value?: number | null) =>
      value && value > 0 ? t('jobDefinitionDetail.monitoringSeconds', { n: value }) : off
    const deadline = current.completionDeadlineLocalTime
      ? String(current.completionDeadlineLocalTime)
      : current.dependencyCompletionWindowSeconds
        ? seconds(current.dependencyCompletionWindowSeconds)
        : off
    return [
      { label: t('jobMonitoringPolicy.softRuntime'), value: seconds(current.softRuntimeSeconds) },
      { label: t('jobMonitoringPolicy.startGrace'), value: seconds(current.startGraceSeconds) },
      { label: t('jobMonitoringPolicy.completionDeadline'), value: deadline },
    ]
  })

  // 系统流水线阶段：原列表查看抽屉的内容，查看统一到详情页后放在基本信息页签
  const pipelineStagesByType = ref<Record<string, string[]>>({})
  const systemPipelineCode = computed(() => {
    const type = job.value?.jobType?.toUpperCase() || ''
    if (type === 'BUNDLE_IMPORT') return 'IMPORT'
    if (type === 'BUNDLE_EXPORT') return 'EXPORT'
    if (type === 'BUNDLE_DISPATCH') return 'DISPATCH'
    return type
  })
  const systemPipelineStages = computed(
    () => pipelineStagesByType.value[systemPipelineCode.value] ?? [],
  )
  void fetchPipelineStages()
    .then((stages) => {
      pipelineStagesByType.value = stages
    })
    .catch(() => {
      /* 阶段说明为辅助信息，加载失败时不显示即可 */
    })
  let contextRevision = 0
  let loadRevision = 0
  let runsRevision = 0
  let auditsRevision = 0
  let alertsRevision = 0
  let workflowsRevision = 0
  const triggerScope = useTenantRequestScope()
  const sameTenant = computed(() => !!job.value && job.value.tenantId === tenant.tenantId)
  const canActOnJob = computed(() => sameTenant.value && canMutateConfig.value)
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

  function isUnsupportedFileTabJobType(jobType: string | null | undefined): boolean {
    return jobType !== 'IMPORT' && jobType !== 'EXPORT'
  }

  async function load() {
    const targetId = jobId.value
    const targetTenant = tenantId.value
    const context = contextRevision
    const request = ++loadRevision
    loadError.value = false
    if (!Number.isFinite(targetId) || targetId <= 0) {
      job.value = null
      loading.value = false
      return
    }
    if (job.value && (job.value.id !== targetId || job.value.tenantId !== targetTenant)) {
      job.value = null
      runs.value = []
      auditRows.value = []
      alertRows.value = []
      workflowRows.value = []
    }
    loading.value = true
    try {
      const result = await jobApi.getDefinition(targetId, targetTenant)
      if (request !== loadRevision || context !== contextRevision) return
      ++runsRevision
      ++auditsRevision
      ++alertsRevision
      ++workflowsRevision
      runsLoading.value = false
      auditLoading.value = false
      alertsLoading.value = false
      workflowsLoading.value = false
      job.value = result
      if (activeTab.value === 'files' && isUnsupportedFileTabJobType(job.value.jobType)) {
        activeTab.value = 'basic'
      }
      runsLoaded.value = false
      auditsLoaded.value = false
      alertsLoaded.value = false
      workflowsLoaded.value = false
      void loadLazyTab(activeTab.value)
    } catch {
      if (request === loadRevision && context === contextRevision) loadError.value = true
    } finally {
      if (request === loadRevision && context === contextRevision) loading.value = false
    }
  }

  async function loadRuns() {
    if (!job.value || runsLoaded.value) return
    const sourceJob = job.value
    const context = contextRevision
    const request = ++runsRevision
    runsLoading.value = true
    try {
      const result = await instanceApi.list({
        tenantId: sourceJob.tenantId,
        exactJobCode: sourceJob.jobCode,
        page: 1,
        pageSize: 15,
      })
      if (request !== runsRevision || context !== contextRevision) return
      runs.value = result.records ?? []
      runsLoaded.value = true
    } finally {
      if (request === runsRevision && context === contextRevision) runsLoading.value = false
    }
  }

  async function loadAudits() {
    if (!job.value) return
    const sourceJob = job.value
    const context = contextRevision
    const request = ++auditsRevision
    auditLoading.value = true
    try {
      const result = await queryAuditsPage(sourceJob.tenantId, 1, 50)
      if (request !== auditsRevision || context !== contextRevision) return
      auditRows.value = (result.items ?? [])
        .filter((row) => {
          const text = `${row.operationType ?? ''} ${row.detailSummary ?? ''} ${row.evidenceRef ?? ''}`
          return text.includes(sourceJob.jobCode)
        })
        .slice(0, 50)
      auditsLoaded.value = true
    } finally {
      if (request === auditsRevision && context === contextRevision) auditLoading.value = false
    }
  }

  async function loadAlerts() {
    if (!job.value) return
    const sourceJob = job.value
    const context = contextRevision
    const request = ++alertsRevision
    alertsLoading.value = true
    try {
      const result = await governanceApi.listAlertRoutings(sourceJob.tenantId)
      if (request !== alertsRevision || context !== contextRevision) return
      alertRows.value = result
      alertsLoaded.value = true
    } finally {
      if (request === alertsRevision && context === contextRevision) alertsLoading.value = false
    }
  }

  async function loadWorkflows() {
    if (!job.value) return
    const sourceJob = job.value
    const context = contextRevision
    const request = ++workflowsRevision
    workflowsLoading.value = true
    try {
      const result = await workflowApi.listDefinitions({
        tenantId: sourceJob.tenantId,
        relatedJobCode: sourceJob.jobCode,
        page: 1,
        pageSize: 50,
      })
      if (request !== workflowsRevision || context !== contextRevision) return
      workflowRows.value = result.records ?? []
      workflowsLoaded.value = true
    } finally {
      if (request === workflowsRevision && context === contextRevision)
        workflowsLoading.value = false
    }
  }

  function goWorkflowDesigner(row: ConsoleWorkflowDefinitionResponse) {
    if (!isCurrentTenantForNavigation()) return
    void router.push(`/workflow/viewer/${row.id}`)
  }

  function isCurrentTenantForNavigation() {
    if (!job.value) return false
    if (job.value.tenantId === tenant.tenantId) return true
    ElMessage.warning(
      t('jobDefinitionDetail.switchTenantForDetails', { tenant: job.value.tenantId }),
    )
    return false
  }

  function onCalendarCreated(code: string) {
    ElMessage.success(t('jobDefinitionDetail.calendarCreated', { code }))
    calendarMiniVisible.value = false
  }

  function onWindowCreated(code: string) {
    ElMessage.success(t('jobDefinitionDetail.windowCreated', { code }))
    windowMiniVisible.value = false
  }

  function loadLazyTab(tab: DetailTab) {
    if (tab === 'runs') return loadRuns()
    if (tab === 'audit' && !auditsLoaded.value) return loadAudits()
    if (tab === 'alerts' && !alertsLoaded.value) return loadAlerts()
    if (tab === 'workflow' && !workflowsLoaded.value) return loadWorkflows()
  }

  async function triggerJob() {
    if (!job.value || !canMutateConfig.value || !isCurrentTenantForNavigation()) return
    const sourceJob = job.value
    const scope = triggerScope.begin()
    const authSession = currentAuthSession()
    const isCurrent = () =>
      triggerScope.isCurrent(scope) &&
      isSharedAuthRevisionCurrent() &&
      currentAuthSession() === authSession &&
      canActOnJob.value &&
      job.value?.id === sourceJob.id &&
      job.value?.tenantId === sourceJob.tenantId
    let payloadText = sourceJob.defaultParams?.trim() || '{}'
    try {
      const { value } = await ElMessageBox.prompt(
        t('jobDefinitionDetail.triggerPromptMessage'),
        t('jobDefinitionDetail.triggerPromptTitle', { code: sourceJob.jobCode }),
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
    if (!isCurrent()) return
    triggering.value = true
    try {
      const workflowDefinitionId = sourceJob.defaultWorkflowDefinitionId ?? 0
      const requestTenantId = sourceJob.tenantId
      const triggerPayload = JSON.parse(payloadText)
      await jobApi.trigger(workflowDefinitionId, requestTenantId, triggerPayload)
      if (!isCurrent()) return
      ElMessage.success(t('jobDefinitionDetail.triggerSubmitted'))
      runsLoaded.value = false
      if (activeTab.value === 'runs') await loadRuns()
    } finally {
      triggering.value = false
    }
  }

  function goAllRuns() {
    if (!job.value || !isCurrentTenantForNavigation()) return
    void router.push({
      path: '/monitor/job-instances',
      query: { exactJobCode: job.value.jobCode, range: 'all' },
    })
  }

  function goEdit() {
    if (!job.value || !canMutateConfig.value || !isCurrentTenantForNavigation()) return
    void router.push({
      path: '/jobs/definitions',
      query: {
        action: 'edit',
        editId: String(job.value.id),
        jobCode: job.value.jobCode,
        tenantId: job.value.tenantId,
      },
    })
  }

  function goRunDetail(row: ConsoleJobInstanceResponse) {
    if (!isCurrentTenantForNavigation()) return
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
      if (activeTab.value === 'files' && isUnsupportedFileTabJobType(jobType)) {
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
    [() => tenant.tenantId, () => route.params.id, () => route.query.tenantId],
    () => {
      ++contextRevision
      triggerScope.begin()
      dryRunVisible.value = false
      calendarMiniVisible.value = false
      windowMiniVisible.value = false
    },
    { flush: 'sync' },
  )
  watch(
    canMutateConfig,
    () => {
      triggerScope.begin()
      dryRunVisible.value = false
      calendarMiniVisible.value = false
      windowMiniVisible.value = false
    },
    { flush: 'sync' },
  )

  watch(
    () => route.params.id,
    () => {
      void load()
    },
  )

  useTenantReload(load)
</script>

<style scoped>
  .monitoring-summary {
    margin-bottom: 16px;
    padding: 12px 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }

  .monitoring-summary header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .monitoring-summary h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .monitoring-summary dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px 24px;
    margin: 0;
  }

  .monitoring-summary dt {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .monitoring-summary dd {
    margin: 2px 0 0;
    font-variant-numeric: tabular-nums;
  }

  .detail-pipeline {
    margin-top: 16px;
  }

  .detail-pipeline h3 {
    margin: 0 0 8px;
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .long-link-cell {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .long-link-cell > :first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail-loading {
    padding: 8px 0;
  }

  .detail-summary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border-light);
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
    flex-wrap: wrap;
  }

  .panel-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .mono {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
    font-size: 12px;
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
