/**
 * stream.ts 走 EventSource 原生 API + 受保护的 ticket 接口。
 * 运行环境是 node,需要在测试里:
 *   - 用 vi.mock 打桩 `@/api/client`(post)和 `@/api/interceptors`(readStoredTenantId)
 *   - 手写极简 EventSource 替身(保存 URL 供断言,支持 dispatch/close)
 *   - 通过 import.meta.env 的 hook 模拟 base url(直接赋值 globalThis 不够,改用 stub)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type EventSourceInit = Record<string, unknown>

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  private listeners = new Map<string, Array<(e: MessageEvent) => void>>()

  constructor(url: string, _init?: EventSourceInit) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(name: string, fn: (e: MessageEvent) => void) {
    const arr = this.listeners.get(name) ?? []
    arr.push(fn)
    this.listeners.set(name, arr)
  }

  close() {
    this.closed = true
  }

  /** 测试辅助:触发 default onmessage */
  emit(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  /** 测试辅助:触发命名事件 */
  emitNamed(name: string, data: string) {
    const arr = this.listeners.get(name) ?? []
    for (const fn of arr) fn({ data } as MessageEvent)
  }

  /** 测试辅助:触发 onerror */
  fail() {
    this.onerror?.(new Event('error'))
  }
}

// ---- 模块桩 ----
vi.mock('@/api/client', () => ({
  post: vi.fn(),
}))
vi.mock('@/api/interceptors', () => ({
  readStoredTenantId: vi.fn(() => 'tenant-x'),
}))

// 全局替换 EventSource
vi.stubGlobal('EventSource', FakeEventSource)
// 把 VITE_API_BASE_URL 设空,路径拼接简单化
vi.stubEnv('VITE_API_BASE_URL', '')

import { createLogStream, createSseStream, fetchStreamTicket } from './stream'
import { post } from './client'

const mockedPost = vi.mocked(post)

beforeEach(() => {
  FakeEventSource.instances.length = 0
  mockedPost.mockReset()
  mockedPost.mockResolvedValue({ ticket: 'T-abc' } as unknown as never)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('fetchStreamTicket', () => {
  it('POSTs to /api/console/auth/stream/ticket and returns ticket', async () => {
    const t = await fetchStreamTicket()
    expect(mockedPost).toHaveBeenCalledWith('/api/console/auth/stream/ticket', {})
    expect(t).toBe('T-abc')
  })
})

describe('createSseStream', () => {
  it('constructs /stream/{domain}/events for streaming-prefixed domains', async () => {
    await createSseStream('job-instances', () => {})
    expect(FakeEventSource.instances).toHaveLength(1)
    const url = new URL(FakeEventSource.instances[0].url, 'http://localhost')
    expect(url.pathname).toBe('/api/console/stream/job-instances/events')
    expect(url.searchParams.get('tenantId')).toBe('tenant-x')
    expect(url.searchParams.get('ticket')).toBe('T-abc')
  })

  it('constructs /stream/pipeline-progress/events for pipeline progress', async () => {
    await createSseStream('pipeline-progress', () => {})
    const url = new URL(FakeEventSource.instances[0].url, 'http://localhost')
    expect(url.pathname).toBe('/api/console/stream/pipeline-progress/events')
  })

  it('constructs /{domain}/events for non-prefixed domains', async () => {
    await createSseStream('alerts', () => {})
    const url = new URL(FakeEventSource.instances[0].url, 'http://localhost')
    expect(url.pathname).toBe('/api/console/alerts/events')
  })

  it('forwards onmessage payload to callback', async () => {
    const onMessage = vi.fn()
    await createSseStream('workers', onMessage)
    FakeEventSource.instances[0].emit('hello')
    expect(onMessage).toHaveBeenCalledWith('hello')
  })

  it('forwards named business events but ignores heartbeat lifecycle events', async () => {
    const onMessage = vi.fn()
    await createSseStream('pipeline-progress', onMessage)
    FakeEventSource.instances[0].emitNamed(
      'pipeline-progress-dirty',
      JSON.stringify({ data: { pipelineInstanceId: 123 } }),
    )
    FakeEventSource.instances[0].emitNamed(
      'heartbeat',
      JSON.stringify({ data: { status: 'alive' } }),
    )
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('pipelineInstanceId'))
  })

  it('calls onError handler then closes on onerror', async () => {
    const onError = vi.fn()
    await createSseStream('workers', () => {}, onError)
    const es = FakeEventSource.instances[0]
    es.fail()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(es.closed).toBe(true)
  })

  it('throws when ticket fetch fails (caller handles)', async () => {
    mockedPost.mockRejectedValueOnce(new Error('401'))
    await expect(createSseStream('alerts', () => {})).rejects.toThrow('401')
  })
})

describe('createLogStream', () => {
  it('filters messages by instanceId via payload.data.id', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    const es = FakeEventSource.instances[0]

    es.emit(JSON.stringify({ data: { id: 42, status: 'RUNNING' } }))
    es.emit(JSON.stringify({ data: { id: 99, status: 'OTHER' } }))

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('RUNNING'))
  })

  it('forwards non-JSON messages without filtering', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    FakeEventSource.instances[0].emit('heartbeat')
    expect(onMessage).toHaveBeenCalledWith('heartbeat')
  })

  it('forwards messages without payload id (heartbeat/ready) without filtering', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    FakeEventSource.instances[0].emit(JSON.stringify({ data: {} }))
    expect(onMessage).toHaveBeenCalledTimes(1)
  })

  it('subscribes to named job-instance events', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    FakeEventSource.instances[0].emitNamed(
      'job-instance-updated',
      JSON.stringify({ data: { id: 42 } }),
    )
    expect(onMessage).toHaveBeenCalled()
  })
})
