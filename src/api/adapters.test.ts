import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toPageResult, fetchAllPageItems } from './adapters'
import { ElMessage } from 'element-plus'

vi.mock('element-plus', () => ({
  ElMessage: {
    warning: vi.fn(),
  },
}))

// mock the get function from client
vi.mock('./client', () => ({
  get: vi.fn(),
}))

import { get } from './client'

const mockedGet = vi.mocked(get)

describe('toPageResult', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('returns correct slice for page 1', () => {
    const result = toPageResult(items, 1, 3)
    expect(result.records).toEqual([1, 2, 3])
    expect(result.total).toBe(10)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(3)
  })

  it('returns correct slice for page 2', () => {
    const result = toPageResult(items, 2, 3)
    expect(result.records).toEqual([4, 5, 6])
  })

  it('returns partial last page', () => {
    const result = toPageResult(items, 4, 3)
    expect(result.records).toEqual([10])
  })

  it('returns empty records for out-of-bounds page', () => {
    const result = toPageResult(items, 10, 3)
    expect(result.records).toEqual([])
    expect(result.total).toBe(10)
  })

  it('returns all items when pageSize >= total', () => {
    const result = toPageResult(items, 1, 100)
    expect(result.records).toEqual(items)
    expect(result.total).toBe(10)
  })
})

describe('fetchAllPageItems', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    vi.mocked(ElMessage.warning).mockReset()
    vi.unstubAllGlobals()
  })

  it('returns array directly when API returns an array', async () => {
    mockedGet.mockResolvedValueOnce(['a', 'b', 'c'])
    const result = await fetchAllPageItems('/api/items', { tenantId: 't1' })
    expect(result).toEqual(['a', 'b', 'c'])
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('returns all items from single page response', async () => {
    mockedGet.mockResolvedValueOnce({ items: ['a', 'b'], total: 2 })
    const result = await fetchAllPageItems('/api/items', {})
    expect(result).toEqual(['a', 'b'])
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('fetches multiple pages until exhausted', async () => {
    mockedGet
      .mockResolvedValueOnce({ items: [1, 2], total: 5 })
      .mockResolvedValueOnce({ items: [3, 4], total: 5 })
      .mockResolvedValueOnce({ items: [5], total: 5 })
    const result = await fetchAllPageItems('/api/items', {}, { pageSize: 2 })
    expect(result).toEqual([1, 2, 3, 4, 5])
    expect(mockedGet).toHaveBeenCalledTimes(3)
  })

  it('stops when items.length < pageSize', async () => {
    mockedGet
      .mockResolvedValueOnce({ items: [1, 2, 3], total: 6 })
      .mockResolvedValueOnce({ items: [4], total: 6 })
    const result = await fetchAllPageItems('/api/items', {}, { pageSize: 3 })
    expect(result).toEqual([1, 2, 3, 4])
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('respects maxPages limit', async () => {
    mockedGet.mockResolvedValue({ items: ['x', 'x'], total: 1000 })
    const result = await fetchAllPageItems('/api/items', {}, { pageSize: 2, maxPages: 3 })
    expect(result).toHaveLength(6)
    expect(mockedGet).toHaveBeenCalledTimes(3)
  })

  it('does not show truncation warning outside browser environment', async () => {
    mockedGet.mockResolvedValue({ items: ['x', 'x'], total: 1000 })

    await fetchAllPageItems('/api/items-node', {}, { pageSize: 2, maxPages: 3 })

    expect(ElMessage.warning).not.toHaveBeenCalled()
  })

  it('shows truncation warning once in browser environment', async () => {
    vi.stubGlobal('document', {})
    mockedGet.mockResolvedValue({ items: ['x', 'x'], total: 1000 })

    await fetchAllPageItems('/api/items-browser', {}, { pageSize: 2, maxPages: 3 })
    await fetchAllPageItems('/api/items-browser', {}, { pageSize: 2, maxPages: 3 })

    expect(ElMessage.warning).toHaveBeenCalledTimes(1)
  })
})
