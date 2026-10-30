import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn() }, post: vi.fn() }))

import { apiClient, post } from '@/api/client'
import { downloadForensicExport, requestForensicExport } from '@/api/forensic'

const mockedPost = vi.mocked(post)
const mockedGet = vi.mocked(apiClient.get)

describe('forensic export API', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
  })

  it('submits an explicitly keyed export request', async () => {
    const request = {
      tenantId: 'tenant-a',
      bizDateFrom: '2026-10-01',
      bizDateTo: '2026-10-02',
      exportFormat: 'BUNDLE' as const,
    }
    const response = { exportId: 'export-1', status: 'COMPLETED' }
    mockedPost.mockResolvedValue(response)

    await expect(requestForensicExport(request, 'request-key')).resolves.toEqual(response)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/forensic/export', request, {
      headers: { 'Idempotency-Key': 'request-key' },
      timeout: 120_000,
    })
  })

  it('downloads by export id and explicit tenant scope as a blob', async () => {
    const response = { data: new Blob(['bundle']) }
    mockedGet.mockResolvedValue(response)

    await expect(downloadForensicExport('export/1', 'tenant-a')).resolves.toEqual(response)
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/forensic/export/export%2F1/download',
      { params: { tenantId: 'tenant-a' }, responseType: 'blob', timeout: 120_000 },
    )
  })
})
