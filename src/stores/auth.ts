import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get } from '@/api/client'
import { authApi, mapProfileToUserInfo, type ConsoleAuthProfilePayload } from '@/api/auth'
import { useTenantStore } from '@/stores/tenant'
import { roleOrder } from '@/constants/role'
import type { UserInfo, Role, MenuGroup } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') ?? '')
  const userInfoInternal = ref<UserInfo | null>(null)
  let fetchMePromise: Promise<void> | null = null

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
    if (fetchMePromise) return fetchMePromise
    fetchMePromise = (async () => {
      try {
        const profile = await get<ConsoleAuthProfilePayload>('/api/console/auth/me')
        userInfoInternal.value = mapProfileToUserInfo(profile)
        // 注意：不要在这里 setTenantId(profile.tenantId)。
        // 客户端是 tenant 选择的唯一真源（login/localStorage/切换都走 tenant store），
        // /auth/me 返回的是账号归属 tenant，会把系统管理员的切换结果覆盖回去。
      } finally {
        fetchMePromise = null
      }
    })()
    return fetchMePromise
  }

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
