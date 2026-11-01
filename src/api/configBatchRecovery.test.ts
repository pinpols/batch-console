// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, post } from '@/api/client'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createConfigBatchRecovery, listConfigBatchRecoveries, saveConfigBatchRecovery } from '@/utils/configBatchRecovery'
import { getConfigBatchOperation } from './configBatchRecovery'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('配置批操作只读回查 API', () => {
  it('使用原请求键、操作类型和审计租户查询，不发送写请求', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'selected-tenant', auditTenantId: 'source-tenant', operationKind: 'TENANT_COPY',
    })
    localStorage.setItem(STORAGE_KEYS.tenantId, command.headerTenant)
    vi.mocked(get).mockResolvedValue({ status: 'UNKNOWN' })
    expect(saveConfigBatchRecovery(command)).toBe(true)

    const response = await getConfigBatchOperation(command, command.actor, command.headerTenant)

    expect(response.status).toBe('UNKNOWN')
    expect(get).toHaveBeenCalledWith('/api/console/config/batch-operation',
      { auditTenantId: 'source-tenant', operationKind: 'TENANT_COPY' },
      { headers: { 'Idempotency-Key': command.key } })
    expect(post).not.toHaveBeenCalled()
    expect(listConfigBatchRecoveries(command.actor, command.headerTenant).commands).toEqual([command])
  })

  it('当前账号或当前请求头租户不匹配时拒绝发送', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'selected-tenant', auditTenantId: 'source-tenant', operationKind: 'JOB_BUNDLE_CREATE',
    })
    localStorage.setItem(STORAGE_KEYS.tenantId, 'other-tenant')
    await expect(getConfigBatchOperation(command, command.actor, command.headerTenant)).rejects.toThrow()
    localStorage.setItem(STORAGE_KEYS.tenantId, command.headerTenant)
    await expect(getConfigBatchOperation(command, 'another-operator', command.headerTenant)).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('回查 404 不删除原记录或重发业务操作', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'selected-tenant', auditTenantId: 'source-tenant', operationKind: 'JOB_BUNDLE_IMPORT',
    })
    localStorage.setItem(STORAGE_KEYS.tenantId, command.headerTenant)
    saveConfigBatchRecovery(command)
    vi.mocked(get).mockRejectedValue({ response: { status: 404 } })
    await expect(getConfigBatchOperation(command, command.actor, command.headerTenant)).rejects.toMatchObject({ response: { status: 404 } })
    expect(listConfigBatchRecoveries(command.actor, command.headerTenant).commands).toEqual([command])
    expect(post).not.toHaveBeenCalled()
  })
})
