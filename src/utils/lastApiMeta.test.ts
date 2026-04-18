import { describe, it, expect, beforeEach } from 'vitest'
import { lastApiMeta, setLastApiMeta } from './lastApiMeta'
import type { CommonMeta } from '@/types'

const meta: CommonMeta = {
  traceId: 'trace-1',
  requestId: 'req-1',
  timestamp: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  lastApiMeta.value = null
})

describe('setLastApiMeta', () => {
  it('stores a valid meta object', () => {
    setLastApiMeta(meta)
    expect(lastApiMeta.value).toEqual(meta)
  })

  it('replaces existing value with a new one', () => {
    setLastApiMeta(meta)
    const next: CommonMeta = {
      traceId: 'trace-2',
      requestId: 'req-2',
      timestamp: '2026-01-02T00:00:00Z',
    }
    setLastApiMeta(next)
    expect(lastApiMeta.value).toEqual(next)
  })

  it('sets value to null when called with undefined', () => {
    setLastApiMeta(meta)
    setLastApiMeta(undefined)
    expect(lastApiMeta.value).toBeNull()
  })

  it('sets value to null when called with null', () => {
    setLastApiMeta(meta)
    setLastApiMeta(null)
    expect(lastApiMeta.value).toBeNull()
  })
})
