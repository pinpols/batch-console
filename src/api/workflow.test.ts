import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('./adapters', () => ({ fetchAllPageItems: vi.fn() }))

import { get } from './client'
import { workflowApi } from './workflow'

const mockedGet = vi.mocked(get)

describe('workflowApi', () => {
  beforeEach(() => mockedGet.mockReset())

  it('lists definitions with backend filters and pagination', async () => {
    mockedGet.mockResolvedValue({ items: [{ id: 7 }], total: 21 })

    const result = await workflowApi.listDefinitions({
      tenantId: 'ta',
      workflowCode: 'daily',
      workflowName: 'Daily',
      workflowType: 'DAG',
      enabled: false,
      version: 2,
      page: 2,
      pageSize: 15,
    })

    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/workflow-definitions', {
      tenantId: 'ta',
      pageNo: 2,
      pageSize: 15,
      workflowCode: 'daily',
      workflowName: 'Daily',
      workflowType: 'DAG',
      enabled: false,
      version: 2,
    })
    expect(result).toEqual({ records: [{ id: 7 }], total: 21, page: 2, pageSize: 15 })
  })
})
