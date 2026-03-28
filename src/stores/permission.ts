import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { navigationGroups } from '@/constants/navigation'
import type { NavigationGroup } from '@/constants/navigation'
import type { Role } from '@/types'

export const usePermissionStore = defineStore('permission', () => {
  const auth = useAuthStore()
  const role = computed(() => auth.role)

  function canAccessRole(minRole?: Role) {
    if (!minRole) return true
    return auth.canAccess(minRole)
  }

  function canAccessPermissions(permissions?: string | string[]) {
    if (!permissions) return true
    const required = Array.isArray(permissions) ? permissions : [permissions]
    return required.some((permission) => auth.hasPermission(permission))
  }

  function filterGroups(groups: NavigationGroup[]) {
    return groups
      .filter((group) => canAccessRole(group.minRole))
      .map((group) => ({
        ...group,
        children: group.children.filter((item) => canAccessRole(item.minRole)),
      }))
      .filter((group) => group.children.length > 0)
  }

  const visibleGroups = computed(() => filterGroups(navigationGroups))

  return {
    role,
    visibleGroups,
    canAccessRole,
    canAccessPermissions,
    filterGroups,
  }
})
