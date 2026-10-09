import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn() }))

import { get } from '@/api/client'
import { getConsoleOidcProvider } from '@/api/oidc'

const mockedGet = vi.mocked(get)

describe('getConsoleOidcProvider', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('reads the server-controlled pilot registration', async () => {
    mockedGet.mockResolvedValue({ enabled: true, registrationId: 'pilot-tenant' })

    await expect(getConsoleOidcProvider()).resolves.toEqual({
      enabled: true,
      registrationId: 'pilot-tenant',
    })
    expect(mockedGet).toHaveBeenCalledWith('/api/console/auth/oidc/provider')
  })

  it('fails closed when the provider response has no data', async () => {
    mockedGet.mockResolvedValue(null)

    await expect(getConsoleOidcProvider()).resolves.toEqual({ enabled: false })
  })
})
