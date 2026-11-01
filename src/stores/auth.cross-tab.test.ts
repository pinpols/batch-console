// @vitest-environment jsdom
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { currentAuthSession } from '@/api/authSession'

const mocks = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), profile: vi.fn() }))
vi.mock('@/api/auth', () => ({
  authApi: { login: mocks.login, logout: mocks.logout, profile: mocks.profile },
  mapProfileToUserInfo: (profile: { username: string; permissions: string[] }) => ({
    userId: profile.username, username: profile.username, role: 'VIEWER',
    permissions: profile.permissions, capabilities: [],
  }),
}))
import { useAuthStore } from './auth'

let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  mocks.login.mockResolvedValue({
    tenantId: 'system',
    userInfo: { username: 'admin', userId: 'admin', role: 'ADMIN', permissions: ['ROLE_ADMIN'], capabilities: [] },
  })
  mocks.logout.mockResolvedValue(undefined)
})
afterEach(() => disposePinia(pinia))

it('其他标签切换身份时立即清除旧权限，复核后展示新账号', async () => {
  let finishProfile!: (value: unknown) => void
  mocks.profile.mockReturnValue(new Promise((resolve) => { finishProfile = resolve }))
  const auth = useAuthStore()
  await auth.login('admin', 'example')
  expect(auth.hasPermission('ROLE_ADMIN')).toBe(true)

  localStorage.setItem(STORAGE_KEYS.authSessionRevision, 'other-session')
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.authSessionRevision, newValue: 'other-session' }))
  expect(auth.userInfo).toBeNull()
  expect(auth.hasPermission('ROLE_ADMIN')).toBe(false)
  finishProfile({ username: 'auditor', permissions: ['ROLE_AUDITOR'] })
  await vi.waitFor(() => expect(auth.userInfo?.username).toBe('auditor'))
})

it('通知到达前发现共享代次已变化时，不发送旧标签登出', async () => {
  mocks.profile.mockReturnValue(new Promise(() => {}))
  const auth = useAuthStore()
  await auth.login('admin', 'example')
  localStorage.setItem(STORAGE_KEYS.authSessionRevision, 'other-session')

  await auth.logout()
  expect(mocks.logout).not.toHaveBeenCalled()
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('1')
  expect(auth.userInfo).toBeNull()
})

it('页面恢复时发现共享代次变化，先清除旧账号权限', async () => {
  mocks.profile.mockReturnValue(new Promise(() => {}))
  const auth = useAuthStore()
  await auth.login('admin', 'example')
  localStorage.setItem(STORAGE_KEYS.authSessionRevision, 'other-session')

  window.dispatchEvent(new Event('pageshow'))
  expect(auth.userInfo).toBeNull()
  expect(auth.hasPermission('ROLE_ADMIN')).toBe(false)
})

it('旧账号打开的登出确认框不能登出已同步的新账号', async () => {
  mocks.profile.mockResolvedValue({ username: 'auditor', permissions: ['ROLE_AUDITOR'] })
  const auth = useAuthStore()
  await auth.login('admin', 'example')
  const openedSession = currentAuthSession()
  localStorage.setItem(STORAGE_KEYS.authSessionRevision, 'other-session')
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.authSessionRevision, newValue: 'other-session' }))
  await vi.waitFor(() => expect(auth.userInfo?.username).toBe('auditor'))

  const staleLogout = auth.logout as (expectedSession: number) => Promise<unknown>
  await staleLogout(openedSession)
  expect(mocks.logout).not.toHaveBeenCalled()
  expect(auth.userInfo?.username).toBe('auditor')
})
