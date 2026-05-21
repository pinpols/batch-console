import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listTriggers,
  registerTrigger,
  unregisterTrigger,
  pauseTrigger,
  resumeTrigger,
} from './triggers'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

import { get, post } from './client'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

describe('triggersApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('listTriggers GET with tenantId query', async () => {
    mockedGet.mockResolvedValue({ items: [] })
    await listTriggers('ta')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ops/triggers', { tenantId: 'ta' })
  })

  it('registerTrigger POST with encoded jobCode + tenantId in params', async () => {
    mockedPost.mockResolvedValue('ok')
    await registerTrigger('job/01', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/job%2F01/register',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })

  it('unregisterTrigger POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await unregisterTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/JOB_A/unregister',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })

  it('pauseTrigger POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await pauseTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/ops/triggers/JOB_A/pause', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('resumeTrigger POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await resumeTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/ops/triggers/JOB_A/resume', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('jobCode with special chars (#, space) is URL-encoded for path safety', async () => {
    mockedPost.mockResolvedValue('ok')
    await registerTrigger('JOB A#1', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/JOB%20A%231/register',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })
})
