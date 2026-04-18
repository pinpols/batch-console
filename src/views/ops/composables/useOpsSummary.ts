import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOpsSummary } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'
import { lastApiMeta } from '@/utils/lastApiMeta'
import {
  getDashboardBundle,
  getDashboardSlaReport,
  getDashboardExecutionProgress,
  getDashboardTenantUsage,
} from '@/api/dashboard'
import type { ConsoleOpsSummaryResponse } from '@/types/console-api'
import {
  buildLineOption,
  buildStackBarOption,
  buildHorizontalTopNOption,
  emptyOption,
} from './useChartOptions'

export function useOpsSummary() {
  const router = useRouter()
  const tenant = useTenantStore()

  // ---- core state ----
  const loading = ref(false)
  const summary = ref<ConsoleOpsSummaryResponse | null>(null)
  const lastTrace = computed(() => lastApiMeta.value?.traceId ?? '')

  // ---- tabs / range ----
  const opsTab = ref<'kpis' | 'trend' | 'dist' | 'extra'>('kpis')
  const rangeKey = ref<'1h' | '6h' | '24h'>('6h')

  // ---- chart options ----
  const chartsLoading = ref(false)
  const jobsTrendOption = ref<Record<string, unknown>>({})
  const alertsTrendOption = ref<Record<string, unknown>>({})
  const outboxTrendOption = ref<Record<string, unknown>>({})
  const alertTypeTopNOption = ref<Record<string, unknown>>({})
  const workerLoadTopNOption = ref<Record<string, unknown>>({})

  const chartTheme = computed(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : undefined,
  )

  // ---- extra panels ----
  const extraLoading = ref(false)
  const slaReport = ref<unknown>(null)
  const executionProgress = ref<unknown>(null)
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
      const [sla, exec, usage] = await Promise.all([
        getDashboardSlaReport(tenant.tenantId).catch(() => null),
        getDashboardExecutionProgress(tenant.tenantId).catch(() => null),
        getDashboardTenantUsage(tenant.tenantId).catch(() => null),
      ])
      slaReport.value = sla
      executionProgress.value = exec
      tenantUsage.value = usage
    } finally {
      extraLoading.value = false
    }
  }

  function go(path: string) {
    router.push(path)
  }

  function goFailedJobs() {
    router.push({ path: '/monitor/job-instances', query: { status: 'FAILED' } })
  }

  function copyTrace() {
    if (!lastTrace.value) return
    void navigator.clipboard.writeText(lastTrace.value)
    ElMessage.success('已复制 traceId')
  }

  watch(rangeKey, () => {
    void loadCharts()
  })

  return {
    // state
    loading,
    summary,
    lastTrace,
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
    executionProgress,
    tenantUsage,
    // actions
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
    copyTrace,
  }
}
