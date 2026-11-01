/**
 * interceptors + logger + logRedact 端到端集成测试:
 *   真起一个 axios 实例,走 applyApiInterceptors + MockAdapter,
 *   检查 logger buffer 里产出的 LogEntry 形状。
 *
 * 目的:证明"请求 URL / params / 请求体 / 响应体 / 错误体 / traceId"
 *       都按预期落在日志里,且敏感字段已脱敏。
 */
import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyApiInterceptors } from './interceptors'
import { advanceAuthSession, initializeSharedAuthRevision } from './authSession'
import { clearLogs, getLogs } from '@/utils/logger'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { AUTH_COOKIE_LOCK_NAME } from '@/constants/authCookieLock'
import { stubLocalStorage } from '@/test-utils/localStorage'

// localStorage + location + window stubs(node env 没有)
const storage = stubLocalStorage()
// 默认覆盖无 Web Locks 的兼容路径；锁行为在专项用例中注入。
vi.stubGlobal('navigator', {})
vi.stubGlobal('location', { pathname: '/ops/summary', hash: '' })
if (typeof window === 'undefined') {
  vi.stubGlobal('window', { addEventListener: vi.fn(), location: { href: '/' } })
}

// element-plus ElMessage 桩(interceptors 里用到了 ElMessage.error)
vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}))

function makeClient() {
  const client = axios.create()
  applyApiInterceptors(client)
  return client
}

