/**
 * interceptors + logger + logRedact 端到端集成测试:
 *   真起一个 axios 实例,走 applyApiInterceptors + MockAdapter,
 *   检查 logger buffer 里产出的 LogEntry 形状。
 *
 * 目的:证明"请求 URL / params / 请求体 / 响应体 / 错误体 / traceId"
 *       都按预期落在日志里,且敏感字段已脱敏。
 */
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyApiInterceptors } from './interceptors'
import { clearLogs, getLogs } from '@/utils/logger'

// localStorage + location + window stubs(node env 没有)
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})
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

beforeEach(() => {
  storage.clear()
  // D7 Stage B: token 不再前端持有；session flag 表达"已登录"
  storage.set('batch-console-session', '1')
  storage.set('batch-console-tenant-id', 'tenant-a')
  // telemetry 默认关闭，测试需显式启用否则 logger push() 早 return → 断言 getLogs() 全失败
  storage.set('batch-console-telemetry', 'on')
  clearLogs()
})

afterEach(() => {
  vi.clearAllMocks()
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
    expect(storage.get('batch-console-session')).toBeUndefined()
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
    expect(storage.get('batch-console-session')).toBe('1')
    expect((window as { location: { href: string } }).location.href).toBe('/')
  })

  it('/api/console/ops/triggers 401 → refresh 成功 → 用新 token retry 原请求成功', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    let bizCallCount = 0
    client.defaults.adapter = (async (cfg: { url?: string }) => {
      const url = cfg.url ?? ''
      if (url.includes('/api/console/auth/token')) {
        // refresh 成功:返回新 accessToken
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { code: 'SUCCESS', data: { accessToken: 'new-token' }, message: 'ok', meta: {} },
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

  it('/api/console/auth/login 401 → 保留 session 状态（提示密码错），不跳登录', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    client.defaults.adapter = make401Adapter('/api/console/auth/login') as never
    await expect(client.post('/api/console/auth/login', {})).rejects.toThrow()
    // D7 Stage B: 登录 401 是输错密码，不应清掉已有 session flag
    expect(storage.get('batch-console-session')).toBe('1')
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
