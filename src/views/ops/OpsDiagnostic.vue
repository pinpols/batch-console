<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="anyLoading" @click="runAll">
          {{ t('opsDiagnostic.btnRunAll') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <div class="diag-catalog">
        <article
          v-for="card in diagCards"
          :key="card.key"
          class="diag-card"
          :class="{ 'is-active': card.expanded, 'is-error': card.error }"
        >
          <header class="diag-card__head">
            <span class="diag-card__icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </span>
            <div class="diag-card__title">
              <h3>{{ card.title }}</h3>
              <p>{{ card.desc }}</p>
            </div>
          </header>

          <div class="diag-card__meta">
            <el-tag v-if="card.loading" size="small" effect="plain" type="info">
              {{ t('opsDiagnostic.statusRunning') }}
            </el-tag>
            <el-tag v-else-if="card.error" size="small" effect="plain" type="danger">
              {{ t('opsDiagnostic.statusFailed') }}
            </el-tag>
            <el-tag v-else-if="card.hasData" size="small" effect="plain" type="success">
              {{ t('opsDiagnostic.statusOk') }}
            </el-tag>
            <el-tag v-else size="small" effect="plain" type="info">
              {{ t('opsDiagnostic.statusIdle') }}
            </el-tag>
            <span v-if="card.lastRunAt" class="diag-card__time">
              {{ t('opsDiagnostic.lastRunAt', { time: card.lastRunAt }) }}
            </span>
          </div>

          <footer class="diag-card__action">
            <el-button
              v-if="card.hasData"
              type="primary"
              plain
              size="small"
              :icon="card.expanded ? ArrowUp : ArrowDown"
              @click="card.expanded = !card.expanded"
            >
              {{ card.expanded ? t('opsDiagnostic.btnCollapse') : t('opsDiagnostic.btnExpand') }}
            </el-button>
            <el-button
              type="primary"
              plain
              size="small"
              :icon="Refresh"
              :loading="card.loading"
              @click="card.run()"
            >
              {{ card.hasData ? t('opsDiagnostic.btnRerun') : t('opsDiagnostic.btnRun') }}
            </el-button>
          </footer>

          <el-collapse-transition>
            <div v-if="card.expanded && card.hasData" class="diag-card__result">
              <component :is="card.resultRender" />
            </div>
          </el-collapse-transition>
        </article>

        <!-- 补救卡片:危险动作,独立一张,跟诊断卡片视觉区分 -->
        <article class="diag-card diag-card--danger">
          <header class="diag-card__head">
            <span class="diag-card__icon diag-card__icon--danger">
              <el-icon><Tools /></el-icon>
            </span>
            <div class="diag-card__title">
              <h3>{{ t('opsDiagnostic.cardRemediation') }}</h3>
              <p>{{ t('opsDiagnostic.descRemediation') }}</p>
            </div>
          </header>

          <div class="diag-card__meta">
            <el-tag size="small" effect="plain" type="danger">
              {{ t('opsDiagnostic.badgeDanger') }}
            </el-tag>
          </div>

          <div class="diag-card__hint">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ t('opsDiagnostic.remediationPrereq') }}</span>
          </div>
          <footer class="diag-card__action diag-card__action--dual">
            <el-tooltip
              :content="cleanupDisableReason || t('opsDiagnostic.cleanupTip')"
              placement="top"
            >
              <span class="diag-card__btn-wrap">
                <el-button
                  type="warning"
                  plain
                  size="small"
                  :icon="Delete"
                  :loading="cleaning"
                  :disabled="!!cleanupDisableReason"
                  v-track-click="t('opsDiagnostic.trackCleanup')"
                  @click="doCleanup"
                >
                  {{ t('opsDiagnostic.btnCleanup') }}
                </el-button>
              </span>
            </el-tooltip>
            <el-tooltip
              :content="republishDisableReason || t('opsDiagnostic.republishTip')"
              placement="top"
            >
              <span class="diag-card__btn-wrap">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Promotion"
                  :loading="republishing"
                  :disabled="!!republishDisableReason"
                  v-track-click="t('opsDiagnostic.trackRepublish')"
                  @click="doRepublish"
                >
                  {{ t('opsDiagnostic.btnRepublish') }}
                </el-button>
              </span>
            </el-tooltip>
          </footer>
        </article>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, h, onMounted, reactive, ref, type Component } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    ArrowDown,
    ArrowUp,
    Cpu,
    DataAnalysis,
    Delete,
    InfoFilled,
    Lock,
    MessageBox,
    Monitor,
    Promotion,
    Refresh,
    Tools,
    Warning,
  } from '@element-plus/icons-vue'
  import { getKafkaLag, getOutboxStats, cleanupOutbox, republishOutbox } from '@/api/ops'
  import {
    getClusterDiagnostic,
    getShedLockStatus,
    getWorkerConsistency,
    getOutboxHealth,
  } from '@/api/clusterDiagnostic'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { purifyHtml } from '@/utils/safeHtml'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()

  // ──────────────────────────────────────────────
  // 摘要工具(保留原有 summary 函数)
  // ──────────────────────────────────────────────
  type Obj = Record<string, unknown>
  const ok = (s: string | number) => `<strong style="color:var(--color-success)">${s}</strong>`
  const bad = (s: string | number) => `<strong style="color:var(--color-danger)">${s}</strong>`
  const dim = (s: string | number) => `<span style="color:var(--color-text-tertiary)">${s}</span>`
  const n = (v: unknown) => (typeof v === 'number' ? v : 0)
  const arr = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  const SEP = ' &nbsp;·&nbsp; '
  const tx = (k: string, p?: Record<string, unknown>) => t(`opsDiagnostic.${k}`, p ?? {})

  function summarizeOutbox(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const breakdown = Array.isArray(d.statusBreakdown) ? (d.statusBreakdown as Obj[]) : []
    const total = breakdown.reduce((s, x) => s + n(x.cnt), 0)
    const failed = breakdown
      .filter((x) => /FAIL|ERROR/i.test(String(x.deliveryStatus ?? '')))
      .reduce((s, x) => s + n(x.cnt), 0)
    const pending = breakdown
      .filter((x) => /PENDING|NEW|PUBLISHING/i.test(String(x.deliveryStatus ?? '')))
      .reduce((s, x) => s + n(x.cnt), 0)
    return [
      tx('sumTotal', { n: total }),
      `${tx('sumPending')} ${pending > 0 ? bad(pending) : ok(0)}`,
      `${tx('sumFailed')} ${failed > 0 ? bad(failed) : ok(0)}`,
    ].join(SEP)
  }

  function summarizeCluster(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const sl = (d.shedLock as Obj) ?? {}
    const wk = (d.workers as Obj) ?? {}
    const ob = (d.outbox as Obj) ?? {}
    const parts: string[] = []
    parts.push(`${tx('sumShedLockActive')} ${ok(n(sl.activeLocks))}/${n(sl.totalLocks)}`)
    const wkIssues =
      n(wk.staleOnlineWorkers) +
      n(wk.drainingPastDeadlineWorkers) +
      n(wk.decommissionedWorkersWithActiveTasks)
    parts.push(
      wkIssues > 0
        ? `${tx('sumWorkerHealthy')} ${ok(n(wk.onlineWorkers))} · ${tx('sumWorkerAbnormal')} ${bad(wkIssues)}`
        : `${tx('sumWorkerHealthy')} ${ok(n(wk.onlineWorkers))}`,
    )
    const obIssues = n(ob.pendingEvents) + n(ob.stalePublishingEvents)
    parts.push(obIssues > 0 ? `${tx('sumOutboxPending')} ${bad(obIssues)}` : ok(tx('sumOutboxOk')))
    return parts.join(SEP)
  }

  function summarizeWorker(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const online = n(d.onlineWorkers)
    const stale = n(d.staleOnlineWorkers)
    const drainingOverdue = n(d.drainingPastDeadlineWorkers)
    const decomActive = n(d.decommissionedWorkersWithActiveTasks)
    const invalidTags = arr(d.invalidCapabilityTags)
    const draining = n(d.drainingWorkers)
    const running = n(d.runningInstances)
    const parts: string[] = [`${tx('sumOnline')} ${ok(online)}`]
    if (draining > 0) parts.push(`${tx('sumDraining')} ${dim(draining)}`)
    if (running > 0) parts.push(`${tx('sumRunning')} ${dim(running)}`)
    const issues: string[] = []
    if (stale > 0) issues.push(`${tx('sumStaleHeartbeat')} ${bad(stale)}`)
    if (drainingOverdue > 0) issues.push(`${tx('sumDrainingOverdue')} ${bad(drainingOverdue)}`)
    if (decomActive > 0) issues.push(`${tx('sumDecomActive')} ${bad(decomActive)}`)
    if (invalidTags > 0) issues.push(`${tx('sumInvalidTags')} ${bad(invalidTags)}`)
    if (issues.length === 0) parts.push(`${tx('sumConsistencyOk')} ${ok('✓')}`)
    else parts.push(...issues)
    return parts.join(SEP)
  }

  function summarizeOutboxHealth(data: unknown): string {
    if (!data || typeof data !== 'object') return ''
    const d = data as Obj
    const pending = n(d.pendingEvents)
    const active = n(d.activeEvents)
    const stale = n(d.stalePublishingEvents)
    return [
      `${tx('sumPending')} ${pending > 0 ? bad(pending) : ok(0)}`,
      `${tx('sumActive')} ${dim(active)}`,
      `${tx('sumStuck')} ${stale > 0 ? bad(stale) : ok(0)}`,
    ].join(SEP)
  }

  // ──────────────────────────────────────────────
  // 7 张诊断卡片状态机
  // ──────────────────────────────────────────────
  interface DiagCard {
    key: string
    icon: Component
    title: string
    desc: string
    loading: boolean
    error: boolean
    expanded: boolean
    data: unknown
    lastRunAt: string
    hasData: boolean
    run: () => Promise<void>
    resultRender: () => unknown
  }

  function fmtNow() {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date())
  }

  function createCard(opts: {
    key: string
    icon: Component
    title: string
    desc: string
    fetch: (tenantId: string) => Promise<unknown>
    /** 渲染展开后的卡片结果体(JsonPreview / el-table 等) */
    render: (data: unknown) => unknown
  }): DiagCard {
    const state = reactive({
      loading: false,
      error: false,
      expanded: false,
      data: null as unknown,
      lastRunAt: '',
    }) as Pick<DiagCard, 'loading' | 'error' | 'expanded' | 'data' | 'lastRunAt'>

    async function run() {
      if (!tenant.tenantId) return
      state.loading = true
      state.error = false
      try {
        state.data = await opts.fetch(tenant.tenantId)
        state.lastRunAt = fmtNow()
        state.expanded = true
      } catch {
        state.data = null
        state.error = true
      } finally {
        state.loading = false
      }
    }

    return reactive({
      key: opts.key,
      icon: opts.icon,
      title: opts.title,
      desc: opts.desc,
      get loading() {
        return state.loading
      },
      get error() {
        return state.error
      },
      get expanded() {
        return state.expanded
      },
      set expanded(v: boolean) {
        state.expanded = v
      },
      get data() {
        return state.data
      },
      get lastRunAt() {
        return state.lastRunAt
      },
      get hasData() {
        return state.data != null
      },
      run,
      resultRender: () => opts.render(state.data),
    }) as DiagCard
  }

  // 渲染助手:summary + JsonPreview
  function renderJsonWithSummary(summarizer: (data: unknown) => string) {
    return (data: unknown) =>
      h(
        JsonPreview,
        { data },
        {
          summary: ({ data: d }: { data: unknown }) =>
            h('span', { innerHTML: purifyHtml(summarizer(d)) }),
        },
      )
  }

  // Kafka lag 用专属表格
  function renderKafkaLag(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      return h('div', { class: 'diag-empty' }, t('opsDiagnostic.emptyData'))
    }
    return h('div', { class: 'diag-kafka-lag' }, [
      h('table', { class: 'diag-mini-table' }, [
        h(
          'thead',
          null,
          h('tr', null, [
            h('th', null, 'Group ID'),
            h('th', { class: 'num' }, 'Lag'),
            h('th', { class: 'num' }, 'Partitions'),
          ]),
        ),
        h(
          'tbody',
          null,
          (data as Array<Record<string, unknown>>).map((row) =>
            h('tr', { key: String(row.groupId) }, [
              h('td', { class: 'mono' }, String(row.groupId ?? '')),
              h(
                'td',
                { class: 'num' },
                h(
                  'span',
                  { class: Number(row.totalLag) > 0 ? 'lag-bad' : 'lag-ok' },
                  String(row.totalLag ?? 0),
                ),
              ),
              h('td', { class: 'num' }, String(row.partitionCount ?? 0)),
            ]),
          ),
        ),
      ]),
    ])
  }

  function renderShedLock(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      return h(JsonPreview, { data })
    }
    return h('div', { class: 'diag-shedlock' }, [
      h('table', { class: 'diag-mini-table' }, [
        h(
          'thead',
          null,
          h('tr', null, [
            h('th', null, t('opsDiagnostic.colLockName')),
            h('th', null, t('opsDiagnostic.colLockUntil')),
            h('th', null, t('opsDiagnostic.colLockedBy')),
          ]),
        ),
        h(
          'tbody',
          null,
          (data as Array<Record<string, unknown>>).map((row, i) =>
            h('tr', { key: i }, [
              h('td', { class: 'mono' }, String(row.name ?? '')),
              h('td', null, String(row.lockUntil ?? '')),
              h('td', { class: 'mono' }, String(row.lockedBy ?? '')),
            ]),
          ),
        ),
      ]),
    ])
  }

  const cardKafkaLag = createCard({
    key: 'kafkaLag',
    icon: Warning,
    title: t('opsDiagnostic.sectionKafkaLag'),
    desc: t('opsDiagnostic.descKafkaLag'),
    fetch: getKafkaLag,
    render: renderKafkaLag,
  })
  const cardOutboxStats = createCard({
    key: 'outboxStats',
    icon: MessageBox,
    title: t('opsDiagnostic.sectionOutboxStats'),
    desc: t('opsDiagnostic.descOutboxStats'),
    fetch: getOutboxStats,
    render: renderJsonWithSummary(summarizeOutbox),
  })
  const cardCluster = createCard({
    key: 'cluster',
    icon: Monitor,
    title: t('opsDiagnostic.sectionClusterOverview'),
    desc: t('opsDiagnostic.descCluster'),
    fetch: getClusterDiagnostic,
    render: renderJsonWithSummary(summarizeCluster),
  })
  const cardShedLock = createCard({
    key: 'shedLock',
    icon: Lock,
    title: t('opsDiagnostic.sectionShedLock'),
    desc: t('opsDiagnostic.descShedLock'),
    fetch: getShedLockStatus,
    render: renderShedLock,
  })
  const cardWorker = createCard({
    key: 'worker',
    icon: Cpu,
    title: t('opsDiagnostic.sectionWorkerConsistency'),
    desc: t('opsDiagnostic.descWorker'),
    fetch: getWorkerConsistency,
    render: renderJsonWithSummary(summarizeWorker),
  })
  const cardOutboxHealth = createCard({
    key: 'outboxHealth',
    icon: DataAnalysis,
    title: t('opsDiagnostic.sectionOutboxHealth'),
    desc: t('opsDiagnostic.descOutboxHealth'),
    fetch: getOutboxHealth,
    render: renderJsonWithSummary(summarizeOutboxHealth),
  })

  // 卡片顺序按 oncall 排障扫读心智:
  // 集群概览(top-down)→ Worker 一致性 → Kafka Lag(消息层)→ Outbox 统计 → Outbox 健康
  // → ShedLock(底层锁,低频)。Outbox 补救卡片(高危)在模板最后单独渲染。
  const diagCards = computed<DiagCard[]>(() => [
    cardCluster,
    cardWorker,
    cardKafkaLag,
    cardOutboxStats,
    cardOutboxHealth,
    cardShedLock,
  ])

  const anyLoading = computed(() => diagCards.value.some((c) => c.loading))

  async function runAll() {
    // 并发跑全部 6 个,容忍单个失败
    await Promise.all(diagCards.value.map((c) => c.run().catch(() => undefined)))
    const failed = diagCards.value.filter((c) => c.error).length
    if (failed === 0) ElMessage.success(t('opsDiagnostic.refreshDone'))
    else if (failed === diagCards.value.length) ElMessage.error(t('opsDiagnostic.refreshAllFailed'))
    else ElMessage.warning(t('opsDiagnostic.refreshPartial', { n: failed }))
  }

  // ──────────────────────────────────────────────
  // 补救卡片:cleanup + republish
  // ──────────────────────────────────────────────
  const cleaning = ref(false)
  const republishing = ref(false)

  /**
   * 前置条件:Outbox 补救按钮在不满足条件时禁用,tooltip 给出原因。
   *  - 清理:需 ADMIN + Outbox 统计已加载 + 有可清理事件(脏数据/失败积压)
   *  - 重发布:需 ADMIN + 健康状态已加载 + 当前有 pending 或 stale 事件
   */
  const isAdmin = computed(() => auth.role === 'ADMIN')

  const cleanupDisableReason = computed<string>(() => {
    if (!isAdmin.value) return t('opsDiagnostic.needAdmin')
    const stats = cardOutboxStats.data as Record<string, unknown> | null
    if (!stats) return t('opsDiagnostic.needOutboxStats')
    const breakdown = Array.isArray(stats.statusBreakdown) ? stats.statusBreakdown : []
    const total = breakdown.reduce(
      (s: number, x: Record<string, unknown>) => s + Number(x.cnt ?? 0),
      0,
    )
    if (total === 0) return t('opsDiagnostic.cleanupNoTargets')
    return ''
  })

  const republishDisableReason = computed<string>(() => {
    if (!isAdmin.value) return t('opsDiagnostic.needAdmin')
    const health = cardOutboxHealth.data as Record<string, unknown> | null
    if (!health) return t('opsDiagnostic.needOutboxHealth')
    const failed = Number(health.pendingEvents ?? 0) + Number(health.stalePublishingEvents ?? 0)
    if (failed === 0) return t('opsDiagnostic.republishNoTargets')
    return ''
  })

  async function doCleanup() {
    try {
      await ElMessageBox.confirm(
        t('opsDiagnostic.cleanupConfirmText'),
        t('opsDiagnostic.cleanupConfirmTitle'),
        { type: 'warning' },
      )
      cleaning.value = true
      await cleanupOutbox(tenant.tenantId)
      ElMessage.success(t('opsDiagnostic.cleanupDoneToast'))
      // 顺手刷新一下 outbox 卡片
      void cardOutboxStats.run()
    } catch {
      /* cancel */
    } finally {
      cleaning.value = false
    }
  }

  async function doRepublish() {
    try {
      const { value: idsText } = await ElMessageBox.prompt(
        t('opsDiagnostic.republishPromptText'),
        t('opsDiagnostic.republishPromptTitle'),
        {
          inputPattern: /^\s*\d+(\s*,\s*\d+)*\s*$/,
          inputErrorMessage: t('opsDiagnostic.republishPromptError'),
          type: 'warning',
        },
      )
      const ids = idsText
        .split(',')
        .map((s: string) => Number(s.trim()))
        .filter((nn: number) => !Number.isNaN(nn) && nn > 0)
      if (!ids.length) {
        ElMessage.warning(t('opsDiagnostic.noValidIds'))
        return
      }
      republishing.value = true
      await republishOutbox(tenant.tenantId, ids)
      ElMessage.success(t('opsDiagnostic.republishDoneToast', { n: ids.length }))
      void cardOutboxStats.run()
    } catch {
      /* cancel */
    } finally {
      republishing.value = false
    }
  }

  // 进页面并发预热所有卡，避免用户手动逐个点"加载"
  onMounted(() => {
    void Promise.all(diagCards.value.map((c) => c.run().catch(() => undefined)))
  })

  useTenantReload(() => {
    // 切租户 → 重跑已展开的卡(用户已经在看的),其他保留旧数据 + 标记 stale 由用户决定
    for (const c of diagCards.value) {
      if (c.hasData) void c.run()
    }
  })
