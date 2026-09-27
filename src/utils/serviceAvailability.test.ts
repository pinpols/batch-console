import { describe, expect, it, vi } from 'vitest'
import { checkDocsAvailability, isConsoleServiceUnavailable } from './serviceAvailability'

describe('isConsoleServiceUnavailable', () => {
  it('识别网络错误、超时与服务端错误', () => {
    expect(isConsoleServiceUnavailable({ code: 'ERR_NETWORK' })).toBe(true)
    expect(isConsoleServiceUnavailable({ code: 'ECONNABORTED' })).toBe(true)
    expect(isConsoleServiceUnavailable({ response: { status: 503 } })).toBe(true)
  })

  it('不把认证与业务校验错误标记为服务不可用', () => {
    expect(isConsoleServiceUnavailable({ response: { status: 401 } })).toBe(false)
    expect(isConsoleServiceUnavailable({ response: { status: 409 } })).toBe(false)
  })
})

describe('checkDocsAvailability', () => {
  it('接受正常响应与跨域 opaque 响应', async () => {
    const okFetch = vi.fn().mockResolvedValue({ ok: true, type: 'basic' })
    const opaqueFetch = vi.fn().mockResolvedValue({ ok: false, type: 'opaque' })

    expect(await checkDocsAvailability('/docs/', okFetch as unknown as typeof fetch)).toBe(true)
    expect(
      await checkDocsAvailability(
        'http://localhost:5174/docs/',
        opaqueFetch as unknown as typeof fetch,
      ),
    ).toBe(true)
  })

  it('在错误响应或连接失败时返回 false', async () => {
    const missingFetch = vi.fn().mockResolvedValue({ ok: false, type: 'basic' })
    const failedFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await checkDocsAvailability('/docs/', missingFetch as unknown as typeof fetch)).toBe(
      false,
    )
    expect(await checkDocsAvailability('/docs/', failedFetch as unknown as typeof fetch)).toBe(
      false,
    )
  })
})
