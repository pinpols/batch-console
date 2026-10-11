import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'

const elMessageErrorMock = vi.fn()
const elMessageSuccessMock = vi.fn()
vi.mock('element-plus', () => ({
  ElMessage: {
    error: (...args: unknown[]) => elMessageErrorMock(...args),
    success: (...args: unknown[]) => elMessageSuccessMock(...args),
  },
}))

import { showErrorToast } from './errorToast'

beforeEach(() => {
  elMessageErrorMock.mockReset()
  elMessageSuccessMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function findCopyButton(node: unknown): { props?: Record<string, unknown> } | undefined {
  if (!node || typeof node !== 'object') return undefined
  const vnode = node as { props?: Record<string, unknown>; children?: unknown }
  if (vnode.props?.class === 'error-toast__trace-copy') return vnode
  if (Array.isArray(vnode.children)) {
    return vnode.children.map(findCopyButton).find(Boolean)
  }
  return undefined
}

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

  it('复制 TraceId 成功时显示成功反馈', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    showErrorToast({ title: 'X', message: 'Y', traceId: 'trace-abc' })
    const button = findCopyButton(elMessageErrorMock.mock.calls[0][0].message)

    await (button?.props?.onClick as () => Promise<boolean>)()

    expect(elMessageSuccessMock).toHaveBeenCalledWith('TraceId copied')
  })

  it('剪贴板不可用且兼容复制失败时显示失败反馈', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const textarea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn() },
      execCommand: vi.fn(() => false),
    })
    showErrorToast({ title: 'X', message: 'Y', traceId: 'trace-abc' })
    const button = findCopyButton(elMessageErrorMock.mock.calls[0][0].message)

    await (button?.props?.onClick as () => Promise<boolean>)()

    expect(elMessageErrorMock).toHaveBeenLastCalledWith(
      'Copy failed. Check browser clipboard permissions.',
    )
  })
})
