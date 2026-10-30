/**
 * 移动端 tab bar 徽章计数统一来源。MobileLayout 挂载时开始 30s 轮询，
 * 各 tab 从 store 读数即可。页面隐藏时轮询暂停（由 useAutoRefresh 负责）。
 */
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getOpsSummary } from '@/api/ops'
import { useTenantStore } from '@/stores/tenant'

export const useMobileBadgesStore = defineStore('mobile-badges', () => {
  const pendingApprovals = ref(0)
  const openAlerts = ref(0)
  const criticalAlerts = ref(0)
  const failedJobs = ref(0)
  const tenant = useTenantStore()
  let requestGeneration = 0
  let fetchingTenantId: string | null = null

  watch(
    () => tenant.tenantId,
    () => {
      requestGeneration += 1
      fetchingTenantId = null
      pendingApprovals.value = 0
      openAlerts.value = 0
      criticalAlerts.value = 0
      failedJobs.value = 0
    },
    { flush: 'sync' },
  )

  async function refresh(): Promise<void> {
    const tenantId = tenant.tenantId
    if (!tenantId || fetchingTenantId === tenantId) return
    fetchingTenantId = tenantId
    const generation = ++requestGeneration
    try {
      const s = await getOpsSummary(tenantId)
      if (generation !== requestGeneration || tenantId !== tenant.tenantId) return
      pendingApprovals.value = s.pendingApprovals ?? 0
      openAlerts.value = s.openAlerts ?? 0
      criticalAlerts.value = s.criticalAlerts ?? 0
      failedJobs.value = s.failedJobs ?? 0
    } catch {
      /* 保留上次值 */
    } finally {
      if (generation === requestGeneration) fetchingTenantId = null
    }
  }

  const approvalsBadge = computed(() => pendingApprovals.value)
  const alertsBadge = computed(() => openAlerts.value)
  // failedJobs 是历史失败数；后端暂未提供“未处理失败”计数，不能作为导航待办徽章。
  const jobsBadge = computed(() => 0)

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
