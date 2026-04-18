import { describe, it, expect } from 'vitest'
import { useBriefActionLoading } from './useBriefActionLoading'

describe('useBriefActionLoading', () => {
  it('sets busy to true during run and false after', async () => {
    const { busy, run } = useBriefActionLoading(0)
    expect(busy.value).toBe(false)

    const promise = run(() => 42)
    expect(busy.value).toBe(true)

    const result = await promise
    expect(result).toBe(42)
    expect(busy.value).toBe(false)
  })

  it('returns the sync function value', async () => {
    const { run } = useBriefActionLoading(0)
    const result = await run(() => 'hello')
    expect(result).toBe('hello')
  })

  it('returns the async function value', async () => {
    const { run } = useBriefActionLoading(0)
    const result = await run(async () => 'async-result')
    expect(result).toBe('async-result')
  })

  it('resets busy even if function throws', async () => {
    const { busy, run } = useBriefActionLoading(0)
    await expect(
      run(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(busy.value).toBe(false)
  })

  it('honors minimum display duration', async () => {
    const { run } = useBriefActionLoading(50)
    const start = Date.now()
    await run(() => 'quick')
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(45) // allow slight jitter
  })

  it('does not artificially delay slow operations', async () => {
    const { run } = useBriefActionLoading(10)
    const start = Date.now()
    await run(() => new Promise((r) => setTimeout(r, 50)))
    const elapsed = Date.now() - start
    // Should be ~50ms, not 60ms — min already elapsed during the wait
    expect(elapsed).toBeLessThan(80)
  })
})
