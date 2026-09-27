import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

import { patch } from '@/api/client'
import { governanceApi } from '@/api/governance'
import { togglePipelineDefinition } from '@/api/system'

const mockedPatch = vi.mocked(patch)

describe('enabled state API', () => {
  beforeEach(() => {
    mockedPatch.mockReset()
    mockedPatch.mockResolvedValue(undefined)
  })

  it.each([
    ['resource queue', governanceApi.toggleQueue, '/api/console/queues/11/enabled'],
    ['batch window', governanceApi.toggleBatchWindow, '/api/console/batch-windows/11/enabled'],
    ['calendar', governanceApi.toggleCalendar, '/api/console/calendars/11/enabled'],
    ['quota policy', governanceApi.toggleQuotaPolicy, '/api/console/quota-policies/11/enabled'],
    ['alert routing', governanceApi.toggleAlertRouting, '/api/console/alert-routings/11/enabled'],
    [
      'pipeline definition',
      togglePipelineDefinition,
      '/api/console/pipeline-definitions/11/enabled',
    ],
  ])('sets %s with explicit PATCH body', async (_name, setEnabled, path) => {
    await setEnabled(11, 'ta', false)

    expect(mockedPatch).toHaveBeenCalledWith(path, { tenantId: 'ta', enabled: false })
  })
})
