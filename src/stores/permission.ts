import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { navigationGroups } from '@/constants/navigation'
import type { NavigationGroup } from '@/constants/navigation'
import { resolveIcon } from '@/utils/iconResolve'
import type { MenuGroup, Role } from '@/types'

function menuGroupToNavigation(menu: MenuGroup): NavigationGroup {
  return {
    key: menu.key,
    title: menu.title,
    icon: resolveIcon(menu.icon),
    minRole: menu.minRole,
    children: menu.children.map((c) => ({
      title: c.title,
      path: c.path,
      icon: resolveIcon(c.icon),
      minRole: c.minRole,
    })),
  }
}

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
   * 优先使用后端 ConsoleMenuRegistry 下发的菜单（已按 authorities 过滤）；
   * 如果后端未下发（老版本后端 / 未登录 / fetchMe 未完成），回退到硬编码导航并按 role 过滤作为兜底。
   */
  const visibleGroups = computed<NavigationGroup[]>(() => {
    const backendMenus = auth.menus
    if (backendMenus && backendMenus.length > 0) {
      // 后端通常已按权限过滤，但仍兜底剔除空分组，避免侧边栏出现“点了没反应”的标题项。
      return backendMenus
        .map(menuGroupToNavigation)
        .filter((g) => Array.isArray(g.children) && g.children.length > 0)
    }
    return filterGroups(navigationGroups)
  })

  return {
    role,
    visibleGroups,
    canAccessRole,
    canAccessPermissions,
    filterGroups,
  }
})
