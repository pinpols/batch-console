import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { usePermission } from './usePermission'

const mocks = vi.hoisted(() => ({
  auth: { profileLoaded: true, role: 'ADMIN', hasPermission: (role: string) => role === 'ROLE_ADMIN', canAccess: () => true },
  app: { writesFrozen: false },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.app }))

describe('tenant profile permission state', () => {
  it('withdraws old profile permissions as soon as the current profile is unconfirmed', () => {
    mocks.auth = reactive({ ...mocks.auth, profileLoaded: true })
    const permission = usePermission()
    expect(permission.canMutateConfig.value).toBe(true)
    expect(permission.canManageSystem.value).toBe(true)
    mocks.auth.profileLoaded = false
    expect(permission.canMutateConfig.value).toBe(false)
    expect(permission.canManageSystem.value).toBe(false)
    expect(permission.hasPermission('ROLE_ADMIN')).toBe(false)
    expect(permission.canAccess('VIEWER')).toBe(false)
  })
})
