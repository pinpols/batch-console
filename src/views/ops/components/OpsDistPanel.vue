<template>
  <section class="ops-panel" :class="{ 'ops-panel--active': active }" :aria-hidden="!active">
    <div class="charts-header">
      <div>
        <div class="charts-title">{{ t('opsDistPanel.title') }}</div>
        <div class="charts-subtitle">{{ t('opsDistPanel.subtitle') }}</div>
      </div>
    </div>

    <div class="charts-grid charts-grid--dist">
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--info" />
          {{ t('opsDistPanel.triggerType') }}
        </div>
        <VChart
          class="chart"
          :option="triggerTypeTopNOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--success" />
          {{ t('opsDistPanel.workerGroup') }}
        </div>
        <VChart
          class="chart"
          :option="workerLoadTopNOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--primary" />
          {{ t('opsDistPanel.jobStatus') }}
        </div>
        <VChart
          class="chart"
          :option="jobStatusOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--success" />
          {{ t('opsDistPanel.workerStatus') }}
        </div>
        <VChart
          class="chart"
          :option="workerStatusOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--danger" />
          {{ t('opsDistPanel.alertSeverity') }}
        </div>
        <VChart
          class="chart"
          :option="alertSeverityOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--warning" />
          {{ t('opsDistPanel.outboxHealth') }}
        </div>
        <VChart
          class="chart"
          :option="outboxHealthOption"
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
  import { useI18n } from 'vue-i18n'
  import VChart from 'vue-echarts'

  const { t } = useI18n({ useScope: 'global' })

  defineProps<{
    active: boolean
    chartsLoading: boolean
    chartTheme: string | undefined
    triggerTypeTopNOption: Record<string, unknown>
    workerLoadTopNOption: Record<string, unknown>
    jobStatusOption: Record<string, unknown>
    workerStatusOption: Record<string, unknown>
    alertSeverityOption: Record<string, unknown>
    outboxHealthOption: Record<string, unknown>
  }>()
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
    margin-top: 0;
  }

  .charts-title {
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .charts-subtitle {
    margin-top: 2px;
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
    gap: 16px;
    padding: 0;
  }

  .charts-grid--dist {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .chart-panel {
    padding: 16px 18px 12px;
    min-height: 0;
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
    margin-bottom: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
  }
  .dot--info {
    background: var(--color-text-tertiary);
  }
  .dot--success {
    background: var(--color-success);
  }
  .dot--primary {
    background: var(--color-primary);
  }
  .dot--warning {
    background: var(--color-warning);
  }
  .dot--danger {
    background: var(--color-danger);
  }

  /* 图表需保留轴、刻度和图例的可读高度，不为压缩首屏而牺牲 */
  .chart {
    width: 100%;
    height: 260px;
  }

  @media (max-width: 1100px) {
    .charts-grid--dist {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 900px) {
    .charts-grid--dist {
      grid-template-columns: 1fr;
    }
  }
</style>
