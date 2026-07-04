import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
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
  const { t, te } = useI18n({ useScope: 'global' })
  const paletteOpen = ref(false)

  const breadcrumbs = computed(() => {
    const out: { title: string; path: string }[] = []
    const seen = new Set<string>()
    // 设计稿面包屑「分组 › 页面」:前置当前路由所属的侧栏分组名(分组非路由,不可点)。
    const activePath = (route.meta?.activeMenu as string) ?? route.path
    for (const group of permission.visibleGroups) {
      if (!group.children?.some((c) => c.path === activePath)) continue
      const gKey = `nav.group.${group.key}`
      const gTitle = te(gKey) ? t(gKey) : group.title
      if (gTitle) out.push({ title: gTitle, path: '' })
      break
    }
    for (const r of route.matched) {
      const fallback = r.meta?.title
      const pathKey = r.meta?.pathKey as string | undefined
      const i18nKey = pathKey ? `page.${pathKey}.title` : ''
      let title: string | undefined
      if (i18nKey && te(i18nKey)) {
        title = t(i18nKey)
      } else if (typeof fallback === 'string' && fallback) {
        title = fallback
      }
      if (!title) continue
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
      ElMessage.success(t('copy.linkSuccess'))
    } catch {
      ElMessage.error(t('copy.fail'))
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
    ElMessage.success(`${t('nav.switchTenant')}: ${newTenantId}`)
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
      ElMessage.success(t('copy.tenantSuccess'))
    } catch {
      ElMessage.error(t('copy.fail'))
    }
  }

  const currentTitle = computed(() => {
    const pathKey = route.meta?.pathKey as string | undefined
    const i18nKey = pathKey ? `page.${pathKey}.title` : ''
    if (i18nKey && te(i18nKey)) return t(i18nKey)
    return (route.meta.title as string) ?? t('nav.appTitle')
  })

  const visibleGroups = computed(() => permission.visibleGroups)

  const themeToggleLabel = computed(() => {
    if (app.themePreference === 'system') {
      const effective = app.theme === 'dark' ? t('nav.themeDark') : t('nav.themeLight')
      return `${t('nav.themeFollowSystem')} · ${effective}`
    }
    return app.themePreference === 'light' ? t('nav.themeLight') : t('nav.themeDark')
  })

  const themeToggleAriaLabel = computed(() => t('nav.switchTheme'))

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
