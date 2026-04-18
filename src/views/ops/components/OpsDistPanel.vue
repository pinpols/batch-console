<template>
  <section class="ops-panel" :class="{ 'ops-panel--active': active }" :aria-hidden="!active">
    <div class="charts-header">
      <div>
        <div class="charts-title">分布</div>
        <div class="charts-subtitle">用于定位"主要异常类型/主要影响面"</div>
      </div>
      <div class="charts-actions">
        <el-button
          size="small"
          :icon="RefreshRight"
          :loading="chartsLoading"
          @click="$emit('refreshCharts')"
        >
          刷新
        </el-button>
      </div>
    </div>

    <div class="charts-grid charts-grid--dist">
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--info" />
          触发类型分布
        </div>
        <VChart
          class="chart"
          :option="alertTypeTopNOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
      <div class="chart-panel">
        <div class="panel-title">
          <span class="dot dot--success" />
          Worker 组 / 状态分布
        </div>
        <VChart
          class="chart"
          :option="workerLoadTopNOption"
          :theme="chartTheme"
          autoresize
          :loading="chartsLoading"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { RefreshRight } from '@element-plus/icons-vue'
  import VChart from 'vue-echarts'

  defineProps<{
    active: boolean
    chartsLoading: boolean
    chartTheme: string | undefined
    alertTypeTopNOption: Record<string, unknown>
    workerLoadTopNOption: Record<string, unknown>
  }>()

  defineEmits<{
    refreshCharts: []
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
    gap: var(--page-section-gap);
    padding: 6px 0;
  }

  .charts-grid--dist {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .dot--info {
    background: #64748b;
  }
  .dot--success {
    background: var(--color-success);
  }

  .chart {
    width: 100%;
    height: 240px;
  }

  @media (max-width: 1100px) {
    .charts-grid--dist {
      grid-template-columns: 1fr;
    }
  }
</style>
