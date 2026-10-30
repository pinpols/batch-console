import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))

import { del, get, post } from '@/api/client'
import {
  bindConsoleOidcIdentity,
  getConsoleOidcProvider,
  listConsoleOidcIdentities,
  unbindConsoleOidcIdentity,
} from '@/api/oidc'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)
const mockedDelete = vi.mocked(del)

describe('getConsoleOidcProvider', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedDelete.mockReset()
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

  it('lists identity bindings within the explicitly selected tenant', async () => {
    mockedGet.mockResolvedValue([])

    await expect(listConsoleOidcIdentities('tenant-a')).resolves.toEqual([])
    expect(mockedGet).toHaveBeenCalledWith('/api/console/auth/oidc/identities', {
      tenantId: 'tenant-a',
    })
  })

  it('binds the exact username and subject with tenant scope in query parameters', async () => {
    const identity = {
      id: 4,
      tenantId: 'tenant-a',
      accountId: 8,
      username: 'operator',
      issuer: 'https://issuer.example',
      subject: 'stable-subject-1',
      linkedBy: 'admin',
      linkedAt: '2026-10-26T00:00:00Z',
    }
    const request = { username: 'operator', subject: 'stable-subject-1' }
    mockedPost.mockResolvedValue(identity)

    await expect(bindConsoleOidcIdentity('tenant-a', request)).resolves.toEqual(identity)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/auth/oidc/identities', request, {
      params: { tenantId: 'tenant-a' },
    })
  })

  it('unbinds only the selected identity inside the selected tenant', async () => {
    mockedDelete.mockResolvedValue(undefined)

    await expect(unbindConsoleOidcIdentity('tenant-a', 4)).resolves.toBeUndefined()
    expect(mockedDelete).toHaveBeenCalledWith('/api/console/auth/oidc/identities/4', {
      params: { tenantId: 'tenant-a' },
    })
  })
})
