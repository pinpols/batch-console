<template>
  <MPullRefresh :on-refresh="load">
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

      <MSkeleton v-else-if="loading" :count="4" />
      <div v-else class="m-empty">暂无数据。后端未联调时属正常。</div>

      <!-- 快捷入口:Tab Bar 已占满 5 个槽位,这里导出二级常用列表 -->
      <div class="m-quick-grid">
        <router-link to="/m/files" class="m-quick">
          <el-icon><Files /></el-icon>
          <span>文件</span>
        </router-link>
        <router-link to="/m/tenants" class="m-quick">
          <el-icon><OfficeBuilding /></el-icon>
          <span>租户</span>
        </router-link>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { Refresh, Files, OfficeBuilding } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
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
  // 30s 轮询：页面在前台时自动刷新，切后台时暂停（oncall 场景）
  useAutoRefresh(load, 30_000)
</script>

<style scoped>
  .m-quick-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  .m-quick {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 18px 12px;
    border-radius: 12px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    color: var(--color-text-primary);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
  }

  .m-quick :deep(.el-icon) {
    font-size: 22px;
    color: var(--color-primary);
  }

  .m-quick:active {
    transform: scale(0.97);
  }
</style>
