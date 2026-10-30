import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { PipelineProgressSnapshot } from '@/api/pipelineProgress'
vi.mock('@/api/pipelineProgress', () => ({ getPipelineProgressSnapshot: vi.fn() }))
vi.mock('@/api/stream', () => ({ createPipelineProgressSnapshotStream: vi.fn() }))
vi.mock('@/api/filePipelineQuery', () => ({ queryPipelineProgress: vi.fn() }))
import { getPipelineProgressSnapshot } from '@/api/pipelineProgress'
import { createPipelineProgressSnapshotStream } from '@/api/stream'
import { queryPipelineProgress } from '@/api/filePipelineQuery'
import { useLivePipelineProgress } from './useLivePipelineProgress'
const scopes: ReturnType<typeof effectScope>[] = []
const sample = (id = 7, rows = 10, second = 0): PipelineProgressSnapshot => ({
  tenantId: 'owned',
  generatedAt: `2026-10-25T10:00:0${second}Z`,
  pipelines: [
    {
      pipelineInstanceId: id,
      runStatus: 'RUNNING',
      stageGraphAvailable: true,
      stageCodes: ['LOAD'],
      steps: [
        {
          stepId: id * 10,
          pipelineInstanceId: id,
          stepCode: 'load',
          stageCode: 'LOAD',
          stepStatus: 'RUNNING',
          runSeq: 1,
          rowsProcessed: rows,
        },
      ],
    },
  ],
})
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
})
function start() {
  const callbacks: Parameters<typeof createPipelineProgressSnapshotStream>[2][] = []
  const close = vi.fn()
  vi.mocked(getPipelineProgressSnapshot).mockImplementation(async (scope) => sample(Number(scope)))
  vi.mocked(createPipelineProgressSnapshotStream).mockImplementation(async (_scope, _tenant, h) => {
    callbacks.push(h)
    return { close } as unknown as EventSource
  })
  const ids = ref([7, 7]),
    tenant = ref('owned'),
    scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useLivePipelineProgress(tenant, ids))!
  return { state, ids, tenant, callbacks, close }
}
describe('useLivePipelineProgress', () => {
  it('deduplicates scope and consumes full snapshots without live GET or legacy dirty queries', async () => {
    const { state, callbacks } = start()
    await flush()
    callbacks[0].ready()
    callbacks[0].snapshot(sample(7, 88, 1))
    await vi.advanceTimersByTimeAsync(60000)
    expect(getPipelineProgressSnapshot).toHaveBeenCalledExactlyOnceWith('7', 'owned')
    expect(queryPipelineProgress).not.toHaveBeenCalled()
    expect(state.byStepId.value.get(70)?.rowsProcessed).toBe(88)
  })
  it('replaces a successful empty pipeline snapshot and drops old page samples on a scope switch', async () => {
    const { state, ids, callbacks, close } = start()
    await flush()
    callbacks[0].snapshot({
      ...sample(7, 10, 1),
      pipelines: [{ ...sample().pipelines[0], steps: [] }],
    })
    expect(state.byStepId.value.size).toBe(0)
    ids.value = [8]
    await flush()
    expect(close).toHaveBeenCalled()
    callbacks[0].snapshot(sample(7, 99, 3))
    expect([...state.byStepId.value.keys()]).toEqual([80])
  })
  it('marks the whole requested range unavailable on stream failure without stamping old samples fresh', async () => {
    const { state, callbacks } = start()
    await flush()
    const timestamp = state.lastSucceededAt.value
    callbacks[0].error()
    await flush()
    expect(state.unavailable.value).toBe(true)
    expect([...state.failedPipelineIds.value]).toEqual([7])
    expect(state.lastSucceededAt.value).toBe(timestamp)
  })
})
