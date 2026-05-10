import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'

// stub vue 的 onMounted/onBeforeUnmount 让 setup outside 组件时也跑
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: (fn: () => void) => {
      // 用 effect scope 的 onScopeDispose 模拟卸载
      actual.onScopeDispose(fn)
    },
  }
})

// stub document(node 环境无 DOM,vi.stubGlobal 替代)
let visibility: DocumentVisibilityState = 'visible'
const docListeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
vi.stubGlobal('document', {
  get visibilityState() {
    return visibility
  },
  get hidden() {
    return visibility === 'hidden'
  },
  addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
    if (!docListeners.has(type)) docListeners.set(type, new Set())
    docListeners.get(type)!.add(fn)
  },
  removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
    docListeners.get(type)?.delete(fn)
  },
  dispatchEvent: (e: { type: string }) => {
    docListeners.get(e.type)?.forEach((fn) => {
      if (typeof fn === 'function') fn(e as unknown as Event)
    })
    return true
  },
})

import { useAutoRefresh } from './useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(fn: () => void, intervalMs?: number) {
    const scope = effectScope()
    scope.run(() => useAutoRefresh(fn, intervalMs))
    return { dispose: () => scope.stop() }
  }

  it('每 intervalMs 调用一次 fn(可见态)', () => {
    const fn = vi.fn()
    const { dispose } = setup(fn, 1000)
    vi.advanceTimersByTime(1100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('页面隐藏时停止;恢复可见时立即跑一次', () => {
    const fn = vi.fn()
    const { dispose } = setup(fn, 1000)
    vi.advanceTimersByTime(1100)
    expect(fn).toHaveBeenCalledTimes(1)

    // 模拟切到后台
    visibility = 'hidden'
    ;(document as unknown as { dispatchEvent: (e: { type: string }) => void }).dispatchEvent({
      type: 'visibilitychange',
    })
    vi.advanceTimersByTime(5000)
    // 隐藏期间不应再调
    expect(fn).toHaveBeenCalledTimes(1)

    // 恢复
    visibility = 'visible'
    ;(document as unknown as { dispatchEvent: (e: { type: string }) => void }).dispatchEvent({
      type: 'visibilitychange',
    })
    // 实现恢复时立即 safeRun 一次
    expect(fn).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('卸载后停止', () => {
    const fn = vi.fn()
    const { dispose } = setup(fn, 1000)
    vi.advanceTimersByTime(1100)
    expect(fn).toHaveBeenCalledTimes(1)
    dispose()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1) // 不再增长
  })
})
