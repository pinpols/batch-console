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
  storage.set('token', 'dev.test.token')
  storage.set('batch-console-tenant-id', 'tenant-a')
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

  it('/api/console/auth/me 401 → 清 token + 跳 /login', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    client.defaults.adapter = make401Adapter('/api/console/auth/me') as never
    await expect(client.get('/api/console/auth/me')).rejects.toThrow()
    expect(storage.get('token')).toBeUndefined()
    expect((window as { location: { href: string } }).location.href).toBe('/login')
  })

  it('/api/console/ops/triggers 401 → 静默 refresh,refresh 也 401 → 跳 /login', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    // 业务接口和 /auth/token 都 401:走"refresh 也失败 → 视为 session 真过期"分支
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
    expect(storage.get('token')).toBeUndefined()
    expect((window as { location: { href: string } }).location.href).toBe('/login')
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
    // refresh 后写入新 token
    expect(storage.get('token')).toBe('new-token')
    expect(bizCallCount).toBe(2)
    expect(resp.data).toEqual({ items: [] })
    // 没跳登录
    expect((window as { location: { href: string } }).location.href).toBe('/')
  })

  it('/api/console/auth/login 401 → 保留 token（提示密码错），不跳登录', async () => {
    ;(window as { location: { href: string } }).location.href = '/'
    const client = makeClient()
    client.defaults.adapter = make401Adapter('/api/console/auth/login') as never
    await expect(client.post('/api/console/auth/login', {})).rejects.toThrow()
    expect(storage.get('token')).toBe('dev.test.token')
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

  it('blob 请求也要带 Authorization 头(报表导出 / 模板下载场景必须)', async () => {
    localStorage.setItem('token', 'jwt-blob-test')
    const client = makeClient()
    let capturedAuth: string | undefined
    client.defaults.adapter = async (cfg) => {
      capturedAuth = cfg.headers?.Authorization as string | undefined
      return {
        data: new Blob(['x']),
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      } as never
    }

    await client.get('/api/console/reports/excel/audits', { responseType: 'blob' })

    expect(capturedAuth).toBe('Bearer jwt-blob-test')
    localStorage.removeItem('token')
  })
})

describe('FormData 请求:只记 key 不记 value', () => {
  it('文件上传的 request 字段脱敏为 keys=...', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', data: { uploadToken: 'ut-1' }, message: '' },
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
