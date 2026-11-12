<template>
  <MPullRefresh :on-refresh="refreshAll">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.summary.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.summary.tenantPrefix', { id: tenant.tenantId }) }}
          </div>
        </div>
      </div>

      <MTenantDailyProgress ref="dailyProgress" />

      <div v-if="summary" class="m-metric-grid">
        <component
          :is="canOpenMobile('m-jobs') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-jobs') ? '/m/jobs?status=RUNNING' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.runningJobs') }}</span>
          <span class="m-metric__value">{{ summary.runningJobs }}</span>
        </component>
        <component
          :is="canOpenMobile('m-jobs') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-jobs') ? '/m/jobs?status=FAILED' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.failedJobs') }}</span>
          <span
            class="m-metric__value"
            :class="summary.failedJobs > 0 ? 'm-metric__value--danger' : ''"
          >
            {{ summary.failedJobs }}
          </span>
        </component>
        <component
          :is="canOpenMobile('m-approvals') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-approvals') ? '/m/approvals' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.pendingApprovals') }}</span>
          <span
            class="m-metric__value"
            :class="summary.pendingApprovals > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.pendingApprovals }}
          </span>
        </component>
        <component
          :is="canOpenMobile('m-alerts') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-alerts') ? '/m/alerts' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.openAlerts') }}</span>
          <span
            class="m-metric__value"
            :class="summary.criticalAlerts > 0 ? 'm-metric__value--danger' : ''"
          >
            {{ summary.openAlerts }}
          </span>
        </component>
        <component
          :is="canOpenMobile('m-jobs') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-jobs') ? '/m/jobs?slaBreached=1' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.slaBreaches') }}</span>
          <span
            class="m-metric__value"
            :class="summary.slaBreaches > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.slaBreaches }}
          </span>
        </component>
        <component
          :is="canOpenMobile('m-workers') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-workers') ? '/m/workers?filter=online' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.onlineWorkers') }}</span>
          <span class="m-metric__value m-metric__value--success">{{ summary.onlineWorkers }}</span>
        </component>
        <component
          :is="canOpenMobile('m-workers') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-workers') ? '/m/workers?filter=draining' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.drainingWorkers') }}</span>
          <span class="m-metric__value">{{ summary.drainingWorkers }}</span>
        </component>
        <component
          :is="canOpenMobile('m-workers') ? 'router-link' : 'div'"
          :to="canOpenMobile('m-workers') ? '/m/workers?filter=offline' : undefined"
          class="m-metric"
        >
          <span class="m-metric__label">{{ t('mobile.summary.offlineWorkers') }}</span>
          <span
            class="m-metric__value"
            :class="summary.offlineWorkers > 0 ? 'm-metric__value--warning' : ''"
          >
            {{ summary.offlineWorkers }}
          </span>
        </component>
      </div>

      <MSkeleton v-else-if="loading" :count="4" />
      <div v-else-if="loadError" class="m-empty m-summary-error" role="alert">
        <span>{{ t('mobile.common.loadFail') }}</span>
        <button class="m-btn" type="button" @click="load">{{ t('common.retry') }}</button>
      </div>
      <div v-else class="m-empty">{{ t('mobile.common.empty') }}</div>

      <!-- 快捷入口:Tab Bar 已占满 5 个槽位,这里导出二级常用列表 -->
      <div class="m-quick-grid">
        <router-link v-if="canOpenMobile('m-files')" to="/m/files" class="m-quick">
          <el-icon><Files /></el-icon>
          <span>{{ t('mobile.summary.filesQuick') }}</span>
        </router-link>
        <router-link
          v-if="canOpenMobile('m-approvals')"
          to="/m/approvals?tab=catch-up"
          class="m-quick"
        >
          <el-icon><Memo /></el-icon>
          <span>{{ t('mobile.summary.catchupQuick') }}</span>
        </router-link>
        <router-link v-if="canOpenMobile('m-outbox')" to="/m/outbox" class="m-quick">
          <el-icon><Promotion /></el-icon>
          <span>{{ t('mobile.summary.outboxQuick') }}</span>
        </router-link>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useI18n } from 'vue-i18n'
  import {
    RefreshCw as Refresh,
    Files,
    ClipboardList as Memo,
    Send as Promotion,
  } from '@lucide/vue'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { useTenantStore } from '@/stores/tenant'
  import { usePermissionStore } from '@/stores/permission'
  import { mobileMenuAccess } from '@/router/mobileMenuAccess'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_COLD_MS } from '@/layout-mobile/composables/refreshIntervals'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MTenantDailyProgress from './MTenantDailyProgress.vue'
  import { getOpsSummary } from '@/api/ops'
  import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const permission = usePermissionStore()
  const visiblePaths = computed(
    () =>
      new Set(
        permission.visibleGroups.flatMap((group) =>
          group.children.map((item) => item.path.split('?')[0]),
        ),
      ),
  )
  function canOpenMobile(routeName: string) {
    return visiblePaths.value.has(mobileMenuAccess[routeName])
  }
  const scope = useTenantRequestScope()
  const loading = ref(false)
  const loadError = ref(false)
  const summary = ref<ConsoleOpsSummaryResponse | null>(null)
  const dailyProgress = ref<InstanceType<typeof MTenantDailyProgress> | null>(null)

  async function refreshAll() {
    await Promise.all([load(), dailyProgress.value?.refresh()])
  }

  async function load() {
    const request = scope.begin()
    if (!request.tenantId) return
    loading.value = true
    loadError.value = false
    try {
      const result = await getOpsSummary(request.tenantId)
      if (scope.isCurrent(request)) summary.value = result
    } catch {
      if (scope.isCurrent(request)) {
        summary.value = null
        loadError.value = true
        ElMessage.error(t('mobile.common.loadFail'))
      }
    } finally {
      if (scope.isCurrent(request)) loading.value = false
    }
  }
  watch(
    () => tenant.tenantId,
    () => {
      summary.value = null
      loading.value = false
      loadError.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(load)
  // 30s 轮询：页面在前台时自动刷新，切后台时暂停（oncall 场景）
  useAutoRefresh(load, REFRESH_INTERVAL_COLD_MS)
</script>

<style scoped>
  .m-summary-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-block: 32px;
  }

  .m-quick-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
