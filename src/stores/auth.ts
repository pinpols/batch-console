import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { get } from '@/api/client'
import { authApi, mapProfileToUserInfo, type ConsoleAuthProfilePayload } from '@/api/auth'
import { useTenantStore } from '@/stores/tenant'
import { roleOrder } from '@/constants/role'
import type { UserInfo, Role, MenuGroup } from '@/types'

/**
 * ADR-030 §D7 Stage B：token 已由后端下发为 HttpOnly cookie（JS 不可读），
 * 前端不再持有 token 字符串。{@code SESSION_FLAG_KEY} 仅作为"已登录"UI 提示位，
 * 内容是常量 "1"，无敏感信息；页面刷新后避免登录态闪烁。真正鉴权靠后端 cookie。
 */
const SESSION_FLAG_KEY = 'batch-console-session'

export const useAuthStore = defineStore('auth', () => {
  const sessionActive = ref<boolean>(localStorage.getItem(SESSION_FLAG_KEY) === '1')
  const userInfoInternal = ref<UserInfo | null>(null)
  // 在飞 fetchMe 的目标 tenantId,用于切租户竞态时识别"应丢弃"的旧响应
  let fetchMePromise: Promise<void> | null = null
  let inflightTenantId: string | null = null

  const userInfo = computed(() => userInfoInternal.value)

  const isLoggedIn = computed(() => sessionActive.value)
  const role = computed<Role | null>(() => userInfo.value?.role ?? null)
  /** 后端下发的侧边栏菜单（已按 authorities 过滤） */
  const menus = computed<MenuGroup[]>(() => userInfo.value?.menus ?? [])

  /**
   * 当前用户是否「租户级」角色(TENANT_ADMIN / TENANT_USER),不可切换租户。
   * ADMIN / AUDITOR 是跨租户角色,允许切换。
   */
  const isTenantUser = computed(() => {
    const perms = userInfoInternal.value?.permissions ?? []
    return (
      (perms.includes('ROLE_TENANT_USER') || perms.includes('ROLE_TENANT_ADMIN')) &&
      !perms.includes('ROLE_ADMIN') &&
      !perms.includes('ROLE_AUDITOR')
    )
  })

  function hasPermission(permission: string): boolean {
    const list = userInfoInternal.value?.permissions ?? []
    if (list.includes('*')) return true
    return list.includes(permission)
  }

  function canAccess(minRole: Role): boolean {
    const current = role.value ? roleOrder.indexOf(role.value) : -1
    return current >= roleOrder.indexOf(minRole)
  }

  async function login(username: string, password: string) {
    // D7 Stage B: token 由后端写入 HttpOnly cookie，浏览器自动维护；前端只标"已登录"flag。
    // 2026-05-16 后端 ConsoleAuthController.login 已落 Set-Cookie(batch_console_token,
    // HttpOnly + SameSite=Lax + 8h Max-Age),dev fallback 已删。
    const result = await authApi.login({ username, password })
    sessionActive.value = true
    userInfoInternal.value = result.userInfo
    localStorage.setItem(SESSION_FLAG_KEY, '1')
    const tenant = useTenantStore()
    // 'system' 是 admin 账号宿主,不是业务工作租户;落地到 system 会让所有业务页空白。
    // 保留 localStorage 里上次选的业务租户;首次登录 localStorage 为空时走右上角租户切换器手动选。
    if (result.tenantId && result.tenantId !== 'system') {
      tenant.setTenantId(result.tenantId)
    }
  }

  async function logout() {
    // 后端 /logout 端点会 Set-Cookie max-age=0 清除 token cookie。
    await authApi.logout().catch((e) => {
      if (import.meta.env.DEV) console.warn('[auth] logout request failed:', e)
    })
    sessionActive.value = false
    userInfoInternal.value = null
    localStorage.removeItem(SESSION_FLAG_KEY)
  }

  async function fetchMe() {
    const tenant = useTenantStore()
    const requestedTenantId = tenant.tenantId
    // 同一目标 tenantId 的并发调用复用 promise；切租户立即换 tenant 时
    // inflight tenantId 不一致 → 启新 fetch,旧响应回来时按 requestedTenantId 校验丢弃
    if (fetchMePromise && inflightTenantId === requestedTenantId) {
      return fetchMePromise
    }
    inflightTenantId = requestedTenantId
    fetchMePromise = (async () => {
      try {
        const profile = await get<ConsoleAuthProfilePayload>('/api/console/auth/me')
        // 落地前再校验一次:如果用户切租户在响应回来前发生,丢弃当前响应,
        // 避免 A 租户的 profile 写到 B 租户上下文里(role / menus / permissions 错配)
        if (tenant.tenantId === requestedTenantId) {
          userInfoInternal.value = mapProfileToUserInfo(profile)
        }
        // 注意：不要在这里 setTenantId(profile.tenantId)。
        // 客户端是 tenant 选择的唯一真源（login/localStorage/切换都走 tenant store），
        // /auth/me 返回的是账号归属 tenant，会把系统管理员的切换结果覆盖回去。
      } finally {
        // 只清自己负责的那次 inflight,避免清掉后来更新的 fetch 状态
        if (inflightTenantId === requestedTenantId) {
          fetchMePromise = null
          inflightTenantId = null
        }
      }
    })()
    return fetchMePromise
  }

  // P3:auth store 自动跟随 tenant 切换刷新 profile,
  // 任何路径(Header / TenantList / Mobile / 未来 deep-link)切了租户都会触发,
  // 不再依赖每个调用方手动调 fetchMe。watch 默认非 immediate,初始值不触发。
  const tenantStore = useTenantStore()
  watch(
    () => tenantStore.tenantId,
    () => {
      if (!sessionActive.value) return
      void fetchMe()
    },
  )

  return {
    userInfo,
    isLoggedIn,
    role,
    menus,
    isTenantUser,
    hasPermission,
    canAccess,
    login,
    logout,
    fetchMe,
  }
})
