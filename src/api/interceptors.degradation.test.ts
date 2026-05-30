// @vitest-environment jsdom
/**
 * interceptors:X-Degraded-Source 拦截单测
 *
 * BE Resilience4j 触发降级时,响应头 X-Degraded-Source: <src> 透传降级源。
 * Interceptor 收到后调 app store 的 addDegradationSource(),
 * DegradationBanner 顶部展示。本文件验证 header 到 store 的接线。
 */
import axios from 'axios'
import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyApiInterceptors } from './interceptors'
import { useAppStore } from '@/stores/app'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})
vi.stubGlobal('location', { pathname: '/ops/summary', hash: '' })
if (typeof window === 'undefined') {
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    location: { href: '/' },
    matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
}
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}))

function makeClient() {
  const client = axios.create()
  applyApiInterceptors(client)
  return client
}

beforeEach(() => {
  storage.clear()
  storage.set('batch-console-session', '1')
  storage.set('batch-console-tenant-id', 'tenant-a')
  storage.set('batch-console-telemetry', 'on')
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('X-Degraded-Source header', () => {
  it('单个降级源 → activeDegradationSources 含该源 + isDegraded true', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', message: 'ok', data: [], meta: { traceId: 't1' } },
        status: 200,
        statusText: 'OK',
        headers: { 'x-degraded-source': 'trigger' },
        config: cfg,
      }) as never

    await client.get('/api/console/ops/triggers')
    await new Promise((r) => setTimeout(r, 0)) // 等动态 import 完成

    const app = useAppStore()
    expect(app.activeDegradationSources).toEqual(['trigger'])
    expect(app.isDegraded).toBe(true)
  })

  it('逗号分隔多源 → 全部入库', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', message: 'ok', data: null, meta: {} },
        status: 200,
        statusText: 'OK',
        headers: { 'x-degraded-source': 'trigger, push' },
        config: cfg,
      }) as never

    await client.get('/api/console/dashboard/sla')
    await new Promise((r) => setTimeout(r, 0))

    const app = useAppStore()
    expect(new Set(app.activeDegradationSources)).toEqual(new Set(['trigger', 'push']))
  })

  it('无 header → 不变更 store', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', message: 'ok', data: {}, meta: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      }) as never

    await client.get('/api/console/ops/triggers')
    await new Promise((r) => setTimeout(r, 0))

    const app = useAppStore()
    expect(app.isDegraded).toBe(false)
    expect(app.activeDegradationSources).toEqual([])
  })

  it('空字符串 header 被忽略', async () => {
    const client = makeClient()
    client.defaults.adapter = async (cfg) =>
      ({
        data: { code: 'SUCCESS', message: 'ok', data: {}, meta: {} },
        status: 200,
        statusText: 'OK',
        headers: { 'x-degraded-source': '   ' },
        config: cfg,
      }) as never

    await client.get('/api/console/ops/triggers')
    await new Promise((r) => setTimeout(r, 0))

    const app = useAppStore()
    expect(app.isDegraded).toBe(false)
  })

  it('pruneDegradationSources 清掉 TTL 过期源(60s+)', () => {
    const app = useAppStore()
    app.addDegradationSource('trigger')
    expect(app.isDegraded).toBe(true)

    // 跨越 60s TTL
    app.pruneDegradationSources(Date.now() + 61_000)
    expect(app.isDegraded).toBe(false)
    expect(app.activeDegradationSources).toEqual([])
  })

  it('addDegradationSource 同源重复 → 刷新时间戳,只保留一条', () => {
    const app = useAppStore()
    app.addDegradationSource('trigger')
    app.addDegradationSource('trigger')
    expect(app.activeDegradationSources).toEqual(['trigger'])
  })
})
