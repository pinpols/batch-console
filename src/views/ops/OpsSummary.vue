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

    <!-- P2.1 全 0 引导:summary 加载完且所有核心指标 = 0,显示"开始接入"卡片 -->
    <SectionCard v-if="summary && isFreshTenant && opsTab === 'extra'" class="ops-onboarding">
      <div class="ops-onboarding__head">
        <h3>{{ t('opsSummary.onboardingTitle') }}</h3>
        <p>{{ t('opsSummary.onboardingDesc') }}</p>
      </div>
      <div class="ops-onboarding__grid">
        <button class="ops-onboarding__card" @click="$router.push('/config/tenant-package')">
          <span class="ops-onboarding__icon">
            <el-icon size="20"><FolderOpened /></el-icon>
          </span>
          <strong>{{ t('opsSummary.onboardingImport') }}</strong>
          <span>{{ t('opsSummary.onboardingImportDesc') }}</span>
        </button>
        <button
          class="ops-onboarding__card"
          @click="$router.push('/jobs/definitions?action=create')"
        >
          <span class="ops-onboarding__icon">
            <el-icon size="20"><DocumentAdd /></el-icon>
          </span>
          <strong>{{ t('opsSummary.onboardingNewJob') }}</strong>
          <span>{{ t('opsSummary.onboardingNewJobDesc') }}</span>
        </button>
        <button class="ops-onboarding__card" @click="$router.push('/system/tenants')">
          <span class="ops-onboarding__icon">
            <el-icon size="20"><User /></el-icon>
          </span>
          <strong>{{ t('opsSummary.onboardingTenant') }}</strong>
          <span>{{ t('opsSummary.onboardingTenantDesc') }}</span>
        </button>
        <button class="ops-onboarding__card" @click="$router.push('/workers/management')">
          <span class="ops-onboarding__icon">
            <el-icon size="20"><Cpu /></el-icon>
          </span>
          <strong>{{ t('opsSummary.onboardingWorker') }}</strong>
          <span>{{ t('opsSummary.onboardingWorkerDesc') }}</span>
        </button>
      </div>
    </SectionCard>

    <SectionCard v-if="summary" class="ops-tabs-card">
      <el-tabs v-model="opsTab" class="pill-tabs ops-tabs">
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
          v-if="opsTab === 'trend'"
          :active="true"
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
          :job-status-pie-option="jobStatusPieOption"
          :worker-status-pie-option="workerStatusPieOption"
          :alert-severity-pie-option="alertSeverityPieOption"
          :outbox-health-pie-option="outboxHealthPieOption"
          @refresh-charts="loadCharts"
        />
      </div>
    </SectionCard>

    <OpsExtraPanel
      v-if="opsTab === 'extra'"
      :extra-loading="extraLoading"
      :sla-report="slaReport"
      :tenant-usage="tenantUsage"
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
  import { computed, defineAsyncComponent } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh, FolderOpened, DocumentAdd, User, Cpu } from '@element-plus/icons-vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import PrintButton from '@/components/common/PrintButton.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
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
    jobStatusPieOption,
    workerStatusPieOption,
    alertSeverityPieOption,
    outboxHealthPieOption,
    slaGaugeOption,
    extraLoading,
    slaReport,
    tenantUsage,
    load,
    loadCharts,
    loadExtraPanels,
    go,
    goFailedJobs,
  } = useOpsSummary()

  // 全 0 指标 → 视为"全新租户",显示接入引导
  const isFreshTenant = computed(() => {
    const s = summary.value
    if (!s) return false
    return (
      (s.pendingApprovals ?? 0) === 0 &&
      (s.openAlerts ?? 0) === 0 &&
      (s.criticalAlerts ?? 0) === 0 &&
      (s.runningJobs ?? 0) === 0 &&
      (s.failedJobs ?? 0) === 0
    )
  })
</script>

<style scoped>
  .ops-tabs-card {
    margin-top: 0;
  }
  .ops-onboarding__head {
    margin-bottom: 16px;
  }
  .ops-onboarding__head h3 {
    margin: 0 0 4px;
    font-size: 16px;
    color: var(--color-text-primary);
  }
  .ops-onboarding__head p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }
  .ops-onboarding__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .ops-onboarding__card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    cursor: pointer;
    text-align: left;
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
  }
  .ops-onboarding__card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-surface);
  }
  .ops-onboarding__card:hover .ops-onboarding__icon {
    background: var(--color-primary);
    color: #fff;
  }
  .ops-onboarding__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-bottom: 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    transition:
      background 0.15s,
      color 0.15s;
  }
  .ops-onboarding__card strong {
    font-size: 14px;
    color: var(--color-text-primary);
  }
  .ops-onboarding__card span {
    font-size: 12px;
    color: var(--color-text-tertiary);
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
