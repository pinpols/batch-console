import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { navigationGroups } from '@/constants/navigation'
import type { NavigationGroup } from '@/constants/navigation'
import type { MenuGroup, Role } from '@/types'

export const usePermissionStore = defineStore('permission', () => {
  const auth = useAuthStore()
  const role = computed(() => auth.role)
  // 当前租户资料未确认时不可沿用上一个租户的菜单和能力。
  const backendMenus = computed(() => (auth.profileLoaded ? auth.menus : []))

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
    const roleAccessibleGroups = groups.filter((group) => canAccessRole(group.minRole))
    const groupsWithAccessibleChildren = roleAccessibleGroups.map((group) => ({
      ...group,
      children: group.children.filter((item) => {
        if (item.capabilities?.length) {
          return item.capabilities.some((capability) => auth.hasCapability(capability))
        }
        if (item.authorities?.length) {
          return item.authorities.some((authority) => auth.hasPermission(authority))
        }
        return canAccessRole(item.minRole)
      }),
    }))
    return groupsWithAccessibleChildren.filter((group) => group.children.length > 0)
  }

  /**
   * 后端 ConsoleMenuRegistry 只作为可见性来源（已按 authorities 过滤）。
   * 菜单文案、图标和顺序保持前端 navigationGroups 的稳定定义，避免切租户后
   * /auth/me 返回的租户侧菜单标题覆盖本地产品文案。
   */
  const visibleGroups = computed<NavigationGroup[]>(() => {
    if (!auth.profileLoaded) return []
    const menus = backendMenus.value
    const backendPaths = backendVisiblePaths(menus)
    // 后端菜单是可见性上限,前端精确 authority / capability 规则仍需同时满足。
    const navigationItems = navigationGroups.flatMap((group) => group.children)
    const capabilityPaths = navigationItems
      .filter((item) => item.capabilities?.some((capability) => auth.hasCapability(capability)))
      .map((item) => item.path)
    const fallbackPaths = navigationItems
      .filter((item) => item.menuAccessFallbacks?.some((path) => backendPaths.has(path)))
      .map((item) => item.path)
    const permittedGroups = filterGroups(navigationGroups)
    return filterNavigationByBackendMenus(permittedGroups, menus, [
      ...capabilityPaths,
      ...fallbackPaths,
    ])
  })

  return {
    role,
    visibleGroups,
    canAccessRole,
    canAccessPermissions,
    filterGroups,
    hasBackendMenuAccess: (path?: string) => hasBackendMenuAccess(backendMenus.value, path),
  }
})

export function backendVisiblePaths(backendMenus?: MenuGroup[] | null): Set<string> {
  const menuGroups = backendMenus ?? []
  const childPaths = menuGroups.flatMap((group) => {
    const childrenAreArray = Array.isArray(group.children)
    if (!childrenAreArray) return []
    return group.children.map((child) => child.path)
  })
  return new Set(childPaths)
}

export function hasBackendMenuAccess(backendMenus?: MenuGroup[] | null, path?: string): boolean {
  if (!path) return true
  if (!backendMenus) return true
  return backendVisiblePaths(backendMenus).has(path)
}

export function filterNavigationByBackendMenus(
  groups: NavigationGroup[],
  backendMenus: MenuGroup[],
  additionalVisiblePaths: string[] = [],
): NavigationGroup[] {
  const visiblePaths = backendVisiblePaths(backendMenus)
  for (const path of additionalVisiblePaths) visiblePaths.add(path)

  const groupsWithVisibleChildren = groups.map((group) => {
    const groupFields = { ...group }
    const groupChildren = group.children
    const visibleChildren = groupChildren.filter((item) => {
      // 菜单项可带 query(如补跑审批 /approvals?tab=catch-up 复用审批页);后端菜单按真实页
      // path 收录,匹配时去掉 query 部分,避免带 tab 的项被误滤掉。
      const pagePath = item.path.split('?')[0]
      return visiblePaths.has(pagePath)
    })
    return { ...groupFields, children: visibleChildren }
  })
  return groupsWithVisibleChildren.filter((group) => group.children.length > 0)
}
