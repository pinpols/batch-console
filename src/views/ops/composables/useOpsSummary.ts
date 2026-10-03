import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import { getOpsSummary } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'
import { useTenantReload } from '@/composables/useTenantReload'
import { getDashboardBundle, getDashboardSlaReport, getDashboardTenantUsage } from '@/api/dashboard'
import { logError } from '@/utils/logger'
import type { ConsoleOpsSummaryResponse } from '@/types/console-api'
import {
  buildLineOption,
  buildStackBarOption,
  buildHorizontalTopNOption,
  buildPieOption,
  buildGaugeOption,
  emptyOption,
  OPS_CHART_COLORS,
} from './useChartOptions'

export function useOpsSummary() {
  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenant = useTenantStore()

  // ---- 核心状态 ----
  const loading = ref(false)
  const summary = ref<ConsoleOpsSummaryResponse | null>(null)

  // ---- 页签与时间范围 ----
  const opsTab = ref<'kpis' | 'trend' | 'dist' | 'extra'>('kpis')
  const rangeKey = ref<'1h' | '6h' | '24h'>('6h')

  // ---- 图表配置 ----
  const chartsLoading = ref(false)
  // 趋势(trend): 折线/堆叠柱,看时间序列上的变化
  const jobsTrendOption = ref<Record<string, unknown>>({})
  const alertsTrendOption = ref<Record<string, unknown>>({})
  // 历史命名遗留(变量名 outbox 实际显示 SLA),保留为兼容 prop 名;新代码用 slaTrendOption。
  const slaTrendOption = ref<Record<string, unknown>>({})
  const failRateTrendOption = ref<Record<string, unknown>>({})
  // 分布(distribution): TopN 横向柱 / 饼图,看维度上的占比
  const triggerTypeTopNOption = ref<Record<string, unknown>>({})
  const workerLoadTopNOption = ref<Record<string, unknown>>({})
  const jobStatusPieOption = ref<Record<string, unknown>>({})
  const workerStatusPieOption = ref<Record<string, unknown>>({})
  const alertSeverityPieOption = ref<Record<string, unknown>>({})
  const outboxHealthPieOption = ref<Record<string, unknown>>({})
  // 扩展(extra): gauge / 单值
  // 初始 emptyOption('加载中…'),避免 loadCharts 还没跑完时 VChart 拿到 {} 渲染空白卡
  const slaGaugeOption = ref<Record<string, unknown>>(emptyOption(t('common.loading')))

  // 用品牌主题(echarts.ts 里 registerTheme 注册),不再用 echarts 内置 'dark'。
  // 跟 tokens.css 的 --color-primary / 网格灰阶 / SectionCard 暗底配色都对得上。
  const chartTheme = computed(() =>
    document.documentElement.classList.contains('dark') ? 'console-dark' : 'console-light',
  )

  // ---- 扩展面板 ----
  // 注:执行进度(execution-progress)接口要求 jobCode + bizDate 都必填,
  // 本页是租户级概览没法填,曾在这里调用时一直报"参数缺失 (jobCode)"。
  // 已撤掉调用,UI 改成提示用户去 Job 实例详情查看。
  const extraLoading = ref(false)
  const slaReport = ref<unknown>(null)
  const tenantUsage = ref<unknown>(null)
  // 错误态:dashboard 接口失败时上抛,UI 区块据此渲染重试态而不是悄悄渲染 0(误导 oncall)
  const slaReportError = ref<unknown>(null)
  const tenantUsageError = ref<unknown>(null)

  // ---- 操作 ----

  async function loadCharts() {
    if (!summary.value) return
    chartsLoading.value = true
    try {
      const days = rangeKey.value === '1h' ? 1 : rangeKey.value === '6h' ? 1 : 7
      const bundle = await getDashboardBundle(tenant.tenantId, days)
      jobsTrendOption.value = buildLineOption({
        x: bundle.jobs.labels.length ? bundle.jobs.labels : [t('opsSummary.legendNow')],
        series: [
          {
            name: t('opsSummary.legendRunning'),
            data: bundle.jobs.series.running.length
              ? bundle.jobs.series.running
              : [Number(summary.value?.runningJobs ?? 0)],
            color: OPS_CHART_COLORS.primary,
            area: true,
          },
          {
            name: t('opsSummary.legendFailed'),
            data: bundle.jobs.series.failed.length
              ? bundle.jobs.series.failed
              : [Number(summary.value?.failedJobs ?? 0)],
            color: OPS_CHART_COLORS.danger,
          },
        ],
      })

      alertsTrendOption.value = buildStackBarOption({
        x: bundle.alerts.labels,
        series: [
          { name: 'OPEN', data: bundle.alerts.series.open, color: OPS_CHART_COLORS.danger },
          { name: 'ACKED', data: bundle.alerts.series.acked, color: OPS_CHART_COLORS.primary },
          { name: 'CLOSED', data: bundle.alerts.series.closed, color: OPS_CHART_COLORS.neutral },
        ],
      })

      slaTrendOption.value = buildLineOption({
        x: bundle.sla.labels,
        series: [
          {
            name: t('opsSummary.legendSlaOnTime'),
            data: bundle.sla.series.onTime,
            color: OPS_CHART_COLORS.success,
            area: true,
          },
          {
            name: t('opsSummary.legendSlaViolation'),
            data: bundle.sla.series.violation,
            color: OPS_CHART_COLORS.danger,
          },
        ],
      })

      // 失败率趋势:failed / (failed + running),用 % 表示;数据全 0 时显示空
      const failRateSeries = bundle.jobs.labels.map((_, i) => {
        const r = bundle.jobs.series.running[i] ?? 0
        const f = bundle.jobs.series.failed[i] ?? 0
        const total = r + f
        return total > 0 ? Math.round((f / total) * 10000) / 100 : 0
      })
      failRateTrendOption.value =
        bundle.jobs.labels.length === 0
          ? emptyOption(t('common.noData'))
          : buildLineOption({
              x: bundle.jobs.labels,
              series: [
                {
                  name: t('opsSummary.legendFailRate'),
                  data: failRateSeries,
                  color: OPS_CHART_COLORS.orange,
                  area: true,
                },
              ],
              yAxisName: '%',
            })

      triggerTypeTopNOption.value =
        bundle.triggerTypes.items.length === 0
          ? emptyOption(t('common.noData'))
          : buildHorizontalTopNOption(bundle.triggerTypes.items, OPS_CHART_COLORS.primary)
      workerLoadTopNOption.value =
        bundle.workerLoads.items.length === 0
          ? emptyOption(t('common.noData'))
          : buildHorizontalTopNOption(bundle.workerLoads.items, OPS_CHART_COLORS.success)

      // 状态分布饼图(数据来源:summary KPI 实时快照)
      const s = summary.value
      const running = Number(s?.runningJobs ?? 0)
      const failed = Number(s?.failedJobs ?? 0)
      const slaBreach = Number(s?.slaBreaches ?? 0)
      jobStatusPieOption.value =
        running + failed + slaBreach === 0
          ? emptyOption(t('common.noData'))
          : buildPieOption({
              items: [
                {
                  name: t('opsSummary.legendRunning'),
                  value: running,
                  color: OPS_CHART_COLORS.primary,
                },
                {
                  name: t('opsSummary.legendFailed'),
                  value: failed,
                  color: OPS_CHART_COLORS.danger,
                },
                {
                  name: t('opsSummary.legendSlaViolation'),
                  value: slaBreach,
                  color: OPS_CHART_COLORS.orange,
                },
              ],
              innerRadius: '40%',
            })

      const online = Number(s?.onlineWorkers ?? 0)
      const draining = Number(s?.drainingWorkers ?? 0)
      const offline = Number(s?.offlineWorkers ?? 0)
      workerStatusPieOption.value =
        online + draining + offline === 0
          ? emptyOption(t('common.noData'))
          : buildPieOption({
              items: [
                {
                  name: t('opsSummary.legendOnline'),
                  value: online,
                  color: OPS_CHART_COLORS.success,
                },
                {
                  name: t('opsSummary.legendDraining'),
                  value: draining,
                  color: OPS_CHART_COLORS.warning,
                },
                {
                  name: t('opsSummary.legendOffline'),
                  value: offline,
                  color: OPS_CHART_COLORS.neutral,
                },
              ],
              innerRadius: '40%',
            })

      const openAlerts = Number(s?.openAlerts ?? 0)
      const critical = Number(s?.criticalAlerts ?? 0)
      const otherOpen = Math.max(openAlerts - critical, 0)
      alertSeverityPieOption.value =
        openAlerts === 0
          ? emptyOption(t('opsSummary.noActiveAlerts'))
          : buildPieOption({
              items: [
                {
                  name: t('opsSummary.legendCritical'),
                  value: critical,
                  color: OPS_CHART_COLORS.danger,
                },
                {
                  name: t('opsSummary.legendOtherOpen'),
                  value: otherOpen,
                  color: OPS_CHART_COLORS.warning,
                },
              ],
              innerRadius: '40%',
            })

      const retry = Number(s?.outboxRetryBacklog ?? 0)
      const delivFail = Number(s?.outboxDeliveryFailures ?? 0)
      outboxHealthPieOption.value =
        retry + delivFail === 0
          ? emptyOption(t('opsSummary.outboxHealthy'))
          : buildPieOption({
              items: [
                {
                  name: t('opsSummary.legendRetryBacklog'),
                  value: retry,
                  color: OPS_CHART_COLORS.warning,
                },
                {
                  name: t('opsSummary.legendDeliveryFail'),
                  value: delivFail,
                  color: OPS_CHART_COLORS.danger,
                },
              ],
              innerRadius: '40%',
            })

      // SLA 仪表盘:onTime / (onTime + violation),百分比
      const onTimeTotal = bundle.sla.series.onTime.reduce((a, b) => a + b, 0)
      const violationTotal = bundle.sla.series.violation.reduce((a, b) => a + b, 0)
      const slaPct =
        onTimeTotal + violationTotal === 0
          ? 100
          : Math.round((onTimeTotal / (onTimeTotal + violationTotal)) * 1000) / 10
      slaGaugeOption.value = buildGaugeOption({
        value: slaPct,
        max: 100,
        unit: '%',
        color:
          slaPct >= 99
            ? OPS_CHART_COLORS.success
            : slaPct >= 95
              ? OPS_CHART_COLORS.warning
              : OPS_CHART_COLORS.danger,
      })
    } catch (e) {
      logError('opsSummary.charts.load_failed', {
        reason: e instanceof Error ? e.message : String(e),
      })
      ElMessage.error(t('opsSummary.chartsLoadFailed'))
      jobsTrendOption.value = emptyOption(t('opsSummary.loadFailed'))
      alertsTrendOption.value = emptyOption(t('opsSummary.loadFailed'))
      slaTrendOption.value = emptyOption(t('opsSummary.loadFailed'))
      failRateTrendOption.value = emptyOption(t('opsSummary.loadFailed'))
      triggerTypeTopNOption.value = emptyOption(t('opsSummary.loadFailed'))
      workerLoadTopNOption.value = emptyOption(t('opsSummary.loadFailed'))
      jobStatusPieOption.value = emptyOption(t('opsSummary.loadFailed'))
      workerStatusPieOption.value = emptyOption(t('opsSummary.loadFailed'))
      alertSeverityPieOption.value = emptyOption(t('opsSummary.loadFailed'))
      outboxHealthPieOption.value = emptyOption(t('opsSummary.loadFailed'))
      slaGaugeOption.value = emptyOption(t('opsSummary.loadFailed'))
    } finally {
      chartsLoading.value = false
    }
  }

  async function load() {
    loading.value = true
    try {
      summary.value = await getOpsSummary(tenant.tenantId)
      void loadCharts()
    } catch {
      summary.value = null
      ElMessage.error(t('opsSummary.summaryLoadFailed'))
    } finally {
      loading.value = false
    }
  }

  async function loadExtraPanels() {
    extraLoading.value = true
    // SLA 达标率 gauge 依赖 dashboard bundle,与 SLA 报告 / 租户用量 一起刷,
    // 避免「点了 extra 刷新但 gauge 不动」的不一致体验
    // 注:dashboard 子接口的错误必须保留(以前用 .catch(()=>null) 静默吞,会让 OpsSummary 渲染全 0,
    //     oncall 工程师误判为"昨晚没事"),改为捕获到 *Error ref 让 UI 显式展示加载失败态。
    slaReportError.value = null
    tenantUsageError.value = null
    try {
      const [slaResult, usageResult] = await Promise.allSettled([
        getDashboardSlaReport(tenant.tenantId),
        getDashboardTenantUsage(tenant.tenantId),
      ])
      // 图表刷新失败 loadCharts 内部已有 ElMessage.error + emptyOption(t('opsSummary.loadFailed')) 兜底,这里 fire-and-forget
      void loadCharts()
      if (slaResult.status === 'fulfilled') {
        slaReport.value = slaResult.value
      } else {
        slaReport.value = null
        slaReportError.value = slaResult.reason
      }
      if (usageResult.status === 'fulfilled') {
        tenantUsage.value = usageResult.value
      } else {
        tenantUsage.value = null
        tenantUsageError.value = usageResult.reason
      }
      if (slaReportError.value || tenantUsageError.value) {
        ElNotification.error({
          title: t('opsSummary.extraLoadFailedTitle'),
          message: t('opsSummary.extraLoadFailedMessage'),
          duration: 6000,
        })
      }
    } finally {
      extraLoading.value = false
    }
  }

  function go(path: string) {
    router.push(path)
  }

  function goFailedJobs() {
    // 卡片统计是全量(不限 bizDate)且同时计入 FAILED + PARTIAL_FAILED,
    // 列表必须用 statuses CSV 才能匹配同一计数语义。range=all 清今日锚定。
    router.push({
      path: '/monitor/job-instances',
      query: { statuses: 'FAILED,PARTIAL_FAILED', range: 'all' },
    })
  }

  watch(rangeKey, () => {
    void loadCharts()
  })

  useTenantReload(load)

  return {
    // 状态
    loading,
    summary,
    opsTab,
    rangeKey,
    chartsLoading,
    chartTheme,
    jobsTrendOption,
    alertsTrendOption,
    slaTrendOption,
    failRateTrendOption,
    triggerTypeTopNOption,
    workerLoadTopNOption,
    jobStatusPieOption,
    workerStatusPieOption,
    alertSeverityPieOption,
    outboxHealthPieOption,
    slaGaugeOption,
    extraLoading,
    slaReport,
    tenantUsage,
    slaReportError,
    tenantUsageError,
    // 操作
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
  }
}
