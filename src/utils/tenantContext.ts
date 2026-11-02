import { getActivePinia } from 'pinia'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { useTenantStore } from '@/stores/tenant'

/** 当前标签的租户；尚未初始化 Pinia 时才读取持久化的默认值。 */
export function readActiveTenantId(): string {
  return readTenantContext().tenantId
}

/** revision 用于阻止异步重试跨越同一标签的租户切换，包括切回原租户。 */
export function readTenantContext(): { tenantId: string; revision: number | null } {
  const pinia = getActivePinia()
  if (pinia) {
    const tenant = useTenantStore(pinia)
    return { tenantId: tenant.tenantId, revision: tenant.revision }
  }
  return { tenantId: localStorage.getItem(STORAGE_KEYS.tenantId) ?? '', revision: null }
}
