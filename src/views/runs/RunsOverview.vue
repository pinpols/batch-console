<template>
  <PageContainer>
    <!-- 照设计 dump docs/redesign/proto-nav-全部运行.html:页头 18px/600 + 右侧刷新 -->
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

    <!-- 统计卡行(dump:4 列 / r12 / 6px 彩点 / mono 24px 计数);
         运行中 / 今日失败 卡可点 = 现有 statusFilter 的入口,成功 / 排队 只读 -->
    <div class="ro-stats">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="ro-stat"
        :class="{ 'is-clickable': card.clickable, 'is-active': card.active }"
        role="button"
        :tabindex="card.clickable ? 0 : -1"
        @click="card.clickable && pickStatCard(card.key)"
        @keyup.enter="card.clickable && pickStatCard(card.key)"
      >
        <div class="ro-stat__head">
          <span class="ro-stat__dot" :style="{ background: card.dot }" />
          <span class="ro-stat__label">{{ card.label }}</span>
        </div>
        <div class="ro-stat__num" :style="{ color: card.numColor }">
          {{ card.count ?? '—' }}
        </div>
      </div>
    </div>

    <!-- 双栏(dump:1fr 1fr / gap 16px):左作业运行,右工作流运行 -->
    <div class="ro-grid">
      <div>
        <div class="ro-sec">
          <span class="ro-sec__title">{{ t('runs.jobSection') }}</span>
          <span class="ro-sec__hint">{{ t('runsOverview.recentHint', { n: PAGE_SIZE }) }}</span>
          <span class="ro-sec__spacer" />
          <router-link class="ro-sec__more" to="/monitor/job-instances">
            {{ t('runs.viewAll') }} →
          </router-link>
        </div>
        <div v-loading="jobLoading" class="ro-card">
          <div v-for="row in jobRows" :key="row.id" class="ro-row ro-row--job" @click="goJob(row)">
            <div
              class="ro-row__code"
              :title="`${row.instanceNo} · ${row.bizDate} · ${fmtDatetime(row.startedAt)}`"
            >
              {{ row.jobCode }}
            </div>
            <div>
              <span
                class="ro-pill"
                :style="{
                  color: statusColor(row.instanceStatus),
                  background: statusSoftBg(row.instanceStatus),
                }"
              >
                <span
                  class="ro-pill__dot"
                  :style="{ background: statusColor(row.instanceStatus) }"
                />
                {{ instanceStatusLabel(row.instanceStatus) }}
              </span>
            </div>
            <div class="ro-row__time" :title="fmtDatetime(row.startedAt)">
              {{ fmtShortTime(row.startedAt) }}
            </div>
            <div class="ro-row__ops">
              <span class="ro-row__detail" @click.stop="goJob(row)">{{ t('common.detail') }}</span>
            </div>
          </div>
          <div v-if="!jobLoading && !jobRows.length" class="ro-empty">—</div>
        </div>
      </div>

      <div>
        <div class="ro-sec">
          <span class="ro-sec__title">{{ t('runs.workflowSection') }}</span>
          <span class="ro-sec__hint">{{ t('runsOverview.recentHint', { n: PAGE_SIZE }) }}</span>
          <span class="ro-sec__spacer" />
          <router-link class="ro-sec__more" to="/monitor/workflow-runs">
            {{ t('runs.viewAll') }} →
          </router-link>
        </div>
        <div v-loading="wfLoading" class="ro-card">
          <div
            v-for="row in wfRows"
            :key="row.id"
            class="ro-row ro-row--wf"
            @click="goWorkflow(row)"
          >
            <div class="ro-row__name" :title="`#${row.id} · ${row.bizDate ?? ''}`">
              <span class="ro-row__id">#{{ row.id }}</span>
              <span v-if="row.currentNodeCode" class="ro-row__node">{{ row.currentNodeCode }}</span>
            </div>
            <div>
              <span
                class="ro-pill"
                :style="{
                  color: statusColor(String(row.runStatus ?? '')),
                  background: statusSoftBg(String(row.runStatus ?? '')),
                }"
              >
                <span
                  class="ro-pill__dot"
                  :style="{ background: statusColor(String(row.runStatus ?? '')) }"
                />
                {{ workflowStatusLabel(String(row.runStatus ?? '')) }}
              </span>
            </div>
            <div class="ro-row__time" :title="fmtDatetime(row.startedAt)">
              {{ fmtShortTime(row.startedAt) }}
            </div>
            <div class="ro-row__ops">
              <span class="ro-row__detail" @click.stop="goWorkflow(row)">
                {{ t('common.detail') }}
              </span>
            </div>
          </div>
          <div v-if="!wfLoading && !wfRows.length" class="ro-empty">—</div>
        </div>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
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
  import type { ConsoleJobInstanceResponse, ConsoleWorkflowRunResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenant = useTenantStore()

  const PAGE_SIZE = 15

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

  // ── 状态 → 语义色(dump pill/卡片彩点语言)────────────────────────────
  function statusColor(status: string): string {
    if (status === 'RUNNING') return 'var(--color-primary)'
    if (status === 'COMPLETED' || status === 'SUCCESS') return 'var(--color-success)'
    if (status === 'FAILED') return 'var(--color-danger)'
    return 'var(--color-text-tertiary)'
  }

  function statusSoftBg(status: string): string {
    return `color-mix(in srgb, ${statusColor(status)} 14%, transparent)`
  }

  function instanceStatusLabel(status: string): string {
    const key = `enum.instanceStatus.${status}`
    return te(key) ? t(key) : status || '—'
  }

  function workflowStatusLabel(status: string): string {
    const key = `enum.workflowRunStatus.${status}`
    return te(key) ? t(key) : status || '—'
  }

  // ── 统计卡计数:当前租户下轻查询 total(pageSize=1),接口支持
  //    instanceStatus + startDate/endDate 过滤(见 src/api/queries/instances.ts)──
  const statCounts = reactive<Record<string, number | null>>({
    running: null,
    todayCompleted: null,
    todayFailed: null,
    waiting: null,
  })

  function todayStr(): string {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  const COUNT_DEFS: { key: string; instanceStatus: string; todayOnly: boolean }[] = [
    { key: 'running', instanceStatus: 'RUNNING', todayOnly: false },
    { key: 'todayCompleted', instanceStatus: 'COMPLETED', todayOnly: true },
    { key: 'todayFailed', instanceStatus: 'FAILED', todayOnly: true },
    { key: 'waiting', instanceStatus: 'WAITING', todayOnly: false },
  ]

  async function loadStatCounts() {
    const today = todayStr()
    await Promise.all(
      COUNT_DEFS.map(async (def) => {
        try {
          const pr = await instanceApi.list({
            tenantId: tenant.tenantId,
            instanceStatus: def.instanceStatus,
            ...(def.todayOnly ? { startDate: today, endDate: today } : {}),
            page: 1,
            pageSize: 1,
          })
          statCounts[def.key] = pr.total ?? 0
        } catch {
          statCounts[def.key] = null
        }
      }),
    )
  }

  const statCards = computed(() => [
    {
      key: 'running',
      label: t('runs.filterRunning'),
      dot: 'var(--color-primary)',
      numColor: 'var(--color-primary)',
      count: statCounts.running,
      clickable: true,
      active: statusFilter.value === 'running',
    },
    {
      key: 'todayCompleted',
      label: t('runsOverview.todayCompleted'),
      dot: 'var(--color-success)',
      numColor: 'var(--color-text-primary)',
      count: statCounts.todayCompleted,
      clickable: false,
      active: false,
    },
    {
      key: 'todayFailed',
      label: t('runsOverview.todayFailed'),
      dot: 'var(--color-danger)',
      numColor: 'var(--color-danger)',
      count: statCounts.todayFailed,
      clickable: true,
      active: statusFilter.value === 'failed',
    },
    {
      key: 'waiting',
      label: t('runsOverview.waiting'),
      dot: 'var(--color-text-tertiary)',
      numColor: 'var(--color-text-tertiary)',
      count: statCounts.waiting,
      clickable: false,
      active: false,
    },
  ])

  // 卡片点击 = 现有 statusFilter 的另一入口:再点一次回到全部
  function pickStatCard(key: string) {
    const target = key === 'running' ? 'running' : 'failed'
    statusFilter.value = statusFilter.value === target ? 'all' : target
    loadAll()
  }

  function fmtShortTime(v: unknown): string {
    if (v == null || v === '') return '—'
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return '—'
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}`
  }

  async function loadJobs() {
    jobLoading.value = true
    try {
      const page = await instanceApi.list({
        tenantId: tenant.tenantId,
        instanceStatus: statusCode(),
        page: 1,
        pageSize: PAGE_SIZE,
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
        pageSize: PAGE_SIZE,
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
    void loadStatCounts()
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
  /* ── 照设计 dump docs/redesign/proto-nav-全部运行.html 1:1 ── */

  /* 统计卡行:4 列 / gap 14 / mb 20 */
  .ro-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }

  @media (max-width: 900px) {
    .ro-stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .ro-stat {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow: var(--shadow-card);
  }

  .ro-stat.is-clickable {
    cursor: pointer;
  }

  .ro-stat.is-active {
    border-color: var(--color-primary);
  }

  .ro-stat__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ro-stat__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ro-stat__label {
    color: var(--color-text-secondary);
    font-size: 12.5px;
  }

  .ro-stat__num {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 600;
    margin-top: 8px;
  }

  /* 双栏 */
  .ro-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 1080px) {
    .ro-grid {
      grid-template-columns: 1fr;
    }
  }

  /* 栏头:13/600 标题 + mono 提示 + 全部 → */
  .ro-sec {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .ro-sec__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .ro-sec__hint {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
  }

  .ro-sec__spacer {
    flex: 1;
  }

  .ro-sec__more {
    font-size: 12px;
    color: var(--color-primary);
    cursor: pointer;
    text-decoration: none;
  }

  .ro-sec__more:hover {
    text-decoration: underline;
  }

  /* 卡片列表 */
  .ro-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
    min-height: 48px;
  }

  .ro-row {
    display: grid;
    gap: 10px;
    align-items: center;
    padding: 11px 16px;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
  }

  .ro-row:last-of-type {
    border-bottom: none;
  }

  .ro-row:hover {
    background: var(--color-bg-elevated);
  }

  .ro-row--job {
    grid-template-columns: minmax(0, 1fr) 74px 78px 60px;
  }

  .ro-row--wf {
    grid-template-columns: minmax(0, 1fr) 96px 78px 60px;
  }

  .ro-row__code {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ro-row__name {
    font-size: 12px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ro-row__id {
    font-family: var(--font-mono);
  }

  .ro-row__node {
    margin-left: 6px;
    color: var(--color-text-secondary);
  }

  .ro-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .ro-pill__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ro-row__time {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .ro-row__ops {
    text-align: right;
  }

  .ro-row__detail {
    font-size: 12px;
    color: var(--color-primary);
    cursor: pointer;
    padding: 3px 7px;
    border-radius: 6px;
  }

  .ro-row__detail:hover {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  .ro-empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
