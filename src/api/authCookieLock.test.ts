import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { coordinateAuthCookieRequest } from './authCookieLock'
import { advanceAuthSession, currentAuthSession } from './authSession'

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (_name: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(options.signal.reason), {
              once: true,
            })
          }),
      },
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})

function queuedRequest(signal?: AbortSignal) {
  const adapter = vi.fn()
  const config = {
    method: 'post',
    url: '/api/console/auth/login',
    headers: new AxiosHeaders(),
    adapter,
    timeout: 25,
    signal,
  } as InternalAxiosRequestConfig
  coordinateAuthCookieRequest(config)
  const result = axios
    .getAdapter(config.adapter)(config)
    .catch((error: unknown) => error)
  return { adapter, result }
}

it('等待认证锁超时后失败，不发送未协调请求', async () => {
  const { adapter, result } = queuedRequest()
  await vi.advanceTimersByTimeAsync(25)
  expect(await result).toMatchObject({ code: 'ECONNABORTED' })
  expect(adapter).not.toHaveBeenCalled()
})

it('取消排队请求时退出等待，不发送未协调请求', async () => {
  const controller = new AbortController()
  const { adapter, result } = queuedRequest(controller.signal)
  controller.abort()
  expect(await result).toMatchObject({ code: 'ERR_CANCELED' })
  expect(adapter).not.toHaveBeenCalled()
})

it('取得锁后不因排队时限中断正在执行的请求', async () => {
  let lockSignal!: AbortSignal
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (
          _name: string,
          options: { signal: AbortSignal },
          operation: () => Promise<unknown>,
        ) => {
          lockSignal = options.signal
          return operation()
        },
      },
    },
  })
  let finish!: () => void
  const config = {
    method: 'post',
    url: '/api/console/auth/logout',
    headers: new AxiosHeaders(),
    timeout: 25,
    adapter: (requestConfig: InternalAxiosRequestConfig) =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            status: 204,
            statusText: 'No Content',
            headers: {},
            data: null,
            config: requestConfig,
          })
      }),
  } as InternalAxiosRequestConfig
  coordinateAuthCookieRequest(config)
  const result = axios.getAdapter(config.adapter)(config)
  await vi.advanceTimersByTimeAsync(25)
  expect(lockSignal.aborted).toBe(false)
  finish()
  expect((await result).status).toBe(204)
})

it('排队期间本页切换会话，取得锁后不发送旧认证请求', async () => {
  let grant!: () => void
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (_name: string, _options: unknown, operation: () => Promise<unknown>) =>
          new Promise((resolve, reject) => {
            grant = () => {
              void Promise.resolve().then(operation).then(resolve, reject)
            }
          }),
      },
    },
  })
  const adapter = vi.fn().mockResolvedValue({ status: 204 })
  const config = {
    method: 'post',
    url: '/api/console/auth/logout',
    headers: new AxiosHeaders(),
    timeout: 25,
    adapter,
    _authSession: currentAuthSession(),
  } as InternalAxiosRequestConfig
  coordinateAuthCookieRequest(config)
  const result = axios
    .getAdapter(config.adapter)(config)
    .catch((error: unknown) => error)
  advanceAuthSession()
  grant()
  expect(await result).toMatchObject({ staleSession: true })
  expect(adapter).not.toHaveBeenCalled()
})
