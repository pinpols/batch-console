/**
 * 移动端 tab bar 徽章计数统一来源。MobileLayout 挂载时开始 30s 轮询，
 * 各 tab 从 store 读数即可。页面隐藏时轮询暂停（由 useAutoRefresh 负责）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOpsSummary } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'

export const useMobileBadgesStore = defineStore('mobile-badges', () => {
  const pendingApprovals = ref(0)
  const openAlerts = ref(0)
  const criticalAlerts = ref(0)
  const failedJobs = ref(0)
  let fetching = false

  async function refresh(): Promise<void> {
    if (fetching) return
    fetching = true
    try {
      const tenant = useTenantStore()
      if (!tenant.tenantId) return
      const s = await getOpsSummary(tenant.tenantId)
      pendingApprovals.value = s.pendingApprovals ?? 0
      openAlerts.value = s.openAlerts ?? 0
      criticalAlerts.value = s.criticalAlerts ?? 0
      failedJobs.value = s.failedJobs ?? 0
    } catch {
      /* 保留上次值 */
    } finally {
      fetching = false
    }
  }

  const approvalsBadge = computed(() => pendingApprovals.value)
  const alertsBadge = computed(() => openAlerts.value)
  const jobsBadge = computed(() => failedJobs.value)

  return {
    pendingApprovals,
    openAlerts,
    criticalAlerts,
    failedJobs,
    approvalsBadge,
    alertsBadge,
    jobsBadge,
    refresh,
  }
})
