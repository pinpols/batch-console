<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
          {{ t('opsSummary.btnRefresh') }}
        </el-button>
      </template>
    </PageHeader>

    <div v-if="lastTrace" class="trace-bar">
      <span class="trace-label">{{ t('opsSummary.traceLabel') }}</span>
      <code class="trace-code">{{ lastTrace }}</code>
      <el-button size="small" @click="copyTrace">{{ t('opsSummary.btnCopy') }}</el-button>
    </div>

    <SectionCard v-if="summary" class="ops-tabs-card">
      <el-tabs v-model="opsTab" v-hover-tab-activate="true" class="pill-tabs ops-tabs">
        <el-tab-pane :label="t('opsSummary.tabKpis')" name="kpis" />
        <el-tab-pane :label="t('opsSummary.tabTrend')" name="trend" />
        <el-tab-pane :label="t('opsSummary.tabDist')" name="dist" />
        <el-tab-pane :label="t('opsSummary.tabExtra')" name="extra" />
      </el-tabs>

      <div class="ops-panels">
        <OpsMetricGrid
          :summary="summary"
          :active="opsTab === 'kpis'"
          @go="go"
          @go-failed-jobs="goFailedJobs"
        />

        <OpsTrendPanel
          :active="opsTab === 'trend'"
          v-model:range-key="rangeKey"
          :charts-loading="chartsLoading"
          :chart-theme="chartTheme"
          :jobs-trend-option="jobsTrendOption"
          :alerts-trend-option="alertsTrendOption"
          :outbox-trend-option="outboxTrendOption"
          @refresh-charts="loadCharts"
        />

        <OpsDistPanel
          :active="opsTab === 'dist'"
          :charts-loading="chartsLoading"
          :chart-theme="chartTheme"
          :alert-type-top-n-option="alertTypeTopNOption"
          :worker-load-top-n-option="workerLoadTopNOption"
          @refresh-charts="loadCharts"
        />
      </div>
    </SectionCard>

    <OpsExtraPanel
      v-if="opsTab === 'extra'"
      :extra-loading="extraLoading"
      :sla-report="slaReport"
      :tenant-usage="tenantUsage"
      @load-extra="loadExtraPanels"
    />

    <SectionCard v-else-if="!loading && !summary">
      <EmptyState :description="t('opsSummary.errorDesc')" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  // echarts/core 模块注册:本页是 echarts 的唯一使用入口,从 main.ts 挪到这里以
  // 跟随路由 lazy chunk 加载,首屏不下 echarts(~181 KB gzip)。
  import '@/charts/echarts'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import OpsMetricGrid from './components/OpsMetricGrid.vue'
  import OpsTrendPanel from './components/OpsTrendPanel.vue'
  import OpsDistPanel from './components/OpsDistPanel.vue'
  import OpsExtraPanel from './components/OpsExtraPanel.vue'
  import { useOpsSummary } from './composables/useOpsSummary'

  const {
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
    tenantUsage,
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
    copyTrace,
  } = useOpsSummary()
</script>

<style scoped>
  .trace-bar {
    display: flex;
    align-items: center;
    gap: var(--page-block-gap);
    margin-bottom: 0;
    padding: var(--page-block-gap) var(--card-inner-padding);
    font-size: 13px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
  }

  .trace-label {
    color: var(--color-text-tertiary, #8c8c8c);
  }

  .trace-code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }

  .ops-tabs-card {
    margin-top: 0;
  }

  .ops-tabs {
    margin-top: 2px;
  }

  .ops-tabs :deep(.el-tabs__content) {
    display: none;
  }

  .ops-tabs-card :deep(.el-card__body) {
    overflow: visible;
  }

  .ops-panels {
    position: relative;
    margin-top: 10px;
    overflow: visible;
  }
</style>
