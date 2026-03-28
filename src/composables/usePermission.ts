import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types'

export function usePermission() {
  const auth = useAuthStore()
  const role = computed(() => auth.role)

  function canAccess(minRole: Role) {
    return auth.canAccess(minRole)
  }

  function hasPermission(permission: string) {
    return auth.hasPermission(permission)
  }

  return {
    role,
    canAccess,
    hasPermission,
  }
}