describe('登出请求的会话边界', () => {
  it('共享会话已变更时拒绝旧标签的业务写请求', async () => {
    initializeSharedAuthRevision()
    const client = makeClient()
    const adapter = vi.fn()
    client.defaults.adapter = adapter
    storage.set(STORAGE_KEYS.authSessionRevision, 'another-session')
    await expect(client.post('/api/console/jobs', {})).rejects.toMatchObject({ staleSession: true })
    expect(adapter).not.toHaveBeenCalled()
  })

  it('同源标签中的旧登出响应结束后才发送新登录请求', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    let lastLock: Promise<unknown> = Promise.resolve()
    const requestLock = vi.fn((_name: string, _options: unknown, operation: () => Promise<unknown>) => {
      const next = lastLock.then(operation, operation)
      lastLock = next.catch(() => undefined)
      return next
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: requestLock } },
    })
    let finishLogout!: () => void
    let logoutStarted!: () => void
    const started = new Promise<void>((resolve) => { logoutStarted = resolve })
    let loginStarted = false
    const oldTab = makeClient()
    const newTab = makeClient()
    oldTab.defaults.adapter = async (config) => {
      logoutStarted()
      await new Promise<void>((resolve) => { finishLogout = resolve })
      return { status: 204, statusText: 'No Content', data: null, headers: {}, config }
    }
    newTab.defaults.adapter = async (config) => {
      loginStarted = true
      return { status: 200, statusText: 'OK', data: {}, headers: {}, config }
    }
    try {
      const logout = oldTab.post('/api/console/auth/logout')
      await started
      const login = newTab.post('/api/console/auth/login', {})
      await Promise.resolve()
      await Promise.resolve()
      expect(loginStarted).toBe(false)
      finishLogout()
      await Promise.all([logout, login])
      expect(loginStarted).toBe(true)
      expect(requestLock).toHaveBeenCalledTimes(2)
    } finally {
      finishLogout?.()
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('认证锁失败时传播错误，不发送未协调的认证请求', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: vi.fn().mockRejectedValue(new Error('lock unavailable')) } },
    })
    const client = makeClient()
    const adapter = vi.fn()
    client.defaults.adapter = adapter
    try {
      await expect(client.post('/api/console/auth/logout')).rejects.toThrow('lock unavailable')
      expect(adapter).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('令牌换发参与认证锁，普通业务请求不占用认证锁', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const requestLock = vi.fn((_name: string, _options: unknown, operation: () => Promise<unknown>) => operation())
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request: requestLock } },
    })
    const client = makeClient()
    client.defaults.adapter = async (config) => ({
      status: 200, statusText: 'OK', data: {}, headers: {}, config,
    })
    try {
      await client.post('/api/console/auth/token')
      await client.post('/api/console/jobs', {})
      expect(requestLock).toHaveBeenCalledTimes(1)
      expect(requestLock).toHaveBeenCalledWith(AUTH_COOKIE_LOCK_NAME, { signal: expect.any(AbortSignal) }, expect.any(Function))
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('连续登出分别到达服务端，不复用同一自动幂等键', async () => {
    const client = makeClient()
    const keys: unknown[] = []
    client.defaults.adapter = async (config) => {
      keys.push(config.headers.get('Idempotency-Key'))
      return { data: null, status: 204, statusText: 'No Content', headers: {}, config }
    }

    await client.post('/api/console/auth/logout')
    await client.post('/api/console/auth/logout')

    expect(keys).toEqual([undefined, undefined])
  })

  it('显式键与业务写请求的自动键保持原有行为', async () => {
    const client = makeClient()
    const keys: unknown[] = []
    client.defaults.adapter = async (config) => {
      keys.push(config.headers.get('Idempotency-Key'))
      return { data: null, status: 204, statusText: 'No Content', headers: {}, config }
    }

    await client.post('/api/console/auth/logout', undefined, {
      headers: { 'Idempotency-Key': 'caller-key' },
    })
    await client.post('/api/console/jobs', { jobCode: 'example' })

    expect(keys[0]).toBe('caller-key')
    expect(keys[1]).toEqual(expect.any(String))
  })

  it('旧会话迟到的 401 不刷新新账号或展示旧错误', async () => {
    const client = makeClient()
    let release!: () => void
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const refreshed = vi.fn()
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/console/auth/token') {
        refreshed()
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }
      return new Promise((_resolve, reject) => {
        release = () =>
          reject(
            Object.assign(new Error('旧会话已失效'), {
              isAxiosError: true,
              response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
              config,
            }),
          )
        markStarted()
      })
    }) as never

    const pending = client.get('/api/console/config/change-logs').catch((error) => error)
    await started
    advanceAuthSession()
    release()
    await pending

    expect(refreshed).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(storage.get(STORAGE_KEYS.session)).toBe('1')
  })

  it('请求发起后立即切账号时，旧请求的 401 不刷新新会话', async () => {
    const client = makeClient()
    const refreshed = vi.fn()
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/console/auth/token') {
        refreshed()
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }
      throw Object.assign(new Error('旧会话已失效'), {
        isAxiosError: true,
        response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
        config,
      })
    }) as never

    const pending = client.get('/api/console/config/change-logs').catch((error) => error)
    advanceAuthSession()
    await pending

    expect(refreshed).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('旧会话请求收尾不会缩短新会话同一写请求的幂等保护', async () => {
    const client = makeClient()
    const keys: string[] = []
    const completions: Array<() => void> = []
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      keys.push(String(config.headers.get('Idempotency-Key')))
      return new Promise((resolve) => {
        completions.push(() =>
          resolve({ data: null, status: 204, statusText: 'No Content', headers: {}, config }),
        )
      })
    }) as never

    const first = client.post('/api/console/jobs', { jobCode: 'same-request' })
    await vi.waitFor(() => expect(keys).toHaveLength(1))
    advanceAuthSession()
    const second = client.post('/api/console/jobs', { jobCode: 'same-request' })
    await vi.waitFor(() => expect(keys).toHaveLength(2))
    completions[0]!()
    await first
    const third = client.post('/api/console/jobs', { jobCode: 'same-request' })
    await vi.waitFor(() => expect(keys).toHaveLength(3))

    expect(keys[0]).not.toBe(keys[1])
    expect(keys[2]).toBe(keys[1])
    completions[1]!()
    completions[2]!()
    await Promise.all([second, third])
  })

  it('登出后旧业务请求返回 401 时不再刷新会话', async () => {
    const client = makeClient()
    const refreshed = vi.fn()
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/console/auth/token') {
        refreshed()
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }
      throw Object.assign(new Error('已退出'), {
        isAxiosError: true,
        response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
        config,
      })
    }) as never
    storage.delete(STORAGE_KEYS.session)

    await expect(client.get('/api/console/config/change-logs')).rejects.toThrow('已退出')
    expect(refreshed).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('不同会话的刷新互不复用，旧刷新结束也不释放新会话的在途刷新', async () => {
    const client = makeClient()
    const releases: Array<() => void> = []
    const businessCalls: string[] = []
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/console/auth/token') {
        return new Promise((resolve) => {
          releases.push(() =>
            resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
          )
        })
      }
      businessCalls.push(String(config.url))
      throw Object.assign(new Error('需要认证'), {
        isAxiosError: true,
        response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
        config,
      })
    }) as never

    const first = client.get('/api/console/old').catch((error) => error)
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    advanceAuthSession()
    const second = client.get('/api/console/new-1').catch((error) => error)
    let newRefreshStarted = false
    try {
      await vi.waitFor(() => expect(releases).toHaveLength(2), { timeout: 600 })
      newRefreshStarted = true
    } catch {
      // 保证失败时也释放在途请求，再报告复用旧刷新的首个断言。
    }
    if (!newRefreshStarted) {
      releases[0]!()
      await Promise.all([first, second])
      expect(newRefreshStarted).toBe(true)
      return
    }

    releases[0]!()
    await first
    const third = client.get('/api/console/new-2').catch((error) => error)
    await vi.waitFor(() => expect(businessCalls).toHaveLength(3))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(releases).toHaveLength(2)
    releases[1]!()
    await Promise.all([second, third])
  })
})

