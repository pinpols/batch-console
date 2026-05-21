import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  batchCreateTenants,
  suspendTenant,
  activateTenant,
} from './tenants'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

import { get, post, put } from './client'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)
const mockedPut = vi.mocked(put)

describe('tenantsApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedPut.mockReset()
  })

  it('listTenants GET with empty query default', async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0, pageNo: 1, pageSize: 20 })
    await listTenants()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/tenants', {})
  })

  it('listTenants GET passes query filters', async () => {
    mockedGet.mockResolvedValue({ items: [], total: 0, pageNo: 1, pageSize: 20 })
    await listTenants({ keyword: 'x', status: 'ACTIVE', pageNo: 2, pageSize: 50 })
    expect(mockedGet).toHaveBeenCalledWith('/api/console/tenants', {
      keyword: 'x',
      status: 'ACTIVE',
      pageNo: 2,
      pageSize: 50,
    })
  })

  it('getTenant GET encodes tenantId', async () => {
    mockedGet.mockResolvedValue({})
    await getTenant('te/na nt')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/tenants/te%2Fna%20nt')
  })

  it('createTenant POST with body', async () => {
    mockedPost.mockResolvedValue({})
    const body = {
      tenantId: 'ta',
      tenantName: 'A',
      username: 'op-a',
      password: 'Strong!Pass123',
    }
    await createTenant(body)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/tenants', body)
  })

  it('updateTenant PUT with encoded id + body', async () => {
    mockedPut.mockResolvedValue({})
    await updateTenant('ta', { tenantName: 'New' })
    expect(mockedPut).toHaveBeenCalledWith('/api/console/tenants/ta', { tenantName: 'New' })
  })

  it('batchCreateTenants POST with batch body', async () => {
    mockedPost.mockResolvedValue({})
    const body = {
      tenants: [{ tenantId: 't1', tenantName: 'T1' }],
      password: 'BulkPass!123',
      initConfigFrom: 'default-tenant',
      initMode: 'UPSERT' as const,
    }
    await batchCreateTenants(body)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/tenants/batch', body)
  })

  it('suspendTenant POST encoded id, no body', async () => {
    mockedPost.mockResolvedValue({})
    await suspendTenant('ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/tenants/ta/suspend')
  })

  it('activateTenant POST encoded id, no body', async () => {
    mockedPost.mockResolvedValue({})
    await activateTenant('ta')
    expect(mockedPost).toHaveBeenCalledWith('/api/console/tenants/ta/activate')
  })
})
