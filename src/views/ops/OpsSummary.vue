<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('opsSummary.btnRefresh') }}
        </el-button>
        <PrintButton />
      </template>
    </PageHeader>

    <TenantDailyProgress />
    <OnboardingCenter />

    <div v-if="summary" class="ops-tabs-card">
      <!-- 扩展面板的刷新钮上提到 tabs 同行右侧(用户反馈:原独占一行造成空带) -->
      <div class="ops-tabs-row">
        <el-tabs v-model="opsTab" class="pill-tabs ops-tabs">
          <el-tab-pane :label="t('opsSummary.tabKpis')" name="kpis" />
          <el-tab-pane :label="t('opsSummary.tabTrend')" name="trend" />
          <el-tab-pane :label="t('opsSummary.tabDist')" name="dist" />
          <el-tab-pane :label="t('opsSummary.tabExtra')" name="extra" />
        </el-tabs>
        <el-button
          v-if="opsTab === 'extra'"
          class="ops-tabs-row__refresh"
          :icon="Refresh"
          :loading="extraLoading"
          @click="loadExtraPanels"
        >
          {{ t('opsExtraPanel.btnRefresh') }}
        </el-button>
      </div>

      <div v-show="opsTab !== 'extra'" class="ops-panels">
        <OpsMetricGrid
          :summary="summary"
          :active="opsTab === 'kpis'"
          @go="go"
          @go-failed-jobs="goFailedJobs"
        />

        <OpsTrendPanel
          v-if="opsTab === 'trend'"
          active
          v-model:range-key="rangeKey"
          :charts-loading="chartsLoading"
          :chart-theme="chartTheme"
          :jobs-trend-option="jobsTrendOption"
          :alerts-trend-option="alertsTrendOption"
          :sla-trend-option="slaTrendOption"
          :fail-rate-trend-option="failRateTrendOption"
          @refresh-charts="loadCharts"
        />

        <OpsDistPanel
          v-if="opsTab === 'dist'"
          :active="true"
          :charts-loading="chartsLoading"
          :chart-theme="chartTheme"
          :trigger-type-top-n-option="triggerTypeTopNOption"
          :worker-load-top-n-option="workerLoadTopNOption"
          :job-status-option="jobStatusOption"
          :worker-status-option="workerStatusOption"
          :alert-severity-option="alertSeverityOption"
          :outbox-health-option="outboxHealthOption"
          @refresh-charts="loadCharts"
        />
      </div>
    </div>

    <OpsExtraPanel
      v-if="opsTab === 'extra'"
      :extra-loading="extraLoading"
      :sla-report="slaReport"
      :tenant-usage="tenantUsage"
      :sla-report-error="slaReportError"
      :tenant-usage-error="tenantUsageError"
      :sla-gauge-option="slaGaugeOption"
      :chart-theme="chartTheme"
      @load-extra="loadExtraPanels"
    />

    <SectionCard v-else-if="!loading && !summary">
      <EmptyState :description="t('opsSummary.errorDesc')" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { defineAsyncComponent } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import PrintButton from '@/components/common/PrintButton.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import TenantDailyProgress from './components/TenantDailyProgress.vue'
  import OnboardingCenter from '@/components/onboarding/OnboardingCenter.vue'
  import OpsMetricGrid from './components/OpsMetricGrid.vue'
  import { useOpsSummary } from './composables/useOpsSummary'

  const OpsTrendPanel = defineAsyncComponent(() => import('./components/OpsTrendPanel.vue'))
  const OpsDistPanel = defineAsyncComponent(() => import('./components/OpsDistPanel.vue'))
  const OpsExtraPanel = defineAsyncComponent(() => import('./components/OpsExtraPanel.vue'))

  const {
    loading,
    summary,
    opsTab,
    rangeKey,
    chartsLoading,
    chartTheme,
    jobsTrendOption,
    alertsTrendOption,
    slaTrendOption,
    failRateTrendOption,
    triggerTypeTopNOption,
    workerLoadTopNOption,
    jobStatusOption,
    workerStatusOption,
    alertSeverityOption,
    outboxHealthOption,
    slaGaugeOption,
    extraLoading,
    slaReport,
    tenantUsage,
    slaReportError,
    tenantUsageError,
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
  } = useOpsSummary()
</script>

<style scoped>
  .ops-tabs-card {
    margin-top: 0;
  }
  /* 还原设计纵向节奏:副标题→Tab ≈ 32px、Tab→卡片 ≈ 28px */
  .ops-tabs-card {
    margin-top: 12px;
  }

  .ops-tabs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .ops-tabs-row__refresh {
    flex: 0 0 auto;
  }

  .ops-tabs {
    margin-top: 0;
  }

  .ops-tabs :deep(.el-tabs__content) {
    display: none;
  }

  .ops-panels {
    position: relative;
    margin-top: 12px;
    overflow: visible;
  }
</style>
