<template>
  <SectionCard class="extra-panel-card">
    <div class="extra-panels">
      <section class="extra-block extra-block--gauge">
        <h4 class="extra-title">{{ t('opsExtraPanel.slaGaugeTitle') }}</h4>
        <VChart
          class="chart chart--gauge"
          :option="slaGaugeOption"
          :theme="chartTheme"
          autoresize
        />
      </section>

      <section class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.slaReport') }}</h4>
        <p class="extra-subtitle">{{ t('opsExtraPanel.slaReportSummary', { days: slaPeriod }) }}</p>
        <VChart
          v-if="slaRows.length"
          class="chart"
          :option="slaReportOption"
          :theme="chartTheme"
          autoresize
        />
        <div v-else-if="extraLoading" class="chart-loading" role="status">
          {{ t('common.loading') }}
        </div>
        <EmptyState
          v-else-if="props.slaReportError"
          variant="error"
          :description="t('opsSummary.extraLoadFailedMessage')"
        >
          <template #action>
            <el-button type="primary" :loading="extraLoading" @click="emit('loadExtra')">
              {{ t('common.retry') }}
            </el-button>
          </template>
        </EmptyState>
        <EmptyState v-else :description="t('opsExtraPanel.emptyData')" />
      </section>

      <section class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.execProgress') }}</h4>
        <div class="recent-run-toolbar">
          <p class="extra-subtitle">
            {{ t('opsExtraPanel.recentRunsSummary', { count: recentRunLimit }) }}
          </p>
          <el-select
            v-model="recentRunLimit"
            class="recent-run-limit"
            :aria-label="t('opsExtraPanel.recentRunsLimit')"
          >
            <el-option
              v-for="count in recentRunLimits"
              :key="count"
              :label="String(count)"
              :value="count"
            />
          </el-select>
        </div>
        <VChart
          v-if="recentRunRows.length && !recentRunsLoading"
          class="chart"
          :option="recentRunsOption"
          :theme="chartTheme"
          autoresize
        />
        <EmptyState
          v-else-if="recentRunsFailed && !recentRunsLoading"
          variant="error"
          :description="recentRunsMessage"
        >
          <template #action>
            <el-button type="primary" :loading="recentRunsLoading" @click="loadRecentInstances">
              {{ t('common.retry') }}
            </el-button>
          </template>
        </EmptyState>
        <EmptyState v-else-if="!recentRunsLoading" :description="recentRunsMessage" />
        <div v-else class="chart-loading" role="status">{{ t('common.loading') }}</div>
        <div class="recent-run-footer">
          <el-button link type="primary" @click="goToInstances">
            {{ t('opsExtraPanel.linkJobInstances') }}
          </el-button>
        </div>
      </section>

      <section class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.tenantUsage') }}</h4>
        <p class="extra-subtitle">
          {{ t('opsExtraPanel.tenantUsageSummary', { days: usagePeriod }) }}
        </p>
        <VChart
          v-if="usageValues.some((item) => item.value > 0)"
          class="chart"
          :option="tenantUsageOption"
          :theme="chartTheme"
          autoresize
        />
        <div v-else-if="extraLoading" class="chart-loading" role="status">
          {{ t('common.loading') }}
        </div>
        <EmptyState
          v-else-if="props.tenantUsageError"
          variant="error"
          :description="t('opsSummary.extraLoadFailedMessage')"
        >
          <template #action>
            <el-button type="primary" :loading="extraLoading" @click="emit('loadExtra')">
              {{ t('common.retry') }}
            </el-button>
          </template>
        </EmptyState>
        <EmptyState v-else :description="t('opsExtraPanel.emptyData')" />
      </section>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import '@/charts/echarts'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import VChart from 'vue-echarts'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { jobApi } from '@/api/job'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import { useTenantStore } from '@/stores/tenant'
  import { buildGroupedBarOption, OPS_CHART_COLORS } from '../composables/useChartOptions'
  import { ElMessage } from 'element-plus'

  type SlaJob = {
    jobCode?: string
    jobName?: string | null
    totalInstances?: number
    successCount?: number
    failedCount?: number
    slaBreached?: number
    slaOnTime?: number
  }
  const props = defineProps<{
    extraLoading: boolean
    slaReport: unknown
    tenantUsage: unknown
    slaReportError: unknown
    tenantUsageError: unknown
    slaGaugeOption: Record<string, unknown>
    chartTheme: string | undefined
  }>()
  const emit = defineEmits<{ loadExtra: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const router = useRouter()
  const recentRunLimits = [10, 20, 50]
  const recentRunLimit = ref(10)
  const recentInstances = ref<ConsoleJobInstanceResponse[]>([])
  const recentRunsLoading = ref(false)
  const recentRunsFailed = ref(false)
  let recentRunsRequestId = 0

  const slaData = computed(() => asRecord(props.slaReport))
  const slaRows = computed<SlaJob[]>(() => asArray<SlaJob>(slaData.value.jobs))
  const slaPeriod = computed(() => Number(slaData.value.periodDays) || 7)
  const usageData = computed(() => asRecord(props.tenantUsage))
  const usagePeriod = computed(() => Number(usageData.value.periodDays) || 7)

  const slaReportOption = computed(() => {
    const rows = [...slaRows.value]
      .map((row) => {
        const denominator = (Number(row.slaOnTime) || 0) + (Number(row.slaBreached) || 0)
        return {
          name: row.jobName || row.jobCode || '-',
          value: denominator
            ? Math.round(((Number(row.slaOnTime) || 0) / denominator) * 1000) / 10
            : 0,
        }
      })
      .sort((a, b) => a.value - b.value)
      .slice(0, 8)
    return buildGroupedBarOption({
      x: rows.map((row) => row.name),
      series: [
        {
          name: t('opsExtraPanel.attainment'),
          data: rows.map((row) => row.value),
          color: OPS_CHART_COLORS.success,
        },
      ],
      yAxisName: '%',
    })
  })

  const usageValues = computed(() => [
    { name: t('opsExtraPanel.jobDefinitions'), value: Number(usageData.value.jobDefinitions) || 0 },
    {
      name: t('opsExtraPanel.workflowDefinitions'),
      value: Number(usageData.value.workflowDefinitions) || 0,
    },
    { name: t('opsExtraPanel.fileChannels'), value: Number(usageData.value.fileChannels) || 0 },
    { name: t('opsExtraPanel.fileTemplates'), value: Number(usageData.value.fileTemplates) || 0 },
    {
      name: t('opsExtraPanel.recentJobInstances'),
      value: Number(usageData.value.recentJobInstances) || 0,
    },
    { name: t('opsExtraPanel.recentFiles'), value: Number(usageData.value.recentFiles) || 0 },
  ])
  const tenantUsageOption = computed(() =>
    buildGroupedBarOption({
      x: usageValues.value.map((item) => item.name),
      series: [
        {
          name: t('opsExtraPanel.usageCount'),
          data: usageValues.value.map((item) => item.value),
          color: OPS_CHART_COLORS.primary,
        },
      ],
    }),
  )

  const recentRunRows = computed(() => {
    const counts = new Map<string, number>()
    for (const instance of recentInstances.value) {
      const status = instance.instanceStatus || 'UNKNOWN'
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    return [...counts.entries()].map(([status, count]) => ({
      name: t(`enum.instanceStatus.${status}`, status),
      value: count,
    }))
  })
  const recentRunsMessage = computed(() =>
    recentRunsFailed.value ? t('opsExtraPanel.recentRunsLoadFailed') : t('opsExtraPanel.emptyData'),
  )
  const recentRunsOption = computed(() =>
    buildGroupedBarOption({
      x: recentRunRows.value.map((row) => row.name),
      series: [
        {
          name: t('opsExtraPanel.recentRunsCount'),
          data: recentRunRows.value.map((row) => row.value),
          color: OPS_CHART_COLORS.primary,
        },
      ],
    }),
  )

  async function loadRecentInstances() {
    const requestId = ++recentRunsRequestId
    const tenantId = tenant.tenantId
    recentRunsLoading.value = true
    recentRunsFailed.value = false
    recentInstances.value = []
    try {
      const result = await jobApi.listInstances({
        tenantId,
        page: 1,
        pageSize: recentRunLimit.value,
      })
      if (requestId !== recentRunsRequestId || tenantId !== tenant.tenantId) return
      recentInstances.value = result.records
    } catch {
      if (requestId !== recentRunsRequestId || tenantId !== tenant.tenantId) return
      recentInstances.value = []
      recentRunsFailed.value = true
      ElMessage.error(t('opsExtraPanel.recentRunsLoadFailed'))
    } finally {
      if (requestId === recentRunsRequestId) recentRunsLoading.value = false
    }
  }

  function goToInstances() {
    void router.push('/monitor/job-instances')
  }

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  }
  function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : []
  }

  watch([() => tenant.tenantId, recentRunLimit], () => void loadRecentInstances(), {
    immediate: true,
  })

  onMounted(() => {
    if (!props.slaReport && !props.tenantUsage) emit('loadExtra')
  })
</script>

<style scoped>
  .extra-panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-md);
  }
  .extra-block {
    min-width: 0;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    padding: var(--card-inner-padding);
  }
  .extra-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 650;
    color: var(--color-text-primary);
  }
  .extra-subtitle {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }
  .chart {
    width: 100%;
    height: 260px;
  }
  .chart--gauge {
    height: 220px;
  }
  .extra-block--gauge {
    display: flex;
    flex-direction: column;
  }
  .recent-run-toolbar,
  .recent-run-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .recent-run-limit {
    width: 88px;
    flex: 0 0 auto;
  }
  .chart-loading {
    display: grid;
    min-height: 260px;
    place-items: center;
    color: var(--color-text-tertiary);
  }
  @media (max-width: 900px) {
    .extra-panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .recent-run-toolbar {
      align-items: flex-start;
    }
  }
</style>