</script>

<style scoped>
  .diag-catalog {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-md);
  }

  .diag-card {
    display: grid;
    grid-template-rows: auto auto auto auto;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    transition:
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      border-color var(--motion-duration-md) var(--motion-ease-standard),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard);
  }

  .diag-card:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-border) 75%, var(--color-primary) 25%);
    box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
  }

  .diag-card.is-active {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border) 65%);
  }

  .diag-card.is-error {
    border-color: color-mix(in srgb, var(--color-danger) 32%, var(--color-border) 68%);
  }

  .diag-card--danger {
    border-color: color-mix(in srgb, var(--color-danger) 24%, var(--color-border) 76%);
    background: color-mix(in srgb, var(--color-danger) 3%, var(--color-bg-card) 97%);
  }

  .diag-card__head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .diag-card__icon {
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card) 88%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
    color: var(--color-primary);
  }

  .diag-card__icon--danger {
    background: color-mix(in srgb, var(--color-danger) 12%, var(--color-bg-card) 88%);
    border-color: color-mix(in srgb, var(--color-danger) 22%, var(--color-border) 78%);
    color: var(--color-danger);
  }

  .diag-card__icon :deep(svg) {
    width: 18px;
    height: 18px;
  }

  .diag-card__title {
    min-width: 0;
    flex: 1;
  }

  .diag-card__title h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .diag-card__title p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .diag-card__meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .diag-card__time {
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .diag-card__action {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .diag-card__action--dual {
    justify-content: space-between;
  }

  /* 高危补救按钮的前置条件提示行,放在按钮上方,info 蓝图标 + 浅色文字 */
  .diag-card__hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 4px 0 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
    border-radius: 4px;
  }

  .diag-card__hint .el-icon {
    color: var(--color-primary);
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* 包一层 span 让 el-tooltip 即使在 disabled button 上也能触发(EP 默认 disabled 不触发) */
  .diag-card__btn-wrap {
    display: inline-flex;
  }

  .diag-card__result {
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px dashed var(--color-border-light);
    font-size: 12px;
  }

  /* 卡片内嵌 mini 表格(Kafka lag / ShedLock) */
  .diag-card__result :deep(.diag-mini-table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .diag-card__result :deep(.diag-mini-table th),
  .diag-card__result :deep(.diag-mini-table td) {
    padding: 6px 8px;
    border-bottom: 1px solid var(--color-border-light);
    text-align: left;
  }

  .diag-card__result :deep(.diag-mini-table th) {
    font-weight: 600;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
  }

  .diag-card__result :deep(.diag-mini-table .num) {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .diag-card__result :deep(.diag-mini-table .mono) {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    color: var(--color-text-primary);
  }

  .diag-card__result :deep(.lag-bad) {
    color: var(--color-danger);
    font-weight: 700;
  }

  .diag-card__result :deep(.lag-ok) {
    color: var(--color-success);
  }

  .diag-card__result :deep(.diag-empty) {
    padding: 16px;
    text-align: center;
    color: var(--color-text-tertiary);
  }

  @media (max-width: 640px) {
    .diag-catalog {
      grid-template-columns: 1fr;
    }
  }
</style>
