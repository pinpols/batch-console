import {
  getCurrentInstance,
  getCurrentScope,
  onActivated,
  onDeactivated,
  onScopeDispose,
  watch,
} from 'vue'
import { useTenantStore } from '@/stores/tenant'

/** 仅活动页面参与交互式租户切换的未保存检查。 */
export function useTenantChangeGuard(
  hasChanges: () => boolean,
  getDraftState: () => unknown,
): void {
  const tenant = useTenantStore()
  let draftRevision = 0
  watch(
    getDraftState,
    () => {
      draftRevision += 1
    },
    { deep: true, flush: 'sync' },
  )
  const register = () => tenant.registerTenantChangeGuard(hasChanges, () => draftRevision)
  let unregister: (() => void) | undefined = register()
  if (getCurrentInstance()) {
    onActivated(() => {
      unregister ??= register()
    })
    onDeactivated(() => {
      unregister?.()
      unregister = undefined
    })
  }
  if (getCurrentScope()) onScopeDispose(() => unregister?.())
}
