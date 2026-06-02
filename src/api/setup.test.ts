import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/tenants', () => ({
  listTenants: vi.fn(),
}))

import { listTenants } from '@/api/tenants'
import { systemHasTenants, invalidateSystemHasTenantsCache, _resetForTest } from './setup'

const mockedListTenants = vi.mocked(listTenants)

describe('systemHasTenants', () => {
  beforeEach(() => {
    mockedListTenants.mockReset()
    _resetForTest()
  })

  it('returns true when backend reports total > 0', async () => {
    mockedListTenants.mockResolvedValue({ total: 3, pageNo: 1, pageSize: 1, items: [] })
    await expect(systemHasTenants()).resolves.toBe(true)
    expect(mockedListTenants).toHaveBeenCalledWith({ pageNo: 1, pageSize: 1 })
  })

  it('returns false when backend reports total = 0', async () => {
    mockedListTenants.mockResolvedValue({ total: 0, pageNo: 1, pageSize: 1, items: [] })
    await expect(systemHasTenants()).resolves.toBe(false)
  })

  it('caches result within a session to avoid repeated calls', async () => {
    mockedListTenants.mockResolvedValue({ total: 0, pageNo: 1, pageSize: 1, items: [] })
    await systemHasTenants()
    await systemHasTenants()
    await systemHasTenants()
    expect(mockedListTenants).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after invalidate (e.g. after creating the first tenant)', async () => {
    mockedListTenants.mockResolvedValueOnce({ total: 0, pageNo: 1, pageSize: 1, items: [] })
    await systemHasTenants()
    invalidateSystemHasTenantsCache()
    mockedListTenants.mockResolvedValueOnce({ total: 1, pageNo: 1, pageSize: 1, items: [] })
    await expect(systemHasTenants()).resolves.toBe(true)
    expect(mockedListTenants).toHaveBeenCalledTimes(2)
  })

  it('treats missing total as no tenants', async () => {
    mockedListTenants.mockResolvedValue({
      total: undefined as unknown as number,
      pageNo: 1,
      pageSize: 1,
      items: [],
    })
    await expect(systemHasTenants()).resolves.toBe(false)
  })
})
