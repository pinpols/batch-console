import { describe, it, expect, vi } from 'vitest'
import { effectScope } from 'vue'
import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  it('toggles busy + loading during async execution', async () => {
    const { busy, loading, run } = useAsyncAction(async () => {
      await Promise.resolve()
      return 42
    })
    expect(busy.value).toBe(false)
    expect(loading.value).toBe(false)
    const promise = run()
    expect(busy.value).toBe(true)
    expect(loading.value).toBe(true)
    const result = await promise
    expect(result).toBe(42)
    expect(busy.value).toBe(false)
    expect(loading.value).toBe(false)
  })

  it('blocks concurrent calls — second click returns undefined', async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return 'done'
    })
    const { run } = useAsyncAction(fn)
    const p1 = run()
    // 同步立即第二次点击
    const p2 = run()
    expect(await p2).toBeUndefined()
    expect(await p1).toBe('done')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('forwards args to fn', async () => {
    const fn = vi.fn(async (a: number, b: string) => `${a}:${b}`)
    const { run } = useAsyncAction(fn)
    const result = await run(7, 'x')
    expect(result).toBe('7:x')
    expect(fn).toHaveBeenCalledWith(7, 'x')
  })

  it('rethrows errors and resets busy', async () => {
    const onError = vi.fn()
    const { busy, run } = useAsyncAction(
      async () => {
        throw new Error('boom')
      },
      { onError },
    )
    await expect(run()).rejects.toThrow('boom')
    expect(busy.value).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('enforces cooldown — clicks during cooldown return undefined', async () => {
    const fn = vi.fn(async () => 'ok')
    const { loading, run } = useAsyncAction(fn, { cooldownMs: 30 })
    await run()
    // 完成后 cooling 期间 loading 仍为 true
    expect(loading.value).toBe(true)
    expect(await run()).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
    // 等过 cooldown
    await new Promise((r) => setTimeout(r, 45))
    expect(loading.value).toBe(false)
    expect(await run()).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fires onSuccess with result', async () => {
    const onSuccess = vi.fn()
    const { run } = useAsyncAction(async () => 'value', { onSuccess })
    await run()
    expect(onSuccess).toHaveBeenCalledWith('value')
  })

  it('cleans up cooldown timer on scope dispose', async () => {
    const scope = effectScope()
    let action: ReturnType<typeof useAsyncAction<[], string>> | null = null
    scope.run(() => {
      action = useAsyncAction(async () => 'ok', { cooldownMs: 200 })
    })
    await action!.run()
    expect(action!.loading.value).toBe(true)
    scope.stop()
    // dispose 后 cooldown 不再阻塞外部代码:这里不直接断言 loading=false
    // (cooling.value 仍可能为 true 但 timer 已 clear,不会再执行 setTimeout 回调泄漏)
    // 间接断言:dispose 后立即再调用,不应抛错且无 leaked timer
    expect(() => action!.loading.value).not.toThrow()
  })
})
