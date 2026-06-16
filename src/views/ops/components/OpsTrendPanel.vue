<template>
  <section class="ops-panel" :class="{ 'ops-panel--active': active }" :aria-hidden="!active">
    <div class="charts-header">
      <div>
        <div class="charts-title">{{ t('opsTrendPanel.title') }}</div>
        <div class="charts-subtitle">{{ t('opsTrendPanel.subtitle') }}</div>
      </div>
      <div class="charts-actions">
        <el-radio-group :model-value="rangeKey" size="small" @update:model-value="onRangeChange">
          <el-radio-button value="1h">1h</el-radio-button>
          <el-radio-button value="6h">6h</el-radio-button>
          <el-radio-button value="24h">24h</el-radio-button>
        </el-radio-group>
        <el-button
          size="small"
          :icon="RefreshRight"
          :loading="chartsLoading || refresh.loading.value"
          @click="onRefresh"
        >
          {{ t('opsTrendPanel.btnRefresh') }}
        </el-button>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--primary" />
          {{ t('opsTrendPanel.runFailTrend') }}
        </div>
        <VChart
          class="chart"
          :option="jobsTrendOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>

      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--warning" />
          {{ t('opsTrendPanel.alertTrend') }}
        </div>
        <VChart
          class="chart"
          :option="alertsTrendOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>

      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--success" />
          {{ t('opsTrendPanel.slaTrend') }}
        </div>
        <VChart
          class="chart"
          :option="slaTrendOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>

      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--danger" />
          {{ t('opsTrendPanel.failRateTrend') }}
        </div>
        <VChart
          class="chart"
          :option="failRateTrendOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import '@/charts/echarts'
  import { watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshRight } from '@element-plus/icons-vue'
  import VChart from 'vue-echarts'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const { t } = useI18n({ useScope: 'global' })

  const props = defineProps<{
    active: boolean
    rangeKey: '1h' | '6h' | '24h'
    chartsLoading: boolean
    chartTheme: string | undefined
    jobsTrendOption: Record<string, unknown>
    alertsTrendOption: Record<string, unknown>
    slaTrendOption: Record<string, unknown>
    failRateTrendOption: Record<string, unknown>
  }>()

  const emit = defineEmits<{
    'update:rangeKey': [value: '1h' | '6h' | '24h']
    refreshCharts: []
  }>()

  function onRangeChange(v: string | number | boolean | undefined) {
    // el-radio-group 的 modelValue 是 union;限定到三档 enum 再 emit。
    if (v === '1h' || v === '6h' || v === '24h') emit('update:rangeKey', v)
  }

  const refresh = useRefreshAction()

  function onRefresh() {
    void refresh.run(async () => {
      emit('refreshCharts')
      await new Promise<void>((resolve) => {
        const stop = watch(
          () => props.chartsLoading,
          (v, old) => {
            if (old && !v) {
              stop()
              resolve()
            }
          },
        )
      })
    })
  }
</script>

<style scoped>
  .ops-panel {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
    overflow: visible;
  }

  .ops-panel--active {
    position: relative;
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
  }

  .charts-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    margin-top: 6px;
  }

  .charts-title {
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .charts-subtitle {
    margin-top: 4px;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: var(--line-height-base);
  }

  .charts-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--page-section-gap);
    padding: 6px 0;
  }

  .chart-panel {
    padding: var(--card-inner-padding);
    min-height: 280px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
  }

  .panel-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    font-weight: 650;
    color: var(--color-text-primary);
    margin-bottom: var(--space-sm);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
  }
  .dot--primary {
    background: var(--color-primary);
  }
  .dot--warning {
    background: var(--color-warning);
  }
  .dot--success {
    background: var(--color-success);
  }
  .dot--danger {
    background: var(--color-danger);
  }

  .chart {
    width: 100%;
    height: 240px;
  }

  @media (max-width: 1100px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
