import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { put: vi.fn() },
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}))
vi.mock('@/api/adapters', () => ({ fetchAllPageItems: vi.fn() }))
vi.mock('@/api/interceptors', () => ({ readStoredTenantId: vi.fn(() => 'tenant-a') }))

import { apiClient, get, post } from '@/api/client'
import { fileApi } from '@/api/file'

const mockedPost = vi.mocked(post)
const mockedGet = vi.mocked(get)
const mockedPut = vi.mocked(apiClient.put)

describe('file upload API', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
    mockedPut.mockReset()
  })

  it('lists only configured manual upload targets for the selected tenant', async () => {
    const targets = [
      {
        tenantId: 'tenant-a',
        calendarCode: 'BUSINESS_DAY',
        workflowDefinitionId: 18,
        workflowCode: 'FILE_IMPORT',
        workflowName: 'File import',
        fileGroupCode: 'DAILY_INPUT',
      },
    ]
    mockedGet.mockResolvedValue(targets)

    await expect(fileApi.listManualUploadTargets('tenant-a')).resolves.toEqual(targets)
    expect(mockedGet).toHaveBeenCalledWith('/api/console/files/manual-upload-targets', {
      tenantId: 'tenant-a',
    })
  })

  it('sends a tenant-scoped bundle binding when creating a grouped upload session', async () => {
    const response = {
      fileId: 9,
      status: 'RECEIVED',
      uploadMode: 'APP_MANAGED',
      uploadMethod: 'PUT',
      contentField: 'file',
      uploadUrl: '/api/console/files/9/content?tenantId=tenant-a',
      storageBucket: 'private-bucket',
      storagePath: 'private/path',
      fileName: 'orders.csv',
    }
    const binding = {
      calendarCode: 'BUSINESS_DAY',
      workflowDefinitionId: 18,
      fileGroupCode: 'DAILY_INPUT',
      bizDate: '2026-10-26',
      requiredFileNames: ['orders.csv', 'customers.csv'],
      bundleTemplateCode: 'ORDERS_TEMPLATE',
    }
    mockedPost.mockResolvedValue(response)

    await expect(
      fileApi.presignUpload('tenant-a', 'inbound', 'orders.csv', 'group-session-key', binding),
    ).resolves.toEqual(response)
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/files/presign-upload',
      binding,
      {
        params: { tenantId: 'tenant-a', channelCode: 'inbound', fileName: 'orders.csv' },
        headers: { 'Idempotency-Key': 'group-session-key' },
      },
    )
  })

  it('creates an upload session with tenant, channel, filename, and an idempotency key', async () => {
    const response = {
      fileId: 8,
      status: 'RECEIVED',
      uploadMode: 'APP_MANAGED',
      uploadMethod: 'PUT',
      contentField: 'file',
      uploadUrl: '/api/console/files/8/content?tenantId=tenant-a',
      storageBucket: 'private-bucket',
      storagePath: 'private/path',
      fileName: 'input.csv',
    }
    mockedPost.mockResolvedValue(response)

    await expect(
      fileApi.presignUpload('tenant-a', 'inbound', 'input.csv', 'session-key'),
    ).resolves.toEqual(response)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/files/presign-upload', undefined, {
      params: { tenantId: 'tenant-a', channelCode: 'inbound', fileName: 'input.csv' },
      headers: { 'Idempotency-Key': 'session-key' },
    })
  })

  it('uploads multipart content to the application-managed endpoint', async () => {
    const file = new File(['content'], 'input.csv', { type: 'text/csv' })
    mockedPut.mockResolvedValue({ data: { status: 'UPLOADED' } })

    await expect(fileApi.uploadContent(8, 'tenant-a', file, 'content-key')).resolves.toEqual({
      status: 'UPLOADED',
    })
    const [path, body, config] = mockedPut.mock.calls[0]
    expect(path).toBe('/api/console/files/8/content')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
    expect(config).toMatchObject({
      params: { tenantId: 'tenant-a' },
      headers: { 'Idempotency-Key': 'content-key' },
      timeout: 120_000,
    })
  })

  it('confirms arrival with a separate idempotency key', async () => {
    mockedPost.mockResolvedValue({ status: 'CONFIRMED' })

    await expect(fileApi.confirmFileArrival(8, 'tenant-a', 'arrival-key')).resolves.toEqual({
      status: 'CONFIRMED',
    })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/files/8/confirm-arrival', undefined, {
      params: { tenantId: 'tenant-a' },
      headers: { 'Idempotency-Key': 'arrival-key' },
    })
  })
})
