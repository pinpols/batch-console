import { beforeEach, expect, it, vi } from 'vitest'
import { advanceAuthSession } from './authSession'

const mocks = vi.hoisted(() => ({ encrypt: vi.fn(), post: vi.fn(), clear: vi.fn() }))
vi.mock('@/api/client', () => ({ post: mocks.post, get: vi.fn() }))
vi.mock('@/utils/loginCrypto', () => ({
  encryptLoginBody: mocks.encrypt,
  clearPublicKeyCache: mocks.clear,
}))
import { authApi } from './auth'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.post.mockImplementation(async (_url: string, body: { username: string }) => ({
    username: body.username,
    tenantId: 'system',
    authorities: [],
  }))
})

it('旧登录的加密迟到时，不发送覆盖新会话的请求', async () => {
  let finishOldEncryption!: () => void
  mocks.encrypt.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOldEncryption = () => resolve(null)
      }),
  )
  mocks.encrypt.mockResolvedValueOnce(null)
  advanceAuthSession()
  const oldLogin = authApi.login({ username: 'old', password: 'example' }).catch((error) => error)
  advanceAuthSession()
  await authApi.login({ username: 'new', password: 'example' })
  finishOldEncryption()
  expect(await oldLogin).toMatchObject({ staleSession: true })
  expect(mocks.post).toHaveBeenCalledTimes(1)
  expect(mocks.post.mock.calls[0]?.[1]).toMatchObject({ username: 'new' })
})

it('登录返回用户信息而不暴露响应体令牌字段', async () => {
  mocks.encrypt.mockResolvedValueOnce(null)
  const result = await authApi.login({ username: 'user', password: 'example' })
  expect(result.userInfo.username).toBe('user')
  expect(result).not.toHaveProperty('token')
})
