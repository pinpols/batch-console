import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, post } from './client'
import {
  getConfigSyncRequestStatus,
  importConfigSync,
  reconcileConfigSyncLog,
} from './configReleases'
vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./adapters', () => ({ fetchAllPageItems: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
describe('配置同步原命令与核对 API', () => {
  it('导入携带调用方保留的原幂等键', () => {
    const body = {
      tenantId: 'audit',
      sourceEnv: 'dev',
      targetEnv: 'prod',
      targetTenantIds: ['target'],
      bundle: {},
    }
    importConfigSync(body, 'original-key')
    expect(post).toHaveBeenCalledWith('/api/console/config/sync/import', body, {
      headers: { 'Idempotency-Key': 'original-key' },
    })
  })
  it('状态查询只携带原请求身份，不重做导入或写入', () => {
    getConfigSyncRequestStatus('audit', 'original-key')
    expect(get).toHaveBeenCalledWith(
      '/api/console/config/sync/requests/status',
      { tenantId: 'audit' },
      { headers: { 'Idempotency-Key': 'original-key' } },
    )
    expect(post).not.toHaveBeenCalled()
  })
  it('核对使用审计标识和租户，不将原导入键改作另一类写命令', () => {
    reconcileConfigSyncLog('audit', 41)
    expect(post).toHaveBeenCalledWith('/api/console/config/sync/logs/41/reconcile', undefined, {
      params: { tenantId: 'audit' },
    })
  })
})
