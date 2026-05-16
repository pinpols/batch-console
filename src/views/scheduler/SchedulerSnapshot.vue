<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :loading="loading" @click="loadAll()">
          {{ t('schedulerSnapshot.headerRefresh') }}
        </el-button>
        <el-button type="warning" :loading="pauseLoading" @click="confirmPauseAll">
          {{ t('schedulerSnapshot.headerPauseAll') }}
        </el-button>
        <el-button type="success" :loading="resumeLoading" @click="confirmResumeAll">
          {{ t('schedulerSnapshot.headerResumeAll') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard v-if="snap">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            {{ t('schedulerSnapshot.cardSnapshotTitle') }}
            <el-tag size="small" effect="plain" type="info">{{ snap.generatedAt }}</el-tag>
          </div>
          <div class="card-actions">
            <el-tag size="small" effect="plain" type="info">tenant: {{ snap.tenantId }}</el-tag>
          </div>
        </div>
      </template>

      <div class="kpis" role="tablist" :aria-label="t('schedulerSnapshot.kpiAriaLabel')">
        <SnapshotKpiTab
          v-for="t in kpiTabs"
          :key="t.key"
          :label="t.label"
          :value="t.value"
          :variant="t.variant"
          :active="activePanel === t.key"
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

      <div v-show="activePanel === 'policies'" class="detail-pane" role="tabpanel">
        <el-table
          v-loading="loading"
          :data="pagedPolicies.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colPolicy')" min-width="180">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="primary">{{ row.policyCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
                    {{ row.fairShareGroup }}
                  </el-tag>
                </div>
                <div class="cell-sub">
                  quotaResetPolicy:
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
            label="maxRunningJobsPerTenant"
            width="190"
          />
          <el-table-column prop="burstLimit" label="burstLimit" width="110" />
          <el-table-column prop="partitionBurstLimit" label="partitionBurstLimit" width="150" />
          <el-table-column prop="quotaBurstRemaining" label="quotaBurstRemaining" width="160" />
          <el-table-column
            prop="quotaBurstPeakBorrowed"
            label="quotaBurstPeakBorrowed"
            width="180"
          />
          <el-table-column prop="groupSharedMaxRunningJobs" label="groupSharedMax" width="130" />
          <DatetimeColumn
            prop="quotaResetWindowExpiresAt"
            :label="t('schedulerSnapshot.colQuotaWindow')"
            width="170"
          />
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="110" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <CopyableText :text="String(row.policyCode ?? '')">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </CopyableText>
              </div>
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

      <div v-show="activePanel === 'queues'" class="detail-pane" role="tabpanel">
        <el-table
          v-loading="loading"
          :data="pagedQueues.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colQueue')" min-width="180">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="success">{{ row.queueCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.fairShareGroup)">
                    {{ row.fairShareGroup }}
                  </el-tag>
                </div>
                <div class="cell-sub">
                  quotaResetPolicy:
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
          <el-table-column prop="maxRunningJobs" label="maxRunningJobs" width="150" />
          <el-table-column
            prop="effectiveMaxRunningJobs"
            label="effectiveMaxRunningJobs"
            width="190"
          />
          <el-table-column prop="burstLimit" label="burstLimit" width="110" />
          <el-table-column prop="quotaBurstRemaining" label="quotaBurstRemaining" width="160" />
          <el-table-column
            prop="quotaBurstPeakBorrowed"
            label="quotaBurstPeakBorrowed"
            width="180"
          />
          <el-table-column prop="groupSharedMaxRunningJobs" label="groupSharedMax" width="130" />
          <DatetimeColumn
            prop="quotaResetWindowExpiresAt"
            :label="t('schedulerSnapshot.colQuotaWindow')"
            width="170"
          />
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="110" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <CopyableText :text="String(row.queueCode ?? '')">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </CopyableText>
              </div>
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

      <div v-show="activePanel === 'workers'" class="detail-pane" role="tabpanel">
        <el-table
          v-loading="loading"
          :data="pagedWorkers.records"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
          class="console-table"
        >
          <el-table-column :label="t('schedulerSnapshot.colWorker')" min-width="220">
            <template #default="{ row }">
              <div class="cell-stack">
                <div class="cell-main">
                  <el-tag size="small" effect="plain" type="info">{{ row.workerCode }}</el-tag>
                  <el-tag size="small" effect="plain" :type="tagTypeForKey(row.workerGroup)">
                    {{ row.workerGroup }}
                  </el-tag>
                  <StatusTag :value="row.status" category="worker" />
                </div>
                <div class="cell-sub">heartbeat: {{ fmtDatetime(row.heartbeatAt) }}</div>
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
          <el-table-column :label="t('schedulerSnapshot.colActions')" width="110" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <CopyableText :text="String(row.workerCode ?? '')">
                  {{ t('schedulerSnapshot.actionCopyCode') }}
                </CopyableText>
              </div>
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

      <div v-show="activePanel === 'history'" class="detail-pane" role="tabpanel">
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
                  quotaResetPolicy:
                  <el-tag size="small" effect="plain" type="info">{{
                    row.quotaResetPolicy
                  }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="activeJobs" label="activeJobs" width="100" align="right" />
          <el-table-column
            prop="activePartitions"
            label="activePartitions"
            width="130"
            align="right"
          />
          <el-table-column
            prop="effectiveJobCap"
            label="effectiveJobCap"
            width="130"
            align="right"
          />
          <el-table-column prop="maxJobsBase" label="maxJobsBase" width="120" align="right" />
          <el-table-column prop="burstLimit" label="burstLimit" width="110" align="right" />
          <el-table-column
            prop="groupActiveJobs"
            label="groupActiveJobs"
            width="140"
            align="right"
          />
          <el-table-column prop="groupMaxJobs" label="groupMaxJobs" width="120" align="right" />
          <el-table-column prop="onlineWorkers" label="onlineWorkers" width="120" align="right" />
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
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t } = useI18n({ useScope: 'global' })
  import { fmtDatetime } from '@/utils/datetime'
  import {
    getSchedulerSnapshot,
    getSchedulerSnapshotHistory,
    pauseAllSchedulers,
    resumeAllSchedulers,
  } from '@/api/scheduler'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import SnapshotKpiTab from './components/SnapshotKpiTab.vue'
  import type {
    ConsoleSchedulerSnapshotHistoryResponse,
    ConsoleSchedulerSnapshotResponse,
  } from '@/types/console-api'

  type PanelKey = 'policies' | 'queues' | 'workers' | 'history'
  type KpiVariant = 'primary' | 'success' | 'warning' | 'info'

  const tenant = useTenantStore()
  const loading = ref(false)
  const histLoading = ref(false)
  const pauseLoading = ref(false)
  const resumeLoading = ref(false)
  const snap = ref<ConsoleSchedulerSnapshotResponse | null>(null)
  const history = ref<ConsoleSchedulerSnapshotHistoryResponse[]>([])
  const activePanel = ref<PanelKey>('policies')

  const pageSize = ref(20)
  const pagePolicies = ref(1)
  const pageQueues = ref(1)
  const pageWorkers = ref(1)
  const pageHistory = ref(1)

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

  async function loadAll(silent = false) {
    loading.value = true
    histLoading.value = true
    let snapOk = true
    let histOk = true
    try {
      snap.value = await getSchedulerSnapshot(tenant.tenantId)
    } catch {
      snap.value = null
      snapOk = false
    } finally {
      loading.value = false
    }
    try {
      history.value = await getSchedulerSnapshotHistory(tenant.tenantId)
    } catch {
      history.value = []
      histOk = false
    } finally {
      histLoading.value = false
    }
    if (!silent) {
      if (snapOk && histOk) ElMessage.success(t('schedulerSnapshot.refreshDone'))
      else if (!snapOk && !histOk) ElMessage.error(t('schedulerSnapshot.refreshFailed'))
      else ElMessage.warning(t('schedulerSnapshot.refreshPartial'))
    }
  }

  useTenantReload(() => loadAll(true))

  async function confirmPauseAll() {
    try {
      await confirmDanger({
        verb: '暂停',
        target: '当前租户全部调度器',
        consequence:
          '所有触发器停止派发新任务,正在运行的实例不受影响。恢复后才会继续按计划派发,可能造成短时间窗口积压。',
        confirmButtonText: '确认暂停',
      })
      pauseLoading.value = true
      await pauseAllSchedulers()
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
        verb: '恢复',
        target: '当前租户全部调度器',
        consequence: '触发器恢复派发,暂停期间到点的任务会按既定策略追跑或顺延。',
        confirmButtonText: '确认恢复',
      })
      resumeLoading.value = true
      await resumeAllSchedulers()
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
    box-shadow: 0 0 0 3px rgb(0 0 0 / 4%);
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
