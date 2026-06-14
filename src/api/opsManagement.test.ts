import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

import { get, put, del } from './client'
import {
  listShardCatalog,
  upsertShardCatalog,
  deleteShardCatalog,
  listTenantPlacements,
  upsertTenantPlacement,
  deleteTenantPlacement,
  PLACEMENT_KEY_PATTERN,
} from './opsManagement'

const mockedGet = vi.mocked(get)
const mockedPut = vi.mocked(put)
const mockedDel = vi.mocked(del)

describe('opsManagement', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPut.mockReset()
    mockedDel.mockReset()
  })

  it('lists shard catalog', async () => {
    mockedGet.mockResolvedValue([{ placementKey: 'shard-a' }])
    const result = await listShardCatalog()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ops/shard-catalog')
    expect(result).toEqual([{ placementKey: 'shard-a' }])
  })

  it('upserts shard catalog', async () => {
    const body = { placementKey: 'shard-a', host: 'h', port: 5432, dbName: 'd', secretRef: 's' }
    await upsertShardCatalog(body)
    expect(mockedPut).toHaveBeenCalledWith('/api/console/ops/shard-catalog', body)
  })

  it('deletes shard catalog by encoded key', async () => {
    await deleteShardCatalog('shard a')
    expect(mockedDel).toHaveBeenCalledWith('/api/console/ops/shard-catalog/shard%20a')
  })

  it('lists tenant placements', async () => {
    mockedGet.mockResolvedValue([])
    await listTenantPlacements()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ops/tenant-placements')
  })

  it('upserts tenant placement', async () => {
    const body = { tenantId: 'ta', placementKey: 'shard-a' }
    await upsertTenantPlacement(body)
    expect(mockedPut).toHaveBeenCalledWith('/api/console/ops/tenant-placements', body)
  })

  it('deletes tenant placement by encoded tenantId', async () => {
    await deleteTenantPlacement('ta/x')
    expect(mockedDel).toHaveBeenCalledWith('/api/console/ops/tenant-placements/ta%2Fx')
  })

  it('placement key pattern accepts lowercase/digit/hyphen and rejects others', () => {
    expect(PLACEMENT_KEY_PATTERN.test('shard-a1')).toBe(true)
    expect(PLACEMENT_KEY_PATTERN.test('Shard_A')).toBe(false)
    expect(PLACEMENT_KEY_PATTERN.test('shard a')).toBe(false)
  })
})
