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
  it('成功:BE 返回 string[],options 被填充并缓存', async () => {
    getMock.mockResolvedValueOnce(['job-a', 'job-b', null, 'job-c'])
    const { load, options } = useJobCodeOptions()
    const codes = await load('t1')
    expect(codes).toEqual(['job-a', 'job-b', 'job-c'])
    expect(options.value).toEqual(['job-a', 'job-b', 'job-c'])
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
})
