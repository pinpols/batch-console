import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { usePermissionStore } from './permission'

const mocks = vi.hoisted(() => ({
  auth: {
    profileLoaded: false,
    menus: [] as unknown[],
    role: 'ADMIN',
    canAccess: () => true,
    hasPermission: () => true,
    hasCapability: () => false,
  },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.auth = reactive({
    profileLoaded: false,
    menus: [],
    role: 'ADMIN',
    canAccess: () => true,
    hasPermission: () => true,
    hasCapability: () => false,
  })
})

describe('backend menu profile', () => {
  it('hides menu-controlled routes before profile confirmation and after an explicit empty profile', () => {
    const permission = usePermissionStore()
    expect(permission.visibleGroups).toEqual([])
    expect(permission.hasBackendMenuAccess('/ops/summary')).toBe(false)
    mocks.auth.profileLoaded = true
    expect(permission.visibleGroups).toEqual([])
    expect(permission.hasBackendMenuAccess('/ops/summary')).toBe(false)
  })

  it('withdraws old menu access while the next tenant profile is pending', () => {
    mocks.auth.menus = [{ key: 'workspace', children: [{ path: '/ops/summary' }] }]
    mocks.auth.profileLoaded = true
    const permission = usePermissionStore()
    expect(permission.hasBackendMenuAccess('/ops/summary')).toBe(true)
    expect(permission.visibleGroups.length).toBeGreaterThan(0)
    mocks.auth.profileLoaded = false
    expect(permission.hasBackendMenuAccess('/ops/summary')).toBe(false)
    expect(permission.visibleGroups).toEqual([])
  })
})
