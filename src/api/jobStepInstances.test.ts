import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ get: vi.fn() }))

import { get } from './client'
import { queryJobStepInstancePage } from './jobStepInstances'

const mockedGet = vi.mocked(get)

describe('queryJobStepInstancePage', () => {
  beforeEach(() => mockedGet.mockReset())

  it('passes pagination and server filters to the canonical endpoint', async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0 })
    const query = {
      tenantId: 'ta',
      pageNo: 2,
      pageSize: 15,
      jobInstanceId: 101,
      stepStatus: 'FAILED',
    }

    await queryJobStepInstancePage(query)

    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/job-step-instances', query)
  })
})
