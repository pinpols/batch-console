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
  it('同一消费者切换租户后，迟到的旧请求不能覆盖新候选', async () => {
    let resolveOld!: (rows: unknown) => void
    getMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce([{ code: 'B_JOB' }])
    const { load, options, loading } = useJobCodeOptions()
    const pending = load('tenant-a')
    await load('tenant-b')
    resolveOld([{ code: 'A_JOB' }])
    await pending
    expect(options.value).toEqual(['B_JOB'])
    expect(loading.value).toBe(false)
  })

  it('清空候选后在途请求不能重新填入旧候选', async () => {
    let resolveOld!: (rows: unknown) => void
    getMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    const { load, clear, options, loading } = useJobCodeOptions()
    const pending = load('tenant-a')
    clear()
    resolveOld([{ code: 'A_JOB' }])
    await pending
    expect(options.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('共享同租户在途请求的两个消费者都更新自身候选', async () => {
    let resolveShared!: (rows: unknown) => void
    getMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveShared = resolve
      }),
    )
    const first = useJobCodeOptions()
    const second = useJobCodeOptions()
    const a = first.load('tenant-a')
    const b = second.load('tenant-a')
    resolveShared([{ code: 'A_JOB' }])
    await Promise.all([a, b])
    expect(first.options.value).toEqual(['A_JOB'])
    expect(second.options.value).toEqual(['A_JOB'])
    expect(getMock).toHaveBeenCalledTimes(1)
  })
})
