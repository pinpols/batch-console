import { watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'

/**
 * 在组件 setup 时调用 `fn` 一次，并在 `tenant.tenantId` 变化时再次调用。
 *
 * 统一"切换租户后需要重取数据"的模式，替代各视图里手写的
 * `onMounted(load)` + `watch(() => tenant.tenantId, load)`，避免漏写
 * watch 造成切租户后数据不刷新的 bug（典型如 OpsSummary）。
 *
 * 使用 TanStack Query 且已把 tenantId 纳入 queryKey 的场景无需此组合式
 * （查询会自动失效重取）。
 */
export function useTenantReload(fn: () => void | Promise<void>): void {
  const tenant = useTenantStore()
  watch(
    () => tenant.tenantId,
    () => {
      void fn()
    },
    { immediate: true },
  )
}
