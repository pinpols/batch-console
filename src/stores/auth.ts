import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { get } from '@/api/client'
import { authApi, mapProfileToUserInfo, type ConsoleAuthProfilePayload } from '@/api/auth'
import { useTenantStore } from '@/stores/tenant'
import { roleOrder } from '@/constants/role'
import type { UserInfo, Role, MenuGroup } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') ?? '')
  const userInfoInternal = ref<UserInfo | null>(null)
  // 在飞 fetchMe 的目标 tenantId,用于切租户竞态时识别"应丢弃"的旧响应
  let fetchMePromise: Promise<void> | null = null
  let inflightTenantId: string | null = null

  const userInfo = computed(() => userInfoInternal.value)

  const isLoggedIn = computed(() => !!token.value)
  const role = computed<Role | null>(() => userInfo.value?.role ?? null)
  /** 后端下发的侧边栏菜单（已按 authorities 过滤） */
  const menus = computed<MenuGroup[]>(() => userInfo.value?.menus ?? [])

  /** 当前用户是否为租户用户（非系统角色，不可切换租户） */
  const isTenantUser = computed(() => {
    const perms = userInfoInternal.value?.permissions ?? []
    return (
      perms.includes('ROLE_TENANT_USER') &&
      !perms.includes('ROLE_ADMIN') &&
      !perms.includes('ROLE_CONFIG_ADMIN') &&
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
    const result = await authApi.login({ username, password })
    token.value = result.token
    userInfoInternal.value = result.userInfo
    localStorage.setItem('token', result.token)
    const tenant = useTenantStore()
    if (result.tenantId) {
      tenant.setTenantId(result.tenantId)
    }
  }

  async function logout() {
    await authApi.logout().catch((e) => {
      if (import.meta.env.DEV) console.warn('[auth] logout request failed:', e)
    })
    token.value = ''
    userInfoInternal.value = null
    localStorage.removeItem('token')
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
      if (!token.value) return
      void fetchMe()
    },
  )

  return {
    token,
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
