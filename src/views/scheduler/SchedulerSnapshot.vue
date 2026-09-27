<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(() => loadAll())"
        >
          {{ t('schedulerSnapshot.headerRefresh') }}
        </el-button>
        <el-button
          v-if="canManageSystem && schedulerState === 'running'"
          type="warning"
          :icon="Pause"
          :loading="pauseLoading"
          @click="confirmPauseAll"
        >
          {{ t('schedulerSnapshot.headerPauseAll') }}
        </el-button>
        <el-button
          v-else-if="canManageSystem && schedulerState === 'paused'"
          type="success"
          :icon="Play"
          :loading="resumeLoading"
          @click="confirmResumeAll"
        >
          {{ t('schedulerSnapshot.headerResumeAll') }}
        </el-button>
        <el-tooltip v-else-if="canManageSystem" :content="t('schedulerSnapshot.statusUnknownTip')">
          <span>
            <el-button disabled :icon="Pause">{{ t('schedulerSnapshot.statusUnknown') }}</el-button>
          </span>
        </el-tooltip>
      </template>
    </PageHeader>

    <el-alert
      v-if="loadError"
      class="snapshot-alert"
      type="error"
      show-icon
      :closable="false"
      :title="t('schedulerSnapshot.loadErrorTitle')"
      :description="
        snap
          ? t('schedulerSnapshot.staleDescription', { time: fmtDatetime(lastSuccessfulAt) })
          : t('schedulerSnapshot.loadErrorDescription')
      "
    >
      <template #default>
        <div class="snapshot-alert__actions">
          <CopyableText v-if="loadErrorTrace" :text="loadErrorTrace">
            <span>{{ t('schedulerSnapshot.errorTrace', { trace: loadErrorTrace }) }}</span>
          </CopyableText>
          <el-button type="primary" plain size="small" :loading="loading" @click="loadAll()">
            {{ t('common.retry') }}
          </el-button>
          <el-button plain size="small" @click="router.push('/ops/diagnostic')">
            {{ t('schedulerSnapshot.openDiagnostic') }}
          </el-button>
        </div>
      </template>
    </el-alert>

    <SectionCard v-if="!snap && !loading" class="mt">
      <EmptyState variant="service-down" :description="t('schedulerSnapshot.loadErrorDescription')">
        <template #action>
          <el-button type="primary" :icon="Refresh" @click="loadAll()">
            {{ t('common.retry') }}
          </el-button>
        </template>
      </EmptyState>
    </SectionCard>

    <SectionCard v-if="snap">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            {{ t('schedulerSnapshot.cardSnapshotTitle') }}
            <el-tag size="small" effect="plain" type="info">{{
              fmtDatetime(snap.generatedAt)
            }}</el-tag>
            <el-tag size="small" effect="plain" :type="schedulerStateTagType">
              {{ schedulerStateLabel }}
            </el-tag>
          </div>
          <div class="card-actions">
            <el-tag size="small" effect="plain" type="info">
              {{ t('schedulerSnapshot.tenantLabel', { id: snap.tenantId }) }}
            </el-tag>
          </div>
        </div>
      </template>

      <div
        class="kpis"
        role="tablist"
        :aria-label="t('schedulerSnapshot.kpiAriaLabel')"
        @keydown="onKpiKeydown"
      >
        <SnapshotKpiTab
          v-for="t in kpiTabs"
          :key="t.key"
          :label="t.label"
          :value="t.value"
          :variant="t.variant"
          :active="activePanel === t.key"
          :tab-id="`snapshot-tab-${t.key}`"
          :panel-id="`snapshot-panel-${t.key}`"
          @select="activePanel = t.key"
        />
      </div>
    </SectionCard>

    <SectionCard v-if="snap" class="mt detail-card">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <span class="dot" :class="activeDotClass" />
            {{ activePanelTitle }}
          </div>
          <el-tag size="small" effect="plain" type="info">
            {{ activePanelCount }}{{ t('schedulerSnapshot.countSuffix') }}
          </el-tag>
        </div>
      </template>

      <div
        v-show="activePanel === 'policies'"
        id="snapshot-panel-policies"
        class="detail-pane"
        role="tabpanel"
        aria-labelledby="snapshot-tab-policies"
      >
        <el-table
          v-loading="loading"
          :data="pagedPolicies.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colPolicy')" min-width="280">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="primary">{{ row.policyCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
                    {{ row.fairShareGroup }}
                  </el-tag>
                </div>
                <div class="cell-sub">
                  {{ t('schedulerSnapshot.quotaResetPolicyLabel') }}:
                  <el-tag size="small" effect="plain" type="info">{{
                    row.quotaResetPolicy
                  }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="fairShareWeight"
            :label="t('schedulerSnapshot.colWeight')"
            width="90"
          />
          <el-table-column
            prop="activeJobs"
            :label="t('schedulerSnapshot.colActiveJobs')"
            width="110"
          />
          <el-table-column
            prop="activePartitions"
            :label="t('schedulerSnapshot.colActivePartitions')"
            width="110"
          />
          <el-table-column
            prop="effectiveTenantJobCap"
            :label="t('schedulerSnapshot.colTenantJobCap')"
            width="140"
          />
          <el-table-column
            prop="effectiveTenantPartitionCap"
            :label="t('schedulerSnapshot.colTenantPartitionCap')"
            width="150"
          />
          <el-table-column
            prop="maxRunningJobsPerTenant"
            :label="t('schedulerSnapshot.colMaxRunningJobsPerTenant')"
            width="190"
          />
          <el-table-column
            prop="burstLimit"
            :label="t('schedulerSnapshot.colBurstLimit')"
            width="110"
          />
          <el-table-column
            prop="partitionBurstLimit"
            :label="t('schedulerSnapshot.colPartitionBurstLimit')"
            width="150"
          />
          <el-table-column
            prop="quotaBurstRemaining"
            :label="t('schedulerSnapshot.colQuotaBurstRemaining')"
            width="160"
          />
          <el-table-column
            prop="quotaBurstPeakBorrowed"
            :label="t('schedulerSnapshot.colQuotaBurstPeakBorrowed')"
            width="180"
          />
          <el-table-column
            prop="groupSharedMaxRunningJobs"
            :label="t('schedulerSnapshot.colGroupSharedMax')"
            width="130"
          />
          <DatetimeColumn
            prop="quotaResetWindowExpiresAt"
            :label="t('schedulerSnapshot.colQuotaWindow')"
            width="170"
          />
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="140" fixed="right">
            <template #default="{ row }">
              <CopyableText :text="String(row.policyCode ?? '')" class="snapshot-copy-action">
                <el-button type="primary" plain size="small" :icon="DocumentCopy">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </el-button>
              </CopyableText>
            </template>
          </el-table-column>
        </el-table>
        <TablePagerBar
          :page="pagePolicies"
          :page-size="pageSize"
          :total="pagedPolicies.total"
          @update:page="setPagePolicies"
          @update:page-size="onDetailPageSizeChange"
        />
      </div>

      <div
        v-show="activePanel === 'queues'"
        id="snapshot-panel-queues"
        class="detail-pane"
        role="tabpanel"
        aria-labelledby="snapshot-tab-queues"
      >
        <el-table
          v-loading="loading"
          :data="pagedQueues.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colQueue')" min-width="280">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="success">{{ row.queueCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
                    {{ row.fairShareGroup }}
                  </el-tag>
                </div>
                <div class="cell-sub">
                  {{ t('schedulerSnapshot.quotaResetPolicyLabel') }}:
                  <el-tag size="small" effect="plain" type="info">{{
                    row.quotaResetPolicy
                  }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="fairShareWeight"
            :label="t('schedulerSnapshot.colWeight')"
            width="90"
          />
          <el-table-column
            prop="activeJobs"
            :label="t('schedulerSnapshot.colActiveJobs')"
            width="110"
          />
          <el-table-column
            prop="maxRunningJobs"
            :label="t('schedulerSnapshot.colMaxRunningJobs')"
            width="150"
          />
          <el-table-column
            prop="effectiveMaxRunningJobs"
            :label="t('schedulerSnapshot.colEffectiveMaxRunningJobs')"
            width="190"
          />
          <el-table-column
            prop="burstLimit"
            :label="t('schedulerSnapshot.colBurstLimit')"
            width="110"
          />
          <el-table-column
            prop="quotaBurstRemaining"
            :label="t('schedulerSnapshot.colQuotaBurstRemaining')"
            width="160"
          />
          <el-table-column
            prop="quotaBurstPeakBorrowed"
            :label="t('schedulerSnapshot.colQuotaBurstPeakBorrowed')"
            width="180"
          />
          <el-table-column
            prop="groupSharedMaxRunningJobs"
            :label="t('schedulerSnapshot.colGroupSharedMax')"
            width="130"
          />
          <DatetimeColumn
            prop="quotaResetWindowExpiresAt"
            :label="t('schedulerSnapshot.colQuotaWindow')"
            width="170"
          />
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="140" fixed="right">
            <template #default="{ row }">
              <CopyableText :text="String(row.queueCode ?? '')" class="snapshot-copy-action">
                <el-button type="primary" plain size="small" :icon="DocumentCopy">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </el-button>
              </CopyableText>
            </template>
          </el-table-column>
        </el-table>
        <TablePagerBar
          :page="pageQueues"
          :page-size="pageSize"
          :total="pagedQueues.total"
          @update:page="setPageQueues"
          @update:page-size="onDetailPageSizeChange"
        />
      </div>

      <div
        v-show="activePanel === 'workers'"
        id="snapshot-panel-workers"
        class="detail-pane"
        role="tabpanel"
        aria-labelledby="snapshot-tab-workers"
      >
        <el-table
          v-loading="loading"
          :data="pagedWorkers.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colWorker')" min-width="280">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="info">{{ row.workerCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.workerGroup)">
                    {{ row.workerGroup }}
                  </el-tag>
                  <StatusTag :value="row.status" category="worker" />
                </div>
                <div class="cell-sub">
                  {{ t('schedulerSnapshot.heartbeatLabel') }}: {{ fmtDatetime(row.heartbeatAt) }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('schedulerSnapshot.colCurrentLoad')" width="240">
            <template #default="{ row }">
              <div class="load-cell">
                <el-progress
                  :percentage="Math.min(100, Math.max(0, Number(row.currentLoad) || 0))"
                  :stroke-width="10"
                  :show-text="false"
                  :status="progressStatus(row.status)"
                />
                <span class="load-cell__value">{{ row.currentLoad }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="140" fixed="right">
            <template #default="{ row }">
              <CopyableText :text="String(row.workerCode ?? '')" class="snapshot-copy-action">
                <el-button type="primary" plain size="small" :icon="DocumentCopy">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </el-button>
              </CopyableText>
            </template>
          </el-table-column>
        </el-table>
        <TablePagerBar
          :page="pageWorkers"
          :page-size="pageSize"
          :total="pagedWorkers.total"
          @update:page="setPageWorkers"
          @update:page-size="onDetailPageSizeChange"
        />
      </div>

      <div
        v-show="activePanel === 'history'"
        id="snapshot-panel-history"
        class="detail-pane"
        role="tabpanel"
        aria-labelledby="snapshot-tab-history"
      >
        <el-table
          v-loading="histLoading"
          :data="pagedHistory.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <DatetimeColumn prop="snapshotAt" :label="t('schedulerSnapshot.colTime')" width="170" />
          <el-table-column :label="t('schedulerSnapshot.colPolicyGroup')" min-width="220">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="primary">{{ row.policyCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
                    {{ row.fairShareGroup }}
                  </el-tag>
                </div>
                <div class="cell-sub">
                  {{ t('schedulerSnapshot.quotaResetPolicyLabel') }}:
                  <el-tag size="small" effect="plain" type="info">{{
                    row.quotaResetPolicy
                  }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="activeJobs"
            :label="t('schedulerSnapshot.colActiveJobs')"
            width="100"
            align="right"
          />
          <el-table-column
            prop="activePartitions"
            :label="t('schedulerSnapshot.colActivePartitions')"
            width="130"
            align="right"
          />
          <el-table-column
            prop="effectiveJobCap"
            :label="t('schedulerSnapshot.colEffectiveJobCap')"
            width="130"
            align="right"
          />
          <el-table-column
            prop="maxJobsBase"
            :label="t('schedulerSnapshot.colMaxJobsBase')"
            width="120"
            align="right"
          />
          <el-table-column
            prop="burstLimit"
            :label="t('schedulerSnapshot.colBurstLimit')"
            width="110"
            align="right"
          />
          <el-table-column
            prop="groupActiveJobs"
            :label="t('schedulerSnapshot.colGroupActiveJobs')"
            width="140"
            align="right"
          />
          <el-table-column
            prop="groupMaxJobs"
            :label="t('schedulerSnapshot.colGroupMaxJobs')"
            width="120"
            align="right"
          />
          <el-table-column
            prop="onlineWorkers"
            :label="t('schedulerSnapshot.colOnlineWorkers')"
            width="120"
            align="right"
          />
        </el-table>
        <TablePagerBar
          :page="pageHistory"
          :page-size="pageSize"
          :total="pagedHistory.total"
          @update:page="setPageHistory"
          @update:page-size="onDetailPageSizeChange"
        />
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Copy as DocumentCopy, Pause, Play, RefreshCw as Refresh } from 'lucide-vue-next'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  import { fmtDatetime } from '@/utils/datetime'
  import {
    getSchedulerSnapshot,
    getSchedulerSnapshotHistory,
    getSchedulerStatus,
    pauseAllSchedulers,
    resumeAllSchedulers,
  } from '@/api/scheduler'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { usePermission } from '@/composables/usePermission'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import SnapshotKpiTab from './components/SnapshotKpiTab.vue'
  import type {
    ConsoleSchedulerSnapshotHistoryResponse,
    ConsoleSchedulerSnapshotResponse,
  } from '@/types/console-api'

  type PanelKey = 'policies' | 'queues' | 'workers' | 'history'
  type KpiVariant = 'primary' | 'success' | 'warning' | 'info'

  const tenant = useTenantStore()
  const { canManageSystem } = usePermission()
  const loading = ref(false)
  const histLoading = ref(false)
  const pauseLoading = ref(false)
  const resumeLoading = ref(false)
  const snap = ref<ConsoleSchedulerSnapshotResponse | null>(null)
  const history = ref<ConsoleSchedulerSnapshotHistoryResponse[]>([])
  const schedulerStatus = ref('')
  const loadError = ref(false)
  const loadErrorTrace = ref('')
  const lastSuccessfulAt = ref<string | null>(null)
  const activePanel = ref<PanelKey>('policies')
  const KPI_KEYS: PanelKey[] = ['policies', 'queues', 'workers', 'history']

  function onKpiKeydown(event: KeyboardEvent) {
    let nextIndex = KPI_KEYS.indexOf(activePanel.value)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      nextIndex = (nextIndex + 1) % KPI_KEYS.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      nextIndex = (nextIndex - 1 + KPI_KEYS.length) % KPI_KEYS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = KPI_KEYS.length - 1
    else return

    event.preventDefault()
    activePanel.value = KPI_KEYS[nextIndex]
    requestAnimationFrame(() =>
      document.getElementById(`snapshot-tab-${activePanel.value}`)?.focus(),
    )
  }

  const pageSize = ref(15)
  const pagePolicies = ref(1)
  const pageQueues = ref(1)
  const pageWorkers = ref(1)
  const pageHistory = ref(1)

  const schedulerState = computed<'running' | 'paused' | 'unknown'>(() => {
    const status = schedulerStatus.value.toUpperCase()
    if (status === 'ALL_PAUSED' || status === 'PAUSED') return 'paused'
    if (status === 'RUNNING' || status === 'ALL_RESUMED') return 'running'
    return 'unknown'
  })
  const schedulerStateLabel = computed(() =>
    schedulerState.value === 'paused'
      ? t('schedulerSnapshot.statusPaused')
      : schedulerState.value === 'running'
        ? t('schedulerSnapshot.statusRunning')
        : t('schedulerSnapshot.statusUnknown'),
  )
  const schedulerStateTagType = computed(() =>
    schedulerState.value === 'paused'
      ? 'warning'
      : schedulerState.value === 'running'
        ? 'success'
        : 'info',
  )

  const kpiTabs = computed<{ key: PanelKey; label: string; value: number; variant: KpiVariant }[]>(
    () => [
      {
        key: 'policies',
        label: t('schedulerSnapshot.kpiPolicies'),
        value: snap.value?.policies?.length ?? 0,
        variant: 'primary',
      },
      {
        key: 'queues',
        label: t('schedulerSnapshot.kpiQueues'),
        value: snap.value?.queues?.length ?? 0,
        variant: 'success',
      },
      {
        key: 'workers',
        label: t('schedulerSnapshot.kpiWorkers'),
        value: snap.value?.workers?.length ?? 0,
        variant: 'warning',
      },
      {
        key: 'history',
        label: t('schedulerSnapshot.kpiHistory'),
        value: history.value.length,
        variant: 'info',
      },
    ],
  )

  type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'
  const TAG_TYPES: TagType[] = ['primary', 'success', 'warning', 'danger', 'info']

  const pagedPolicies = computed(() =>
    toPageResult(snap.value?.policies ?? [], pagePolicies.value, pageSize.value),
  )
  const pagedQueues = computed(() =>
    toPageResult(snap.value?.queues ?? [], pageQueues.value, pageSize.value),
  )
  const pagedWorkers = computed(() =>
    toPageResult(snap.value?.workers ?? [], pageWorkers.value, pageSize.value),
  )
  const pagedHistory = computed(() =>
    toPageResult(history.value, pageHistory.value, pageSize.value),
  )

  function setPagePolicies(p: number) {
    pagePolicies.value = p
  }

  function setPageQueues(p: number) {
    pageQueues.value = p
  }

  function setPageWorkers(p: number) {
    pageWorkers.value = p
  }

  function setPageHistory(p: number) {
    pageHistory.value = p
  }

  function onDetailPageSizeChange(s: number) {
    pageSize.value = s
    pagePolicies.value = 1
    pageQueues.value = 1
    pageWorkers.value = 1
    pageHistory.value = 1
  }

  const activePanelTitle = computed(() => {
    const m: Record<PanelKey, string> = {
      policies: t('schedulerSnapshot.panelPolicies'),
      queues: t('schedulerSnapshot.panelQueues'),
      workers: t('schedulerSnapshot.panelWorkers'),
      history: t('schedulerSnapshot.panelHistory'),
    }
    return m[activePanel.value]
  })

  const activeDotClass = computed(() => {
    const m: Record<PanelKey, string> = {
      policies: 'dot--primary',
      queues: 'dot--success',
      workers: 'dot--warning',
      history: 'dot--info',
    }
    return m[activePanel.value]
  })

  const activePanelCount = computed(() => {
    const m: Record<PanelKey, number> = {
      policies: snap.value?.policies?.length ?? 0,
      queues: snap.value?.queues?.length ?? 0,
      workers: snap.value?.workers?.length ?? 0,
      history: history.value.length,
    }
    return m[activePanel.value]
  })

  function tagTypeForKey(key: string | null | undefined): TagType {
    const s = String(key ?? '').trim()
    if (!s) return 'info'
    let hash = 0
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
    return TAG_TYPES[hash % TAG_TYPES.length]
  }

  function progressStatus(
    status: string | null | undefined,
  ): 'success' | 'warning' | 'exception' | undefined {
    const s = String(status ?? '').toUpperCase()
    if (s === 'ONLINE') return 'success'
    if (s === 'DRAINING') return 'warning'
    if (s === 'OFFLINE') return 'exception'
    return undefined
  }

  function errorCorrelation(reason: unknown): string {
    const response = (reason as { response?: { data?: unknown; headers?: unknown } })?.response
    const data = response?.data as { meta?: { traceId?: unknown; requestId?: unknown } } | undefined
    const fromMeta = data?.meta?.traceId ?? data?.meta?.requestId
    if (fromMeta) return String(fromMeta)
    const headers = response?.headers as
      { get?: (name: string) => unknown; [key: string]: unknown } | undefined
    const fromHeader =
      headers?.get?.('x-trace-id') ??
      headers?.get?.('x-request-id') ??
      headers?.['x-trace-id'] ??
      headers?.['x-request-id']
    return fromHeader ? String(fromHeader) : ''
  }

  async function loadAll(silent = false) {
    loading.value = true
    histLoading.value = true
    const [snapResult, historyResult, statusResult] = await Promise.allSettled([
      getSchedulerSnapshot(tenant.tenantId),
      getSchedulerSnapshotHistory(tenant.tenantId),
      getSchedulerStatus(),
    ])
    const snapOk = snapResult.status === 'fulfilled'
    const histOk = historyResult.status === 'fulfilled'
    const statusOk = statusResult.status === 'fulfilled'
    if (snapResult.status === 'fulfilled') snap.value = snapResult.value
    if (historyResult.status === 'fulfilled') history.value = historyResult.value
    if (statusResult.status === 'fulfilled') schedulerStatus.value = statusResult.value.status
    else schedulerStatus.value = ''
    loadError.value = !snapOk || !histOk || !statusOk
    loadErrorTrace.value =
      [snapResult, historyResult, statusResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => errorCorrelation(result.reason))
        .find(Boolean) ?? ''
    if (snapOk) lastSuccessfulAt.value = new Date().toISOString()
    loading.value = false
    histLoading.value = false
    if (!silent) {
      if (snapOk && histOk && statusOk) ElMessage.success(t('schedulerSnapshot.refreshDone'))
      else if (!snapOk && !histOk && !statusOk)
        ElMessage.error(t('schedulerSnapshot.refreshFailed'))
      else ElMessage.warning(t('schedulerSnapshot.refreshPartial'))
    }
  }

  useTenantReload(() => loadAll(true))

  async function confirmPauseAll() {
    try {
      await confirmDanger({
        verb: t('schedulerSnapshot.pauseAllConfirmVerb'),
        target: t('schedulerSnapshot.confirmAllTarget'),
        consequence: t('schedulerSnapshot.pauseAllConfirmConsequence'),
        confirmButtonText: t('schedulerSnapshot.pauseAllConfirmButton'),
      })
      pauseLoading.value = true
      await pauseAllSchedulers()
      schedulerStatus.value = 'ALL_PAUSED'
      ElMessage.success(t('schedulerSnapshot.pauseSuccess'))
      await loadAll()
    } catch {
      /* cancel */
    } finally {
      pauseLoading.value = false
    }
  }

  async function confirmResumeAll() {
    try {
      await confirmDanger({
        verb: t('schedulerSnapshot.resumeAllConfirmVerb'),
        target: t('schedulerSnapshot.confirmAllTarget'),
        consequence: t('schedulerSnapshot.resumeAllConfirmConsequence'),
        confirmButtonText: t('schedulerSnapshot.resumeAllConfirmButton'),
      })
      resumeLoading.value = true
      await resumeAllSchedulers()
      schedulerStatus.value = 'ALL_RESUMED'
      ElMessage.success(t('schedulerSnapshot.resumeSuccess'))
      await loadAll()
    } catch {
      /* cancel */
    } finally {
      resumeLoading.value = false
    }
  }
</script>

<style scoped>
  .mt {
    margin-top: 16px;
  }

  .snapshot-alert {
    margin-bottom: var(--space-md);
  }

  .snapshot-alert__actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .card-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 14px;
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-text-primary) 4%, transparent);
  }

  .dot--primary {
    background: var(--color-primary);
  }
  .dot--success {
    background: var(--color-success);
  }
  .dot--warning {
    background: var(--color-warning);
  }
  .dot--info {
    background: var(--color-text-tertiary);
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
  }

  .detail-pane {
    min-width: 0;
  }

  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cell-main {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .cell-sub {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .load-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .load-cell__value {
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  @media (max-width: 960px) {
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
