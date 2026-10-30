// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import {
  createConfigSyncRecovery,
  saveConfigSyncRecovery,
  restoreConfigSyncRecovery,
  clearConfigSyncRecovery,
  canRetryConfigSync,
} from './configSyncRecovery'

const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto')

const body = {
  tenantId: 'tenant-a',
  sourceEnv: 'dev',
  targetEnv: 'prod',
  targetTenantIds: ['target'],
  bundle: { secret: 'private-fixture-value', jobs: [] },
}
const scope = 'operator\0tenant-a'
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('配置同步原命令恢复', () => {
  it('仅保存原键和输入摘要，不保存敏感配置正文', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    expect(saveConfigSyncRecovery(command)).toBe(true)
    expect(restoreConfigSyncRecovery(scope)).toEqual({ command, blocked: false })
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toContain('private-fixture-value')
    expect(await canRetryConfigSync(command, body)).toBe(true)
  })
  it('隔离账号和租户的恢复记录', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(command)
    expect(restoreConfigSyncRecovery('other\0tenant-a').command).toBeNull()
    expect(restoreConfigSyncRecovery('operator\0tenant-b').command).toBeNull()
    await expect(createConfigSyncRecovery('operator\0tenant-b', body)).rejects.toThrow()
  })
  it('仅等价 JSON 及原目标与环境可沿用原命令', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    expect(
      await canRetryConfigSync(command, {
        ...body,
        bundle: { jobs: [], secret: 'private-fixture-value' },
      }),
    ).toBe(true)
    expect(await canRetryConfigSync(command, { ...body, targetEnv: 'dev' })).toBe(false)
    expect(await canRetryConfigSync(command, { ...body, targetTenantIds: ['other'] })).toBe(false)
    expect(await canRetryConfigSync(command, { ...body, bundle: {} })).toBe(false)
  })
  it('超过23小时仍保留审计身份，但不再允许自动重试', async () => {
    const now = Date.now()
    const command = await createConfigSyncRecovery(scope, body, now - 23 * 3600 * 1000)
    saveConfigSyncRecovery(command)
    expect(restoreConfigSyncRecovery(scope).command).toEqual(command)
    expect(await canRetryConfigSync(command, body, now)).toBe(false)
  })
  it('损坏或未来身份记录不自动删除或放行', async () => {
    const initial = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(initial)
    const key = sessionStorage.key(0)!
    expect(key).toContain(STORAGE_KEYS.configSyncRecoveryPrefix)
    sessionStorage.setItem(key, '{broken')
    expect(restoreConfigSyncRecovery(scope).blocked).toBe(true)
    expect(sessionStorage.getItem(key)).toBe('{broken')
    const command = await createConfigSyncRecovery(scope, body, Date.now() + 60_000)
    expect(saveConfigSyncRecovery(command)).toBe(false)
  })
  it('旧回包不得删除或覆盖较新命令', async () => {
    const old = await createConfigSyncRecovery(scope, body)
    const newer = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(newer)
    expect(saveConfigSyncRecovery(old)).toBe(false)
    expect(clearConfigSyncRecovery(old)).toBe(false)
    expect(restoreConfigSyncRecovery(scope).command).toEqual(newer)
    expect(clearConfigSyncRecovery(newer)).toBe(true)
  })
  it('同源不同 API 环境不复用旧部署的命令身份', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(command)
    vi.stubEnv('VITE_API_BASE_URL', 'https://other-environment.example.test')
    vi.resetModules()
    const otherEnvironment = await import('./configSyncRecovery')
    expect(otherEnvironment.restoreConfigSyncRecovery(scope).command).toBeNull()
    expect(restoreConfigSyncRecovery(scope).command).toEqual(command)
  })

  it('同一请求键不能覆盖原输入摘要或创建时间', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(command)
    expect(saveConfigSyncRecovery({ ...command, bodyHash: 'a'.repeat(64) })).toBe(false)
    expect(saveConfigSyncRecovery({ ...command, createdAt: command.createdAt - 1 })).toBe(false)
    expect(restoreConfigSyncRecovery(scope).command).toEqual(command)
  })

  it('恢复记录中的非法请求头字符保持阻断', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    saveConfigSyncRecovery(command)
    const key = sessionStorage.key(0)!
    sessionStorage.setItem(key, JSON.stringify({ ...command, key: 'invalid\r\nheader' }))
    expect(restoreConfigSyncRecovery(scope).blocked).toBe(true)
  })

  it('存储不可用时拒绝写入和解除未知状态', async () => {
    const command = await createConfigSyncRecovery(scope, body)
    const broken = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
    } as unknown as Storage
    expect(restoreConfigSyncRecovery(scope, broken).blocked).toBe(true)
    expect(saveConfigSyncRecovery(command, broken)).toBe(false)
    expect(clearConfigSyncRecovery(command, broken)).toBe(false)
  })
})
