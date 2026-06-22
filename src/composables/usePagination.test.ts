import { describe, expect, it } from 'vitest'
import { usePagination } from './usePagination'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'

describe('usePagination', () => {
  it('uses the project default page size', () => {
    const pager = usePagination()

    expect(pager.pageSize.value).toBe(DEFAULT_PAGE_SIZE)
    expect(pager.apiParams.value).toEqual({ pageNo: 1, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('allows callers to override page size explicitly', () => {
    const pager = usePagination({ pageSize: 30 })

    expect(pager.pageSize.value).toBe(30)
    expect(pager.apiParams.value).toEqual({ pageNo: 1, pageSize: 30 })
  })
})
