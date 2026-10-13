import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
vi.mock('@/api/client', () => ({
  get: (...args: unknown[]) => getMock(...args),
}))

import { useJobCodeOptions, __resetJobCodeCacheForTest } from './useJobCodeOptions'

beforeEach(() => {
  getMock.mockReset()
  __resetJobCodeCacheForTest()
})

describe('useJobCodeOptions', () => {
  it('成功:BE 返回 code/name 选项,向调用方暴露去重后的 code 并缓存', async () => {
    getMock.mockResolvedValueOnce([
      { code: 'job-a', name: 'Job A' },
      { code: 'job-b', name: 'Job B' },
      { code: 'job-a', name: 'Duplicate A' },
      { code: null, name: 'Invalid' },
    ])
    const { load, options } = useJobCodeOptions()
    const codes = await load('t1')
    expect(codes).toEqual(['job-a', 'job-b'])
    expect(options.value).toEqual(['job-a', 'job-b'])
    // 第二次相同 tenant → 走缓存,不再请求 BE
    await load('t1')
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('失败降级:接口报错 → options 为空,不抛', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'))
    const { load, options } = useJobCodeOptions()
    const codes = await load('t1')
    expect(codes).toEqual([])
    expect(options.value).toEqual([])
  })

  it('并发切换租户时分别请求并只返回对应租户的编码', async () => {
    let resolveTenantA: ((value: unknown) => void) | undefined
    let resolveTenantB: ((value: unknown) => void) | undefined
    getMock
      .mockImplementationOnce(() => new Promise((resolve) => (resolveTenantA = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveTenantB = resolve)))
    const tenantA = useJobCodeOptions()
    const tenantB = useJobCodeOptions()
    const loadingA = tenantA.load('tenant-a')
    const loadingB = tenantB.load('tenant-b')

    resolveTenantB?.([{ code: 'B_JOB', name: 'Tenant B job' }])
    expect(await loadingB).toEqual(['B_JOB'])
    resolveTenantA?.([{ code: 'A_JOB', name: 'Tenant A job' }])
    expect(await loadingA).toEqual(['A_JOB'])
    expect(getMock).toHaveBeenCalledTimes(2)
  })
})
