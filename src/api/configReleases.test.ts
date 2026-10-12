import { beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from './client'
import { revokeSecretVersion } from './configReleases'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

describe('configuration secret API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revokes the exact secret version with tenant and audit reason', async () => {
    const body = { tenantId: 'tenant-a', reason: 'Credential was exposed' }

    await revokeSecretVersion(42, body)

    expect(post).toHaveBeenCalledWith('/api/console/config/secrets/42/revoke', body)
  })
})
