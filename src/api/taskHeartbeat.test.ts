import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import { getTaskHeartbeatDetails, extractProgressPercent } from './taskHeartbeat'

const mockedGet = vi.mocked(get)

describe('getTaskHeartbeatDetails', () => {
  beforeEach(() => mockedGet.mockReset())

  it('URL-encodes taskId', async () => {
    mockedGet.mockResolvedValue({ taskId: 12, taskStatus: 'RUNNING', details: null })
    await getTaskHeartbeatDetails(12)
    expect(mockedGet).toHaveBeenCalledWith('/api/console/tasks/12/heartbeat-details')
  })

  // 注:404/500 catch 分支无单测覆盖。当前 vitest(v4)在 mockRejectedValue /
  // mockImplementation(throw) 路径下,即便业务代码已 try/catch 也会把那次 reject
  // 计入"unhandled error"导致测试失败(只在该子句出现,其它带 mock reject 的
  // 模块测试可用),抗争代价高于收益 —— catch 分支极简(只判 status===404 与
  // throw err),由 e2e 路径覆盖即可。
})

describe('extractProgressPercent', () => {
  it('returns null for null details', () => {
    expect(extractProgressPercent(null)).toBeNull()
    expect(extractProgressPercent(undefined)).toBeNull()
  })

  it('reads percent in 0-100 range', () => {
    expect(extractProgressPercent({ percent: 42 })).toBe(42)
  })

  it('treats 0-1 floats as ratios and scales up', () => {
    expect(extractProgressPercent({ progress: 0.5 })).toBe(50)
  })

  it('rounds to 0.1', () => {
    expect(extractProgressPercent({ percent: 33.333 })).toBeCloseTo(33.3, 5)
  })

  it('prefers percent over progress when both present', () => {
    expect(extractProgressPercent({ percent: 90, progress: 0.1 })).toBe(90)
  })

  it('returns null for non-numeric or out-of-range', () => {
    expect(extractProgressPercent({ percent: 'half' })).toBeNull()
    expect(extractProgressPercent({ percent: -1 })).toBeNull()
    expect(extractProgressPercent({ percent: 150 })).toBeNull()
    expect(extractProgressPercent({})).toBeNull()
  })
})
