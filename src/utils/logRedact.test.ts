import { describe, expect, it } from 'vitest'
import {
  sanitizeForLog,
  sanitizeParams,
  sanitizeRequestBody,
  sanitizeResponseBody,
} from './logRedact'

describe('sanitizeForLog — sensitive key redaction', () => {
  it('redacts common sensitive keys to ***', () => {
    const input = {
      username: 'alice',
      password: 'p@ssw0rd',
      token: 'eyJ...',
      refreshToken: 'rt-xyz',
      client_secret: 's',
      apiKey: 'k',
      cookie: 'sess=1',
      authorization: 'Bearer x',
    }
    expect(sanitizeForLog(input)).toEqual({
      username: 'alice',
      password: '***',
      token: '***',
      refreshToken: '***',
      client_secret: '***',
      apiKey: '***',
      cookie: '***',
      authorization: '***',
    })
  })

  it('does NOT false-match partial keys (traceToken, pageToken, idempotencyToken)', () => {
    const input = { traceToken: 'ok', pageToken: 'ok', idempotencyToken: 'ok' }
    const out = sanitizeForLog(input) as typeof input
    expect(out.traceToken).toBe('ok')
    expect(out.pageToken).toBe('ok')
    expect(out.idempotencyToken).toBe('ok')
  })

  it('redacts nested sensitive keys', () => {
    const input = {
      user: { name: 'a', password: 'p' },
      list: [{ id: 1, token: 't' }],
    }
    const out = sanitizeForLog(input) as {
      user: { name: string; password: string }
      list: { id: number; token: string }[]
    }
    expect(out.user.password).toBe('***')
    expect(out.list[0].token).toBe('***')
  })
})

describe('sanitizeForLog — limits', () => {
  it('truncates long strings with (N chars) suffix', () => {
    const s = 'x'.repeat(300)
    const out = sanitizeForLog(s) as string
    expect(out.length).toBeLessThan(300)
    expect(out).toMatch(/…\(300 chars\)$/)
  })

  it('caps array length and appends "+N more"', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i)
    const out = sanitizeForLog(arr) as unknown[]
    expect(out[out.length - 1]).toMatch(/\+10 more/)
    expect(out.length).toBeLessThanOrEqual(21)
  })

  it('returns _truncated object when JSON exceeds maxBytes', () => {
    const huge = { rows: Array.from({ length: 200 }, (_, i) => ({ k: `v-${i}` })) }
    const out = sanitizeForLog(huge, { maxBytes: 200 }) as { _truncated: string; _size: number }
    expect(out._truncated).toBeTruthy()
    expect(out._size).toBeGreaterThan(200)
  })

  it('caps nesting depth', () => {
    let leaf: Record<string, unknown> = { v: 1 }
    for (let i = 0; i < 10; i++) leaf = { nest: leaf }
    const out = sanitizeForLog(leaf) as Record<string, unknown>
    // 深度超过 5 后应出现 '[deep]'
    const str = JSON.stringify(out)
    expect(str).toContain('[deep]')
  })
})

describe('sanitizeForLog — non-plain values', () => {
  it('summarizes FormData by keys only', () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x']), 'a.txt')
    fd.append('reason', 'test')
    expect(sanitizeForLog(fd)).toMatch(/FormData keys=file,reason/)
  })

  it('summarizes Blob with size and type', () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    expect(sanitizeForLog(blob)).toMatch(/Blob size=5 type=text\/plain/)
  })

  it('handles Date as ISO string', () => {
    const d = new Date('2026-04-18T10:00:00Z')
    expect(sanitizeForLog(d)).toBe('2026-04-18T10:00:00.000Z')
  })

  it('handles undefined / null / primitives', () => {
    expect(sanitizeForLog(undefined)).toBeUndefined()
    expect(sanitizeForLog(null)).toBeNull()
    expect(sanitizeForLog(42)).toBe(42)
    expect(sanitizeForLog(true)).toBe(true)
  })
})

describe('wrappers', () => {
  it('sanitizeParams returns undefined for null/undefined', () => {
    expect(sanitizeParams(null)).toBeUndefined()
    expect(sanitizeParams(undefined)).toBeUndefined()
  })

  it('sanitizeRequestBody returns undefined for empty string', () => {
    expect(sanitizeRequestBody('')).toBeUndefined()
    expect(sanitizeRequestBody(undefined)).toBeUndefined()
  })

  it('sanitizeResponseBody redacts token in CommonResponse.data', () => {
    const body = {
      code: 'SUCCESS',
      message: 'ok',
      data: { accessToken: 'xxx', username: 'a' },
      meta: { traceId: 't1', requestId: 'r1' },
    }
    const out = sanitizeResponseBody(body) as typeof body
    expect(out.data.accessToken).toBe('***')
    expect(out.data.username).toBe('a')
    expect(out.meta.traceId).toBe('t1')
  })
})
