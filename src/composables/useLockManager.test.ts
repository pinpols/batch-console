import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const acquireMock = vi.fn()
const renewMock = vi.fn()
const releaseMock = vi.fn()

vi.mock('@/api/workflowDesigner', () => ({
  workflowDesignerApi: {
    acquireLock: (...args: unknown[]) => acquireMock(...args),
    renewLock: (...args: unknown[]) => renewMock(...args),
    releaseLock: (...args: unknown[]) => releaseMock(...args),
  },
}))

vi.mock('@/utils/logger', () => ({ logRoute: vi.fn() }))

import { useLockManager } from './useLockManager'
import { useDesignerStore } from '@/views/workflow/designer/store/useDesignerStore'

function inScope<T>(fn: () => T): { value: T; stop: () => void } {
  const scope = effectScope()
  const value: T = scope.run(fn) as T
  return { value, stop: () => scope.stop() }
}

beforeEach(() => {
  setActivePinia(createPinia())
  acquireMock.mockReset()
  renewMock.mockReset()
  releaseMock.mockReset()
})

describe('useLockManager', () => {
  it('acquire 成功 → store.lock isMine=true,editable', async () => {
    acquireMock.mockResolvedValueOnce({
      workflowDefinitionId: 1,
      lockedBy: 'alice',
      acquiredAt: 't',
      expiresAt: 't2',
      isMine: true,
    })
    const { value: mgr, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const store = useDesignerStore()
    const r = await mgr.acquire(1, 'tn1')
    expect(r).toBe('editable')
    expect(store.lock).toMatchObject({ isMine: true, lockedBy: 'alice' })
    expect(store.editable).toBe(true)
    stop()
  })

  it('acquire 409 占用 → store.lock isMine=false,只读', async () => {
    acquireMock.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { data: { lockedBy: 'bob', expiresAt: 'x' } },
      },
    })
    const { value: mgr, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const store = useDesignerStore()
    const r = await mgr.acquire(1, 'tn1')
    expect(r).toBe('readonly')
    expect(store.lock).toMatchObject({ isMine: false, lockedBy: 'bob' })
    expect(store.editable).toBe(false)
    stop()
  })

  it('renew 成功 → store.lock 续期', async () => {
    acquireMock.mockResolvedValueOnce({
      workflowDefinitionId: 1,
      lockedBy: 'alice',
      acquiredAt: 't',
      expiresAt: 'old',
      isMine: true,
    })
    renewMock.mockResolvedValueOnce({
      workflowDefinitionId: 1,
      lockedBy: 'alice',
      acquiredAt: 't',
      expiresAt: 'new',
      isMine: true,
    })
    const { value: mgr, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const store = useDesignerStore()
    await mgr.acquire(1, 'tn1')
    await mgr.renew()
    expect((store.lock as { expiresAt: string }).expiresAt).toBe('new')
    stop()
  })

  it('renew 409 被夺 → 切只读 + onLost(taken)', async () => {
    acquireMock.mockResolvedValueOnce({
      workflowDefinitionId: 1,
      lockedBy: 'alice',
      acquiredAt: 't',
      expiresAt: 'old',
      isMine: true,
    })
    renewMock.mockRejectedValueOnce({
      response: { status: 409, data: { data: { lockedBy: 'eve', expiresAt: 'z' } } },
    })
    const onLost = vi.fn()
    const { value: mgr, stop } = inScope(() => useLockManager({ intervalMs: 0, onLost }))
    const store = useDesignerStore()
    await mgr.acquire(1, 'tn1')
    await mgr.renew()
    expect(onLost).toHaveBeenCalledWith('taken')
    expect(store.lock).toMatchObject({ isMine: false, lockedBy: 'eve' })
    stop()
  })

  it('release 调用 BE 并清空 store.lock', async () => {
    acquireMock.mockResolvedValueOnce({
      workflowDefinitionId: 1,
      lockedBy: 'alice',
      acquiredAt: 't',
      expiresAt: 'e',
      isMine: true,
    })
    releaseMock.mockResolvedValueOnce(undefined)
    const { value: mgr, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const store = useDesignerStore()
    await mgr.acquire(1, 'tn1')
    await mgr.release()
    expect(releaseMock).toHaveBeenCalledWith(1, 'tn1')
    expect(store.lock).toBeNull()
    stop()
  })
  it('旧工作流锁请求晚到时不覆盖新工作流锁', async () => {
    let resolveA!: (value: unknown) => void
    acquireMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveA = resolve
        }),
      )
      .mockResolvedValueOnce({ lockedBy: 'B-owner', expiresAt: 'B-time' })
    const { value: manager, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const pending = manager.acquire(1, 'tenant-a')
    await manager.acquire(2, 'tenant-b')
    resolveA({ lockedBy: 'A-owner', expiresAt: 'A-time' })
    await pending
    expect(useDesignerStore().lock?.lockedBy).toBe('B-owner')
    stop()
  })

  it('释放之后迟到的续租不能恢复本地可编辑态', async () => {
    let resolveRenew!: (value: unknown) => void
    acquireMock.mockResolvedValueOnce({ lockedBy: 'A-owner', expiresAt: 'old' })
    renewMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRenew = resolve
      }),
    )
    releaseMock.mockResolvedValue(undefined)
    const { value: manager, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    await manager.acquire(1, 'tenant-a')
    const pending = manager.renew()
    await manager.release()
    resolveRenew({ lockedBy: 'A-owner', expiresAt: 'new' })
    await pending
    expect(useDesignerStore().lock).toBeNull()
    stop()
  })

  it('旧锁释放回包不能清空后来获取的新锁', async () => {
    let resolveRelease!: () => void
    acquireMock
      .mockResolvedValueOnce({ lockedBy: 'A-owner', expiresAt: 'old' })
      .mockResolvedValueOnce({ lockedBy: 'B-owner', expiresAt: 'new' })
    releaseMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveRelease = resolve
      }),
    )
    const { value: manager, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    await manager.acquire(1, 'tenant-a')
    const pending = manager.release()
    await manager.acquire(2, 'tenant-b')
    resolveRelease()
    await pending
    expect(useDesignerStore().lock?.lockedBy).toBe('B-owner')
    stop()
  })

  it('组件作用域结束后不再接收迟到的获取结果', async () => {
    let resolveAcquire!: (value: unknown) => void
    acquireMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAcquire = resolve
      }),
    )
    const { value: manager, stop } = inScope(() => useLockManager({ intervalMs: 0 }))
    const pending = manager.acquire(1, 'tenant-a')
    stop()
    resolveAcquire({ lockedBy: 'A-owner', expiresAt: 'old' })
    await pending
    expect(useDesignerStore().lock).toBeNull()
  })
})
