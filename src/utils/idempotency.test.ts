import { describe, it, expect } from 'vitest'
import { createIdempotencyKey } from './idempotency'

describe('createIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    expect(createIdempotencyKey()).toBeTruthy()
    expect(typeof createIdempotencyKey()).toBe('string')
  })

  it('returns unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 100 }, () => createIdempotencyKey()))
    expect(keys.size).toBe(100)
  })

  it('returns a UUID format when crypto.randomUUID is available', () => {
    const key = createIdempotencyKey()
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('falls back to timestamp format when crypto is unavailable', () => {
    const original = globalThis.crypto
    // @ts-expect-error intentional override for test
    delete globalThis.crypto
    const key = createIdempotencyKey()
    expect(key).toMatch(/^\d+-\d+-[a-z0-9]+$/)
    ;(globalThis as { crypto?: Crypto }).crypto = original
  })
})
