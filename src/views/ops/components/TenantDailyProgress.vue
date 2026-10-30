<template>
  <SectionCard v-if="tenant.tenantId">
    <template #header>
      <span>{{ t('dailyProgress.title') }}</span>
      <LiveStatusBadge :status="status" :last-refreshed-at="lastRefreshedAt" />
    </template>
    <div class="daily-progress__toolbar">
      <label for="daily-progress-date">{{ t('dailyProgress.date') }}</label>
      <el-date-picker
        id="daily-progress-date"
        v-model="bizDate"
        type="date"
        value-format="YYYY-MM-DD"
        :clearable="false"
        :aria-label="t('dailyProgress.date')"
      />
      <el-button @click="bizDate = todayBusinessDate()">{{ t('dailyProgress.today') }}</el-button>
      <el-button :loading="loading" @click="refresh">{{ t('dailyProgress.refresh') }}</el-button>
    </div>
    <el-alert
      v-if="error"
      :title="t('dailyProgress.unavailable')"
      type="warning"
      :closable="false"
    />
    <DataState
      :loading="loading"
      :has-data="Boolean(progress)"
      :empty-text="t('dailyProgress.noWork')"
    >
      <template v-if="progress">
        <el-alert
          v-if="progress.coverage.uncoveredDefinitions"
          :title="
            t('dailyProgress.incomplete', {
              missing: progress.coverage.uncoveredDefinitions,
              total: progress.coverage.scheduledDefinitions,
            })
          "
          type="warning"
          :closable="false"
        />
        <p v-else class="daily-progress__hint">
          {{
            t(
              progress.coverage.scheduledDefinitions
                ? 'dailyProgress.complete'
                : 'dailyProgress.noSchedules',
            )
          }}
        </p>
        <VChart
          class="daily-progress__chart"
          :option="chartOption"
          :theme="chartTheme"
          autoresize
          role="img"
          :aria-label="t('dailyProgress.chartLabel')"
        />
        <div
          class="daily-progress__table-scroll"
          role="region"
          tabindex="0"
          :aria-label="t('dailyProgress.tableCaption')"
        >
          <el-table
            :data="rows"
            row-key="scope"
            class="daily-progress__table"
            :aria-label="t('dailyProgress.tableCaption')"
          >
            <el-table-column :label="t('dailyProgress.scope')" min-width="150"
              ><template #default="{ row }">{{ scopeLabel(row?.scope) }}</template></el-table-column
            >
            <el-table-column prop="total" :label="t('dailyProgress.denominator')" min-width="120" />
            <el-table-column prop="ended" :label="t('dailyProgress.ended')" min-width="100" />
            <el-table-column
              v-for="bucket in buckets"
              :key="bucket"
              :prop="bucket"
              :label="t(`dailyProgress.${bucket}`)"
              min-width="115"
            />
            <el-table-column :label="t('dailyProgress.percentage')" min-width="150"
              ><template #default="{ row }">{{
                row.percentage == null ? t('dailyProgress.unknown') : `${row.percentage}%`
              }}</template></el-table-column
            >
          </el-table>
        </div>
        <p class="daily-progress__hint">{{ t('dailyProgress.scopeHint') }}</p>
      </template>
    </DataState>
  </SectionCard>
</template>
<script setup lang="ts">
  import '@/charts/echarts'
  import VChart from 'vue-echarts'
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTenantStore } from '@/stores/tenant'
  import { useDailyProgress } from '@/composables/useDailyProgress'
  import { todayBusinessDate } from '@/utils/datetime'
  import { dailyProgressRows, DAILY_PROGRESS_BUCKETS } from '@/utils/dailyProgress'
  import { OPS_CHART_COLORS } from '../composables/useChartOptions'
  import SectionCard from '@/components/common/SectionCard.vue'
  import LiveStatusBadge from '@/components/common/LiveStatusBadge.vue'
  import DataState from '@/components/common/DataState.vue'
  const { t } = useI18n()
  function scopeLabel(scope: unknown) {
    return typeof scope === 'string' ? t(`dailyProgress.${scope}`) : t('dailyProgress.unknown')
  }
  const tenant = useTenantStore()
  const bizDate = ref(todayBusinessDate())
  const { progress, status, loading, error, lastRefreshedAt, refresh } = useDailyProgress(
    () => tenant.tenantId,
    bizDate,
  )
  const rows = computed(() => (progress.value ? dailyProgressRows(progress.value) : []))
  const buckets = DAILY_PROGRESS_BUCKETS
  const chartTheme = computed(() =>
    document.documentElement.classList.contains('dark') ? 'console-dark' : 'console-light',
  )
  const colors = [
    OPS_CHART_COLORS.success,
    OPS_CHART_COLORS.danger,
    OPS_CHART_COLORS.primary,
    OPS_CHART_COLORS.warning,
    OPS_CHART_COLORS.neutral,
    OPS_CHART_COLORS.teal,
  ]
  const chartOption = computed(() => ({
    animation: false,
    grid: { left: 16, right: 24, top: 45, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    legend: { type: 'scroll', top: 0 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.value.map((row) => t(`dailyProgress.${row.scope}`)),
    },
    series: buckets.map((bucket, index) => ({
      name: t(`dailyProgress.${bucket}`),
      type: 'bar',
      stack: 'state',
      itemStyle: { color: colors[index] },
      barMaxWidth: 24,
      data: rows.value.map((row) =>
        row.scope === 'SCHEDULED_OCCURRENCE' && progress.value?.coverage.uncoveredDefinitions
          ? null
          : row.total
            ? Math.round((10000 * row[bucket]) / row.total) / 100
            : 0,
      ),
    })),
  }))
  let lastToday = todayBusinessDate()
  let rollover: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    rollover = setInterval(() => {
      const next = todayBusinessDate()
      if (bizDate.value === lastToday) bizDate.value = next
      lastToday = next
    }, 60_000)
  })
  onUnmounted(() => clearInterval(rollover))
</script>
<style scoped>
  .daily-progress__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .daily-progress__chart {
    height: 18rem;
    width: 100%;
  }
  .daily-progress__table-scroll {
    max-width: 100%;
    overflow-x: auto;
  }
  .daily-progress__table {
    min-width: 76rem;
  }
  .daily-progress__table-scroll:focus-visible {
    outline: 2px solid var(--button-focus-ring);
    outline-offset: 2px;
  }
  .daily-progress__hint {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-block: var(--space-sm);
  }
</style>
