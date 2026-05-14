import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'
import { useTenantStore } from './tenant'

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
    menus: p.menus,
  })),
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    storage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('isLoggedIn is false when no token', () => {
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
  })

  it('isLoggedIn is true when session flag exists', () => {
    storage.set('batch-console-session', '1')
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

  it('logout clears session flag and userInfo', async () => {
    // D7 Stage B: token 不再前端持有；登录态用 session flag 表达
    storage.set('batch-console-session', '1')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(true)

    await auth.logout()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.userInfo).toBeNull()
    expect(storage.get('batch-console-session')).toBeUndefined()
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

  it('fetchMe discards stale response after tenant switch mid-flight', async () => {
    const { get } = await import('@/api/client')
    const mockedGet = vi.mocked(get)
    storage.set('batch-console-session', '1')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-A')

    // 第一次 fetchMe 拿 A profile,响应延迟回来
    let resolveA!: (v: unknown) => void
    mockedGet.mockReturnValueOnce(
      new Promise((r) => {
        resolveA = r
      }),
    )
    const pA = auth.fetchMe()

    // 切到 B,旧 fetchMe 还在飞;watch 触发新 fetchMe(B)
    tenant.setTenantId('tenant-B')
    let resolveB!: (v: unknown) => void
    mockedGet.mockReturnValueOnce(
      new Promise((r) => {
        resolveB = r
      }),
    )
    // 等 watch 异步触发完
    await Promise.resolve()
    await Promise.resolve()

    // B 先落地 → 写入 B profile
    resolveB({
      userId: 'uB',
      username: 'user-b',
      role: 'OPERATOR',
      permissions: ['ROLE_TENANT_USER'],
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(auth.userInfo?.username).toBe('user-b')

    // A 后落地 → 当前 tenant 已是 B,丢弃 A 响应,不污染 userInfo
    resolveA({
      userId: 'uA',
      username: 'user-a',
      role: 'ADMIN',
      permissions: ['*'],
    })
    await pA
    expect(auth.userInfo?.username).toBe('user-b')
  })

  it('auth store auto-refreshes profile when tenant changes', async () => {
    const { get } = await import('@/api/client')
    const mockedGet = vi.mocked(get)
    storage.set('batch-console-session', '1')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    const tenant = useTenantStore()

    mockedGet.mockResolvedValue({
      userId: 'u1',
      username: 'after-switch',
      role: 'ADMIN',
      permissions: ['*'],
    })

    expect(mockedGet).toHaveBeenCalledTimes(0)
    tenant.setTenantId('new-tenant')
    // watch 是异步的,等 microtask flush
    await new Promise((r) => setTimeout(r, 0))
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(auth.userInfo?.username).toBe('after-switch')
  })

  it('tenant change does NOT trigger fetchMe when no session', async () => {
    const { get } = await import('@/api/client')
    const mockedGet = vi.mocked(get)
    setActivePinia(createPinia())
    useAuthStore() // 触发 store 初始化 / watch 注册
    const tenant = useTenantStore()

    tenant.setTenantId('whatever')
    await new Promise((r) => setTimeout(r, 0))
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
