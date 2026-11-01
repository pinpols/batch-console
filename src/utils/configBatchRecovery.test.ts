// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import {
  canReadConfigBatchRecovery,
  clearConfigBatchRecovery,
  createConfigBatchRecovery,
  listConfigBatchRecoveries,
  saveConfigBatchRecovery,
} from './configBatchRecovery'

const scope = {
  actor: 'operator',
  headerTenant: 'selected-tenant',
  auditTenantId: 'source-tenant',
  operationKind: 'TENANT_COPY' as const,
}

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.unstubAllEnvs())

describe('配置批操作原请求记录', () => {
  it('同一账号和租户保留多条操作，并且只保存身份', () => {
    const withPayload = { ...scope, payload: { password: 'private-fixture-value' } }
    const first = createConfigBatchRecovery(withPayload)
    const second = createConfigBatchRecovery({ ...scope, operationKind: 'JOB_BUNDLE_IMPORT' })
    expect(saveConfigBatchRecovery(first)).toBe(true)
    expect(saveConfigBatchRecovery(second)).toBe(true)
    const restored = listConfigBatchRecoveries(scope.actor, scope.headerTenant)
    expect(restored).toEqual({ commands: [first, second], blocked: false })
    const key = sessionStorage.key(0)!
    expect(key).toContain(STORAGE_KEYS.configBatchRecoveryPrefix)
    expect(sessionStorage.getItem(key)).not.toContain('private-fixture-value')
    expect(clearConfigBatchRecovery(first)).toBe(true)
    expect(listConfigBatchRecoveries(scope.actor, scope.headerTenant).commands).toEqual([second])
  })

  it('刷新读取时按账号和原请求头租户隔离', () => {
    const command = createConfigBatchRecovery(scope)
    expect(saveConfigBatchRecovery(command)).toBe(true)
    expect(listConfigBatchRecoveries('another-operator', scope.headerTenant).commands).toEqual([])
    expect(listConfigBatchRecoveries(scope.actor, 'another-tenant').commands).toEqual([])
    expect(canReadConfigBatchRecovery(command, scope.actor, scope.headerTenant)).toBe(true)
    expect(canReadConfigBatchRecovery(command, 'another-operator', scope.headerTenant)).toBe(false)
    expect(canReadConfigBatchRecovery(command, scope.actor, 'another-tenant')).toBe(false)
  })

  it('同一浏览器不同 API 环境的记录互不复用', async () => {
    const command = createConfigBatchRecovery(scope)
    expect(saveConfigBatchRecovery(command)).toBe(true)
    vi.stubEnv('VITE_API_BASE_URL', 'https://other-environment.example.test')
    vi.resetModules()
    const otherEnvironment = await import('./configBatchRecovery')
    expect(otherEnvironment.listConfigBatchRecoveries(scope.actor, scope.headerTenant).commands).toEqual([])
    expect(listConfigBatchRecoveries(scope.actor, scope.headerTenant).commands).toEqual([command])
  })

  it('不可用或损坏的存储不会覆盖或清除已有记录', () => {
    const command = createConfigBatchRecovery(scope)
    expect(saveConfigBatchRecovery(command)).toBe(true)
    const key = sessionStorage.key(0)!
    sessionStorage.setItem(key, '{broken')
    expect(listConfigBatchRecoveries(scope.actor, scope.headerTenant).blocked).toBe(true)
    expect(saveConfigBatchRecovery(command)).toBe(false)
    expect(clearConfigBatchRecovery(command)).toBe(false)
    expect(sessionStorage.getItem(key)).toBe('{broken')
    const broken = { getItem: () => { throw new Error('storage unavailable') } } as unknown as Storage
    expect(listConfigBatchRecoveries(scope.actor, scope.headerTenant, broken).blocked).toBe(true)
    expect(saveConfigBatchRecovery(command, broken)).toBe(false)
    expect(clearConfigBatchRecovery(command, broken)).toBe(false)
  })

  it('旧响应不能覆盖或删除同键但不同内容的记录', () => {
    const command = createConfigBatchRecovery(scope)
    expect(saveConfigBatchRecovery(command)).toBe(true)
    const changed = { ...command, auditTenantId: 'other-source' }
    expect(saveConfigBatchRecovery(changed)).toBe(false)
    expect(clearConfigBatchRecovery(changed)).toBe(false)
    expect(listConfigBatchRecoveries(scope.actor, scope.headerTenant).commands).toEqual([command])
  })
})
