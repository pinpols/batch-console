import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logRoute,
  logClick,
  logApi,
  logError,
  getLogs,
  queryLogs,
  clearLogs,
  flushLogs,
  exportLogsAsJson,
  initLogger,
} from './logger'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})
vi.stubGlobal('location', { pathname: '/test', hash: '' })

// initLogger calls window.addEventListener — stub it in node env
if (typeof window === 'undefined') {
  vi.stubGlobal('window', { addEventListener: vi.fn() })
} else if (!window.addEventListener) {
  window.addEventListener = vi.fn() as unknown as typeof window.addEventListener
}

beforeEach(() => {
  clearLogs()
  storage.clear()
})

describe('logger core — schema 对齐后端 OpenAPI', () => {
  it('logRoute writes type=route with page', () => {
    logRoute('页面切换:首页', { path: '/ops/summary' })
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].type).toBe('route')
    expect(logs[0].level).toBe('info')
    expect(logs[0].name).toBe('页面切换:首页')
    expect(logs[0].page).toBe('/test')
    expect(logs[0].props).toEqual({ path: '/ops/summary' })
  })

  it('logClick writes type=click', () => {
    logClick('触发 Job')
    expect(getLogs()[0].type).toBe('click')
  })

  it('logApi(info) writes type=api; logApi(error) writes type=error for backend ERROR level', () => {
    logApi('GET /api/test → 200', 'info')
    logApi('POST /api/fail → 500', 'error', { status: 500 })
    const logs = getLogs()
    expect(logs[0].type).toBe('api')
    expect(logs[0].level).toBe('info')
    expect(logs[1].type).toBe('error') // API 错误上报为 error type,后端直接打 ERROR 级
    expect(logs[1].level).toBe('error')
    expect(logs[1].props?.status).toBe(500)
  })

  it('logError writes type=error', () => {
    logError('运行时异常', { message: 'TypeError' })
    const e = getLogs()[0]
    expect(e.type).toBe('error')
    expect(e.level).toBe('error')
    expect(e.props?.message).toBe('TypeError')
  })

  it('entries have auto-incrementing ids and ISO timestamps', () => {
    logClick('a')
    logClick('b')
    const logs = getLogs()
    expect(logs[1].id).toBeGreaterThan(logs[0].id)
    expect(logs[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('omits props key when undefined or empty object', () => {
    logClick('simple')
    logClick('still simple', {})
    const logs = getLogs()
    expect(logs[0]).not.toHaveProperty('props')
    expect(logs[1]).not.toHaveProperty('props')
  })
})

describe('ignored errors — benign noise filtered out', () => {
  it('drops ResizeObserver loop errors', () => {
    logError('ResizeObserver loop completed with undelivered notifications.')
    logError('ResizeObserver loop limit exceeded')
    expect(getLogs()).toHaveLength(0)
  })

  it('drops cross-origin "Script error." messages', () => {
    logError('Script error.')
    expect(getLogs()).toHaveLength(0)
  })

  it('drops "Non-Error promise rejection captured"', () => {
    logError('Non-Error promise rejection captured with value: foo')
    expect(getLogs()).toHaveLength(0)
  })

  it('keeps legitimate error messages', () => {
    logError('TypeError: Cannot read property x of undefined')
    expect(getLogs()).toHaveLength(1)
  })
})

describe('ring buffer', () => {
  it('caps at MAX_ENTRIES (500) and drops oldest', () => {
    for (let i = 0; i < 520; i++) logClick(`click-${i}`)
    const logs = getLogs()
    expect(logs.length).toBeLessThanOrEqual(500)
    expect(logs[0].name).toBe('click-20')
  })
})

describe('queryLogs', () => {
  beforeEach(() => {
    logRoute('page A')
    logClick('button X')
    logApi('GET /api → 200', 'info', { url: '/api' })
    logError('boom')
  })

  it('filters by type', () => {
    expect(queryLogs({ type: 'click' })).toHaveLength(1)
    expect(queryLogs({ type: 'api' })).toHaveLength(1)
    expect(queryLogs({ type: 'error' })).toHaveLength(1)
  })

  it('filters by level', () => {
    expect(queryLogs({ level: 'error' })).toHaveLength(1)
    expect(queryLogs({ level: 'info' })).toHaveLength(3)
  })

  it('filters by keyword in name', () => {
    expect(queryLogs({ keyword: 'button' })).toHaveLength(1)
  })

  it('filters by keyword in props', () => {
    expect(queryLogs({ keyword: '/api' })).toHaveLength(1)
  })

  it('returns all when no filter', () => {
    expect(queryLogs()).toHaveLength(4)
  })
})

describe('clearLogs', () => {
  it('empties buffer and localStorage', () => {
    logClick('a')
    flushLogs()
    expect(localStorage.getItem('batch-console-oplog')).not.toBeNull()
    clearLogs()
    expect(getLogs()).toHaveLength(0)
    expect(localStorage.getItem('batch-console-oplog')).toBeNull()
  })
})

describe('persistence', () => {
  it('flushLogs writes to localStorage as {seq, entries}', () => {
    logClick('persist me')
    logRoute('page B')
    flushLogs()

    const raw = localStorage.getItem('batch-console-oplog')
    expect(raw).not.toBeNull()
    const data = JSON.parse(raw!) as { seq: number; entries: { name: string }[] }
    expect(data.entries).toHaveLength(2)
    expect(data.entries[0].name).toBe('persist me')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('batch-console-oplog', '{broken json!!!}')
    expect(() => initLogger()).not.toThrow()
  })
})

describe('exportLogsAsJson', () => {
  it('returns valid JSON array with all entries', () => {
    logClick('x')
    logRoute('y')
    const parsed = JSON.parse(exportLogsAsJson()) as unknown[]
    expect(parsed).toHaveLength(2)
  })
})
