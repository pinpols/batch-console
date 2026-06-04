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
  // @ts-expect-error scope.run returns T | undefined
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
})
