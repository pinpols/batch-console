import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOpsSummary } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'
import { useTenantReload } from '@/composables/useTenantReload'
import { getDashboardBundle, getDashboardSlaReport, getDashboardTenantUsage } from '@/api/dashboard'
import type { ConsoleOpsSummaryResponse } from '@/types/console-api'
import {
  buildLineOption,
  buildStackBarOption,
  buildHorizontalTopNOption,
  buildPieOption,
  buildGaugeOption,
  emptyOption,
} from './useChartOptions'

export function useOpsSummary() {
  const router = useRouter()
  const tenant = useTenantStore()

  // ---- core state ----
  const loading = ref(false)
  const summary = ref<ConsoleOpsSummaryResponse | null>(null)

  // ---- tabs / range ----
  const opsTab = ref<'kpis' | 'trend' | 'dist' | 'extra'>('kpis')
  const rangeKey = ref<'1h' | '6h' | '24h'>('6h')

  // ---- chart options ----
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
  const slaGaugeOption = ref<Record<string, unknown>>({})

  // 用品牌主题(echarts.ts 里 registerTheme 注册),不再用 echarts 内置 'dark'。
  // 跟 tokens.css 的 --color-primary / 网格灰阶 / SectionCard 暗底配色都对得上。
  const chartTheme = computed(() =>
    document.documentElement.classList.contains('dark') ? 'console-dark' : 'console-light',
  )

  // ---- extra panels ----
  // 注:执行进度(execution-progress)接口要求 jobCode + bizDate 都必填,
  // 本页是租户级概览没法填,曾在这里调用时一直报"参数缺失 (jobCode)"。
  // 已撤掉调用,UI 改成提示用户去 Job 实例详情查看。
  const extraLoading = ref(false)
  const slaReport = ref<unknown>(null)
  const tenantUsage = ref<unknown>(null)

  // ---- actions ----

  async function loadCharts() {
    if (!summary.value) return
    chartsLoading.value = true
    try {
      const days = rangeKey.value === '1h' ? 1 : rangeKey.value === '6h' ? 1 : 7
      const bundle = await getDashboardBundle(tenant.tenantId, days)
      jobsTrendOption.value = buildLineOption({
        x: bundle.jobs.labels.length ? bundle.jobs.labels : ['当前'],
        series: [
          {
            name: '运行中',
            data: bundle.jobs.series.running.length
              ? bundle.jobs.series.running
              : [Number(summary.value?.runningJobs ?? 0)],
            color: '#1677ff',
            area: true,
          },
          {
            name: '失败',
            data: bundle.jobs.series.failed.length
              ? bundle.jobs.series.failed
              : [Number(summary.value?.failedJobs ?? 0)],
            color: '#ff4d4f',
          },
        ],
      })

      alertsTrendOption.value = buildStackBarOption({
        x: bundle.alerts.labels,
        series: [
          { name: 'OPEN', data: bundle.alerts.series.open, color: '#ff4d4f' },
          { name: 'ACKED', data: bundle.alerts.series.acked, color: '#1677ff' },
          { name: 'CLOSED', data: bundle.alerts.series.closed, color: '#8c8c8c' },
        ],
      })

      outboxTrendOption.value = buildLineOption({
        x: bundle.sla.labels,
        series: [
          { name: 'SLA 达标', data: bundle.sla.series.onTime, color: '#52c41a', area: true },
          { name: 'SLA 违约', data: bundle.sla.series.violation, color: '#ff4d4f' },
        ],
      })

      alertTypeTopNOption.value =
        bundle.triggerTypes.items.length === 0
          ? emptyOption('暂无数据')
          : buildHorizontalTopNOption(bundle.triggerTypes.items, '#1677ff')
      workerLoadTopNOption.value =
        bundle.workerLoads.items.length === 0
          ? emptyOption('暂无数据')
          : buildHorizontalTopNOption(bundle.workerLoads.items, '#52c41a')
    } catch (e) {
      console.error('[ops charts]', e)
      ElMessage.error('图表数据加载失败，请稍后重试')
      jobsTrendOption.value = emptyOption('加载失败')
      alertsTrendOption.value = emptyOption('加载失败')
      outboxTrendOption.value = emptyOption('加载失败')
      alertTypeTopNOption.value = emptyOption('加载失败')
      workerLoadTopNOption.value = emptyOption('加载失败')
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
      ElMessage.error('运营概览加载失败，请检查网络或稍后重试')
    } finally {
      loading.value = false
    }
  }

  async function loadExtraPanels() {
    extraLoading.value = true
    try {
      const [sla, usage] = await Promise.all([
        getDashboardSlaReport(tenant.tenantId).catch(() => null),
        getDashboardTenantUsage(tenant.tenantId).catch(() => null),
      ])
      slaReport.value = sla
      tenantUsage.value = usage
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
    // state
    loading,
    summary,
    opsTab,
    rangeKey,
    chartsLoading,
    chartTheme,
    jobsTrendOption,
    alertsTrendOption,
    outboxTrendOption,
    alertTypeTopNOption,
    workerLoadTopNOption,
    extraLoading,
    slaReport,
    tenantUsage,
    // actions
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
  }
}
