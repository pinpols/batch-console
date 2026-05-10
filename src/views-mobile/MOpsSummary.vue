<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.summary.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.summary.tenantPrefix', { id: tenant.tenantId }) }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <div v-if="summary" class="m-metric-grid">
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.runningJobs') }}</span>
          <span class="m-metric__value">{{ summary.runningJobs }}</span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.failedJobs') }}</span>
          <span
            class="m-metric__value"
            :class="summary.failedJobs > 0 ? 'm-metric__value--danger' : ''"
          >
            {{ summary.failedJobs }}
          </span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.pendingApprovals') }}</span>
          <span
            class="m-metric__value"
            :class="summary.pendingApprovals > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.pendingApprovals }}
          </span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.openAlerts') }}</span>
          <span
            class="m-metric__value"
            :class="summary.criticalAlerts > 0 ? 'm-metric__value--danger' : ''"
          >
            {{ summary.openAlerts }}
          </span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.slaBreaches') }}</span>
          <span
            class="m-metric__value"
            :class="summary.slaBreaches > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.slaBreaches }}
          </span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.onlineWorkers') }}</span>
          <span class="m-metric__value m-metric__value--success">{{ summary.onlineWorkers }}</span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.drainingWorkers') }}</span>
          <span class="m-metric__value">{{ summary.drainingWorkers }}</span>
        </div>
        <div class="m-metric">
          <span class="m-metric__label">{{ t('mobile.summary.offlineWorkers') }}</span>
          <span
            class="m-metric__value"
            :class="summary.offlineWorkers > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.offlineWorkers }}
          </span>
        </div>
      </div>

      <MSkeleton v-else-if="loading" :count="4" />
      <div v-else class="m-empty">{{ t('mobile.common.empty') }}</div>

      <!-- 快捷入口:Tab Bar 已占满 5 个槽位,这里导出二级常用列表 -->
      <div class="m-quick-grid">
        <router-link to="/m/files" class="m-quick">
          <el-icon><Files /></el-icon>
          <span>{{ t('mobile.summary.filesQuick') }}</span>
        </router-link>
        <router-link to="/m/tenants" class="m-quick">
          <el-icon><OfficeBuilding /></el-icon>
          <span>{{ t('mobile.summary.tenantsQuick') }}</span>
        </router-link>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh, Files, OfficeBuilding } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
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
      ElMessage.error(t('mobile.common.loadFail'))
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
