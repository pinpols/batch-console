import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import { listWorkerFingerprints, getWorkerFingerprintSummary } from './workerFingerprint'

const mockedGet = vi.mocked(get)

describe('workerFingerprint api', () => {
  beforeEach(() => mockedGet.mockReset())

  it('listWorkerFingerprints passes tenantId when provided', async () => {
    mockedGet.mockResolvedValue([])
    await listWorkerFingerprints('acme-prod')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/workers/fingerprints', {
      tenantId: 'acme-prod',
    })
  })

  it('listWorkerFingerprints omits params when tenantId not provided', async () => {
    mockedGet.mockResolvedValue([])
    await listWorkerFingerprints()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/workers/fingerprints', undefined)
  })

  it('listWorkerFingerprints normalizes null response to empty array', async () => {
    mockedGet.mockResolvedValue(null)
    await expect(listWorkerFingerprints()).resolves.toEqual([])
  })

  it('getWorkerFingerprintSummary hits the summary endpoint with tenantId', async () => {
    mockedGet.mockResolvedValue([])
    await getWorkerFingerprintSummary('acme-prod')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/workers/fingerprints/summary', {
      tenantId: 'acme-prod',
    })
  })

  it('getWorkerFingerprintSummary omits params when tenantId not provided', async () => {
    mockedGet.mockResolvedValue([])
    await getWorkerFingerprintSummary()
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/workers/fingerprints/summary',
      undefined,
    )
  })

  it('getWorkerFingerprintSummary normalizes null response to empty array', async () => {
    mockedGet.mockResolvedValue(null)
    await expect(getWorkerFingerprintSummary()).resolves.toEqual([])
  })
})
