import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'
import { useTabsStore } from '@/stores/tabs'
import { useTenantStore } from '@/stores/tenant'
import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'

export function useHeaderLogic() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const app = useAppStore()
  const permission = usePermissionStore()
  const tabsStore = useTabsStore()
  const tenant = useTenantStore()
  const paletteOpen = ref(false)

  const breadcrumbs = computed(() => {
    const out: { title: string; path: string }[] = []
    const seen = new Set<string>()
    for (const r of route.matched) {
      const title = r.meta?.title
      if (!title || typeof title !== 'string') continue
      let path = route.fullPath
      if (r.name && typeof r.name === 'string') {
        try {
          path = router.resolve({ name: r.name, params: route.params }).fullPath
        } catch {
          path = route.fullPath
        }
      } else if (r.path) {
        path = r.path.startsWith('/') ? r.path : `/${r.path}`
      }
      if (seen.has(path)) continue
      seen.add(path)
      out.push({ title, path })
    }
    return out
  })

  async function copyCurrentUrl() {
    try {
      const url = new URL(route.fullPath, window.location.origin).href
      await navigator.clipboard.writeText(url)
      ElMessage.success('已复制链接')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  const tenantIdInput = ref(tenant.tenantId)
  watch(
    () => tenant.tenantId,
    (v) => {
      tenantIdInput.value = v
    },
  )

  /** 系统角色是否可切换租户 */
  const canSwitchTenant = computed(() => checkCanSwitchTenant(auth.userInfo?.permissions ?? []))

  async function handleTenantSwitch(newTenantId: string) {
    if (!newTenantId) return
    tenant.setTenantId(newTenantId)
    ElMessage.success(`已切换到租户 ${newTenantId}`)
    // 后端按 tenant+authorities 下发菜单,切租户必须刷 profile;await 避免
    // 过渡窗口期侧边栏 / 路由 guard 用旧 role/menus 渲染或放行。
    // (auth store 同时挂了 watch tenantId 的兜底,这里 await 保 UX)
    try {
      await auth.fetchMe()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[tenant-switch] fetchMe failed:', err)
    }
  }

  async function copyTenant() {
    const text = tenantIdInput.value?.trim() ?? tenant.tenantId
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success('已复制 tenantId')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  const currentTitle = computed(() => (route.meta.title as string) ?? '批量调度平台')

  const visibleGroups = computed(() => permission.visibleGroups)

  const themeToggleLabel = computed(() => {
    if (app.themePreference === 'system') {
      return `跟随系统 · ${app.theme === 'dark' ? '深色' : '浅色'}`
    }
    return app.themePreference === 'light' ? '浅色' : '深色'
  })

  const themeToggleAriaLabel = computed(() => '切换主题')

  const commandPaletteShortcutLabel = computed(() =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? '')
      ? '⌘K'
      : 'Ctrl+K',
  )

  async function handleLogout() {
    await auth.logout()
    tabsStore.clear()
    router.push('/login')
  }

  return {
    route,
    router,
    auth,
    app,
    permission,
    tabsStore,
    tenant,
    paletteOpen,
    breadcrumbs,
    copyCurrentUrl,
    tenantIdInput,
    canSwitchTenant,
    handleTenantSwitch,
    copyTenant,
    currentTitle,
    visibleGroups,
    themeToggleLabel,
    themeToggleAriaLabel,
    commandPaletteShortcutLabel,
    handleLogout,
  }
}
