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
  // 初始 emptyOption('加载中…'),避免 loadCharts 还没跑完时 VChart 拿到 {} 渲染空白卡
  const slaGaugeOption = ref<Record<string, unknown>>(emptyOption('加载中…'))

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

      slaTrendOption.value = buildLineOption({
        x: bundle.sla.labels,
        series: [
          { name: 'SLA 达标', data: bundle.sla.series.onTime, color: '#52c41a', area: true },
          { name: 'SLA 违约', data: bundle.sla.series.violation, color: '#ff4d4f' },
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
          ? emptyOption('暂无数据')
          : buildLineOption({
              x: bundle.jobs.labels,
              series: [{ name: '失败率 %', data: failRateSeries, color: '#ff7a45', area: true }],
              yAxisName: '%',
            })

      triggerTypeTopNOption.value =
        bundle.triggerTypes.items.length === 0
          ? emptyOption('暂无数据')
          : buildHorizontalTopNOption(bundle.triggerTypes.items, '#1677ff')
      workerLoadTopNOption.value =
        bundle.workerLoads.items.length === 0
          ? emptyOption('暂无数据')
          : buildHorizontalTopNOption(bundle.workerLoads.items, '#52c41a')

      // 状态分布饼图(数据来源:summary KPI 实时快照)
      const s = summary.value
      const running = Number(s?.runningJobs ?? 0)
      const failed = Number(s?.failedJobs ?? 0)
      const slaBreach = Number(s?.slaBreaches ?? 0)
      jobStatusPieOption.value =
        running + failed + slaBreach === 0
          ? emptyOption('暂无数据')
          : buildPieOption({
              items: [
                { name: '运行中', value: running, color: '#1677ff' },
                { name: '失败', value: failed, color: '#ff4d4f' },
                { name: 'SLA 违约', value: slaBreach, color: '#fa8c16' },
              ],
              innerRadius: '40%',
            })

      const online = Number(s?.onlineWorkers ?? 0)
      const draining = Number(s?.drainingWorkers ?? 0)
      const offline = Number(s?.offlineWorkers ?? 0)
      workerStatusPieOption.value =
        online + draining + offline === 0
          ? emptyOption('暂无数据')
          : buildPieOption({
              items: [
                { name: '在线', value: online, color: '#52c41a' },
                { name: 'Draining', value: draining, color: '#faad14' },
                { name: '离线', value: offline, color: '#8c8c8c' },
              ],
              innerRadius: '40%',
            })

      const openAlerts = Number(s?.openAlerts ?? 0)
      const critical = Number(s?.criticalAlerts ?? 0)
      const otherOpen = Math.max(openAlerts - critical, 0)
      alertSeverityPieOption.value =
        openAlerts === 0
          ? emptyOption('暂无活跃告警')
          : buildPieOption({
              items: [
                { name: 'Critical', value: critical, color: '#ff4d4f' },
                { name: '其他 OPEN', value: otherOpen, color: '#faad14' },
              ],
              innerRadius: '40%',
            })

      const retry = Number(s?.outboxRetryBacklog ?? 0)
      const delivFail = Number(s?.outboxDeliveryFailures ?? 0)
      outboxHealthPieOption.value =
        retry + delivFail === 0
          ? emptyOption('Outbox 健康')
          : buildPieOption({
              items: [
                { name: '重试积压', value: retry, color: '#faad14' },
                { name: '投递失败', value: delivFail, color: '#ff4d4f' },
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
        color: slaPct >= 99 ? '#52c41a' : slaPct >= 95 ? '#faad14' : '#ff4d4f',
      })
    } catch (e) {
      console.error('[ops charts]', e)
      ElMessage.error('图表数据加载失败，请稍后重试')
      jobsTrendOption.value = emptyOption('加载失败')
      alertsTrendOption.value = emptyOption('加载失败')
      slaTrendOption.value = emptyOption('加载失败')
      failRateTrendOption.value = emptyOption('加载失败')
      triggerTypeTopNOption.value = emptyOption('加载失败')
      workerLoadTopNOption.value = emptyOption('加载失败')
      jobStatusPieOption.value = emptyOption('加载失败')
      workerStatusPieOption.value = emptyOption('加载失败')
      alertSeverityPieOption.value = emptyOption('加载失败')
      outboxHealthPieOption.value = emptyOption('加载失败')
      slaGaugeOption.value = emptyOption('加载失败')
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
    // SLA 达标率 gauge 依赖 dashboard bundle,与 SLA 报告 / 租户用量 一起刷,
    // 避免「点了 extra 刷新但 gauge 不动」的不一致体验
    try {
      const [sla, usage] = await Promise.all([
        getDashboardSlaReport(tenant.tenantId).catch(() => null),
        getDashboardTenantUsage(tenant.tenantId).catch(() => null),
        loadCharts().catch(() => undefined),
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
    // actions
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
  }
}
