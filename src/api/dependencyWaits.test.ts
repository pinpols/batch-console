import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn() }))

import { get, post } from '@/api/client'
import {
  listCalendarDependencyWaits,
  listJobDependencyWaits,
  requestCalendarDependencyWaitAction,
} from './dependencyWaits'

describe('dependency wait API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes cross-calendar wait reads to the selected tenant and filters', async () => {
    await listCalendarDependencyWaits({
      tenantId: 'tenant-a',
      calendarCode: 'PAYMENTS',
      waitStatus: 'WAITING',
      limit: 200,
    })
    expect(get).toHaveBeenCalledWith('/api/console/calendar-dependency-waits', {
      tenantId: 'tenant-a',
      calendarCode: 'PAYMENTS',
      waitStatus: 'WAITING',
      limit: 200,
    })
  })

  it('scopes upstream job waits and does not add launch parameters', async () => {
    await listJobDependencyWaits({ tenantId: 'tenant-a', jobCode: 'SETTLEMENT', limit: 200 })
    expect(get).toHaveBeenCalledWith('/api/console/job-dependency-waits', {
      tenantId: 'tenant-a',
      jobCode: 'SETTLEMENT',
      limit: 200,
    })
  })

  it('sends an explicit idempotency key for audited calendar actions', async () => {
    const body = {
      tenantId: 'tenant-a',
      calendarCode: 'PAYMENTS',
      bizDate: '2026-10-25',
      action: 'RELEASE' as const,
      reason: 'Upstream close verified',
    }
    await requestCalendarDependencyWaitAction(body, 'action-key')
    expect(post).toHaveBeenCalledWith(
      '/api/console/calendar-dependency-waits/manual-action',
      body,
      { headers: { 'Idempotency-Key': 'action-key' } },
    )
  })
})
