import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { WorkflowExecutionProgress } from '@/api/workflowRuns'

vi.mock('@/api/workflowRuns', () => ({ getWorkflowExecutionProgress: vi.fn() }))
vi.mock('@/api/stream', () => ({ createWorkflowExecutionStream: vi.fn() }))
import { getWorkflowExecutionProgress } from '@/api/workflowRuns'
import { createWorkflowExecutionStream } from '@/api/stream'
import { useWorkflowExecutionProgress } from './useWorkflowExecutionProgress'

const snapshot = (tenantId = 'ta', id = 7, second = 0): WorkflowExecutionProgress => ({
  tenantId,
  workflowRunId: id,
  workflowDefinitionId: 3,
  runStatus: 'RUNNING',
  snapshotAvailable: true,
  generatedAt: `2026-10-25T10:00:0${second}Z`,
  nodes: [],
  edges: [],
})
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(getWorkflowExecutionProgress).mockReset()
  vi.mocked(createWorkflowExecutionStream).mockReset()
})
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
})

function start() {
  const tenant = ref('ta')
  const id = ref(7)
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useWorkflowExecutionProgress(tenant, id))!
  return { tenant, id, state }
}

describe('useWorkflowExecutionProgress', () => {
  it('keeps a pushed snapshot when an older in-flight HTTP read completes later', async () => {
    let callbacks!: Parameters<typeof createWorkflowExecutionStream>[2]
    let finish!: (data: WorkflowExecutionProgress) => void
    vi.mocked(getWorkflowExecutionProgress).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    vi.mocked(createWorkflowExecutionStream).mockImplementation(async (_id, _tenant, handlers) => {
      callbacks = handlers
      return { close: vi.fn() } as unknown as EventSource
    })
    const { state } = start()
    await flush()
    callbacks.snapshot({ ...snapshot('ta', 7, 2), runStatus: 'SUCCESS' })
    finish({ ...snapshot('ta', 7, 3), runStatus: 'RUNNING' })
    await flush()
    expect(state.progress.value?.runStatus).toBe('SUCCESS')
  })

  it('consumes pushed snapshots without periodic GET while live and rejects older snapshots', async () => {
    let callbacks!: Parameters<typeof createWorkflowExecutionStream>[2]
    vi.mocked(getWorkflowExecutionProgress).mockResolvedValue(snapshot())
    vi.mocked(createWorkflowExecutionStream).mockImplementation(async (_id, _tenant, handlers) => {
      callbacks = handlers
      return { close: vi.fn() } as unknown as EventSource
    })
    const { state } = start()
    await flush()
    callbacks.ready()
    callbacks.snapshot(snapshot('ta', 7, 2))
    callbacks.snapshot(snapshot('ta', 7, 1))
    await vi.advanceTimersByTimeAsync(90_000)
    expect(getWorkflowExecutionProgress).toHaveBeenCalledTimes(1)
    expect(state.progress.value?.generatedAt).toBe('2026-10-25T10:00:02Z')
    expect(state.status.value).toBe('live')
  })
  it('clears old tenant data, ignores delayed old events, and closes delayed tickets', async () => {
    let callbacks!: Parameters<typeof createWorkflowExecutionStream>[2]
    let finish!: (es: EventSource) => void
    vi.mocked(getWorkflowExecutionProgress).mockImplementation(async (id, tenant) =>
      snapshot(tenant, id),
    )
    vi.mocked(createWorkflowExecutionStream)
      .mockImplementationOnce((_id, _tenant, handlers) => {
        callbacks = handlers
        return new Promise((resolve) => {
          finish = resolve
        })
      })
      .mockResolvedValue({ close: vi.fn() } as unknown as EventSource)
    const { tenant, state } = start()
    await flush()
    tenant.value = ''
    await nextTick()
    expect(state.progress.value).toBeNull()
    callbacks.snapshot(snapshot())
    const close = vi.fn()
    finish({ close } as unknown as EventSource)
    await flush()
    expect(close).toHaveBeenCalledOnce()
    expect(state.progress.value).toBeNull()
    tenant.value = 'tb'
    await flush()
    expect(state.progress.value?.tenantId).toBe('tb')
  })
  it('keeps the last snapshot on disconnect and reconnects with a new full snapshot', async () => {
    let callbacks!: Parameters<typeof createWorkflowExecutionStream>[2]
    const close = vi.fn()
    vi.mocked(getWorkflowExecutionProgress).mockResolvedValue(snapshot())
    vi.mocked(createWorkflowExecutionStream).mockImplementation(async (_id, _tenant, handlers) => {
      callbacks = handlers
      return { close } as unknown as EventSource
    })
    const { state } = start()
    await flush()
    callbacks.ready()
    callbacks.error()
    expect(state.status.value).toBe('reconnecting')
    expect(state.progress.value).not.toBeNull()
    vi.mocked(getWorkflowExecutionProgress).mockResolvedValue(snapshot('ta', 7, 3))
    await vi.advanceTimersByTimeAsync(2000)
    await flush()
    expect(createWorkflowExecutionStream).toHaveBeenCalledTimes(2)
    expect(getWorkflowExecutionProgress).toHaveBeenCalledTimes(2)
    expect(state.progress.value?.generatedAt).toBe('2026-10-25T10:00:03Z')
    expect(close).toHaveBeenCalledOnce()
  })
})
