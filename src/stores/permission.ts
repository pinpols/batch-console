import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { navigationGroups } from '@/constants/navigation'
import type { NavigationGroup } from '@/constants/navigation'
import type { MenuGroup, Role } from '@/types'

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

  /**
   * 后端 ConsoleMenuRegistry 只作为可见性来源（已按 authorities 过滤）。
   * 菜单文案、图标和顺序保持前端 navigationGroups 的稳定定义，避免切租户后
   * /auth/me 返回的租户侧菜单标题覆盖本地产品文案。
   */
  const visibleGroups = computed<NavigationGroup[]>(() => {
    const backendMenus = auth.menus
    if (backendMenus && backendMenus.length > 0) {
      return filterNavigationByBackendMenus(navigationGroups, backendMenus)
    }
    return filterGroups(navigationGroups)
  })

  return {
    role,
    visibleGroups,
    canAccessRole,
    canAccessPermissions,
    filterGroups,
    hasBackendMenuAccess: (path?: string) => hasBackendMenuAccess(auth.menus, path),
  }
})

export function backendVisiblePaths(backendMenus?: MenuGroup[] | null): Set<string> {
  return new Set(
    (backendMenus ?? []).flatMap((g) =>
      Array.isArray(g.children) ? g.children.map((c) => c.path) : [],
    ),
  )
}

export function hasBackendMenuAccess(backendMenus?: MenuGroup[] | null, path?: string): boolean {
  if (!path) return true
  if (!backendMenus || backendMenus.length === 0) return true
  return backendVisiblePaths(backendMenus).has(path)
}

export function filterNavigationByBackendMenus(
  groups: NavigationGroup[],
  backendMenus: MenuGroup[],
): NavigationGroup[] {
  const visiblePaths = backendVisiblePaths(backendMenus)

  return groups
    .map((group) => ({
      ...group,
      children: group.children.filter((item) => visiblePaths.has(item.path)),
    }))
    .filter((group) => group.children.length > 0)
}
