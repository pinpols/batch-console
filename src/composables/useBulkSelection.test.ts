// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('element-plus', () => ({ ElMessage: { success, error, warning } }))
vi.mock('@/locales', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useBulkSelection } from './useBulkSelection'

describe('useBulkSelection', () => {
  beforeEach(() => {
    success.mockReset()
    error.mockReset()
    warning.mockReset()
  })

  it('tracks selection count and clears', () => {
    const b = useBulkSelection<{ id: number }>()
    b.onSelectionChange([{ id: 1 }, { id: 2 }])
    expect(b.count.value).toBe(2)
    expect(b.hasSelection.value).toBe(true)
    b.clear()
    expect(b.count.value).toBe(0)
  })

  it('runBulk all-success returns ok and toasts success + clears', async () => {
    const b = useBulkSelection<{ id: number }>()
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    b.onSelectionChange(items)
    const action = vi.fn().mockResolvedValue(undefined)
    const res = await b.runBulk(items, action)
    expect(res).toEqual({ ok: 3, fail: 0, failed: [] })
    expect(action).toHaveBeenCalledTimes(3)
    expect(success).toHaveBeenCalledTimes(1)
    expect(b.count.value).toBe(0) // cleared on full success
  })

  it('runBulk partial failure collects failed items and warns (no clear)', async () => {
    const b = useBulkSelection<{ id: number }>()
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    b.onSelectionChange(items)
    const action = vi.fn((it: { id: number }) =>
      it.id === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(),
    )
    const res = await b.runBulk(items, action)
    expect(res.ok).toBe(2)
    expect(res.fail).toBe(1)
    expect(res.failed[0].item).toEqual({ id: 2 })
    expect(warning).toHaveBeenCalledTimes(1)
    expect(b.count.value).toBe(3) // not cleared on partial failure
  })

  it('runBulk all-failure errors', async () => {
    const b = useBulkSelection<{ id: number }>()
    const items = [{ id: 1 }, { id: 2 }]
    b.onSelectionChange(items)
    const res = await b.runBulk(items, () => Promise.reject(new Error('x')))
    expect(res.fail).toBe(2)
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('runBulk no-op on empty items', async () => {
    const b = useBulkSelection<{ id: number }>()
    const res = await b.runBulk([], vi.fn())
    expect(res).toEqual({ ok: 0, fail: 0, failed: [] })
  })
})
