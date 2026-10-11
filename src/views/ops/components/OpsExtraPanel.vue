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
        <EmptyState v-else :description="t('opsExtraPanel.emptyData')" />
      </section>

      <section class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.execProgress') }}</h4>
        <div class="progress-filters">
          <el-select
            v-model="selectedJobCode"
            clearable
            filterable
            :placeholder="t('opsExtraPanel.selectJob')"
            :loading="jobsLoading"
          >
            <el-option v-for="code in jobCodes" :key="code" :label="code" :value="code" />
          </el-select>
          <el-date-picker
            v-model="selectedBizDate"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="t('opsExtraPanel.selectBizDate')"
          />
          <el-button
            type="primary"
            :disabled="!selectedJobCode || !selectedBizDate"
            :loading="progressLoading"
            @click="loadProgress"
          >
            {{ t('common.search') }}
          </el-button>
        </div>
        <VChart
          v-if="progressRows.length"
          class="chart"
          :option="progressOption"
          :theme="chartTheme"
          autoresize
        />
        <EmptyState v-else :description="progressMessage" />
      </section>

      <section class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.tenantUsage') }}</h4>
        <p class="extra-subtitle">{{ t('opsExtraPanel.tenantUsageSummary', { days: usagePeriod }) }}</p>
        <VChart
          v-if="usageValues.some((item) => item.value > 0)"
          class="chart"
          :option="tenantUsageOption"
          :theme="chartTheme"
          autoresize
        />
        <EmptyState v-else :description="t('opsExtraPanel.emptyData')" />
      </section>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import '@/charts/echarts'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import VChart from 'vue-echarts'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { jobApi } from '@/api/job'
  import { getDashboardExecutionProgress } from '@/api/dashboard'
  import { useTenantStore } from '@/stores/tenant'
  import {
    buildGroupedBarOption,
    buildStackBarOption,
    OPS_CHART_COLORS,
  } from '../composables/useChartOptions'
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
  type ProgressRow = {
    instanceNo: string
    expectedPartitions: number
    successPartitions: number
    failedPartitions: number
    completedPartitions: number
    progressPercent: number
  }

  const props = defineProps<{
    extraLoading: boolean
    slaReport: unknown
    tenantUsage: unknown
    slaGaugeOption: Record<string, unknown>
    chartTheme: string | undefined
  }>()
  const emit = defineEmits<{ loadExtra: [] }>()
  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const jobCodes = ref<string[]>([])
  const jobsLoading = ref(false)
  const selectedJobCode = ref('')
  const selectedBizDate = ref('')
  const progressRows = ref<ProgressRow[]>([])
  const progressLoading = ref(false)
  const progressSearched = ref(false)

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
          value: denominator ? Math.round(((Number(row.slaOnTime) || 0) / denominator) * 1000) / 10 : 0,
        }
      })
      .sort((a, b) => a.value - b.value)
      .slice(0, 8)
    return buildGroupedBarOption({
      x: rows.map((row) => row.name),
      series: [{ name: t('opsExtraPanel.attainment'), data: rows.map((row) => row.value), color: OPS_CHART_COLORS.success }],
      yAxisName: '%',
    })
  })

  const usageValues = computed(() => [
    { name: t('opsExtraPanel.jobDefinitions'), value: Number(usageData.value.jobDefinitions) || 0 },
    { name: t('opsExtraPanel.workflowDefinitions'), value: Number(usageData.value.workflowDefinitions) || 0 },
    { name: t('opsExtraPanel.fileChannels'), value: Number(usageData.value.fileChannels) || 0 },
    { name: t('opsExtraPanel.fileTemplates'), value: Number(usageData.value.fileTemplates) || 0 },
    { name: t('opsExtraPanel.recentJobInstances'), value: Number(usageData.value.recentJobInstances) || 0 },
    { name: t('opsExtraPanel.recentFiles'), value: Number(usageData.value.recentFiles) || 0 },
  ])
  const tenantUsageOption = computed(() =>
    buildGroupedBarOption({
      x: usageValues.value.map((item) => item.name),
      series: [{ name: t('opsExtraPanel.usageCount'), data: usageValues.value.map((item) => item.value), color: OPS_CHART_COLORS.primary }],
    }),
  )

  const progressMessage = computed(() =>
    progressSearched.value ? t('opsExtraPanel.emptyProgress') : t('opsExtraPanel.execProgressHint'),
  )
  const progressOption = computed(() =>
    buildStackBarOption({
      x: progressRows.value.map((row) => row.instanceNo),
      series: [
        {
          name: t('opsExtraPanel.successPartitions'),
          data: progressRows.value.map((row) => Math.max(row.completedPartitions - row.failedPartitions, 0)),
          color: OPS_CHART_COLORS.success,
        },
        { name: t('opsExtraPanel.failedPartitions'), data: progressRows.value.map((row) => row.failedPartitions), color: OPS_CHART_COLORS.danger },
        { name: t('opsExtraPanel.remainingPartitions'), data: progressRows.value.map((row) => Math.max(row.expectedPartitions - row.completedPartitions, 0)), color: OPS_CHART_COLORS.neutral },
      ],
    }),
  )

  async function loadProgress() {
    if (!selectedJobCode.value || !selectedBizDate.value) return
    progressLoading.value = true
    progressSearched.value = true
    try {
      const response = await getDashboardExecutionProgress(
        tenant.tenantId,
        selectedJobCode.value,
        selectedBizDate.value,
      )
      progressRows.value = asArray<ProgressRow>(response)
    } catch {
      progressRows.value = []
      ElMessage.error(t('opsExtraPanel.progressLoadFailed'))
    } finally {
      progressLoading.value = false
    }
  }

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  }
  function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : []
  }

  onMounted(() => {
    if (!props.slaReport && !props.tenantUsage) emit('loadExtra')
    jobsLoading.value = true
    void jobApi
      .listCodes(tenant.tenantId)
      .then((codes) => (jobCodes.value = codes))
      .catch(() => ElMessage.error(t('opsExtraPanel.jobsLoadFailed')))
      .finally(() => (jobsLoading.value = false))
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
  .progress-filters {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) auto;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  @media (max-width: 900px) {
    .extra-panels { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 560px) {
    .progress-filters { grid-template-columns: minmax(0, 1fr); }
  }
</style>
