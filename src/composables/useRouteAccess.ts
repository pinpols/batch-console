import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { NavigationGroup } from '@/constants/navigation'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import type { Role } from '@/types'

function pathOnly(path: string): string {
  return path.split(/[?#]/, 1)[0] || path
}

/**
 * 判断当前用户能否打开某个页面，与路由守卫口径一致：路由声明的角色、authority、能力，
 * 以及后端下发菜单（含侧栏隐藏项）。用于页面内链接，避免给出点开即被拦回的入口。
 */
export function useRouteAccess(groups?: () => readonly NavigationGroup[]) {
  const router = useRouter()
  const auth = useAuthStore()
  const permission = usePermissionStore()
  const permittedPaths = computed(
    () =>
      new Set(
        (groups ? groups() : permission.visibleGroups).flatMap((group) =>
          group.children.map((item) => pathOnly(item.path)),
        ),
      ),
  )

  function canOpenPath(path: string): boolean {
    const target = router.resolve(path)
    if (!target.matched.length || target.name === 'not-found') return false
    const meta = target.meta
    if (meta.minRole && !permission.canAccessRole(meta.minRole as Role)) return false
    if (meta.permissions && !permission.canAccessPermissions(meta.permissions as string[]))
      return false
    if (
      meta.capabilities &&
      !(meta.capabilities as string[]).some((value) => auth.hasCapability(value))
    )
      return false
    if (
      target.path === '/system/me' ||
      target.path === '/system/users' ||
      target.path.startsWith('/m/')
    )
      return true
    if (target.path === '/system/ai-chat' && auth.hasCapability('AI_ASSISTANT_USE')) return true
    const candidates = [
      String(meta.activeMenu || target.path),
      ...((meta.menuAccessFallbacks as string[] | undefined) ?? []),
    ]
    return candidates.some((candidate) => permittedPaths.value.has(pathOnly(candidate)))
  }

  return { canOpenPath, permittedPaths }
}
