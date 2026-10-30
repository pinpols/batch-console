import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn() }))

import { get, post } from '@/api/client'
import { atomicTaskConfigsApi, type AtomicTaskConfig } from '@/api/atomicTaskConfigs'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

describe('atomicTaskConfigsApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('lists saved configurations for the selected tenant and executor type', async () => {
    const config = {
      id: 9,
      tenantId: 'tenant-a',
      taskType: 'sql',
      name: 'daily settlement',
      parameters: '{"sql":"select 1"}',
      createdBy: 'operator',
      createdAt: '2026-10-25T00:00:00Z',
      updatedAt: '2026-10-25T00:00:00Z',
    } satisfies AtomicTaskConfig
    mockedGet.mockResolvedValue([config])

    await expect(atomicTaskConfigsApi.list('tenant-a', 'sql')).resolves.toEqual([config])
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ops/atomic-task-configs', {
      tenantId: 'tenant-a',
      taskType: 'sql',
    })
  })

  it('creates a schema-backed configuration with explicit tenant scope', async () => {
    const request = {
      tenantId: 'tenant-a',
      taskType: 'sql',
      name: 'daily settlement',
      parameters: { sql: 'select 1' },
    }
    const created = { ...request, id: 10, parameters: JSON.stringify(request.parameters) }
    mockedPost.mockResolvedValue(created)

    await expect(atomicTaskConfigsApi.create(request)).resolves.toEqual(created)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/ops/atomic-task-configs', request)
  })
})