beforeEach(() => {
  vi.resetAllMocks()
  storage.clear()
  initializeSharedAuthRevision()
  // D7 Stage B: token 不再前端持有；session flag 表达"已登录"
  storage.set(STORAGE_KEYS.session, '1')
  storage.set(STORAGE_KEYS.tenantId, 'tenant-a')
  // telemetry 默认关闭，测试需显式启用否则 logger push() 早 return → 断言 getLogs() 全失败
  storage.set(STORAGE_KEYS.telemetry, 'on')
  clearLogs()
})

describe('API 成功日志:URL / params / request / response 全部捕获', () => {
  it('记录完整字段,敏感字段脱敏', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', message: 'ok', data: { id: 42 }, meta: { traceId: 't1' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      }) as never

    await client.post(
      '/api/console/tenants',
      { name: 'T1', password: 'p@ss', token: 'should-redact' },
      { params: { dryRun: true } },
    )

    const entries = getLogs().filter((e) => e.type === 'api' || e.type === 'error')
    expect(entries).toHaveLength(1)
    const e = entries[0]
    expect(e.type).toBe('api')
    expect(e.level).toBe('info')
    expect(e.name).toBe('POST /api/console/tenants → 200')
    expect(e.page).toBe('/ops/summary')
    expect(e.props).toMatchObject({
      kind: 'api',
      method: 'POST',
      url: '/api/console/tenants',
      status: 200,
      params: { dryRun: true },
      request: { name: 'T1', password: '***', token: '***' },
      // 成功路径只记 envelope 的 code/message,不拖 data 和 meta
      response: { code: 'SUCCESS', message: 'ok' },
    })
    expect(e.props?.response).not.toHaveProperty('data')
    expect(e.props?.response).not.toHaveProperty('meta')
    expect(typeof e.props?.durationMs).toBe('number')
  })
})

