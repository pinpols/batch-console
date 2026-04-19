<template>
  <div class="m-page">
    <div class="m-page__header">
      <div>
        <div class="m-page__title">运营概览</div>
        <div class="m-page__subtitle">租户 {{ tenant.tenantId }}</div>
      </div>
      <button class="m-page__refresh" :disabled="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        {{ loading ? '加载中' : '刷新' }}
      </button>
    </div>

    <div v-if="summary" class="m-metric-grid">
      <div class="m-metric">
        <span class="m-metric__label">运行中 Job</span>
        <span class="m-metric__value">{{ summary.runningJobs }}</span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">失败 Job</span>
        <span
          class="m-metric__value"
          :class="summary.failedJobs > 0 ? 'm-metric__value--danger' : ''"
        >
          {{ summary.failedJobs }}
        </span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">待审批</span>
        <span
          class="m-metric__value"
          :class="summary.pendingApprovals > 0 ? 'm-metric__value--warning' : ''"
        >
          {{ summary.pendingApprovals }}
        </span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">未关闭告警</span>
        <span
          class="m-metric__value"
          :class="summary.criticalAlerts > 0 ? 'm-metric__value--danger' : ''"
        >
          {{ summary.openAlerts }}
        </span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">SLA 违约</span>
        <span
          class="m-metric__value"
          :class="summary.slaBreaches > 0 ? 'm-metric__value--warning' : ''"
        >
          {{ summary.slaBreaches }}
        </span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">在线 Worker</span>
        <span class="m-metric__value m-metric__value--success">{{ summary.onlineWorkers }}</span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">Drain Worker</span>
        <span class="m-metric__value">{{ summary.drainingWorkers }}</span>
      </div>
      <div class="m-metric">
        <span class="m-metric__label">离线 Worker</span>
        <span
          class="m-metric__value"
          :class="summary.offlineWorkers > 0 ? 'm-metric__value--warning' : ''"
        >
          {{ summary.offlineWorkers }}
        </span>
      </div>
    </div>

    <div v-else-if="loading" class="m-loading">加载中…</div>
    <div v-else class="m-empty">暂无数据。后端未联调时属正常。</div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { getOpsSummary } from '@/api/ops'
  import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const summary = ref<ConsoleOpsSummaryResponse | null>(null)

  async function load() {
    loading.value = true
    try {
      summary.value = await getOpsSummary(tenant.tenantId)
    } catch {
      summary.value = null
      ElMessage.error('加载失败，请稍后重试')
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
