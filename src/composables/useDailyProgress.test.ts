import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { DailyProgress } from '@/api/dailyProgress'
import type { ProgressStreamHandlers } from '@/types/progress'
vi.mock('@/api/dailyProgress', () => ({ getDailyProgress: vi.fn() }))
vi.mock('@/api/stream', () => ({ createDailyProgressStream: vi.fn() }))
import { getDailyProgress } from '@/api/dailyProgress'
import { createDailyProgressStream } from '@/api/stream'
import { useDailyProgress } from './useDailyProgress'
const snapshot = (bizDate: string, tenantId = 'ta'): DailyProgress => ({
  tenantId,
  bizDate,
  generatedAt: '2040-04-05T10:00:00Z',
  counts: [],
  coverage: { scheduledDefinitions: 0, uncoveredDefinitions: 0 },
})
const flush = async () => {
  for (let n = 0; n < 8; n++) {
    await Promise.resolve()
    await nextTick()
  }
}
const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(getDailyProgress).mockReset()
  vi.mocked(createDailyProgressStream).mockReset()
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
})
describe('useDailyProgress', () => {
  it('changes business-date scope and rejects previous-date events and responses', async () => {
    const date = ref('2040-04-05')
    const tenant = ref('ta')
    let previous!: ProgressStreamHandlers<DailyProgress>
    const close = vi.fn()
    vi.mocked(getDailyProgress).mockImplementation(async (date, tenant) => snapshot(date, tenant))
    vi.mocked(createDailyProgressStream).mockImplementation(async (_date, _tenant, handlers) => {
      previous = handlers
      return { close } as unknown as EventSource
    })
    const scope = effectScope()
    scopes.push(scope)
    const state = scope.run(() => useDailyProgress(tenant, date))!
    await flush()
    const old = previous
    date.value = '2040-04-06'
    await flush()
    old.snapshot(snapshot('2040-04-05'))
    previous.snapshot(snapshot('2040-04-05'))
    expect(state.progress.value?.bizDate).toBe('2040-04-06')
    expect(close).toHaveBeenCalledOnce()
    previous.ready()
    await vi.advanceTimersByTimeAsync(90_000)
    expect(getDailyProgress).toHaveBeenCalledTimes(2)
    expect(state.status.value).toBe('live')
  })
  it('does not send requests when the tenant or business date is absent, including manual refresh', async () => {
    const scope = effectScope()
    scopes.push(scope)
    const state = scope.run(() => useDailyProgress('', ''))!
    await state.refresh()
    expect(getDailyProgress).not.toHaveBeenCalled()
    expect(createDailyProgressStream).not.toHaveBeenCalled()
  })
})
