<template>
  <section class="ops-panel" :class="{ 'ops-panel--active': active }" aria-hidden="false">
    <div class="metric-grid">
      <button type="button" class="metric-hit" @click="$emit('go', '/approvals?status=PENDING')">
        <MetricCard
          :label="t('opsMetricGrid.pendingApprovals')"
          :value="String(summary.pendingApprovals)"
          :description="t('opsMetricGrid.pendingApprovalsDesc')"
          tone="warning"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/observability/alerts?status=OPEN')"
      >
        <MetricCard
          :label="t('opsMetricGrid.activeAlerts')"
          :value="String(summary.openAlerts)"
          :description="t('opsMetricGrid.activeAlertsDesc')"
          tone="warning"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/observability/alerts?severity=CRITICAL&status=OPEN')"
      >
        <MetricCard
          :label="t('opsMetricGrid.criticalAlerts')"
          :value="String(summary.criticalAlerts)"
          :description="t('opsMetricGrid.criticalAlertsDesc')"
          tone="danger"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/monitor/job-instances?status=RUNNING&range=all')"
      >
        <MetricCard
          :label="t('opsMetricGrid.runningInstances')"
          :value="String(summary.runningJobs)"
          :description="t('opsMetricGrid.runningInstancesDesc')"
          tone="info"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('goFailedJobs')">
        <MetricCard
          :label="t('opsMetricGrid.failedInstances')"
          :value="String(summary.failedJobs)"
          :description="t('opsMetricGrid.failedInstancesDesc')"
          tone="danger"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/monitor/job-instances?slaBreached=1&range=all')"
      >
        <MetricCard
          :label="t('opsMetricGrid.slaViolations')"
          :value="String(summary.slaBreaches)"
          :description="t('opsMetricGrid.slaViolationsDesc')"
          tone="warning"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/workers/management?status=ONLINE')"
      >
        <MetricCard
          :label="t('opsMetricGrid.onlineWorkers')"
          :value="String(summary.onlineWorkers)"
          :description="t('opsMetricGrid.workerListDesc')"
          tone="success"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/workers/management?status=DRAINING')"
      >
        <MetricCard
          label="Draining"
          :value="String(summary.drainingWorkers)"
          :description="t('opsMetricGrid.workerListDesc')"
          tone="warning"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/workers/management?status=OFFLINE,DECOMMISSIONED')"
      >
        <MetricCard
          :label="t('opsMetricGrid.offlineWorkers')"
          :value="String(summary.offlineWorkers)"
          :description="t('opsMetricGrid.workerListDesc')"
          tone="danger"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/observability/outbox?tab=retry')"
      >
        <MetricCard
          :label="t('opsMetricGrid.outboxRetryBacklog')"
          :value="String(summary.outboxRetryBacklog)"
          :description="t('opsMetricGrid.outboxRetryBacklogDesc')"
          tone="warning"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/observability/outbox?tab=delivery&status=FAILED')"
      >
        <MetricCard
          :label="t('opsMetricGrid.outboxDeliveryFailed')"
          :value="String(summary.outboxDeliveryFailures)"
          :description="t('opsMetricGrid.outboxDeliveryFailedDesc')"
          tone="danger"
        />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import MetricCard from '@/components/common/MetricCard.vue'
  import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

  const { t } = useI18n({ useScope: 'global' })

  defineProps<{
    summary: ConsoleOpsSummaryResponse
    active: boolean
  }>()

  defineEmits<{
    go: [path: string]
    goFailedJobs: []
  }>()
</script>

<style scoped>
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .metric-hit {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-content);
    text-align: left;
  }

  .metric-hit:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

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

  @media (max-width: 1160px) {
    .metric-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .metric-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