describe('API 4xx 错误日志:trace / request / response / error 全部保留', () => {
  it('带 traceId、请求体、后端错误信息', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) => {
      throw Object.assign(new Error('Request failed with status code 400'), {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          data: {
            code: 'VALIDATION_FAILED',
            message: 'jobCode 必填',
            meta: { traceId: 'trace-xyz', requestId: 'req-42' },
          },
          config: cfg,
        },
        config: cfg,
        code: 'ERR_BAD_REQUEST',
      })
    }

    await expect(
      client.post('/api/console/jobs', { tenantId: 't1', password: 'secret' }),
    ).rejects.toThrow()

    const entries = getLogs().filter((e) => e.type === 'error')
    expect(entries).toHaveLength(1)
    const e = entries[0]
    expect(e.type).toBe('error') // API 失败 → type=error(后端 ERROR 级)
    expect(e.level).toBe('error')
    expect(e.name).toBe('POST /api/console/jobs → 400')
    expect(e.props).toMatchObject({
      kind: 'api',
      method: 'POST',
      url: '/api/console/jobs',
      status: 400,
      errorCode: 'ERR_BAD_REQUEST',
      traceId: 'trace-xyz',
      requestId: 'req-42',
      request: { tenantId: 't1', password: '***' },
      response: {
        code: 'VALIDATION_FAILED',
        message: 'jobCode 必填',
      },
    })
    expect(typeof e.props?.durationMs).toBe('number')
  })

  it('响应体没有 meta 时从响应头读取关联 ID', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) => {
      throw Object.assign(new Error('Request failed with status code 403'), {
        isAxiosError: true,
        response: {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'x-trace-id': 'trace-from-header', 'x-request-id': 'req-from-header' },
          data: { code: 'FORBIDDEN', message: '无权限' },
          config: cfg,
        },
        config: cfg,
        code: 'ERR_BAD_REQUEST',
      })
    }

    await expect(client.get('/api/console/admin-only')).rejects.toThrow()

    const entry = getLogs().find((item) => item.type === 'error')
    expect(entry?.props).toMatchObject({
      traceId: 'trace-from-header',
      requestId: 'req-from-header',
    })
  })
})

describe('409 幂等冲突区分', () => {
  function conflictAdapter(code: string) {
    return async (cfg: { url?: string }) => {
      throw Object.assign(new Error('Request failed with status code 409'), {
        isAxiosError: true,
        response: {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          data: {
            code,
            message: '业务状态冲突',
            ...(code === 'CONFLICT' ? { idempotentReplay: true } : {}),
          },
          config: cfg,
        },
        config: cfg,
      })
    }
  }

  it('自动注入幂等键的业务 STATE_CONFLICT 仍记录错误并提示用户', async () => {
    const client = makeClient()
    client.defaults.adapter = conflictAdapter('STATE_CONFLICT') as never

    await expect(
      client.post('/api/console/jobs/JOB-409/enable', { enabled: true }),
    ).rejects.toThrow()

    expect(getLogs().some((entry) => entry.type === 'error')).toBe(true)
    expect(ElMessage.error).toHaveBeenCalled()
  })

  it('仅对服务端明确标记的幂等重放静默', async () => {
    const client = makeClient()
    client.defaults.adapter = conflictAdapter('CONFLICT') as never

    await expect(
      client.post('/api/console/jobs/JOB-410/enable', { enabled: true }),
    ).rejects.toMatchObject({
      idempotentReplay: true,
      silenced: true,
    })

    expect(getLogs().some((entry) => entry.type === 'error')).toBe(false)
    expect(ElMessage.error).not.toHaveBeenCalled()
  })
})

