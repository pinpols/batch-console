import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
vi.mock('@/api/client', () => ({
  get: (...args: unknown[]) => getMock(...args),
}))

import {
  getMetaEnums,
  getMetaQueues,
  getMetaCalendars,
  getMetaWorkerGroups,
  getMetaBizTypes,
  getMetaWindows,
} from './meta'

beforeEach(() => {
  getMock.mockReset()
})

/**
 * 这组测试锁定 axios 拦截器(`interceptors.ts:213`)的契约:
 * `get<T>()` 返回的就是 envelope 的 `data` 字段内容(已解包),不是 `{data: ...}` 外壳。
 *
 * 之前 meta.ts 6 个函数都把 `get()` 当 `RawCommonResponse` 又读了一次 `.data`,
 * 等于读不存在的字段,返回全空 → 全站下拉变空。
 */
describe('getMetaEnums', () => {
  it('直接消费 get() 返回的解包后 payload(分组 → MetaOption[])', async () => {
    getMock.mockResolvedValue({
      triggerType: [
        { code: 'CRON', label: '定时' },
        { code: 'MANUAL', label: '手动' },
      ],
      severity: [{ code: 'CRITICAL', label: '严重' }],
    })
    const enums = await getMetaEnums()
    expect(getMock).toHaveBeenCalledWith('/api/console/meta/enums')
    expect(enums.triggerType).toEqual([
      { value: 'CRON', label: '定时' },
      { value: 'MANUAL', label: '手动' },
    ])
    expect(enums.severity).toEqual([{ value: 'CRITICAL', label: '严重' }])
  })

  it('label 缺失时回退到 value', async () => {
    getMock.mockResolvedValue({ status: [{ code: 'ACTIVE' }] })
    const enums = await getMetaEnums()
    expect(enums.status).toEqual([{ value: 'ACTIVE', label: 'ACTIVE' }])
  })

  it('过滤掉 value 缺失/非字符串的脏数据', async () => {
    getMock.mockResolvedValue({
      mixed: [{ code: 'OK', label: 'OK' }, { label: '无 code' }, { code: 123, label: '非字符串' }],
    })
    const enums = await getMetaEnums()
    expect(enums.mixed).toEqual([{ value: 'OK', label: 'OK' }])
  })

  it('payload 不是对象时返回 {}(防御后端异常)', async () => {
    getMock.mockResolvedValue(null)
    expect(await getMetaEnums()).toEqual({})
  })
})

describe('getMetaQueues / Calendars / Windows / WorkerGroups / BizTypes', () => {
  it.each([
    ['/api/console/meta/queues', getMetaQueues],
    ['/api/console/meta/calendars', getMetaCalendars],
    ['/api/console/meta/windows', getMetaWindows],
    ['/api/console/meta/worker-groups', getMetaWorkerGroups],
    ['/api/console/meta/biz-types', getMetaBizTypes],
  ])('%s 直接消费 array payload', async (url, fn) => {
    getMock.mockResolvedValue([
      { code: 'A', label: 'Alpha' },
      { value: 'B', label: 'Bravo' },
    ])
    const opts = await fn('tenant-1')
    expect(getMock).toHaveBeenCalledWith(url, { tenantId: 'tenant-1' })
    expect(opts).toEqual([
      { value: 'A', label: 'Alpha' },
      { value: 'B', label: 'Bravo' },
    ])
  })

  it('payload 不是数组时返回 [](防御 null/object 异常返回)', async () => {
    getMock.mockResolvedValue(null)
    expect(await getMetaQueues('t')).toEqual([])
    getMock.mockResolvedValue({ data: [] })
    expect(await getMetaCalendars('t')).toEqual([])
  })
})
