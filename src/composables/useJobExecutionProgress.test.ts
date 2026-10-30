import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { JobExecutionProgress } from '@/api/jobProgress'
vi.mock('@/api/jobProgress', () => ({ getJobExecutionProgress: vi.fn() }))
vi.mock('@/api/stream', () => ({ createJobExecutionStream: vi.fn() }))
import { getJobExecutionProgress } from '@/api/jobProgress'
import { createJobExecutionStream } from '@/api/stream'
import { useJobExecutionProgress } from './useJobExecutionProgress'
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.resetAllMocks()
})
const snapshot = (tenantId = 'owned', jobInstanceId = 42): JobExecutionProgress => ({
  tenantId,
  jobInstanceId,
  jobCode: 'job',
  instanceStatus: 'RUNNING',
  generatedAt: '2026-10-25T10:00:00Z',
  stageGraphAvailable: false,
  counts: [],
  stages: [],
})
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
describe('useJobExecutionProgress', () => {
  it('consumes full snapshots without live GET polling, ignores late old scope data and closes old streams', async () => {
    vi.useFakeTimers()
    const handlers: Parameters<typeof createJobExecutionStream>[2][] = []
    const close = vi.fn()
    vi.mocked(getJobExecutionProgress).mockImplementation(async (id, tenant) =>
      snapshot(tenant, id),
    )
    vi.mocked(createJobExecutionStream).mockImplementation(async (_id, _tenant, h) => {
      handlers.push(h)
      return { close } as unknown as EventSource
    })
    const tenant = ref('owned'),
      id = ref(42),
      scope = effectScope()
    scopes.push(scope)
    const state = scope.run(() => useJobExecutionProgress(tenant, id))!
    await flush()
    handlers[0].ready()
    handlers[0].snapshot({
      ...snapshot(),
      instanceStatus: 'PAUSED',
      generatedAt: '2026-10-25T10:00:01Z',
    })
    await vi.advanceTimersByTimeAsync(60000)
    expect(getJobExecutionProgress).toHaveBeenCalledTimes(1)
    expect(state.progress.value?.instanceStatus).toBe('PAUSED')
    tenant.value = 'other'
    await flush()
    handlers[0].snapshot({
      ...snapshot(),
      instanceStatus: 'SUCCESS',
      generatedAt: '2026-10-25T10:00:03Z',
    })
    expect(state.progress.value?.tenantId).toBe('other')
    expect(close).toHaveBeenCalled()
  })
})
