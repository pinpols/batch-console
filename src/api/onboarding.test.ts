import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/ops', () => ({ getOpsSummary: vi.fn() }))
vi.mock('@/api/job', () => ({ jobApi: { listDefinitionsPaged: vi.fn() } }))
vi.mock('@/api/instance', () => ({ instanceApi: { list: vi.fn() } }))
vi.mock('@/api/tenants', () => ({ getTenantReadiness: vi.fn() }))

import { getOpsSummary } from '@/api/ops'
import { jobApi } from '@/api/job'
import { instanceApi } from '@/api/instance'
import { getTenantReadiness } from '@/api/tenants'
import { getOnboardingEvidence } from './onboarding'

const mockedSummary = vi.mocked(getOpsSummary)
const mockedDefinitions = vi.mocked(jobApi.listDefinitionsPaged)
const mockedRuns = vi.mocked(instanceApi.list)
const mockedReadiness = vi.mocked(getTenantReadiness)

describe('getOnboardingEvidence', () => {
  beforeEach(() => {
    mockedSummary.mockReset()
    mockedDefinitions.mockReset()
    mockedRuns.mockReset()
    mockedReadiness.mockReset()
    mockedSummary.mockResolvedValue({ onlineWorkers: 2 } as never)
    mockedDefinitions.mockResolvedValue({ records: [], total: 3, page: 1, pageSize: 1 })
    mockedRuns
      .mockResolvedValueOnce({ records: [], total: 4, page: 1, pageSize: 1 })
      .mockResolvedValueOnce({ records: [], total: 1, page: 1, pageSize: 1 })
    mockedReadiness.mockResolvedValue({
      tenantId: 'tenant-a',
      ready: true,
      blocking: [],
      warnings: [],
    })
  })

  it('aggregates authoritative evidence in parallel', async () => {
    await expect(getOnboardingEvidence('tenant-a', { includeReadiness: true })).resolves.toEqual({
      tenantId: 'tenant-a',
      jobDefinitionCount: 3,
      runCount: 4,
      successfulRunCount: 1,
      onlineWorkerCount: 2,
      readiness: { tenantId: 'tenant-a', ready: true, blocking: [], warnings: [] },
      readinessSupported: true,
      failedSources: [],
    })
    expect(mockedDefinitions).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      pageNo: 1,
      pageSize: 1,
    })
    expect(mockedRuns).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-a',
      page: 1,
      pageSize: 1,
    })
    expect(mockedRuns).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-a',
      instanceStatus: 'SUCCESS',
      page: 1,
      pageSize: 1,
    })
  })

  it('does not call the protected readiness endpoint for read-only roles', async () => {
    mockedRuns.mockReset()
    mockedRuns.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 1 })
    const result = await getOnboardingEvidence('tenant-a', { includeReadiness: false })

    expect(mockedReadiness).not.toHaveBeenCalled()
    expect(result.readinessSupported).toBe(false)
  })

  it('keeps partial evidence and identifies failed sources', async () => {
    mockedRuns.mockReset()
    mockedRuns.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 1 })
    mockedDefinitions.mockRejectedValue(new Error('unavailable'))

    const result = await getOnboardingEvidence('tenant-a', { includeReadiness: true })

    expect(result.jobDefinitionCount).toBeNull()
    expect(result.onlineWorkerCount).toBe(2)
    expect(result.failedSources).toEqual(['jobDefinitions'])
  })
})
