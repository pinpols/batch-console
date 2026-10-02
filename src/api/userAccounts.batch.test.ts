import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, get, post } from './client'
import {
  applyUserBatch,
  downloadUserBatchTemplate,
  findUserBatchOperation,
  patchUserBatch,
  previewUserBatch,
} from './userAccounts'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn() },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

describe('bulk account provisioning API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads the XLSX template as a blob', async () => {
    const blob = new Blob(['xlsx'])
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob })
    expect(await downloadUserBatchTemplate()).toBe(blob)
    expect(apiClient.get).toHaveBeenCalledWith('/api/console/users/batch/template', {
      responseType: 'blob',
    })
  })

  it('uploads a file without serializing it as JSON', async () => {
    const file = new File(['xlsx'], 'accounts.xlsx')
    await previewUserBatch(file)
    const body = vi.mocked(post).mock.calls[0]?.[1]
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
  })

  it('uses preview version and stable request id for apply and recovery', async () => {
    const row = {
      rowNo: 2,
      tenantId: 'ta',
      username: 'alice',
      displayName: 'Alice',
      role: 'ROLE_TENANT_USER' as const,
    }
    await patchUserBatch('token', 2, row)
    expect(post).toHaveBeenCalledWith('/api/console/users/batch/preview/token/patch', {
      version: 2,
      row,
    })

    await applyUserBatch('token', 3, 'request-1')
    expect(post).toHaveBeenCalledWith(
      '/api/console/users/batch/apply/token',
      { version: 3, requestId: 'request-1' },
      { headers: { 'Idempotency-Key': 'request-1' }, timeout: 60_000 },
    )
    await findUserBatchOperation('request-1')
    expect(get).toHaveBeenCalledWith('/api/console/users/batch/operations', {
      requestId: 'request-1',
    })
  })
})
