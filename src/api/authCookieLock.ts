import axios, {
  AxiosError,
  CanceledError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'
import { currentAuthSession, isSharedAuthRevisionCurrent, staleAuthSessionError } from './authSession'
import { AUTH_COOKIE_LOCK_NAME } from '@/constants/authCookieLock'

const cookieWritingPaths = new Set([
  '/api/console/auth/login',
  '/api/console/auth/logout',
  '/api/console/auth/token',
])
const coordinatedAdapters = new WeakSet<AxiosAdapter>()
const DEFAULT_LOCK_WAIT_MS = 30_000

async function waitForAuthCookieLock(adapter: AxiosAdapter, config: InternalAxiosRequestConfig) {
  const controller = new AbortController()
  let timedOut = false
  const abortWaiting = () => controller.abort()
  if (config.signal?.aborted) throw new CanceledError(undefined, config)
  config.signal?.addEventListener?.('abort', abortWaiting, { once: true })
  const configuredTimeout = config.timeout ?? 0
  const waitMs = configuredTimeout > 0 ? configuredTimeout : DEFAULT_LOCK_WAIT_MS
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, waitMs)
  try {
    return await navigator.locks.request(
      AUTH_COOKIE_LOCK_NAME,
      { signal: controller.signal },
      () => {
        clearTimeout(timer)
        config.signal?.removeEventListener?.('abort', abortWaiting)
        const authSession = (config as InternalAxiosRequestConfig & { _authSession?: number })
          ._authSession
        if (!isSharedAuthRevisionCurrent() || (authSession != null && authSession !== currentAuthSession())) {
          throw staleAuthSessionError(config)
        }
        return adapter(config)
      },
    )
  } catch (error) {
    if (timedOut) throw new AxiosError('认证请求等待锁超时', 'ECONNABORTED', config)
    if (config.signal?.aborted) throw new CanceledError(undefined, config)
    throw error
  } finally {
    clearTimeout(timer)
    config.signal?.removeEventListener?.('abort', abortWaiting)
  }
}

/** 浏览器同源标签共享锁，令认证 Cookie 的写入按请求响应顺序完成。 */
export function coordinateAuthCookieRequest(config: InternalAxiosRequestConfig): void {
  if ((config.method ?? 'get').toLowerCase() !== 'post') return
  if (!cookieWritingPaths.has((config.url ?? '').split('?')[0] ?? '')) return
  if (typeof navigator === 'undefined' || !navigator.locks) return

  const adapter = axios.getAdapter(config.adapter)
  if (coordinatedAdapters.has(adapter)) return
  const coordinated: AxiosAdapter = (requestConfig) => waitForAuthCookieLock(adapter, requestConfig)
  coordinatedAdapters.add(coordinated)
  config.adapter = coordinated
}
