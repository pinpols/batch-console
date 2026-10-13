import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { stubLocalStorage } from '@/test-utils/localStorage'

const { driverDriveMock, driverDestroyMock, driverConstructorMock } = vi.hoisted(() => {
  const drive = vi.fn()
  const destroy = vi.fn()
  return {
    driverDriveMock: drive,
    driverDestroyMock: destroy,
    // 显式带 params:driver.js 构造接受 { steps, ... } config 对象。
    // vi.fn 默认空 tuple 会让 mock.calls[0][0] 报 "no element at index 0"。
    driverConstructorMock: vi.fn<
      (cfg: { steps?: unknown[]; [k: string]: unknown }) => { drive: () => void }
    >(() => ({ drive, destroy })),
  }
})

vi.mock('driver.js', () => ({
  driver: driverConstructorMock,
}))
vi.mock('driver.js/dist/driver.css', () => ({}))

const storage = stubLocalStorage()
type ModalStub = Element & {
  display?: string
  visibility?: string
}
const modalElements: ModalStub[] = []

// stub document.querySelector(useOnboardingTour 校验 anchor 存在性)
vi.stubGlobal('document', {
  querySelectorAll: (sel: string) =>
    sel === '.el-overlay, .el-drawer, .el-dialog' ? modalElements : [],
  querySelector: (sel: string) => {
    // 返回非 null 模拟"anchor 存在"
    return sel === '.fake-missing' ? null : ({} as Element)
  },
})
vi.stubGlobal('getComputedStyle', (element: ModalStub) => ({
  display: element.display ?? 'block',
  visibility: element.visibility ?? 'visible',
}))

import { shouldShowOnboarding, resetOnboarding, startOnboarding } from './useOnboardingTour'

const identity = { userId: 'user-1', tenantId: 'tenant-a' }
const completionKey = `${STORAGE_KEYS.onboardingDone}:2026-10-v2:user-1%3Atenant-a`

beforeEach(() => {
  storage.clear()
  modalElements.length = 0
  driverConstructorMock.mockClear()
  driverDriveMock.mockClear()
  driverDestroyMock.mockClear()
})

describe('useOnboardingTour', () => {
  it('shouldShowOnboarding:首次访问(localStorage 无标记)→ true', () => {
    expect(shouldShowOnboarding(identity)).toBe(true)
  })

  it('shouldShowOnboarding:已完成(localStorage 标 1)→ false', () => {
    storage.set(completionKey, '1')
    expect(shouldShowOnboarding(identity)).toBe(false)
  })

  it('resetOnboarding:清掉标记,下次 shouldShow 返 true', () => {
    storage.set(completionKey, '1')
    resetOnboarding(identity)
    expect(shouldShowOnboarding(identity)).toBe(true)
  })

  it('完成标记按用户和租户隔离', () => {
    storage.set(completionKey, '1')

    expect(shouldShowOnboarding(identity)).toBe(false)
    expect(shouldShowOnboarding({ userId: 'user-1', tenantId: 'tenant-b' })).toBe(true)
    expect(shouldShowOnboarding({ userId: 'user-2', tenantId: 'tenant-a' })).toBe(true)
  })

  it('startOnboarding:启动 driver 并调 drive()', () => {
    startOnboarding(identity, [
      { element: '.real', title: 't1', description: 'd1' },
      { element: '.real-2', title: 't2', description: 'd2' },
    ])
    expect(driverConstructorMock).toHaveBeenCalledTimes(1)
    expect(driverDriveMock).toHaveBeenCalledTimes(1)
    // 校验 steps 透传
    const cfg = driverConstructorMock.mock.calls[0][0]
    expect(cfg.steps).toHaveLength(2)
  })

  it('startOnboarding:默认 3 步从导航骨架衔接到业务引导中心', () => {
    startOnboarding(identity)

    const cfg = driverConstructorMock.mock.calls[0][0]
    expect(cfg.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: '[data-onboarding="tenant"]' }),
        expect.objectContaining({ element: '[data-onboarding="command-palette"]' }),
        expect.objectContaining({ element: '[data-onboarding="onboarding-center"]' }),
      ]),
    )
    expect(cfg.steps).toHaveLength(3)
  })

  it('只有点击完成才写完成标记', () => {
    startOnboarding(identity, [{ element: '.real', title: 't', description: 'd' }])
    const cfg = driverConstructorMock.mock.calls[0][0]
    const fakeDriver = { destroy: driverDestroyMock }

    ;(cfg.onCloseClick as Function)(undefined, undefined, { driver: fakeDriver })
    expect(storage.get(completionKey)).toBeUndefined()

    ;(cfg.onDoneClick as Function)(undefined, undefined, { driver: fakeDriver })
    expect(storage.get(completionKey)).toBe('1')
  })

  it('startOnboarding:全部 anchor DOM 不存在时 跳过启动(避免 driver 报错)', () => {
    startOnboarding(identity, [{ element: '.fake-missing', title: 't', description: 'd' }])
    expect(driverConstructorMock).not.toHaveBeenCalled()
  })

  it('startOnboarding:部分 anchor 不存在,仅过滤掉缺失项继续启动', () => {
    startOnboarding(identity, [
      { element: '.fake-missing', title: 't1', description: 'd1' }, // 不在
      { element: '.real', title: 't2', description: 'd2' }, // 在
    ])
    expect(driverConstructorMock).toHaveBeenCalledTimes(1)
    const cfg = driverConstructorMock.mock.calls[0][0]
    expect(cfg.steps).toHaveLength(1)
  })

  it('startOnboarding:已隐藏的 Element Plus overlay 不阻止引导', () => {
    modalElements.push({ display: 'none', getClientRects: () => [] } as unknown as ModalStub)

    startOnboarding(identity, [{ element: '.real', title: 't', description: 'd' }])

    expect(driverDriveMock).toHaveBeenCalledTimes(1)
  })

  it('startOnboarding:隐藏 overlay 内仍为 flex 的抽屉子节点不阻止引导', () => {
    modalElements.push({
      display: 'flex',
      getClientRects: () => [],
    } as unknown as ModalStub)

    startOnboarding(identity, [{ element: '.real', title: 't', description: 'd' }])

    expect(driverDriveMock).toHaveBeenCalledTimes(1)
  })

  it('startOnboarding:可见模态层存在时不启动', () => {
    modalElements.push({
      display: 'block',
      visibility: 'visible',
      getClientRects: () => [{ width: 10 }],
    } as unknown as ModalStub)

    startOnboarding(identity, [{ element: '.real', title: 't', description: 'd' }])

    expect(driverConstructorMock).not.toHaveBeenCalled()
  })
})
