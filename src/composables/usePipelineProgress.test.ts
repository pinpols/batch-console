import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
vi.mock('@/api/filePipelineQuery', () => ({ queryPipelineProgress: vi.fn() }))
import { queryPipelineProgress, type PipelineProgressResponse } from '@/api/filePipelineQuery'
import { usePipelineProgress } from './usePipelineProgress'

let scope: EffectScope
const tenant = ref('ta')
let progress: ReturnType<typeof usePipelineProgress>
const sample = (id = 1, rows = 10): PipelineProgressResponse => ({
  pipelineInstanceId: id,
  steps: [
    {
      stepId: id * 10,
      pipelineInstanceId: id,
      stageCode: 'LOAD',
      rowsProcessed: rows,
      totalRowsHint: null,
    },
  ],
})

beforeEach(() => {
  vi.mocked(queryPipelineProgress).mockReset()
  tenant.value = 'ta'
  scope = effectScope()
  progress = scope.run(() => usePipelineProgress(() => tenant.value))!
})
afterEach(() => {
  scope.stop()
  vi.restoreAllMocks()
})

describe('usePipelineProgress', () => {
  it('deduplicates pipelines and preserves unknown totals without fabricating values', async () => {
    vi.mocked(queryPipelineProgress).mockResolvedValue(sample())
    expect(await progress.refresh([1, 1])).toBe(true)
    expect(queryPipelineProgress).toHaveBeenCalledTimes(1)
    expect(progress.byStepId.value.get(10)?.totalRowsHint).toBeNull()
    expect(progress.lastSucceededAt.value).not.toBeNull()
  })

  it('retains the previous sample and success time on failure, then recovers', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100)
    vi.mocked(queryPipelineProgress).mockResolvedValue(sample())
    await progress.refresh([1])
    now.mockReturnValue(200)
    vi.mocked(queryPipelineProgress).mockRejectedValue(new Error('offline'))
    expect(await progress.refresh([1])).toBe(false)
    expect(progress.unavailable.value).toBe(true)
    expect(progress.byStepId.value.get(10)?.rowsProcessed).toBe(10)
    expect(progress.lastSucceededAt.value).toBe(100)
    vi.mocked(queryPipelineProgress).mockResolvedValue(sample(1, 20))
    expect(await progress.refresh([1])).toBe(true)
    expect(progress.unavailable.value).toBe(false)
    expect(progress.lastSucceededAt.value).toBe(200)
  })

  it('clears a successful empty snapshot instead of retaining old rows', async () => {
    vi.mocked(queryPipelineProgress).mockResolvedValue(sample())
    await progress.refresh([1])
    vi.mocked(queryPipelineProgress).mockResolvedValue({ pipelineInstanceId: 1, steps: [] })
    expect(await progress.refresh([1])).toBe(true)
    expect(progress.byStepId.value.size).toBe(0)
    expect(progress.unavailable.value).toBe(false)
  })

  it('updates successful pipelines but does not stamp partial failures as success', async () => {
    vi.mocked(queryPipelineProgress).mockImplementation(async (id) => sample(Number(id)))
    await progress.refresh([1, 2])
    const timestamp = progress.lastSucceededAt.value
    vi.mocked(queryPipelineProgress).mockImplementation(async (id) => {
      if (id === 2) throw new Error('offline')
      return sample(1, 99)
    })
    expect(await progress.refresh([1, 2])).toBe(false)
    expect(progress.byStepId.value.get(10)?.rowsProcessed).toBe(99)
    expect(progress.byStepId.value.get(20)?.rowsProcessed).toBe(10)
    expect([...progress.failedPipelineIds.value]).toEqual([2])
    expect(progress.lastSucceededAt.value).toBe(timestamp)
  })

  it('does not restore old tenant samples after a tenant switch', async () => {
    let resolve!: (value: PipelineProgressResponse) => void
    vi.mocked(queryPipelineProgress).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const pending = progress.refresh([1])
    tenant.value = 'tb'
    resolve(sample())
    expect(await pending).toBe(false)
    expect(progress.byStepId.value.size).toBe(0)
    expect(progress.lastSucceededAt.value).toBeNull()
  })

  it('ignores an older overlapping refresh', async () => {
    let resolve!: (value: PipelineProgressResponse) => void
    vi.mocked(queryPipelineProgress).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const older = progress.refresh([1])
    vi.mocked(queryPipelineProgress).mockResolvedValue(sample(1, 99))
    await progress.refresh([1])
    resolve(sample(1, 1))
    expect(await older).toBe(false)
    expect(progress.byStepId.value.get(10)?.rowsProcessed).toBe(99)
  })

  it('drops samples outside the current page and resets on empty pages', async () => {
    vi.mocked(queryPipelineProgress).mockImplementation(async (id) => sample(Number(id)))
    await progress.refresh([1])
    await progress.refresh([2])
    expect([...progress.byStepId.value.keys()]).toEqual([20])
    expect(await progress.refresh([])).toBe(false)
    expect(progress.byStepId.value.size).toBe(0)
    expect(progress.lastSucceededAt.value).toBeNull()
  })

  it('ignores pending requests after disposal', async () => {
    let resolve!: (value: PipelineProgressResponse) => void
    vi.mocked(queryPipelineProgress).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const pending = progress.refresh([1])
    scope.stop()
    resolve(sample())
    expect(await pending).toBe(false)
    expect(progress.byStepId.value.size).toBe(0)
  })
})
