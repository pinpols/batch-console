import { onScopeDispose, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'

/** 将异步请求绑定到当前租户和组件生命周期；后续请求或租户切换会使旧结果失效。 */
export function useTenantRequestScope() {
  const tenant = useTenantStore()
  let revision = 0
  function invalidate() {
    revision += 1
  }
  watch(() => tenant.tenantId, invalidate, { flush: 'sync' })
  onScopeDispose(invalidate)

  function begin() {
    invalidate()
    return { tenantId: tenant.tenantId, revision }
  }

  function isCurrent(scope: ReturnType<typeof begin>) {
    return !!scope.tenantId && scope.tenantId === tenant.tenantId && scope.revision === revision
  }

  return { begin, isCurrent }
}
