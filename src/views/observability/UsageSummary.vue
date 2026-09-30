<template>
  <PageContainer>
    <PageHeader />

    <div class="usage-filters">
      <el-form :inline="true" @submit.prevent="load">
        <el-form-item :label="t('usageSummary.dateRange')">
          <DateRangePresetPicker
            v-model="dateRange"
            type="daterange"
            default-preset="30d"
            :include-all="false"
          />
        </el-form-item>
        <el-form-item :label="t('usageSummary.metric')">
          <el-input
            v-model="metricCode"
            clearable
            :placeholder="t('usageSummary.metricPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('usageSummary.page')">
          <el-input v-model="pageCode" clearable :placeholder="t('usageSummary.pagePlaceholder')" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="Search"
            :loading="loading"
            :disabled="!validRange"
            @click="load"
          >
            {{ t('common.search') }}
          </el-button>
          <el-button :icon="RotateCcw" @click="resetFilters">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>
      <div v-if="!validRange" class="usage-error" role="alert">
        {{ t('usageSummary.rangeError') }}
      </div>
    </div>

    <el-alert
      v-if="loadError"
      type="error"
      show-icon
      :closable="false"
      :title="t('usageSummary.loadError')"
    >
      <template #default>
        <el-button link type="primary" @click="load">{{ t('common.retry') }}</el-button>
      </template>
    </el-alert>

    <template v-else>
      <div class="usage-totals" aria-live="polite">
        <div class="usage-total">
          <span>{{ t('usageSummary.events') }}</span
          ><strong>{{ totals.events.toLocaleString() }}</strong>
        </div>
        <div class="usage-total">
          <span>{{ t('usageSummary.success') }}</span
          ><strong>{{ totals.success.toLocaleString() }}</strong>
        </div>
        <div class="usage-total">
          <span>{{ t('usageSummary.failure') }}</span
          ><strong>{{ totals.failure.toLocaleString() }}</strong>
        </div>
      </div>

      <div v-if="rows.length && trend.length" class="usage-chart">
        <h2>{{ t('usageSummary.trend') }}</h2>
        <VChart class="usage-chart__canvas" :option="chartOption" :theme="chartTheme" autoresize />
      </div>

      <div class="usage-table-head">
        <h2>{{ t('usageSummary.breakdown') }}</h2>
        <el-select
          v-model="appVersion"
          clearable
          :placeholder="t('usageSummary.allVersions')"
          :aria-label="t('usageSummary.version')"
        >
          <el-option v-for="version in versions" :key="version" :value="version" :label="version" />
        </el-select>
      </div>
      <el-table v-loading="loading" :data="pagedRows" :row-key="rowKey" class="usage-table">
        <template #empty><el-empty :description="t('usageSummary.empty')" /></template>
        <el-table-column prop="statDate" :label="t('usageSummary.date')" width="125" />
        <el-table-column prop="source" :label="t('usageSummary.source')" width="170" />
        <el-table-column
          prop="metricCode"
          :label="t('usageSummary.metric')"
          min-width="210"
          show-overflow-tooltip
        />
        <el-table-column
          prop="pageCode"
          :label="t('usageSummary.page')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="appVersion"
          :label="t('usageSummary.version')"
          width="125"
          show-overflow-tooltip
        />
        <el-table-column
          prop="eventCount"
          :label="t('usageSummary.events')"
          width="100"
          align="right"
        />
        <el-table-column
          prop="successCount"
          :label="t('usageSummary.success')"
          width="100"
          align="right"
        />
        <el-table-column
          prop="failureCount"
          :label="t('usageSummary.failure')"
          width="100"
          align="right"
        />
      </el-table>
      <el-pagination
        v-if="filteredRows.length > pageSize"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filteredRows.length"
        :page-sizes="[15, 30, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="usage-pagination"
      />
      <p class="usage-note">{{ t('usageSummary.disclaimer') }}</p>
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
  import '@/charts/echarts'
  import dayjs from 'dayjs'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RotateCcw, Search } from '@lucide/vue'
  import VChart from 'vue-echarts'
  import { queryUsageSummary, type UsageSummaryRow } from '@/api/usage'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAppStore } from '@/stores/app'
  import { useTenantStore } from '@/stores/tenant'
  import { presetDateRange, readBusinessTimezone } from '@/utils/datetime'
  import { usageDailyTrend, usageTotals } from './usageSummary'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const app = useAppStore()
  const loading = ref(false)
  const loadError = ref(false)
  let requestSequence = 0
  const dateRange = ref<[string, string] | null>(
    presetDateRange('30d', 'daterange', readBusinessTimezone()),
  )
  const metricCode = ref('')
  const pageCode = ref('')
  const appVersion = ref('')
  const rows = ref<UsageSummaryRow[]>([])
  const page = ref(1)
  const pageSize = ref(15)

  const validRange = computed(() => {
    const range = dateRange.value
    return Boolean(
      range && !dayjs(range[0]).isAfter(range[1]) && dayjs(range[1]).diff(range[0], 'day') <= 400,
    )
  })
  const versions = computed(() =>
    [...new Set(rows.value.map((row) => row.appVersion).filter(Boolean))].sort(),
  )
  const filteredRows = computed(() => {
    const selected = appVersion.value
      ? rows.value.filter((row) => row.appVersion === appVersion.value)
      : rows.value
    return [...selected].sort((a, b) => b.statDate.localeCompare(a.statDate))
  })
  const pagedRows = computed(() =>
    filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
  )
  const totals = computed(() => usageTotals(filteredRows.value))
  const trend = computed(() => usageDailyTrend(filteredRows.value))
  const chartTheme = computed(() => (app.theme === 'dark' ? 'console-dark' : 'console-light'))
  const chartOption = computed(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: [t('usageSummary.success'), t('usageSummary.failure')] },
    grid: { left: 48, right: 20, top: 48, bottom: 36 },
    xAxis: { type: 'category', data: trend.value.map((item) => item.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: t('usageSummary.success'),
        type: 'line',
        data: trend.value.map((item) => item.success),
      },
      {
        name: t('usageSummary.failure'),
        type: 'line',
        data: trend.value.map((item) => item.failure),
      },
    ],
  }))

  function rowKey(row: UsageSummaryRow) {
    return [
      row.statDate,
      row.tenantId,
      row.source,
      row.metricCode,
      row.pageCode,
      row.appVersion,
    ].join('|')
  }

  async function load() {
    if (!validRange.value || !dateRange.value) return
    const [from, to] = dateRange.value
    const tenantId = tenant.tenantId
    const sequence = ++requestSequence
    rows.value = []
    loadError.value = false
    loading.value = true
    try {
      const result = await queryUsageSummary({
        tenantId,
        from,
        to,
        metricCode: metricCode.value.trim() || undefined,
        pageCode: pageCode.value.trim() || undefined,
      })
      if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
      rows.value = result
      appVersion.value = ''
      page.value = 1
    } catch {
      if (sequence === requestSequence) loadError.value = true
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  function resetFilters() {
    dateRange.value = presetDateRange('30d', 'daterange', readBusinessTimezone())
    metricCode.value = ''
    pageCode.value = ''
    appVersion.value = ''
    void load()
  }

  watch(appVersion, () => {
    page.value = 1
  })
  useTenantReload(load)
</script>

<style scoped>
  .usage-filters {
    margin-bottom: var(--space-md);
  }
  .usage-filters :deep(.el-form-item) {
    margin-bottom: var(--space-sm);
  }
  .usage-error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }
  .usage-totals {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-block: 1px solid var(--color-border-light);
    margin-bottom: var(--space-lg);
  }
  .usage-total {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md);
  }
  .usage-total + .usage-total {
    border-left: 1px solid var(--color-border-light);
  }
  .usage-total span {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .usage-total strong {
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
  }
  .usage-chart {
    margin-bottom: var(--space-lg);
  }
  .usage-chart__canvas {
    height: 280px;
    width: 100%;
  }
  .usage-chart h2,
  .usage-table-head h2 {
    font-size: var(--font-size-lg);
    margin: 0 0 var(--space-sm);
  }
  .usage-table-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }
  .usage-table-head :deep(.el-select) {
    width: 180px;
  }
  .usage-pagination {
    justify-content: flex-end;
    margin-top: var(--space-md);
  }
  .usage-note {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    margin-top: var(--space-md);
  }
  @media (max-width: 640px) {
    .usage-totals {
      grid-template-columns: 1fr;
    }
    .usage-total + .usage-total {
      border-left: 0;
      border-top: 1px solid var(--color-border-light);
    }
    .usage-table-head {
      flex-wrap: wrap;
    }
  }
</style>
