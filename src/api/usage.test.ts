import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from './client'
import { queryUsageSummary } from './usage'

vi.mock('./client', () => ({ get: vi.fn() }))

const mockedGet = vi.mocked(get)

describe('queryUsageSummary', () => {
  beforeEach(() => mockedGet.mockReset())

  it('passes tenant, date window and server-side filters unchanged', async () => {
    mockedGet.mockResolvedValue([])
    const query = {
      tenantId: 'ta',
      from: '2026-09-01',
      to: '2026-09-30',
      metricCode: 'operation.job-trigger',
      pageCode: 'ui.page.ops-summary.view',
    }

    await queryUsageSummary(query)

    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/usage-summary', query)
  })
})
