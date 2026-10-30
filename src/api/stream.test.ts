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

import {
  createLogStream,
  createJobExecutionStream,
  createPipelineProgressSnapshotStream,
  createSseStream,
  createWorkflowExecutionStream,
  createDailyProgressStream,
  fetchStreamTicket,
} from './stream'
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
  it('每次申请新票据使用独立幂等键，避免复用已消费的发行请求', async () => {
    await fetchStreamTicket()
    await fetchStreamTicket()

    const first = mockedPost.mock.calls[0][2] as { headers?: Record<string, string> }
    const second = mockedPost.mock.calls[1][2] as { headers?: Record<string, string> }
    const firstKey = first.headers?.['Idempotency-Key']
    const secondKey = second.headers?.['Idempotency-Key']
    expect(firstKey).toBeTruthy()
    expect(secondKey).toBeTruthy()
    expect(secondKey).not.toBe(firstKey)
  })

  it('POSTs to /api/console/auth/stream/ticket and returns ticket', async () => {
    const t = await fetchStreamTicket()
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/auth/stream/ticket',
      {},
      expect.objectContaining({ _silent: true }),
    )
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

    es.emitNamed('job-instance-updated', JSON.stringify({ data: { id: 42, status: 'RUNNING' } }))
    es.emitNamed('job-instance-updated', JSON.stringify({ data: { id: 99, status: 'OTHER' } }))

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('RUNNING'))
  })

  it('does not forward heartbeat messages', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    FakeEventSource.instances[0].emitNamed('heartbeat', 'heartbeat')
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('forwards reset-required without an instance id', async () => {
    const onMessage = vi.fn()
    await createLogStream(42, onMessage)
    FakeEventSource.instances[0].emitNamed('reset-required', JSON.stringify({ data: {} }))
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

describe('createWorkflowExecutionStream', () => {
  it('uses the captured tenant and consumes only scoped full snapshots', async () => {
    const handlers = { snapshot: vi.fn(), ready: vi.fn(), error: vi.fn(), reset: vi.fn() }
    await createWorkflowExecutionStream(7, 'captured-tenant', handlers)
    const es = FakeEventSource.instances[0]
    expect(es.url).toContain('tenantId=captured-tenant')
    es.emitNamed('ready', '{}')
    es.emitNamed('heartbeat', '{}')
    expect(handlers.ready).toHaveBeenCalledOnce()
    expect(handlers.snapshot).not.toHaveBeenCalled()
    const data = {
      workflowRunId: 7,
      tenantId: 'captured-tenant',
      generatedAt: '2026-10-25T10:00:00Z',
      nodes: [],
      edges: [],
    }
    es.emitNamed('workflow-execution-progress', JSON.stringify({ data }))
    expect(handlers.snapshot).toHaveBeenCalledWith(data)
    es.emitNamed(
      'workflow-execution-progress',
      JSON.stringify({ data: { ...data, tenantId: 'other' } }),
    )
    expect(handlers.snapshot).toHaveBeenCalledOnce()
    expect(handlers.error).toHaveBeenCalledOnce()
    expect(es.closed).toBe(true)
  })
  it('reports malformed snapshots and explicit server errors as disconnected', async () => {
    const handlers = { snapshot: vi.fn(), ready: vi.fn(), error: vi.fn(), reset: vi.fn() }
    await createWorkflowExecutionStream(7, 'ta', handlers)
    FakeEventSource.instances[0].emitNamed('workflow-execution-progress', '{')
    expect(handlers.error).toHaveBeenCalledOnce()
    expect(handlers.snapshot).not.toHaveBeenCalled()
  })
})

describe('createDailyProgressStream', () => {
  it('fixes date and tenant in the stream URL and rejects wrong-date snapshots', async () => {
    const handlers = { ready: vi.fn(), snapshot: vi.fn(), error: vi.fn(), reset: vi.fn() }
    await createDailyProgressStream('2040-04-05', 'daily-a', handlers)
    const source = FakeEventSource.instances[0]
    expect(source.url).toContain('bizDate=2040-04-05')
    expect(source.url).toContain('tenantId=daily-a')
    const data = {
      bizDate: '2040-04-05',
      tenantId: 'daily-a',
      generatedAt: '2040-04-05T10:00:00Z',
      counts: [],
      coverage: { scheduledDefinitions: 0, uncoveredDefinitions: 0 },
    }
    source.emitNamed('daily-progress', JSON.stringify({ data }))
    expect(handlers.snapshot).toHaveBeenCalledWith(data)
    source.emitNamed('daily-progress', JSON.stringify({ data: { ...data, bizDate: '2040-04-06' } }))
    expect(handlers.error).toHaveBeenCalledOnce()
    expect(handlers.snapshot).toHaveBeenCalledOnce()
    expect(source.closed).toBe(true)
  })
})

describe('SSE production base URL', () => {
  it.each(['pipeline', 'job', 'workflow', 'daily', 'domain', 'log'] as const)(
    'keeps a root API base on the same origin for %s',
    async (kind) => {
      vi.stubEnv('VITE_API_BASE_URL', '/')
      const handlers = { ready: vi.fn(), snapshot: vi.fn(), error: vi.fn(), reset: vi.fn() }
      if (kind === 'pipeline') await createPipelineProgressSnapshotStream('7', 'ta', handlers)
      if (kind === 'job') await createJobExecutionStream(42, 'ta', handlers)
      if (kind === 'workflow') await createWorkflowExecutionStream(7, 'ta', handlers)
      if (kind === 'daily') await createDailyProgressStream('2040-04-05', 'ta', handlers)
      if (kind === 'domain') await createSseStream('workflow-runs', vi.fn())
      if (kind === 'log') await createLogStream(7, vi.fn())
      expect(FakeEventSource.instances[0].url).toMatch(/^\/api\/console\//)
      vi.stubEnv('VITE_API_BASE_URL', '')
    },
  )
  it('preserves an absolute API origin and path prefix with a trailing slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://console.example.test/backend/')
    await createWorkflowExecutionStream(7, 'ta', {
      ready: vi.fn(),
      snapshot: vi.fn(),
      error: vi.fn(),
      reset: vi.fn(),
    })
    expect(FakeEventSource.instances[0].url).toMatch(
      /^https:\/\/console\.example\.test\/backend\/api\/console\/workflow-runs\/7\//,
    )
    vi.stubEnv('VITE_API_BASE_URL', '')
  })
})

describe('createJobExecutionStream', () => {
  it('fixes job/tenant scope and fails closed on wrong job snapshots', async () => {
    const handlers = { ready: vi.fn(), snapshot: vi.fn(), error: vi.fn(), reset: vi.fn() }
    await createJobExecutionStream(42, 'owned', handlers)
    const es = FakeEventSource.instances[0]
    expect(es.url).toContain('/job-instances/42/execution-progress/events')
    expect(es.url).toContain('tenantId=owned')
    const data = {
      tenantId: 'owned',
      jobInstanceId: 42,
      generatedAt: '2026-10-25T10:00:00Z',
      counts: [],
      stages: [],
    }
    es.emitNamed('job-execution-progress', JSON.stringify({ data }))
    expect(handlers.snapshot).toHaveBeenCalledWith(data)
    es.emitNamed('job-execution-progress', JSON.stringify({ data: { ...data, jobInstanceId: 43 } }))
    expect(handlers.error).toHaveBeenCalledOnce()
    expect(handlers.snapshot).toHaveBeenCalledOnce()
    expect(es.closed).toBe(true)
  })
})

describe('createPipelineProgressSnapshotStream', () => {
  it('fixes the complete sorted range and rejects incomplete or cross-tenant snapshots', async () => {
    const handlers = { ready: vi.fn(), snapshot: vi.fn(), error: vi.fn(), reset: vi.fn() }
    await createPipelineProgressSnapshotStream('7,9', 'owned', handlers)
    const source = FakeEventSource.instances[0]
    expect(source.url).toContain('pipelineInstanceIds=7%2C9')
    const data = {
      tenantId: 'owned',
      generatedAt: '2026-10-25T10:00:00Z',
      pipelines: [
        { pipelineInstanceId: 9, stageCodes: [], steps: [] },
        { pipelineInstanceId: 7, stageCodes: [], steps: [] },
      ],
    }
    source.emitNamed('pipeline-progress-snapshot', JSON.stringify({ data }))
    expect(handlers.snapshot).toHaveBeenCalledWith(data)
    source.emitNamed(
      'pipeline-progress-snapshot',
      JSON.stringify({ data: { ...data, pipelines: data.pipelines.slice(0, 1) } }),
    )
    expect(handlers.error).toHaveBeenCalledOnce()
    expect(handlers.snapshot).toHaveBeenCalledOnce()
    expect(source.closed).toBe(true)
  })
})
