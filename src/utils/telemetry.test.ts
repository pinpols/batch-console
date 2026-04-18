import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---- browser globals needed by telemetry.ts ----
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
})
vi.stubGlobal('location', { pathname: '/test', hash: '' })
vi.stubGlobal('navigator', { userAgent: 'vitest' })
vi.stubGlobal('screen', { width: 1280, height: 800 })
vi.stubGlobal('document', { visibilityState: 'visible' })
if (typeof window === 'undefined') {
  vi.stubGlobal('window', { addEventListener: vi.fn() })
}
const fetchMock = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', fetchMock)

// Fresh module instance per test block (resets module-level state: enabled, queue, endpoint)
async function freshTelemetry() {
  vi.resetModules()
  return import('./telemetry')
}

describe('track — disabled guard', () => {
  it('does not queue events before initTelemetry is called', async () => {
    const { track, flushTelemetry } = await freshTelemetry()
    storage.set('token', 'tok')
    fetchMock.mockClear()

    track('click', 'btn')
    flushTelemetry()

    expect(fetchMock).not.toHaveBeenCalled()
    storage.delete('token')
  })

  it('does not queue events when initTelemetry called with enabled:false', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: false })
    storage.set('token', 'tok')
    fetchMock.mockClear()

    track('click', 'btn')
    flushTelemetry()

    expect(fetchMock).not.toHaveBeenCalled()
    storage.delete('token')
  })
})

describe('track — enabled', () => {
  beforeEach(() => {
    storage.clear()
    fetchMock.mockClear()
  })

  it('queues events after initTelemetry with enabled:true', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    track('click', 'my-btn', { section: 'header' })
    flushTelemetry()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].type).toBe('click')
    expect(body.events[0].name).toBe('my-btn')
    expect(body.events[0].props?.section).toBe('header')
  })

  it('omits props key when props is undefined', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    track('page_view', 'home')
    flushTelemetry()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.events[0]).not.toHaveProperty('props')
  })

  it('includes page path in each event', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    track('click', 'x')
    flushTelemetry()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.events[0].page).toBe('/test')
  })
})

describe('flushTelemetry — token guard', () => {
  beforeEach(() => {
    storage.clear()
    fetchMock.mockClear()
  })

  it('does not call fetch when token is absent', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    // no token set
    track('click', 'btn')
    flushTelemetry()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('drains the queue after flush so a second flush is a no-op', async () => {
    const { track, flushTelemetry, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    track('click', 'btn')
    flushTelemetry()
    fetchMock.mockClear()

    flushTelemetry() // queue is empty now
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('convenience helpers', () => {
  beforeEach(() => {
    storage.clear()
    fetchMock.mockClear()
  })

  it('trackPageView, trackClick, trackApi, trackApiError, trackJsError all queue correct types', async () => {
    const {
      trackPageView,
      trackClick,
      trackApi,
      trackApiError,
      trackJsError,
      flushTelemetry,
      initTelemetry,
    } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    trackPageView('home')
    trackClick('btn')
    trackApi('GET /items')
    trackApiError('POST /fail')
    trackJsError('TypeError')
    flushTelemetry()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    const types = body.events.map((e: { type: string }) => e.type)
    expect(types).toEqual(['page_view', 'click', 'api_call', 'api_error', 'js_error'])
  })
})

describe('MAX_QUEUE_SIZE auto-flush', () => {
  beforeEach(() => {
    storage.clear()
    fetchMock.mockClear()
  })

  it('auto-flushes when queue reaches 100 items (requires token)', async () => {
    const { track, initTelemetry } = await freshTelemetry()
    initTelemetry({ endpoint: '/api/telemetry', enabled: true })
    storage.set('token', 'tok')

    for (let i = 0; i < 100; i++) {
      track('click', `btn-${i}`)
    }

    // The 100th push triggers flushTelemetry internally
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.events.length).toBeLessThanOrEqual(50) // MAX_BATCH_SIZE
  })
})
