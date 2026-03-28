import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get } from '@/api/client'
import { authApi, mapProfileToUserInfo, type ConsoleAuthProfilePayload } from '@/api/auth'
import { useTenantStore } from '@/stores/tenant'
import { roleOrder } from '@/constants/role'
import type { UserInfo, Role } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') ?? '')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const role = computed<Role | null>(() => userInfo.value?.role ?? null)

  function hasPermission(permission: string): boolean {
    return userInfo.value?.permissions.includes(permission) ?? false
  }

  function canAccess(minRole: Role): boolean {
    const current = role.value ? roleOrder.indexOf(role.value) : -1
    return current >= roleOrder.indexOf(minRole)
  }

  async function login(username: string, password: string) {
    const result = await authApi.login({ username, password })
    token.value = result.token
    userInfo.value = result.userInfo
    localStorage.setItem('token', result.token)
    const tenant = useTenantStore()
    if (result.tenantId) {
      tenant.setTenantId(result.tenantId)
    }
  }

  async function logout() {
    await authApi.logout().catch(() => {})
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
  }

  async function fetchMe() {
    const profile = await get<ConsoleAuthProfilePayload>('/api/console/auth/me')
    userInfo.value = mapProfileToUserInfo(profile)
    const tenant = useTenantStore()
    if (profile.tenantId) {
      tenant.setTenantId(profile.tenantId)
    }
  }

  return { token, userInfo, isLoggedIn, role, hasPermission, canAccess, login, logout, fetchMe }
})