describe('401 分级处理:业务 401 不登出', () => {
  function make401Adapter(url: string) {
    return async (cfg: { url?: string }) => {
      throw Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: { code: 'UNAUTHORIZED', message: 'x', meta: {} },
          config: cfg,
        },
        config: { ...cfg, url },
      })
    }
  }

  it('/api/console/auth/me 401 → 清 session flag + 跳 /login', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    client.defaults.adapter = make401Adapter('/api/console/auth/me') as never
    await expect(client.get('/api/console/auth/me')).rejects.toThrow()
    // D7 Stage B: 不再清 'token'（已不存在），改清 session flag
    expect(storage.get(STORAGE_KEYS.session)).toBeUndefined()
    expect((window as { location: { href: string } }).location.href).toBe('/login')
  })

  it('/api/console/ops/triggers 401 → 静默 refresh,refresh 也 401 → 保留 token,toast 提示(不踢出)', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    // 业务接口和 /auth/token 都 401:不再视为 session 真过期(可能只是 RBAC 不足),
    // 保留 token 让用户停在原页,由 toast 提示。session 真过期由 /auth/me 路径兜底。
    client.defaults.adapter = (async (cfg: { url?: string }) => {
      const url = cfg.url ?? ''
      if (url.includes('/api/console/auth/token') || url.includes('/api/console/ops/triggers')) {
        throw Object.assign(new Error('Request failed with status code 401'), {
          isAxiosError: true,
          response: {
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            data: { code: 'UNAUTHORIZED', message: 'x', meta: {} },
            config: cfg,
          },
          config: cfg,
        })
      }
      throw new Error('Unexpected URL ' + url)
    }) as never
    await expect(client.get('/api/console/ops/triggers')).rejects.toThrow()
    // D7 Stage B: 业务 401 + refresh 也 401 不应清登录态（可能是单接口 RBAC 不足）
    expect(storage.get(STORAGE_KEYS.session)).toBe('1')
    expect((window as { location: { href: string } }).location.href).toBe('/')
  })

  it('/api/console/ops/triggers 401 → 无 token 响应体的 refresh 成功后重试', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    let bizCallCount = 0
    client.defaults.adapter = (async (cfg: { url?: string }) => {
      const url = cfg.url ?? ''
      if (url.includes('/api/console/auth/token')) {
        // 服务端将新 token 写入 HttpOnly Cookie，响应体不返回 token。
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { code: 'SUCCESS', data: { username: 'admin', tokenType: 'Bearer' }, message: 'ok', meta: {} },
          config: cfg,
        }
      }
      if (url.includes('/api/console/ops/triggers')) {
        bizCallCount++
        if (bizCallCount === 1) {
          // 第一次 401 触发 refresh
          throw Object.assign(new Error('Request failed with status code 401'), {
            isAxiosError: true,
            response: {
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              data: { code: 'UNAUTHORIZED', message: 'x', meta: {} },
              config: cfg,
            },
            config: cfg,
          })
        }
        // refresh 后 retry 成功
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { code: 'SUCCESS', data: { items: [] }, message: 'ok', meta: {} },
          config: cfg,
        }
      }
      throw new Error('Unexpected URL ' + url)
    }) as never
    const resp = await client.get('/api/console/ops/triggers')
    // D7 Stage B: token 走 HttpOnly cookie，不再写 localStorage；仅断言 retry 通过
    expect(bizCallCount).toBe(2)
    expect(resp.data).toEqual({ items: [] })
    // 没跳登录
    expect((window as { location: { href: string } }).location.href).toBe('/')
  })

  it('refresh 返回 HTTP 200 但业务失败时不重试原请求', async () => {
    const client = makeClient()
    let businessCalls = 0
    client.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/console/auth/token') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { code: 'UNAUTHORIZED', message: 'refresh rejected', data: null },
          config,
        }
      }
      businessCalls++
      throw Object.assign(new Error('unauthorized'), {
        isAxiosError: true,
        response: { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config },
        config,
      })
    }) as never

    await expect(client.get('/api/console/ops/triggers')).rejects.toThrow('unauthorized')
    expect(businessCalls).toBe(1)
  })

  it('/api/console/auth/login 401 → 保留 session 状态（提示密码错），不跳登录', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    client.defaults.adapter = make401Adapter('/api/console/auth/login') as never
    await expect(client.post('/api/console/auth/login', {})).rejects.toThrow()
    // D7 Stage B: 登录 401 是输错密码，不应清掉已有 session flag
    expect(storage.get(STORAGE_KEYS.session)).toBe('1')
    expect((window as { location: { href: string } }).location.href).toBe('/')
  })
})

