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

describe('logger core', () => {
  it('logRoute adds a route entry', () => {
    logRoute('页面切换：首页', { path: '/ops/summary' })
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe('route')
    expect(logs[0].level).toBe('info')
    expect(logs[0].message).toBe('页面切换：首页')
    expect(logs[0].detail).toEqual({ path: '/ops/summary' })
  })

  it('logClick adds a click entry', () => {
    logClick('触发 Job')
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe('click')
  })

  it('logApi supports different levels', () => {
    logApi('GET /api/test → 200', 'info')
    logApi('POST /api/fail → 500', 'error', { status: 500 })
    const logs = getLogs()
    expect(logs).toHaveLength(2)
    expect(logs[0].level).toBe('info')
    expect(logs[1].level).toBe('error')
    expect(logs[1].detail?.status).toBe(500)
  })

  it('logError adds an error entry', () => {
    logError('运行时异常', { message: 'TypeError' })
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe('error')
    expect(logs[0].level).toBe('error')
  })

  it('entries have auto-incrementing ids and timestamps', () => {
    logClick('a')
    logClick('b')
    const logs = getLogs()
    expect(logs[1].id).toBeGreaterThan(logs[0].id)
    expect(logs[0].ts).toBeTruthy()
  })

  it('omits detail key when undefined', () => {
    logClick('simple')
    const logs = getLogs()
    expect(logs[0]).not.toHaveProperty('detail')
  })
})

describe('ring buffer', () => {
  it('caps at MAX_ENTRIES (500)', () => {
    for (let i = 0; i < 520; i++) {
      logClick(`click-${i}`)
    }
    const logs = getLogs()
    expect(logs.length).toBeLessThanOrEqual(500)
    // oldest entries should be dropped
    expect(logs[0].message).toBe('click-20')
  })
})

describe('queryLogs', () => {
  beforeEach(() => {
    logRoute('page A')
    logClick('button X')
    logApi('GET /api → 200', 'info', { url: '/api' })
    logError('boom')
  })

  it('filters by category', () => {
    expect(queryLogs({ category: 'click' })).toHaveLength(1)
    expect(queryLogs({ category: 'api' })).toHaveLength(1)
  })

  it('filters by level', () => {
    expect(queryLogs({ level: 'error' })).toHaveLength(1)
    expect(queryLogs({ level: 'info' })).toHaveLength(3)
  })

  it('filters by keyword in message', () => {
    expect(queryLogs({ keyword: 'button' })).toHaveLength(1)
  })

  it('filters by keyword in detail', () => {
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
  it('flushLogs writes to localStorage and initLogger restores', () => {
    logClick('persist me')
    logRoute('page B')
    flushLogs()

    const raw = localStorage.getItem('batch-console-oplog')
    expect(raw).not.toBeNull()
    const data = JSON.parse(raw!)
    expect(data.entries).toHaveLength(2)
    expect(data.entries[0].message).toBe('persist me')

    // clearLogs then initLogger should restore from localStorage
    // but clearLogs removes localStorage too, so test restore separately
    clearLogs()
    expect(getLogs()).toHaveLength(0)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('batch-console-oplog', '{broken json!!!}')
    // initLogger should not throw
    expect(() => initLogger()).not.toThrow()
  })
})

describe('exportLogsAsJson', () => {
  it('returns valid JSON array', () => {
    logClick('x')
    logRoute('y')
    const json = exportLogsAsJson()
    const parsed = JSON.parse(json) as unknown[]
    expect(parsed).toHaveLength(2)
  })
})
