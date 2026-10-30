import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn() }))

import { get } from '@/api/client'
import { listWorkerClaimedTasks } from '@/api/workers'

const mockedGet = vi.mocked(get)

describe('listWorkerClaimedTasks', () => {
  beforeEach(() => mockedGet.mockReset())

  it('loads the task list scoped to the selected tenant and encoded worker code', async () => {
    mockedGet.mockResolvedValue([])

    await expect(listWorkerClaimedTasks('worker/blue', 'tenant-a')).resolves.toEqual([])
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/workers/worker%2Fblue/claimed-tasks',
      { tenantId: 'tenant-a' },
    )
  })
})
