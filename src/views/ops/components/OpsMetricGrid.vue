<template>
  <section class="ops-panel" :class="{ 'ops-panel--active': active }" aria-hidden="false">
    <div class="metric-grid">
      <button type="button" class="metric-hit" @click="$emit('go', '/approvals')">
        <MetricCard
          label="待审批"
          :value="String(summary.pendingApprovals)"
          description="点击进入审批中心"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/observability/alerts')">
        <MetricCard
          label="未处理告警"
          :value="String(summary.openAlerts)"
          description="点击查看告警列表"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/observability/alerts?severity=CRITICAL')"
      >
        <MetricCard
          label="严重告警"
          :value="String(summary.criticalAlerts)"
          description="点击查看严重告警"
        />
      </button>
      <button
        type="button"
        class="metric-hit"
        @click="$emit('go', '/monitor/job-instances?status=RUNNING')"
      >
        <MetricCard
          label="运行中任务"
          :value="String(summary.runningJobs)"
          description="点击查看运行中实例"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('goFailedJobs')">
        <MetricCard
          label="失败任务"
          :value="String(summary.failedJobs)"
          description="点击查看失败实例"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/monitor/job-instances')">
        <MetricCard
          label="SLA 违规"
          :value="String(summary.slaBreaches)"
          description="点击查看实例 SLA"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/workers/management')">
        <MetricCard
          label="在线 Worker"
          :value="String(summary.onlineWorkers)"
          description="点击查看 Worker 列表"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/workers/management')">
        <MetricCard
          label="Draining"
          :value="String(summary.drainingWorkers)"
          description="点击查看 Worker 列表"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/workers/management')">
        <MetricCard
          label="离线 Worker"
          :value="String(summary.offlineWorkers)"
          description="点击查看 Worker 列表"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/observability/outbox')">
        <MetricCard
          label="Outbox 重试积压"
          :value="String(summary.outboxRetryBacklog)"
          description="点击查看 Outbox 列表"
        />
      </button>
      <button type="button" class="metric-hit" @click="$emit('go', '/observability/outbox')">
        <MetricCard
          label="Outbox 投递失败"
          :value="String(summary.outboxDeliveryFailures)"
          description="点击查看 Outbox 列表"
        />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
  import MetricCard from '@/components/common/MetricCard.vue'
  import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

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
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--page-section-gap);
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
</style>
