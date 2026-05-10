import { describe, it, expect, vi, beforeEach } from 'vitest'

const { driverDriveMock, driverConstructorMock } = vi.hoisted(() => {
  const drive = vi.fn()
  return {
    driverDriveMock: drive,
    driverConstructorMock: vi.fn(() => ({ drive })),
  }
})

vi.mock('driver.js', () => ({
  driver: driverConstructorMock,
}))
vi.mock('driver.js/dist/driver.css', () => ({}))

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
})

// stub document.querySelector(useOnboardingTour 校验 anchor 存在性)
vi.stubGlobal('document', {
  querySelector: (sel: string) => {
    // 返回非 null 模拟"anchor 存在"
    return sel === '.fake-missing' ? null : ({} as Element)
  },
})

import { shouldShowOnboarding, resetOnboarding, startOnboarding } from './useOnboardingTour'

beforeEach(() => {
  storage.clear()
  driverConstructorMock.mockClear()
  driverDriveMock.mockClear()
})

describe('useOnboardingTour', () => {
  it('shouldShowOnboarding:首次访问(localStorage 无标记)→ true', () => {
    expect(shouldShowOnboarding()).toBe(true)
  })

  it('shouldShowOnboarding:已完成(localStorage 标 1)→ false', () => {
    storage.set('batch-console-onboarding-done', '1')
    expect(shouldShowOnboarding()).toBe(false)
  })

  it('resetOnboarding:清掉标记,下次 shouldShow 返 true', () => {
    storage.set('batch-console-onboarding-done', '1')
    resetOnboarding()
    expect(shouldShowOnboarding()).toBe(true)
  })

  it('startOnboarding:启动 driver 并调 drive()', () => {
    startOnboarding([
      { element: '.real', title: 't1', description: 'd1' },
      { element: '.real-2', title: 't2', description: 'd2' },
    ])
    expect(driverConstructorMock).toHaveBeenCalledTimes(1)
    expect(driverDriveMock).toHaveBeenCalledTimes(1)
    // 校验 steps 透传
    const cfg = driverConstructorMock.mock.calls[0][0]
    expect(cfg.steps).toHaveLength(2)
  })

  it('startOnboarding:全部 anchor DOM 不存在时 跳过启动(避免 driver 报错)', () => {
    startOnboarding([{ element: '.fake-missing', title: 't', description: 'd' }])
    expect(driverConstructorMock).not.toHaveBeenCalled()
  })

  it('startOnboarding:部分 anchor 不存在,仅过滤掉缺失项继续启动', () => {
    startOnboarding([
      { element: '.fake-missing', title: 't1', description: 'd1' }, // 不在
      { element: '.real', title: 't2', description: 'd2' }, // 在
    ])
    expect(driverConstructorMock).toHaveBeenCalledTimes(1)
    const cfg = driverConstructorMock.mock.calls[0][0]
    expect(cfg.steps).toHaveLength(1)
  })
})
