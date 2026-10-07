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

  it('listTriggers GET uses the authenticated tenant scope', async () => {
    mockedGet.mockResolvedValue([])
    await listTriggers()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ops/triggers')
  })

  it('registerTrigger POST with encoded jobCode + tenantId in params', async () => {
    mockedPost.mockResolvedValue({ tenantId: 'ta', jobCode: 'JOB_A', status: 'REGISTERED' })
    await registerTrigger('job/01', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/job%2F01/register',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })

  it('unregisterTrigger POST', async () => {
    mockedPost.mockResolvedValue({ tenantId: 'ta', jobCode: 'JOB_A', status: 'REGISTERED' })
    await unregisterTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/JOB_A/unregister',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })

  it('pauseTrigger POST', async () => {
    mockedPost.mockResolvedValue({ tenantId: 'ta', jobCode: 'JOB_A', status: 'REGISTERED' })
    await pauseTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/ops/triggers/JOB_A/pause', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('resumeTrigger POST', async () => {
    mockedPost.mockResolvedValue({ tenantId: 'ta', jobCode: 'JOB_A', status: 'REGISTERED' })
    await resumeTrigger('JOB_A', 'ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/ops/triggers/JOB_A/resume', undefined, {
      params: { tenantId: 'ta' },
    })
  })

  it('jobCode with special chars (#, space) is URL-encoded for path safety', async () => {
    mockedPost.mockResolvedValue({ tenantId: 'ta', jobCode: 'JOB_A', status: 'REGISTERED' })
    await registerTrigger('JOB A#1', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/triggers/JOB%20A%231/register',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })
})
