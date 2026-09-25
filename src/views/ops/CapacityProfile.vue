<template>
  <PageContainer>
    <PageHeader />

    <!-- 还原设计:查询区直铺底色,无卡片壳 -->
    <div>
      <ListPageQueryBar
        :filter-busy="loading"
        :refresh-busy="loading"
        :disabled="loading"
        @search="load"
        @reset="resetFilters"
        @refresh="load"
      >
        <el-form-item :label="t('capacityProfile.groupByLabel')">
          <el-segmented v-model="query.groupBy" :options="groupByOptions" />
        </el-form-item>
        <el-form-item :label="t('capacityProfile.limitLabel')">
          <el-input-number
            v-model="query.limit"
            class="capacity-limit-input"
            :min="1"
            :max="200"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item :label="t('capacityProfile.windowLabel')">
          <el-date-picker
            class="capacity-window-picker"
            v-model="range"
            type="datetimerange"
            unlink-panels
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            :start-placeholder="t('capacityProfile.fromPlaceholder')"
            :end-placeholder="t('capacityProfile.toPlaceholder')"
          />
        </el-form-item>
      </ListPageQueryBar>
    </div>

    <SectionCard v-if="!report && !loading" class="mt">
      <EmptyState
        :variant="loadError ? 'error' : 'empty'"
        :description="loadError || t('capacityProfile.emptyHint')"
      >
        <template v-if="loadError" #action>
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
            {{ t('capacityProfile.refresh') }}
          </el-button>
        </template>
      </EmptyState>
    </SectionCard>

    <div v-if="report" class="profile-grid">
      <MetricCard
        :label="t('capacityProfile.metricInstances')"
        :value="formatNumber(report.totals?.instanceCount)"
        :description="t('capacityProfile.metricInstancesDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricTasks')"
        :value="formatNumber(report.totals?.taskCount)"
        :description="t('capacityProfile.metricTasksDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricDuration')"
        :value="formatDuration(report.totals?.totalDurationMs)"
        :description="t('capacityProfile.metricDurationDesc')"
      />
      <MetricCard
        :label="t('capacityProfile.metricBytes')"
        :value="formatBytes(report.totals?.totalFileBytes)"
        :description="t('capacityProfile.metricBytesDesc')"
      />
    </div>

    <div v-if="report" class="capacity-charts">
      <SectionCard class="capacity-charts__trend">
        <template #header>{{ t('capacityProfile.trendTitle') }}</template>
        <VChart
          class="capacity-chart"
          :option="trendOption"
          :theme="chartTheme"
          autoresize
          :loading="loading"
        />
      </SectionCard>
      <SectionCard>
        <template #header>{{ t('capacityProfile.rankingTitle') }}</template>
        <VChart
          class="capacity-chart"
          :option="rankingOption"
          :theme="chartTheme"
          autoresize
          :loading="loading"
        />
      </SectionCard>
      <SectionCard>
        <template #header>{{ t('capacityProfile.p95Title') }}</template>
        <VChart
          class="capacity-chart"
          :option="latencyOption"
          :theme="chartTheme"
          autoresize
          :loading="loading"
        />
      </SectionCard>
    </div>

    <SectionCard v-if="report" class="mt capacity-detail">
      <template #header>
        <div class="profile-header">
          <div>
            <div>{{ t('capacityProfile.resultTitle') }}</div>
            <div class="profile-header__hint">{{ t('capacityProfile.resultHint') }}</div>
          </div>
          <div class="profile-header__meta">
            <el-tag size="small" effect="plain">{{ report.groupBy || query.groupBy }}</el-tag>
            <el-tag v-if="report.scope" size="small" effect="plain" type="info">
              {{ report.scope }}
            </el-tag>
            <el-tag v-if="report.generatedAt" size="small" effect="plain" type="info">
              {{ report.generatedAt }}
            </el-tag>
          </div>
        </div>
      </template>

      <el-collapse v-model="detailSections">
        <el-collapse-item name="rows" :title="t('capacityProfile.detailToggle')">
          <el-table
            v-loading="loading"
            :data="report.rows ?? []"
            stripe
            border
            size="small"
            :empty-text="t('common.noData')"
            class="console-table"
          >
            <el-table-column :label="dimensionLabel" min-width="220">
              <template #default="{ row }">
                <div class="cell-stack">
                  <div class="cell-main">{{ dimensionValue(row) }}</div>
                  <div class="cell-sub">{{ secondaryDimensionValue(row) }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="instanceCount"
              :label="t('capacityProfile.colInstances')"
              width="110"
              align="right"
            />
            <el-table-column
              prop="taskCount"
              :label="t('capacityProfile.colTasks')"
              width="100"
              align="right"
            />
            <el-table-column
              prop="successCount"
              :label="t('capacityProfile.colSuccess')"
              width="100"
              align="right"
            />
            <el-table-column
              prop="failureCount"
              :label="t('capacityProfile.colFailure')"
              width="100"
              align="right"
            />
            <el-table-column :label="t('capacityProfile.colAvg')" width="120" align="right">
              <template #default="{ row }">{{ formatDuration(row.avgDurationMs) }}</template>
            </el-table-column>
            <el-table-column :label="t('capacityProfile.colP95')" width="120" align="right">
              <template #default="{ row }">{{ formatDuration(row.p95DurationMs) }}</template>
            </el-table-column>
            <el-table-column :label="t('capacityProfile.colBytes')" width="130" align="right">
              <template #default="{ row }">{{ formatBytes(row.totalFileBytes) }}</template>
            </el-table-column>
            <el-table-column
              prop="processedRecords"
              :label="t('capacityProfile.colRecords')"
              width="130"
              align="right"
            />
            <el-table-column
              prop="recordsPerSecond"
              :label="t('capacityProfile.colRecordsRate')"
              width="130"
              align="right"
            />
            <el-table-column
              prop="mbPerSecond"
              :label="t('capacityProfile.colMbRate')"
              width="110"
              align="right"
            />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </SectionCard>

    <SectionCard v-if="report?.coverage" class="mt">
      <template #header>{{ t('capacityProfile.coverageTitle') }}</template>
      <JsonPreview :data="report.coverage" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import '@/charts/echarts'
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import VChart from 'vue-echarts'
  import {
    getCapacityProfile,
    type CapacityProfileGroupBy,
    type CapacityProfileReport,
    type CapacityProfileRow,
  } from '@/api/capacityProfile'
  import { useTenantStore } from '@/stores/tenant'
  import { useAppStore } from '@/stores/app'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import { fmtNumber } from '@/utils/number'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import {
    buildGroupedBarOption,
    buildHorizontalTopNOption,
    buildLineOption,
    emptyOption,
  } from './composables/useChartOptions'
  import {
    buildCapacityBuckets,
    buildCapacityTrend,
    buildLatencyComparison,
    buildThroughputRanking,
    capacityDimensionValue,
    type CapacityBucket,
  } from './capacityProfilePresentation'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const app = useAppStore()
  const loading = ref(false)
  const loadError = ref('')
  const report = ref<CapacityProfileReport | null>(null)
  const trendBuckets = ref<CapacityBucket[]>([])
  const trendReports = ref<Array<CapacityProfileReport | null>>([])
  const detailSections = ref<string[]>([])
  // 默认最近 7 天窗口:后端 capacity-profile 端点缺省 from/to 会 500,首屏必须带窗口。
  function defaultWindow(): [string, string] {
    const iso = (d: Date) => d.toISOString().slice(0, 19) + 'Z'
    const now = new Date()
    return [iso(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), iso(now)]
  }
  const range = ref<[string, string] | null>(defaultWindow())
  const query = reactive<{ groupBy: CapacityProfileGroupBy; limit: number }>({
    groupBy: 'TENANT',
    limit: 50,
  })

  const groupByOptions = computed(() => [
    { label: t('capacityProfile.groupByTenant'), value: 'TENANT' },
    { label: t('capacityProfile.groupByJob'), value: 'JOB' },
    { label: t('capacityProfile.groupByWorker'), value: 'WORKER' },
  ])
  const chartTheme = computed(() => (app.theme === 'dark' ? 'console-dark' : 'console-light'))
  const trendOption = computed(() => {
    const points = buildCapacityTrend(trendBuckets.value, trendReports.value)
    if (
      !points.length ||
      points.every((point) => point.instanceCount === 0 && point.taskCount === 0)
    ) {
      return emptyOption(t('common.noData'))
    }
    return buildLineOption({
      x: points.map((point) => point.label),
      xAxisLabelFormatter: (value) => value.replace(' - ', '\n'),
      series: [
        {
          name: t('capacityProfile.metricInstances'),
          data: points.map((point) => point.instanceCount),
          color: '#1677ff',
          area: true,
        },
        {
          name: t('capacityProfile.metricTasks'),
          data: points.map((point) => point.taskCount),
          color: '#13c2c2',
        },
      ],
    })
  })
  const rankingOption = computed(() => {
    const items = buildThroughputRanking(report.value?.rows ?? [], query.groupBy, tenant.tenantId)
    return items.length
      ? buildHorizontalTopNOption(items, '#52c41a', t('capacityProfile.recordsPerSecondUnit'))
      : emptyOption(t('common.noData'))
  })
  const latencyOption = computed(() => {
    const latency = buildLatencyComparison(report.value?.rows ?? [], query.groupBy, tenant.tenantId)
    return latency.labels.length
      ? buildGroupedBarOption({
          x: latency.labels,
          yAxisName: 'ms',
          series: [
            { name: t('capacityProfile.colAvg'), data: latency.average, color: '#91caff' },
            { name: t('capacityProfile.colP95'), data: latency.p95, color: '#ff7a45' },
          ],
        })
      : emptyOption(t('common.noData'))
  })

  const dimensionLabel = computed(() => {
    if (query.groupBy === 'JOB') return t('capacityProfile.dimensionJob')
    if (query.groupBy === 'WORKER') return t('capacityProfile.dimensionWorker')
    return t('capacityProfile.dimensionTenant')
  })

  function dimensionValue(row: CapacityProfileRow): string {
    return capacityDimensionValue(row, query.groupBy, tenant.tenantId)
  }

  function secondaryDimensionValue(row: CapacityProfileRow): string {
    if (query.groupBy === 'WORKER') return row.workerGroup || row.tenantId || '—'
    if (query.groupBy === 'JOB') return row.tenantId || tenant.tenantId || '—'
    return report.value?.window?.from && report.value?.window?.to
      ? `${report.value.window.from} ~ ${report.value.window.to}`
      : '—'
  }

  function formatNumber(value: unknown): string {
    return fmtNumber(value)
  }

  function formatDuration(value: unknown): string {
    const ms = Number(value)
    if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
    if (ms < 1000) return `${Math.round(ms)} ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)} s`
    return `${(seconds / 60).toFixed(1)} min`
  }

  function formatBytes(value: unknown): string {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i += 1
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const [from, to] = range.value ?? defaultWindow()
      const buckets = buildCapacityBuckets([from, to])
      const [mainReport, bucketResults] = await Promise.all([
        getCapacityProfile({
          tenantId: tenant.tenantId,
          groupBy: query.groupBy,
          limit: query.limit,
          from,
          to,
        }),
        Promise.allSettled(
          buckets.map((bucket) =>
            getCapacityProfile({
              tenantId: tenant.tenantId,
              groupBy: 'TENANT',
              limit: 1,
              from: bucket.from,
              to: bucket.to,
            }),
          ),
        ),
      ])
      report.value = mainReport
      trendBuckets.value = buckets
      trendReports.value = bucketResults.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      )
      ElMessage.success(t('capacityProfile.loadOk'))
    } catch (error) {
      report.value = null
      trendBuckets.value = []
      trendReports.value = []
      loadError.value = error instanceof Error ? error.message : t('capacityProfile.loadFailed')
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    query.groupBy = 'TENANT'
    query.limit = 50
    range.value = defaultWindow()
    void load()
  }

  useTenantReload(load)
</script>

<style scoped>
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
    margin-top: var(--page-block-gap);
  }

  .capacity-charts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-md);
    margin-top: var(--page-block-gap);
  }

  .capacity-charts__trend {
    grid-column: 1 / -1;
  }

  .capacity-chart {
    width: 100%;
    height: 18rem;
  }

  :deep(.capacity-window-picker) {
    flex: 0 0 27rem;
    width: 27rem !important;
    max-width: min(27rem, calc(100vw - 3rem));
  }

  :deep(.capacity-limit-input) {
    width: 7.5rem;
  }

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .profile-header__meta,
  .cell-main {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .profile-header__hint {
    margin-top: var(--space-xs);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    font-weight: 400;
  }

  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cell-sub {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }

  .mt {
    margin-top: var(--page-block-gap);
  }

  @media (max-width: 1080px) {
    .profile-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .capacity-charts {
      grid-template-columns: 1fr;
    }

    .capacity-charts__trend {
      grid-column: auto;
    }
  }

  @media (max-width: 640px) {
    .profile-grid {
      grid-template-columns: 1fr;
    }

    .capacity-chart {
      height: 16rem;
    }

    .profile-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .profile-header__meta {
      flex-wrap: wrap;
    }
  }
</style>