describe('网络错误:无响应但有 errorCode', () => {
  it('记录 ERR_NETWORK / 无 response', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) => {
      throw Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        config: cfg,
      })
    }

    await expect(client.get('/api/console/workers')).rejects.toThrow()

    const e = getLogs().find((x) => x.type === 'error')
    expect(e).toBeDefined()
    expect(e!.props?.errorCode).toBe('ERR_NETWORK')
    expect(e!.props?.status).toBeUndefined()
    expect(e!.props?.response).toBeUndefined()
  })
})

describe('Blob 响应:不读 body', () => {
  it('xlsx 导出不把响应内容塞进日志', async () => {
    const client = makeClient()
    const fakeBlob = new Blob(['fake-xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    client.defaults.adapter = async (cfg) =>
      ({
        data: fakeBlob,
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': '1024' },
        config: cfg,
      }) as never

    await client.get('/api/console/reports/excel/audits', { responseType: 'blob' })

    const e = getLogs().find((x) => x.type === 'api')
    expect(e).toBeDefined()
    expect(String(e!.props?.response)).toMatch(/Blob responseType/)
  })

  it('blob 请求不注入 Authorization 头 (D7 Stage B: cookie 已自动带)', async () => {
    const client = makeClient()
    let capturedAuth: string | undefined
    let capturedTenant: string | undefined
    client.defaults.adapter = async (cfg) => {
      capturedAuth = cfg.headers?.Authorization as string | undefined
      capturedTenant = cfg.headers?.['X-Tenant-Id'] as string | undefined
      return {
        data: new Blob(['x']),
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      } as never
    }

    await client.get('/api/console/reports/excel/audits', { responseType: 'blob' })

    // Authorization 不再注入；后端靠 HttpOnly cookie 鉴权
    expect(capturedAuth).toBeUndefined()
    // 但 X-Tenant-Id 仍然需要 (cookie 不带租户)
    expect(capturedTenant).toBe('tenant-a')
  })
})

describe('FormData 请求:只记 key 不记 value', () => {
  it('文件上传的 request 字段脱敏为 keys=...', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: {
          code: 'SUCCESS',
          data: {
            uploadToken: 'ut-1',
            fileName: 'a.xlsx',
            resourceQueueRows: 1,
            businessCalendarRows: 1,
            batchWindowRows: 1,
            jobRows: 1,
            fileChannelRows: 1,
            fileTemplateRows: 1,
            pipelineRows: 1,
            pipelineStepRows: 1,
            workflowDefinitionRows: 1,
            workflowNodeRows: 1,
            workflowEdgeRows: 1,
          },
          message: '',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      }) as never

    const fd = new FormData()
    fd.append('file', new Blob(['x']), 'a.xlsx')
    fd.append('reason', 'test-upload')
    await client.post('/api/console/config/tenant-package/excel/upload', fd)

    const e = getLogs().find((x) => x.type === 'api' && String(x.name).includes('upload'))
    expect(e).toBeDefined()
    expect(String(e!.props?.request)).toMatch(/FormData keys=file,reason/)
  })
})

describe('日志不含原始 token(ring buffer 所有 entry)', () => {
  it('任何 LogEntry.props 的 JSON 里都不应出现敏感原文', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', data: { refreshToken: 'rt-should-not-appear' }, message: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      }) as never

    await client.post('/api/console/auth/exchange', {
      password: 'SUPERSECRET',
      apiKey: 'K-123',
    })

    const dump = JSON.stringify(getLogs())
    expect(dump).not.toContain('SUPERSECRET')
    expect(dump).not.toContain('K-123')
    expect(dump).not.toContain('rt-should-not-appear')
  })
})
