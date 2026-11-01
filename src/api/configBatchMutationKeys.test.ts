import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from '@/api/client'
import { jobApi } from '@/api/job'
import { copyTenantConfig } from '@/api/ops'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), apiClient: {} }))
vi.mock('@/api/adapters', () => ({ fetchAllPageItems: vi.fn() }))
vi.mock('@/api/batchDays', () => ({ launchBatchDayCatchUp: vi.fn() }))
vi.mock('@/api/instance', () => ({ instanceApi: {} }))
vi.mock('@/api/queries/instances', () => ({ queryJobInstances: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('配置批操作原请求键', () => {
  it('租户复制使用调用方提前保存的键', () => {
    const body = { sourceTenantId: 'source', targetTenantIds: ['target'] }
    copyTenantConfig(body, 'original-key')
    expect(post).toHaveBeenCalledWith('/api/console/config/tenant-copy', body,
      { headers: { 'Idempotency-Key': 'original-key' } })
  })

  it('作业包创建与导入各使用调用方提前保存的键', () => {
    const create = { tenantId: 'source', mode: 'SKIP_EXISTING' as const, dryRun: false, bundle: {} }
    const imported = { tenantId: 'source', targetTenantIds: ['target'], mode: 'UPSERT' as const, dryRun: false, bundle: {} }
    jobApi.createBundle(create, 'create-key')
    jobApi.importBundle(imported, 'import-key')
    expect(post).toHaveBeenCalledWith('/api/console/jobs/bundle/create', create,
      { headers: { 'Idempotency-Key': 'create-key' } })
    expect(post).toHaveBeenCalledWith('/api/console/jobs/bundle/import', imported,
      { headers: { 'Idempotency-Key': 'import-key' } })
  })
})
