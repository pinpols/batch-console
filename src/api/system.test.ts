import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./adapters', () => ({ fetchAllPageItems: vi.fn() }))

import { post } from './client'
import { previewFileTemplateName } from './system'

const mockedPost = vi.mocked(post)

describe('previewFileTemplateName', () => {
  beforeEach(() => mockedPost.mockReset())

  it('uses the backend naming preview endpoint', async () => {
    mockedPost.mockResolvedValue({ fileName: 'PAYMENT_20260927_001.csv' })
    const body = {
      tenantId: 'tenant-a',
      namingRule: '${bizType}_${bizDate}_${batchNo}',
      fileFormatType: 'DELIMITED',
      bizType: 'PAYMENT',
      bizDate: '2026-09-27',
      batchNo: '001',
    }

    await expect(previewFileTemplateName(body)).resolves.toEqual({
      fileName: 'PAYMENT_20260927_001.csv',
    })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/file-templates/naming-preview', body)
  })
})
