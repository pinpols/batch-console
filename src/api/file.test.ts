import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileApi } from './file'

vi.mock('./client', () => ({
  apiClient: {},
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}))
vi.mock('./adapters', () => ({ fetchAllPageItems: vi.fn() }))
vi.mock('./interceptors', () => ({ readStoredTenantId: vi.fn() }))

import { get } from './client'

const mockedGet = vi.mocked(get)

describe('fileApi', () => {
  beforeEach(() => mockedGet.mockReset())

  it('queries the platform business date after Shanghai midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T16:30:00Z'))
    try {
      mockedGet.mockResolvedValue({ total: 0 })
      await fileApi.summary('tenant-A')
      expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/files', {
        tenantId: 'tenant-A',
        pageNo: 1,
        pageSize: 1,
        startDate: '2026-09-27',
        endDate: '2026-09-27',
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
