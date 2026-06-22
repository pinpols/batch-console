import { afterEach, describe, it, expect, vi } from 'vitest'
import { useBriefActionLoading } from './useBriefActionLoading'

afterEach(() => {
  vi.useRealTimers()
})

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
    vi.useFakeTimers()
    const { run } = useBriefActionLoading(50)
    let settled = false
    const promise = run(() => 'quick').finally(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(49)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(settled).toBe(true)
  })

  it('does not artificially delay slow operations', async () => {
    vi.useFakeTimers()
    const { run } = useBriefActionLoading(10)
    let settled = false
    const promise = run(() => new Promise((r) => setTimeout(r, 50))).finally(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(49)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(settled).toBe(true)
  })
})
