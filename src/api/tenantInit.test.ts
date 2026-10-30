import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from './client'
import { batchInitTenantConfig, type ConfigType } from './ops'

vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))

describe('租户初始化请求目标', () => {
  beforeEach(() => vi.mocked(post).mockReset())

  it.each([undefined, [], ['JOB_DEFINITION']] as (ConfigType[] | undefined)[])(
    '配置正文不覆盖操作人选择的目标、模式或试运行开关：%j',
    async (configTypes) => {
      const spec = {
        targetTenantIds: ['another-tenant'],
        mode: 'UPSERT',
        dryRun: false,
        jobDefinitions: [{ jobCode: 'example' }],
      }
      await batchInitTenantConfig({
        targetTenantIds: ['selected-tenant'],
        mode: 'SKIP_EXISTING',
        dryRun: true,
        spec,
        configTypes,
      })
      expect(post).toHaveBeenCalledWith('/api/console/config/tenant-init', {
        targetTenantIds: ['selected-tenant'],
        mode: 'SKIP_EXISTING',
        dryRun: true,
        jobDefinitions: [{ jobCode: 'example' }],
      })
      expect(spec.targetTenantIds).toEqual(['another-tenant'])
    },
  )
})
