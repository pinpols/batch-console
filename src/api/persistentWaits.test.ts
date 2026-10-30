import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn() }))

import { get } from '@/api/client'
import { listPersistentWaits } from './persistentWaits'

describe('persistent wait API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests a tenant-scoped, filtered page without exposing launch payloads', async () => {
    await listPersistentWaits({
      tenantId: 'tenant-a',
      waitType: 'CAPACITY_ADMISSION',
      waitStatus: 'WAITING',
      workflowDefinitionId: 42,
      bizDateFrom: '2026-10-01',
      bizDateTo: '2026-10-25',
      pageNo: 2,
      pageSize: 30,
    })

    expect(get).toHaveBeenCalledWith('/api/console/ops/persistent-waits', {
      tenantId: 'tenant-a',
      waitType: 'CAPACITY_ADMISSION',
      waitStatus: 'WAITING',
      workflowDefinitionId: 42,
      bizDateFrom: '2026-10-01',
      bizDateTo: '2026-10-25',
      pageNo: 2,
      pageSize: 30,
    })
  })
})
