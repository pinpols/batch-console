<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <div class="header-actions">
          <el-tag type="info" effect="plain">
            {{ t('reportExportHub.tenantTagPrefix', { id: tenant.tenantId }) }}
          </el-tag>
          <el-button size="small" plain @click="copyTenant">
            {{ t('reportExportHub.btnCopy') }}
          </el-button>
        </div>
      </template>
    </PageHeader>

    <!-- 照设计 proto-reports dump:pill 双 tab(趋势分析/导出中心) -->
    <div class="rp-tabs">
      <button
        type="button"
        class="rp-tab"
        :class="{ 'is-active': activeTab === 'trend' }"
        @click="activeTab = 'trend'"
      >
        {{ t('reportExportHub.tabTrend') }}
      </button>
      <button
        type="button"
        class="rp-tab"
        :class="{ 'is-active': activeTab === 'exports' }"
        @click="activeTab = 'exports'"
      >
        {{ t('reportExportHub.tabExports') }}
      </button>
    </div>

    <!-- 趋势分析 tab:KPI 行 + 近 7 日执行量堆叠柱(全部真实数据;dump 的环比 ±% 无数据源,不编造) -->
    <div v-if="activeTab === 'trend'" v-loading="trendLoading">
      <div class="rp-kpis">
        <div v-for="k in kpis" :key="k.label" class="rp-kpi">
          <div class="rp-kpi__label">{{ k.label }}</div>
          <div class="rp-kpi__row">
            <span class="rp-kpi__value">{{ k.value }}</span>
          </div>
        </div>
      </div>

      <div class="rp-chart">
        <div class="rp-chart__head">
          <div class="rp-chart__title">{{ t('reportExportHub.trendTitle') }}</div>
          <span class="rp-chart__spacer" />
          <div class="rp-chart__legend">
            <span class="rp-legend">
              <span class="rp-legend__swatch rp-legend__swatch--success" />
              {{ t('reportExportHub.legendSuccess') }}
            </span>
            <span class="rp-legend">
              <span class="rp-legend__swatch rp-legend__swatch--failed" />
              {{ t('reportExportHub.legendFailed') }}
            </span>
          </div>
        </div>
        <div v-if="trendDays.length" class="rp-bars">
          <div
            v-for="d in trendDays"
            :key="d.day"
            class="rp-bar"
            :title="`${d.day} · ${t('reportExportHub.legendSuccess')} ${d.success} / ${t('reportExportHub.legendFailed')} ${d.failed}`"
          >
            <div class="rp-bar__stack" :style="{ height: d.heightPct }">
              <div
                v-if="d.failed > 0"
                class="rp-bar__seg rp-bar__seg--failed"
                :style="{ height: d.failedPct }"
              />
              <div class="rp-bar__seg rp-bar__seg--success" />
            </div>
            <div class="rp-bar__label">{{ d.label }}</div>
          </div>
        </div>
        <el-empty
          v-else-if="!trendLoading"
          :description="t('reportExportHub.trendEmpty')"
          :image-size="64"
        />
      </div>
    </div>

    <!-- 导出中心 tab:原导出功能全保留 -->
    <SectionCard v-else class="export-hub-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ t('reportExportHub.cardTitle') }}</div>
            <div class="card-subtitle">{{ t('reportExportHub.cardSubtitle') }}</div>
          </div>
          <el-input
            v-model="keyword"
            :placeholder="t('reportExportHub.searchPlaceholder')"
            clearable
            class="search"
          />
        </div>
      </template>

      <div class="grid">
        <article v-for="r in filteredReports" :key="r.key" class="report-card">
          <div class="report-card__main">
            <div class="report-card__title">
              {{ r.label }}
              <el-tag v-if="r.badge" size="small" effect="plain" :type="r.badgeType ?? 'info'">
                {{ r.badge }}
              </el-tag>
            </div>
            <div class="report-card__meta">{{ r.desc }}</div>
          </div>
          <div class="report-card__aside">
            <el-button
              type="primary"
              plain
              size="small"
              :icon="Download"
              :loading="loadingKey === r.key"
              :disabled="loadingKey !== ''"
              @click="downloadOne(r)"
            >
              {{ t('reportExportHub.btnDownload') }}
            </el-button>
            <div class="report-card__file">{{ r.file }}</div>
          </div>
        </article>
      </div>

      <el-empty
        v-if="filteredReports.length === 0"
        :description="t('reportExportHub.emptyDesc')"
        :image-size="72"
        class="empty"
      />

      <p class="hint">{{ t('reportExportHub.hintText') }}</p>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Download } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  import { downloadReportExcel, type ReportExcelKey } from '@/api/reports'
  import { getDashboardJobStats, getDashboardSlaCompliance } from '@/api/dashboard'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const loadingKey = ref<ReportExcelKey | ''>('')

  const keyword = ref('')
  const activeTab = ref<'trend' | 'exports'>('trend')

  // ═══════════════════════════════════════
  // 趋势分析(BE dashboard/job-stats + sla-compliance,近 7 日)
  // ═══════════════════════════════════════
  const TREND_DAYS = 7
  const trendLoading = ref(false)
  interface TrendRow {
    day: string
    success: number
    failed: number
  }
  const trendRows = ref<TrendRow[]>([])
  const slaOnTime = ref<number | null>(null)
  const slaTotal = ref<number | null>(null)
  const avgDurationSeconds = ref<number | null>(null)
  const totalRuns = ref<number | null>(null)
  const successRuns = ref<number | null>(null)

  function asNum(v: unknown): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  async function loadTrend() {
    if (!tenant.tenantId) return
    trendLoading.value = true
    try {
      const [jobStats, sla] = await Promise.all([
        getDashboardJobStats(tenant.tenantId, TREND_DAYS),
        getDashboardSlaCompliance(tenant.tenantId, TREND_DAYS),
      ])
      // dailyTrend: [{ day, status, count }] → 按日聚合成功/失败;总执行 = 全状态求和
      const rows = Array.isArray((jobStats as Record<string, unknown>).dailyTrend)
        ? ((jobStats as Record<string, unknown>).dailyTrend as Record<string, unknown>[])
        : []
      const byDay = new Map<string, TrendRow>()
      let total = 0
      let success = 0
      for (const r of rows) {
        const day = String(r.day ?? '')
        if (!day) continue
        const status = String(r.status ?? '').toUpperCase()
        const count = asNum(r.count)
        total += count
        const item = byDay.get(day) ?? { day, success: 0, failed: 0 }
        if (status === 'SUCCESS' || status === 'COMPLETED') {
          item.success += count
          success += count
        } else if (status === 'FAILED') {
          item.failed += count
        }
        byDay.set(day, item)
      }
      trendRows.value = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
      totalRuns.value = total
      successRuns.value = success

      const s = sla as Record<string, unknown>
      slaOnTime.value = asNum(s.onTime)
      slaTotal.value = asNum(s.totalWithSla)
      avgDurationSeconds.value = s.avgDurationSeconds == null ? null : asNum(s.avgDurationSeconds)
    } catch {
      trendRows.value = []
      totalRuns.value = null
      successRuns.value = null
      slaOnTime.value = null
      slaTotal.value = null
      avgDurationSeconds.value = null
    } finally {
      trendLoading.value = false
    }
  }

  function fmtDuration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ${s % 60}s`
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }

  // KPI 行:总执行/成功率/平均耗时/SLA 达标率(缺数据显示 —,不编造)
  const kpis = computed(() => {
    const total = totalRuns.value
    const success = successRuns.value
    const successRate =
      total != null && success != null && total > 0
        ? `${((success / total) * 100).toFixed(1)}%`
        : '—'
    const avg = avgDurationSeconds.value != null ? fmtDuration(avgDurationSeconds.value) : '—'
    const slaRate =
      slaTotal.value != null && slaTotal.value > 0 && slaOnTime.value != null
        ? `${((slaOnTime.value / slaTotal.value) * 100).toFixed(1)}%`
        : '—'
    return [
      {
        label: t('reportExportHub.kpiTotalRuns'),
        value: total != null ? total.toLocaleString() : '—',
      },
      { label: t('reportExportHub.kpiSuccessRate'), value: successRate },
      { label: t('reportExportHub.kpiAvgDuration'), value: avg },
      { label: t('reportExportHub.kpiSlaRate'), value: slaRate },
    ]
  })

  // 柱高:相对 7 日内最大日总量(成功+失败堆叠;dump 同构)
  const trendDays = computed(() => {
    const rows = trendRows.value
    const max = rows.reduce((m, r) => Math.max(m, r.success + r.failed), 0)
    return rows.map((r) => {
      const sum = r.success + r.failed
      return {
        day: r.day,
        label: r.day.length >= 10 ? r.day.slice(5) : r.day,
        success: r.success,
        failed: r.failed,
        heightPct: max > 0 ? `${Math.max(2, Math.round((sum / max) * 100))}%` : '0%',
        failedPct: sum > 0 ? `${Math.max(1, Math.round((r.failed / sum) * 100))}%` : '0%',
      }
    })
  })

  useTenantReload(loadTrend)

  // ═══════════════════════════════════════
  // 导出中心(原功能全保留)
  // ═══════════════════════════════════════
  type ReportCard = {
    key: ReportExcelKey
    label: string
    desc: string
    file: string
    badge?: string
    badgeType?: 'success' | 'warning' | 'danger' | 'info'
  }

  const reports = computed<ReportCard[]>(() => [
    {
      key: 'config-releases',
      label: t('reportExportHub.labelConfigReleases'),
      desc: t('reportExportHub.descConfigReleases'),
      file: 'config-releases.xlsx',
      badge: t('reportExportHub.badgeConfig'),
    },
    {
      key: 'secrets',
      label: t('reportExportHub.labelSecrets'),
      desc: t('reportExportHub.descSecrets'),
      file: 'secrets.xlsx',
      badge: t('reportExportHub.badgeConfig'),
    },
    {
      key: 'change-logs',
      label: t('reportExportHub.labelChangeLogs'),
      desc: t('reportExportHub.descChangeLogs'),
      file: 'change-logs.xlsx',
    },
    {
      key: 'audits',
      label: t('reportExportHub.labelAudits'),
      desc: t('reportExportHub.descAudits'),
      file: 'audits.xlsx',
      badge: t('reportExportHub.badgeAudit'),
    },
    {
      key: 'scheduler-snapshot',
      label: t('reportExportHub.labelSchedulerSnapshot'),
      desc: t('reportExportHub.descSchedulerSnapshot'),
      file: 'scheduler-snapshot.xlsx',
      badge: t('reportExportHub.badgeSchedule'),
    },
    {
      key: 'scheduler-history',
      label: t('reportExportHub.labelSchedulerHistory'),
      desc: t('reportExportHub.descSchedulerHistory'),
      file: 'scheduler-history.xlsx',
      badge: t('reportExportHub.badgeSchedule'),
    },
    {
      key: 'workers',
      label: t('reportExportHub.labelWorkers'),
      desc: t('reportExportHub.descWorkers'),
      file: 'workers.xlsx',
      badge: t('reportExportHub.badgeRuntime'),
    },
    {
      key: 'outbox-retries',
      label: t('reportExportHub.labelOutboxRetries'),
      desc: t('reportExportHub.descOutboxRetries'),
      file: 'outbox-retries.xlsx',
      badge: t('reportExportHub.badgeObservability'),
    },
    {
      key: 'outbox-deliveries',
      label: t('reportExportHub.labelOutboxDeliveries'),
      desc: t('reportExportHub.descOutboxDeliveries'),
      file: 'outbox-deliveries.xlsx',
      badge: t('reportExportHub.badgeObservability'),
    },
  ])

  const filteredReports = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return reports.value
    return reports.value.filter((r) => {
      const hay = `${r.label} ${r.desc} ${r.file} ${r.badge ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  async function downloadOne(r: { key: ReportExcelKey; file: string }) {
    loadingKey.value = r.key
    try {
      await downloadReportExcel(r.key, { tenantId: tenant.tenantId }, r.file)
      ElMessage.success(t('reportExportHub.downloadStartedToast'))
    } catch {
      ElMessage.error(t('reportExportHub.downloadFailedToast'))
    } finally {
      loadingKey.value = ''
    }
  }

  async function copyTenant() {
    try {
      await navigator.clipboard.writeText(tenant.tenantId)
      ElMessage.success(t('reportExportHub.tenantCopiedToast'))
    } catch {
      ElMessage.error(t('reportExportHub.copyFailedToast'))
    }
  }
</script>

<style scoped>
  /* ── 照 proto-reports dump 1:1(docs/redesign/proto-reports.html) ── */
  .rp-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    margin-bottom: 18px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    width: fit-content;
  }

  .rp-tab {
    height: 30px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: var(--color-text-secondary);
    background: transparent;
    font-weight: 400;
  }

  .rp-tab.is-active {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    font-weight: 600;
  }

  /* KPI 行:4 卡,label 12.5 / 值 mono 26 600 */
  .rp-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 16px;
  }

  .rp-kpi {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: var(--shadow-card);
  }

  .rp-kpi__label {
    color: var(--color-text-secondary);
    font-size: 12.5px;
  }

  .rp-kpi__row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 8px;
  }

  .rp-kpi__value {
    font-family: var(--font-mono);
    font-size: 26px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  /* 近 7 日执行量:堆叠柱(成功 accent / 失败 danger),220px 高 */
  .rp-chart {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    padding: 20px 22px;
  }

  .rp-chart__head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .rp-chart__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .rp-chart__spacer {
    flex: 1;
  }

  .rp-chart__legend {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .rp-legend {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rp-legend__swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .rp-legend__swatch--success {
    background: var(--color-primary);
  }

  .rp-legend__swatch--failed {
    background: var(--color-danger);
  }

  .rp-bars {
    display: flex;
    align-items: flex-end;
    gap: 18px;
    height: 220px;
    padding-top: 10px;
  }

  .rp-bar {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    height: 100%;
    justify-content: flex-end;
  }

  .rp-bar__stack {
    width: 100%;
    max-width: 46px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    border-radius: 5px 5px 0 0;
    overflow: hidden;
  }

  .rp-bar__seg--failed {
    background: var(--color-danger);
  }

  .rp-bar__seg--success {
    background: var(--color-primary);
    flex: 1;
  }

  .rp-bar__label {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
  }

  /* ── 导出中心(原样保留) ── */
  .export-hub-card :deep(.el-card__header) {
    padding-bottom: 14px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    width: 100%;
    min-width: 0;
  }

  .card-header > div:first-child {
    flex: 1 1 200px;
    min-width: 0;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-primary);
  }

  .card-subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-tertiary);
  }

  .search {
    flex: 0 1 360px;
    width: min(360px, 100%);
    min-width: 200px;
    margin-left: auto;
  }

  .grid {
    margin-top: 2px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--page-block-gap);
    align-items: stretch;
  }

  .report-card {
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    border-radius: var(--radius-card-lg);
    padding: var(--card-inner-padding);
    min-height: 108px;
    box-shadow:
      0 1px 0 rgb(0 0 0 / 2%),
      0 8px 18px rgb(15 23 42 / 4%);
    text-align: left;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    transition:
      transform 140ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease,
      background 120ms ease;
    will-change: transform;
  }

  .report-card:hover,
  .report-card:focus-within {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--color-border) 74%, var(--color-primary) 26%);
    background: var(--color-bg-card);
    box-shadow:
      0 1px 0 rgb(0 0 0 / 2%),
      0 14px 28px rgb(15 23 42 / 11%),
      var(--surface-hover-edge-inset);
  }

  .report-card__main {
    flex: 1;
    min-width: 0;
  }

  .report-card__title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 15px;
    font-weight: 650;
    color: var(--color-text-primary);
    line-height: 1.4;
  }

  .report-card__meta {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .report-card__aside {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  .report-card__file {
    font-size: 11px;
    color: var(--color-text-tertiary);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 12px 0 4px;
  }

  .hint {
    margin-top: var(--page-section-gap);
    padding-top: 14px;
    border-top: 1px solid var(--color-border-light);
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-tertiary);
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rp-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .report-card__file {
      max-width: 140px;
    }

    .rp-kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
