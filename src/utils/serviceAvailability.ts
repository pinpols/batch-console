export interface ServiceErrorLike {
  code?: string
  message?: string
  response?: {
    status?: number
  }
}

const NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ERR_NETWORK', 'ETIMEDOUT'])

/**
 * 登录失败是否由控制台服务不可达或服务端故障导致。
 * 401/403 等业务与认证错误不属于服务降级，仍沿用原错误提示。
 */
export function isConsoleServiceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as ServiceErrorLike
  const status = candidate.response?.status
  if (typeof status === 'number') return status >= 500

  const code = candidate.code?.toUpperCase()
  if (code && NETWORK_ERROR_CODES.has(code)) return true

  const message = candidate.message ?? ''
  return /network error|failed to fetch|load failed|timeout|timed out/i.test(message)
}

/** 文档站是否可访问；跨域本地预览返回 opaque 也表示服务已响应。 */
export async function checkDocsAvailability(
  url: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  if (!url || typeof fetcher !== 'function') return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)
  try {
    const response = await fetcher(url, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'include',
      mode: 'no-cors',
      signal: controller.signal,
    })
    return response.ok || response.type === 'opaque'
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
