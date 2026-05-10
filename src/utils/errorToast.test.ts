import { describe, it, expect, vi, beforeEach } from 'vitest'

const elMessageErrorMock = vi.fn()
vi.mock('element-plus', () => ({
  ElMessage: {
    error: (...args: unknown[]) => elMessageErrorMock(...args),
  },
}))

import { showErrorToast } from './errorToast'

beforeEach(() => {
  elMessageErrorMock.mockReset()
})

describe('showErrorToast', () => {
  it('调 ElMessage.error 一次', () => {
    showErrorToast({ title: '请求失败', message: 'tenantId 必填' })
    expect(elMessageErrorMock).toHaveBeenCalledTimes(1)
  })

  it('无 traceId:duration 默认 4000ms,showClose=true', () => {
    showErrorToast({ title: 'X', message: 'Y' })
    const arg = elMessageErrorMock.mock.calls[0][0]
    expect(arg).toMatchObject({ duration: 4000, showClose: true })
  })

  it('有 traceId:duration 拉长到 6500ms(给用户复制时间)', () => {
    showErrorToast({ title: 'X', message: 'Y', traceId: 'trace-abc' })
    const arg = elMessageErrorMock.mock.calls[0][0]
    expect(arg.duration).toBe(6500)
  })

  it('显式 duration 覆盖默认', () => {
    showErrorToast({ title: 'X', message: 'Y', duration: 1000 })
    expect(elMessageErrorMock.mock.calls[0][0].duration).toBe(1000)
  })

  it('空 traceId 视为无(空白被 trim)', () => {
    showErrorToast({ title: 'X', message: 'Y', traceId: '   ' })
    expect(elMessageErrorMock.mock.calls[0][0].duration).toBe(4000)
  })
})
