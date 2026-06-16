import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listMyWorkers, countMyWorkers } from './myWorkers'

vi.mock('./client', () => ({
  get: vi.fn(),
}))

import { get } from './client'

const mockedGet = vi.mocked(get)

describe('myWorkersApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('listMyWorkers GET with tenantId as query params', async () => {
    mockedGet.mockResolvedValue([])
    await listMyWorkers('acme')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/my-workers', { tenantId: 'acme' })
  })

  it('countMyWorkers GET with tenantId as query params', async () => {
    mockedGet.mockResolvedValue(0)
    await countMyWorkers('acme')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/my-workers/count', { tenantId: 'acme' })
  })
})
