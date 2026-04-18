<template>
  <PageContainer>
    <PageHeader
      title="调度快照"
      description="GET /api/console/scheduler/snapshot 与 /snapshot/history"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="loadAll">刷新</el-button>
        <el-button type="warning" :loading="pauseLoading" @click="confirmPauseAll"
          >全局暂停</el-button
        >
        <el-button type="success" :loading="resumeLoading" @click="confirmResumeAll"
          >全局恢复</el-button
        >
      </template>
    </PageHeader>

    <SectionCard v-if="snap">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            当前快照
            <el-tag size="small" effect="plain" type="info">{{ snap.generatedAt }}</el-tag>
          </div>
          <div class="card-actions">
            <el-tag size="small" effect="plain" type="info">tenant: {{ snap.tenantId }}</el-tag>
          </div>
        </div>
      </template>

      <div class="kpis" role="tablist" aria-label="快照分类">
        <div
          role="tab"
          :tabindex="0"
          :aria-selected="activePanel === 'policies'"
          class="kpi kpi--primary"
          :class="{ 'kpi--active': activePanel === 'policies' }"
          @mouseenter="activePanel = 'policies'"
          @click="activePanel = 'policies'"
          @focus="activePanel = 'policies'"
        >
          <div class="kpi__label">策略（policies）</div>
          <div class="kpi__value">{{ snap.policies?.length ?? 0 }}</div>
        </div>
        <div
          role="tab"
          :tabindex="0"
          :aria-selected="activePanel === 'queues'"
          class="kpi kpi--success"
          :class="{ 'kpi--active': activePanel === 'queues' }"
          @mouseenter="activePanel = 'queues'"
          @click="activePanel = 'queues'"
          @focus="activePanel = 'queues'"
        >
          <div class="kpi__label">队列（queues）</div>
          <div class="kpi__value">{{ snap.queues?.length ?? 0 }}</div>
        </div>
        <div
          role="tab"
          :tabindex="0"
          :aria-selected="activePanel === 'workers'"
          class="kpi kpi--warning"
          :class="{ 'kpi--active': activePanel === 'workers' }"
          @mouseenter="activePanel = 'workers'"
          @click="activePanel = 'workers'"
          @focus="activePanel = 'workers'"
        >
          <div class="kpi__label">Workers</div>
          <div class="kpi__value">{{ snap.workers?.length ?? 0 }}</div>
        </div>
        <div
          role="tab"
          :tabindex="0"
          :aria-selected="activePanel === 'history'"
          class="kpi kpi--info"
          :class="{ 'kpi--active': activePanel === 'history' }"
          @mouseenter="activePanel = 'history'"
          @click="activePanel = 'history'"
          @focus="activePanel = 'history'"
        >
          <div class="kpi__label">历史点数</div>
          <div class="kpi__value">{{ history.length }}</div>
        </div>
      </div>
    </SectionCard>

    <SectionCard v-if="snap" class="mt detail-card">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <span class="dot" :class="activeDotClass" />
            {{ activePanelTitle }}
          </div>
          <el-tag size="small" effect="plain" type="info">{{ activePanelCount }} 条</el-tag>
        </div>
      </template>

      <div v-show="activePanel === 'policies'" class="detail-pane" role="tabpanel">
        <el-table
          :data="pagedPolicies.records"
          stripe
          border
          size="small"
          empty-text="暂无数据"
          class="console-table"
        >
          <el-table-column label="策略" min-width="180">
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
          <el-table-column prop="fairShareWeight" label="权重" width="90" />
          <el-table-column prop="activeJobs" label="活跃 Jobs" width="110" />
          <el-table-column prop="activePartitions" label="活跃分片" width="110" />
          <el-table-column prop="effectiveTenantJobCap" label="租户上限(Job)" width="140" />
          <el-table-column prop="effectiveTenantPartitionCap" label="租户上限(分片)" width="150" />
          <el-table-column
            prop="maxRunningJobsPerTenant"
            label="maxRunningJobsPerTenant"
            width="190"
          />
          <el-table-column prop="burstLimit" label="burstLimit" width="110" />
          <el-table-column prop="partitionBurstLimit" label="partitionBurstLimit" width="150" />
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
          :data="pagedQueues.records"
          stripe
          border
          size="small"
          empty-text="暂无数据"
          class="console-table"
        >
          <el-table-column label="队列" min-width="180">
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
          <el-table-column prop="fairShareWeight" label="权重" width="90" />
          <el-table-column prop="activeJobs" label="活跃 Jobs" width="110" />
          <el-table-column prop="maxRunningJobs" label="maxRunningJobs" width="150" />
          <el-table-column
            prop="effectiveMaxRunningJobs"
            label="effectiveMaxRunningJobs"
            width="190"
          />
          <el-table-column prop="burstLimit" label="burstLimit" width="110" />
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
          :data="pagedWorkers.records"
          stripe
          border
          size="small"
          empty-text="暂无数据"
          class="console-table"
        >
          <el-table-column label="Worker" min-width="220">
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
          <el-table-column label="当前负载" width="240">
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
          empty-text="暂无数据"
          class="console-table"
        >
          <DatetimeColumn prop="snapshotAt" label="时间" width="160" />
          <el-table-column prop="policyCode" label="策略" width="140" />
          <el-table-column prop="activeJobs" label="activeJobs" width="100" />
          <el-table-column prop="effectiveJobCap" label="effectiveJobCap" width="120" />
          <el-table-column prop="groupActiveJobs" label="groupActiveJobs" width="130" />
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
  import { computed, ref, watch, onMounted } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fmtDatetime } from '@/utils/datetime'
  import {
    getSchedulerSnapshot,
    getSchedulerSnapshotHistory,
    pauseAllSchedulers,
    resumeAllSchedulers,
  } from '@/api/scheduler'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import type {
    ConsoleSchedulerSnapshotHistoryResponse,
    ConsoleSchedulerSnapshotResponse,
  } from '@/types/console-api'

  type PanelKey = 'policies' | 'queues' | 'workers' | 'history'

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
      policies: '策略（policies）',
      queues: '队列（queues）',
      workers: 'Workers（采样）',
      history: '历史',
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

  async function loadAll() {
    loading.value = true
    histLoading.value = true
    try {
      snap.value = await getSchedulerSnapshot(tenant.tenantId)
    } catch {
      snap.value = null
    } finally {
      loading.value = false
    }
    try {
      history.value = await getSchedulerSnapshotHistory(tenant.tenantId)
    } catch {
      history.value = []
    } finally {
      histLoading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => loadAll(),
  )

  async function confirmPauseAll() {
    try {
      await ElMessageBox.confirm('暂停全部调度器？', '全局暂停', { type: 'warning' })
      pauseLoading.value = true
      await pauseAllSchedulers()
      ElMessage.success('已暂停全部调度')
      await loadAll()
    } catch {
      /* cancel */
    } finally {
      pauseLoading.value = false
    }
  }

  async function confirmResumeAll() {
    try {
      await ElMessageBox.confirm('恢复全部调度器？', '全局恢复', { type: 'info' })
      resumeLoading.value = true
      await resumeAllSchedulers()
      ElMessage.success('已恢复全部调度')
      await loadAll()
    } catch {
      /* cancel */
    } finally {
      resumeLoading.value = false
    }
  }

  onMounted(loadAll)
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
    background: #64748b;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
  }

  .kpi {
    position: relative;
    padding: 14px 14px 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    overflow: hidden;
    cursor: pointer;
    outline: none;
    transition:
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      box-shadow var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .kpi:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  .kpi::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--color-primary);
  }

  .kpi--success::before {
    background: var(--color-success);
  }
  .kpi--warning::before {
    background: var(--color-warning);
  }
  .kpi--info::before {
    background: #64748b;
  }

  .kpi--active {
    border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent),
      var(--shadow-surface);
  }

  .kpi--success.kpi--active {
    border-color: color-mix(in srgb, var(--color-success) 42%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-success) 24%, transparent),
      var(--shadow-surface);
  }

  .kpi--warning.kpi--active {
    border-color: color-mix(in srgb, var(--color-warning) 42%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-warning) 24%, transparent),
      var(--shadow-surface);
  }

  .kpi--info.kpi--active {
    border-color: color-mix(in srgb, #64748b 35%, var(--color-border-light));
    box-shadow:
      0 0 0 1px color-mix(in srgb, #64748b 20%, transparent),
      var(--shadow-surface);
  }

  .kpi__label {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .kpi__value {
    margin-top: 4px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
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
