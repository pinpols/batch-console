import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import {
  tenantPackageApply,
  tenantPackageDownloadSampleTemplate,
  tenantPackageDownloadTemplate,
  tenantPackagePatchRow,
  refreshTenantPackagePreviewOnConflict,
} from './tenantPackageExcel'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn() },
  get: vi.fn(),
  post: vi.fn(),
}))

describe('tenant package scenario template download', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('rejects an empty scenario selection instead of silently downloading ALL', async () => {
    await expect(tenantPackageDownloadSampleTemplate([])).rejects.toThrow(
      'Select at least one configuration scenario',
    )
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('sends only explicitly selected scenarios', async () => {
    const workbook = new Blob(['xlsx'])
    vi.mocked(apiClient.get).mockResolvedValue({ data: workbook })

    await expect(tenantPackageDownloadSampleTemplate(['IMPORT', 'EXPORT'])).resolves.toBe(workbook)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/console/config/tenant-package/excel/sample-template',
      expect.objectContaining({
        params: new URLSearchParams('scenarios=IMPORT&scenarios=EXPORT'),
        responseType: 'blob',
      }),
    )
  })

  it('downloads the blank focused template for the selected scenarios', async () => {
    const workbook = new Blob(['xlsx'])
    vi.mocked(apiClient.get).mockResolvedValue({ data: workbook })

    await expect(tenantPackageDownloadTemplate(['IMPORT', 'SCHEDULE'])).resolves.toBe(workbook)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/console/config/tenant-package/excel/scenario-template',
      expect.objectContaining({
        params: new URLSearchParams('scenarios=IMPORT&scenarios=SCHEDULE'),
        responseType: 'blob',
      }),
    )
  })

  it('preserves selected direction and file format scenario codes', async () => {
    const workbook = new Blob(['xlsx'])
    vi.mocked(apiClient.get).mockResolvedValue({ data: workbook })

    await expect(tenantPackageDownloadTemplate(['IMPORT_EXCEL', 'EXPORT_FIXED_WIDTH']))
      .resolves.toBe(workbook)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/console/config/tenant-package/excel/scenario-template',
      expect.objectContaining({
        params: new URLSearchParams(
          'scenarios=IMPORT_EXCEL&scenarios=EXPORT_FIXED_WIDTH',
        ),
        responseType: 'blob',
      }),
    )
  })
})

describe('tenant package apply confirmation', () => {
  it('refreshes the preview after a state conflict', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)

    await expect(
      refreshTenantPackagePreviewOnConflict(
        { response: { status: 409, data: { code: 'STATE_CONFLICT' } } },
        refresh,
      ),
    ).resolves.toBe('refreshed')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not refresh for unrelated errors and reports refresh failure', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('preview unavailable'))
    await expect(
      refreshTenantPackagePreviewOnConflict(
        { response: { status: 409, data: { code: 'STATE_CONFLICT' } } },
        refresh,
      ),
    ).resolves.toBe('refresh-failed')
    await expect(
      refreshTenantPackagePreviewOnConflict(new Error('network failure'), refresh),
    ).resolves.toBe('not-conflict')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('sends the preview token required by the backend contract', async () => {
    const { post } = await import('@/api/client')
    vi.mocked(post).mockResolvedValue({ uploadToken: 'upload-1' })

    await tenantPackageApply('upload-1', { previewToken: 'preview-1' })

    expect(post).toHaveBeenCalledWith(
      '/api/console/config/tenant-package/excel/apply/upload-1',
      { previewToken: 'preview-1' },
    )
  })

  it('sends the current preview token when patching a row', async () => {
    const { post } = await import('@/api/client')
    vi.mocked(post).mockResolvedValue({ previewToken: 'preview-2' })

    await tenantPackagePatchRow('upload-1', {
      previewToken: 'preview-1',
      sheetName: 'job_definition',
      rowNo: 2,
      values: { job_name: 'daily-import' },
    })

    expect(post).toHaveBeenCalledWith(
      '/api/console/config/tenant-package/excel/preview/upload-1/patch',
      {
        previewToken: 'preview-1',
        sheetName: 'job_definition',
        rowNo: 2,
        values: { job_name: 'daily-import' },
      },
    )
  })
})
