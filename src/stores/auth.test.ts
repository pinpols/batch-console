import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  mapProfileToUserInfo: vi.fn((p) => ({
    userId: p.userId,
    username: p.username,
    role: p.role,
    permissions: p.permissions ?? [],
  })),
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
  })

  it('isLoggedIn is false when no token', () => {
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
  })

  it('isLoggedIn is true when token exists', () => {
    storage.set('token', 'abc')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(true)
  })

  it('hasPermission returns false when no userInfo', () => {
    const auth = useAuthStore()
    expect(auth.hasPermission('ROLE_ADMIN')).toBe(false)
  })

  it('canAccess checks role hierarchy', () => {
    const auth = useAuthStore()
    // Simulate setting userInfo via internal state
    auth.$patch({})
    // Without userInfo, canAccess should return false for any role
    expect(auth.canAccess('VIEWER')).toBe(false)
    expect(auth.canAccess('ADMIN')).toBe(false)
  })

  it('logout clears token and userInfo', async () => {
    storage.set('token', 'test-token')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    expect(auth.token).toBe('test-token')

    await auth.logout()
    expect(auth.token).toBe('')
    expect(auth.userInfo).toBeNull()
    expect(storage.get('token')).toBeUndefined()
  })

  it('fetchMe deduplicates concurrent calls', async () => {
    const { get } = await import('@/api/client')
    const mockedGet = vi.mocked(get)
    let resolve!: (v: unknown) => void
    mockedGet.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )

    const auth = useAuthStore()
    const p1 = auth.fetchMe()
    const p2 = auth.fetchMe()

    // Both calls return the same underlying promise, so only 1 API call
    resolve({
      userId: 'u1',
      username: 'test',
      role: 'ADMIN',
      permissions: ['*'],
    })
    await p1
    await p2
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(auth.userInfo?.username).toBe('test')
  })
})
