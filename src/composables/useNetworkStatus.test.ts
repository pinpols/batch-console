import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'

const elMessageMock = vi.fn(() => ({ close: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: (...args: unknown[]) => elMessageMock(...args),
}))

vi.mock('@element-plus/icons-vue', () => ({
  CircleCloseFilled: {},
  CircleCheckFilled: {},
}))

// Stub window + navigator(node 环境无 DOM,不引 jsdom 保 vitest 启动快)
const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
let online = true

vi.stubGlobal('window', {
  addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(fn)
  },
  removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
    listeners.get(type)?.delete(fn)
  },
  dispatchEvent: (e: { type: string }) => {
    listeners.get(e.type)?.forEach((fn) => {
      if (typeof fn === 'function') fn(e as unknown as Event)
    })
    return true
  },
})

vi.stubGlobal('navigator', {
  get onLine() {
    return online
  },
})

import { useNetworkStatus } from './useNetworkStatus'

beforeEach(() => {
  elMessageMock.mockClear()
  listeners.clear()
  online = true
})

function setup() {
  const scope = effectScope()
  let api!: ReturnType<typeof useNetworkStatus>
  scope.run(() => {
    api = useNetworkStatus()
  })
  return { api, dispose: () => scope.stop() }
}

function fireEvent(type: string) {
  ;(window as unknown as { dispatchEvent: (e: { type: string }) => void }).dispatchEvent({ type })
}

describe('useNetworkStatus', () => {
  it('初始 navigator.onLine = true 时不弹消息', () => {
    const { api, dispose } = setup()
    expect(api.online.value).toBe(true)
    expect(elMessageMock).not.toHaveBeenCalled()
    dispose()
  })

  it('offline 事件触发后 online → false 且弹错误 toast(持久化 duration=0)', () => {
    const { api, dispose } = setup()
    fireEvent('offline')
    expect(api.online.value).toBe(false)
    expect(elMessageMock).toHaveBeenCalledTimes(1)
    expect(elMessageMock.mock.calls[0][0]).toMatchObject({
      type: 'error',
      duration: 0,
    })
    dispose()
  })

  it('online 事件后恢复 + 弹 success toast', () => {
    const { api, dispose } = setup()
    fireEvent('offline')
    elMessageMock.mockClear()
    fireEvent('online')
    expect(api.online.value).toBe(true)
    expect(elMessageMock).toHaveBeenCalledTimes(1)
    expect(elMessageMock.mock.calls[0][0]).toMatchObject({ type: 'success' })
    dispose()
  })

  it('scope.stop() 后 listener 清理(再发 offline 不增加 toast)', () => {
    const { dispose } = setup()
    dispose()
    elMessageMock.mockClear()
    fireEvent('offline')
    expect(elMessageMock).not.toHaveBeenCalled()
  })
})
